import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'
import {
    extractSignatureLinks,
    createTrackedLinksForProspect,
    buildTrackedSignatureHtml
} from '@/lib/email-link-tracker'

// Schema pour valider le payload
const generateEmailSchema = z.object({
    campaignId: z.string().uuid(),
    prospectIds: z.array(z.union([z.string(), z.number()])).min(1),
    agent_instructions: z.string().optional(), // OVERRIDE for Playground
    step: z.number().optional().default(1) // Step sequence
})

/**
 * POST /api/cold-email/generate
 * 
 * Déclenche la génération de Cold Emails via Webhook N8N.
 * 
 * Process:
 * 1. Auth Check
 * 2. Payload Validation
 * 3. Quota Check (Optional - Soft limit for now)
 * 4. Job Creation (cold_email_jobs)
 * 5. Campaign-Prospect Links Upsert (campaign_prospect_links)
 * 6. Webhook Trigger (N8N)
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()
    let userId: string | undefined = undefined

    try {
        // 1. Validations
        const body = await request.json()
        const validated = generateEmailSchema.parse(body)

        const supabase = await createClient()

        const authHeader = request.headers.get('authorization');
        const isInternalCron = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

        if (isInternalCron) {
            const { data: campaign } = await supabase
                .from('cold_email_campaigns')
                .select('user_id')
                .eq('id', validated.campaignId)
                .single()
            if (campaign) userId = campaign.user_id
        } else {
            const { data: { user }, error: authError } = await supabase.auth.getUser()

            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }

            userId = user.id
        }

        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 400 })
        }

        // FETCH INSTRUCTIONS if not overridden
        let finalInstructions = validated.agent_instructions
        if (!finalInstructions) {
            // Check step specific instructions first
            const { data: stepInfo } = await supabase
                .from('campaign_steps')
                .select('agent_instructions')
                .eq('campaign_id', validated.campaignId)
                .eq('step_order', validated.step)
                .single()

            if (stepInfo?.agent_instructions) {
                finalInstructions = stepInfo.agent_instructions
            } else {
                // Fallback to campaign level instructions
                const { data: campaign } = await supabase
                    .from('cold_email_campaigns')
                    .select('agent_instructions')
                    .eq('id', validated.campaignId)
                    .single()

                if (campaign?.agent_instructions) {
                    finalInstructions = campaign.agent_instructions
                }
            }
        }

        logInfo('Cold Email generation requested', {
            userId,
            campaignId: validated.campaignId,
            prospectCount: validated.prospectIds.length,
            step: validated.step,
            hasInstructions: !!finalInstructions
        })

        // Webhook URL (Environment or Hardcoded Fallback)
        const HARDCODED_URL = "https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_generateur_cold_mail"
        const webhookUrl = process.env.N8N_WEBHOOK_COLD_EMAIL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL || HARDCODED_URL

        if (!webhookUrl) {
            throw new Error('Webhook URL not configured')
        }

        // 2. Vérification Quotas (Lecture seule pour l'instant)
        const { data: quota, error: quotaError } = await supabase
            .from('quotas')
            .select('cold_emails_used, cold_emails_limit')
            .eq('user_id', userId)
            .single()

        // Note: On ne bloque pas strictement ici si pas de quota trouvé pour éviter de bloquer l'UX 
        // si la migration n'est pas parfaite, mais on loggue l'info.
        // N8N gérera la décrémentation réelle ou le blocage si nécessaire.
        if (quota) {
            // Basic check capable logic could go here
        }

        // 3. Création du Job (Tracking)
        const { data: job, error: jobError } = await supabase
            .from('cold_email_jobs')
            .insert({
                user_id: userId,
                campaign_id: validated.campaignId,
                prospect_ids: validated.prospectIds, // Stocké en jsonb
                status: 'pending',
                started_at: new Date().toISOString()
            })
            .select()
            .single()

        if (jobError || !job) {
            console.error('❌ Failed to create cold email job:', jobError)
            throw new Error('Failed to create tracking job')
        }

        // 4. Initialisation des liens Prospect-Campagne
        const linksToUpsert = validated.prospectIds.map(prospectId => ({
            campaign_id: validated.campaignId,
            prospect_id: prospectId, // Table campaign_prospects utilise prospect_id
            email_status: 'pending', // Status initial pour déclencher le polling UI
            updated_at: new Date().toISOString()
        }))

        const { error: linksError } = await supabase
            .from('campaign_prospects')
            .upsert(linksToUpsert, {
                onConflict: 'campaign_id,prospect_id',
                ignoreDuplicates: false
            })

        if (linksError) {
            // On loggue mais on ne bloque pas tout le process, N8N pourra gérer ou retry
            console.error('⚠️ Warning: Failed to upsert campaign links:', linksError)
        }

        // 5. Mise à jour du Quota (Incrémentation)
        if (quota) {
            const { error: usageError } = await supabase
                .from('quotas')
                .update({
                    cold_emails_used: (quota.cold_emails_used || 0) + validated.prospectIds.length
                })
                .eq('user_id', userId)

            if (usageError) {
                console.error('❌ Failed to update quota usage:', usageError)
            } else {
                console.log(`✅ Quota updated: +${validated.prospectIds.length} used`)
            }
        }

        // 5. Fetch enriched prospect data to pass to n8n
        const { data: prospects } = await supabase
            .from('scrape_prospect')
            .select('*')
            .in('id', validated.prospectIds)

        // ── STEP 4.5: Génération des liens de tracking pour chaque prospect ──────
        // Charger les données de signature de la campagne
        const { data: campaignForSig } = await supabase
            .from('cold_email_campaigns')
            .select(`
                id, my_website,
                signature_name, signature_title, signature_company,
                signature_phone, signature_email, signature_ps,
                signature_show_phone, signature_show_email, signature_show_website,
                signature_website_text, signature_custom_link_url, signature_custom_link_text,
                signature_elements_order
            `)
            .eq('id', validated.campaignId)
            .single()

        // Map prospectId → tracked links + signature HTML
        const prospectTrackingData: Record<string, {
            tracked_links: Array<{ type: string; label: string; original_url: string; tracking_url: string; short_code: string }>
            signature_tracked_html: string
        }> = {}

        if (campaignForSig) {
            const signatureLinks = extractSignatureLinks(campaignForSig)

            if (signatureLinks.length > 0) {
                for (const prospectId of validated.prospectIds) {
                    try {
                        const pId = Number(prospectId)

                        // Supprimer les anciens liens trackés pour ce prospect/campagne
                        await supabase
                            .from('email_tracked_links')
                            .delete()
                            .eq('campaign_id', validated.campaignId)
                            .eq('prospect_id', pId)

                        // Créer les nouveaux liens trackés
                        const trackedLinks = await createTrackedLinksForProspect(
                            validated.campaignId,
                            pId,
                            signatureLinks
                        )

                        // Construire le HTML de signature avec liens trackés
                        const signatureTrackedHtml = buildTrackedSignatureHtml(campaignForSig, trackedLinks)

                        // Mettre à jour campaign_prospects avec la signature trackée
                        await supabase
                            .from('campaign_prospects')
                            .update({
                                signature_tracked_html: signatureTrackedHtml,
                                links_click_count: 0,
                                updated_at: new Date().toISOString()
                            })
                            .eq('campaign_id', validated.campaignId)
                            .eq('prospect_id', pId)

                        // Sauvegarder pour le payload N8N
                        prospectTrackingData[String(prospectId)] = {
                            tracked_links: trackedLinks.map(tl => ({
                                type: tl.link_type,
                                label: tl.link_label,
                                original_url: tl.original_url,
                                tracking_url: tl.tracking_url,
                                short_code: tl.short_code
                            })),
                            signature_tracked_html: signatureTrackedHtml
                        }
                    } catch (trackErr: any) {
                        console.error(`[Generate] Tracking links failed for prospect ${prospectId}:`, trackErr.message)
                    }
                }
            }
        }

        // 6. Payload Webhook N8N
        const webhookPayload = {
            user_id: userId,
            job_id: job.id,
            campaign_id: validated.campaignId,
            prospect_ids: validated.prospectIds,
            prospects_data: prospects || [], // Enriched context for the AI prompt
            step: validated.step,
            agent_instructions: finalInstructions,
            // ── Données de tracking ──
            // Pour chaque prospect, N8N doit utiliser signature_tracked_html
            // (qui contient déjà les liens avec shortcodes de tracking)
            // ou utiliser tracked_links pour construire sa propre signature
            prospect_tracking: prospectTrackingData,
            // Format des URLs de tracking : https://saas-prospection.vercel.app/api/track/[short_code]
            // Remplace les URLs brutes (tel:, mailto:, https://) par ces URLs dans la signature
        }

        // 6. Appel Webhook (avec Timeout)
        console.log(`📤 [Cold Email] Calling webhook: ${webhookUrl}`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s max

        try {
            const webhookResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'NeuraFlow/1.0'
                },
                body: JSON.stringify(webhookPayload),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text()
                throw new Error(`Webhook returned ${webhookResponse.status}: ${errorText}`)
            }

            console.log(`✅ [Cold Email] Webhook triggered successfully`)

            // Update Job status to 'running' implies webhook received it
            await supabase
                .from('cold_email_jobs')
                .update({ status: 'running' })
                .eq('id', job.id)

            return NextResponse.json({
                success: true,
                jobId: job.id,
                prospectCount: validated.prospectIds.length
            })

        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            console.error('❌ Webhook call failed:', fetchError)

            // Mark job as failed
            await supabase
                .from('cold_email_jobs')
                .update({
                    status: 'failed',
                    error_message: fetchError.message
                })
                .eq('id', job.id)

            throw fetchError
        }

    } catch (error: any) {
        logError('Cold email generation check failed', error, { userId })

        // Zod validation error
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid payload', details: (error as any).errors }, { status: 400 })
        }

        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
