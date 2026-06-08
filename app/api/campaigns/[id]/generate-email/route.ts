import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
    extractSignatureLinks,
    createTrackedLinksForProspect,
    buildTrackedSignatureHtml
} from '@/lib/email-link-tracker'

export const dynamic = 'force-dynamic'

// Schema pour valider le payload
const generateEmailSchema = z.object({
    prospectIds: z.union([
        z.array(z.union([z.string(), z.number()])).min(1),
        z.string(),
        z.number()
    ])
})

/**
 * POST /api/campaigns/[id]/generate-email
 * 
 * Version mise à jour pour utiliser le nouveau Webhook N8N (batch).
 * Remplace l'ancienne logique itérative un par un.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json()
        const { id: campaignId } = await params

        // Validation basique
        const validated = generateEmailSchema.safeParse(body)

        if (!validated.success) {
            return NextResponse.json({ error: 'Invalid payload', details: (validated.error as any).errors }, { status: 400 })
        }

        // Normalisation en tableau
        let prospectIds: (string | number)[] = []
        if (Array.isArray(validated.data.prospectIds)) {
            prospectIds = validated.data.prospectIds
        } else {
            prospectIds = [validated.data.prospectIds]
        }

        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Guard: count total prospects in pending/running jobs for this campaign
        const { data: activeJobs } = await supabase
            .from('cold_email_jobs')
            .select('prospect_ids')
            .eq('campaign_id', campaignId)
            .in('status', ['pending', 'running'])
            .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

        const totalInProgress = (activeJobs || []).reduce((sum: number, job: any) => {
            return sum + (Array.isArray(job.prospect_ids) ? job.prospect_ids.length : 0)
        }, 0)

        const remainingSlots = 50 - totalInProgress

        if (remainingSlots <= 0) {
            return NextResponse.json({
                error: `Limite atteinte — ${totalInProgress} génération(s) déjà en cours. Attendez la fin avant de relancer.`,
                totalInProgress
            }, { status: 429 })
        }

        // Cap prospect list to remaining slots
        if (prospectIds.length > remainingSlots) {
            console.log(`[Guard] Capping ${prospectIds.length} prospects to ${remainingSlots} remaining slots (${totalInProgress} in progress)`)
            prospectIds = prospectIds.slice(0, remainingSlots)
        }

        const HARDCODED_URL = "https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_generateur_cold_mail"
        const webhookUrl = process.env.N8N_WEBHOOK_COLD_EMAIL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL || HARDCODED_URL

        // 0. Safeguard: Filter out prospects who are already SENT or BOUNCED
        const { data: existingLinks, error: checkError } = await supabase
            .from('campaign_prospects')
            .select('prospect_id, email_status')
            .eq('campaign_id', campaignId)
            .in('prospect_id', prospectIds)

        let isRegeneration = false
        if (!checkError && existingLinks) {
            const lockedIds = existingLinks
                .filter(link => ['sent', 'bounced', 'replied'].includes(link.email_status))
                .map(link => link.prospect_id)

            if (lockedIds.length > 0) {
                const originalCount = prospectIds.length
                prospectIds = prospectIds.filter(id => !lockedIds.includes(Number(id)) && !lockedIds.includes(String(id)))
                console.log(`🔒 Skipped ${originalCount - prospectIds.length} locked prospects (sent/bounced)`)
            }

            // Check if any of the prospects already have a generated email
            const generatedIds = existingLinks
                .filter(link => ['generated', 'pending'].includes(link.email_status))
                .map(link => link.prospect_id)

            if (generatedIds.length > 0) {
                console.log(`♻️ Regeneration/Follow-up detected for ${generatedIds.length} prospect(s). Keeping old data for history.`)
            }
        }

        if (prospectIds.length === 0) {
            return NextResponse.json({
                success: true,
                generated: 0,
                message: "All selected prospects are locked (already sent/bounced)",
                total: 0
            })
        }

        // 1. Création du Job (Tracking)
        const { data: job, error: jobError } = await supabase
            .from('cold_email_jobs')
            .insert({
                user_id: user.id,
                campaign_id: campaignId,
                prospect_ids: prospectIds,
                status: 'pending',
                started_at: new Date().toISOString()
            })
            .select()
            .single()

        if (jobError || !job) {
            console.error('❌ Failed to create cold email job:', jobError)
            return NextResponse.json({ error: 'Failed to create tracking job' }, { status: 500 })
        }

        // 2. Mettre à jour TOUS les prospects à 'pending' pour que le spinner s'affiche
        const { error: resetError } = await supabase
            .from('campaign_prospects')
            .update({
                email_status: 'pending',
                updated_at: new Date().toISOString()
            })
            .eq('campaign_id', campaignId)
            .in('prospect_id', prospectIds)

        if (resetError) {
            console.error('❌ Failed to set prospects to pending status:', resetError)
        } else {
            console.log(`✅ Set ${prospectIds.length} prospect(s) to pending status`)
        }

        // Quota is now managed by the database trigger on cold_email_generations

        // ── Tracked links per prospect ────────────────────────────────────────
        // Load campaign signature fields
        const { data: campaign } = await supabase
            .from('cold_email_campaigns')
            .select(`
                my_website, signature_name, signature_title, signature_company,
                signature_phone, signature_email, signature_ps,
                signature_show_phone, signature_show_email, signature_show_website,
                signature_website_text, signature_custom_link_url, signature_custom_link_text,
                signature_elements_order
            `)
            .eq('id', campaignId)
            .single()

        // Extract raw signature links (shared across all prospects for this campaign)
        const signatureLinks = campaign ? extractSignatureLinks(campaign) : []

        // Create tracked links per prospect and store signature HTML
        const prospectSignatures: Record<string | number, string> = {}
        if (signatureLinks.length > 0 && campaign) {
            await Promise.all(
                prospectIds.map(async (prospectId) => {
                    try {
                        const tracked = await createTrackedLinksForProspect(
                            campaignId,
                            prospectId,
                            signatureLinks
                        )
                        const signatureHtml = buildTrackedSignatureHtml(campaign, tracked)
                        prospectSignatures[prospectId] = signatureHtml

                        // Store tracked signature HTML in campaign_prospects
                        await supabase
                            .from('campaign_prospects')
                            .update({ signature_tracked_html: signatureHtml })
                            .eq('campaign_id', campaignId)
                            .eq('prospect_id', prospectId)
                    } catch (trackErr) {
                        console.error(`[LinkTracker] Failed for prospect ${prospectId}:`, trackErr)
                    }
                })
            )
        }

        // Calculate the next step for each prospect
        const prospectSteps: Record<string | number, number> = {}
        const { data: pastGenerations } = await supabase
            .from('cold_email_generations')
            .select('prospect_id, step')
            .eq('campaign_id', campaignId)
            .in('prospect_id', prospectIds)

        for (const id of prospectIds) {
            const history = (pastGenerations || []).filter((g: any) => g.prospect_id == id)
            if (history.length > 0) {
                const maxStep = Math.max(...history.map((g: any) => g.step || 1))
                prospectSteps[id] = maxStep + 1
            } else {
                prospectSteps[id] = 1
            }
        }
        
        // Compute a global step (fallback) which is the max step among all prospects
        const globalStep = prospectIds.length > 0 ? Math.max(...Object.values(prospectSteps)) : 1;

        // 3. Payload Webhook N8N — enrichi avec les signatures trackées et le step
        const webhookPayload = {
            user_id: user.id,
            job_id: job.id,
            campaign_id: campaignId,
            prospect_ids: prospectIds,
            step: globalStep, // Fallback global pour N8N
            prospect_steps: prospectSteps, // Map détaillée par prospect
            prospect_signatures: prospectSignatures
        }

        // 4. Appel Webhook (avec Timeout) - On attend juste le déclenchement
        console.log(`📤 [Campaign Batch] Calling webhook: ${webhookUrl}`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

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

            // Update Job to running
            await supabase
                .from('cold_email_jobs')
                .update({ status: 'running' })
                .eq('id', job.id)

            // Return success with 'generated' count as expected by UI
            return NextResponse.json({
                success: true,
                generated: prospectIds.length,
                total: prospectIds.length,
                jobId: job.id
            })

        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            console.error('❌ Webhook call failed:', fetchError)

            await supabase
                .from('cold_email_jobs')
                .update({ status: 'failed', error_message: fetchError.message })
                .eq('id', job.id)

            throw fetchError
        }

    } catch (error: any) {
        console.error('GENERATE EMAIL ERROR:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            generated: 0
        }, { status: 500 })
    }
}
