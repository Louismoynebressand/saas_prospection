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

            // Check if any of the prospects already have a generated email (= regeneration)
            const generatedIds = existingLinks
                .filter(link => ['generated', 'pending'].includes(link.email_status))
                .map(link => link.prospect_id)

            if (generatedIds.length > 0) {
                isRegeneration = true
                console.log(`♻️ Regeneration detected for ${generatedIds.length} prospect(s). Cleaning up old data first...`)

                // WE NO LONGER DELETE FROM cold_email_generations
                // This preserves the history of emails (Step 1, Step 2, etc.)
                console.log(`✅ Keeping old cold_email_generations for history`)

                // STEP 1.5: Delete old tracked links to prevent duplicates
                const { error: deleteLinksError } = await supabase
                    .from('email_tracked_links')
                    .delete()
                    .eq('campaign_id', campaignId)
                    .in('prospect_id', generatedIds)

                if (deleteLinksError) {
                    console.error('❌ Failed to delete old tracked links:', deleteLinksError)
                    return NextResponse.json({ error: 'Failed to clean up old tracked links' }, { status: 500 })
                }
                console.log(`✅ Deleted old tracked links for ${generatedIds.length} prospect(s)`)

                // STEP 2: Reset campaign_prospects to 'pending' so UI shows loading state
                const { error: resetError } = await supabase
                    .from('campaign_prospects')
                    .update({
                        email_status: 'pending',
                        generated_email_subject: null,
                        generated_email_content: null,
                        signature_tracked_html: null,
                        links_click_count: 0,
                        email_generated_at: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('campaign_id', campaignId)
                    .in('prospect_id', generatedIds)

                if (resetError) {
                    console.error('❌ Failed to reset campaign_prospects status:', resetError)
                } else {
                    console.log(`✅ Reset ${generatedIds.length} prospect(s) to pending status`)
                }
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

        // 2. Init campaign_prospects for NEW prospects only (already-existing ones were handled above)
        const newProspectIds = (existingLinks || []).length === 0
            ? prospectIds
            : prospectIds.filter(id => !(existingLinks || []).some(l => l.prospect_id == id))

        if (newProspectIds.length > 0) {
            const linksToInsert = newProspectIds.map(prospectId => ({
                campaign_id: campaignId,
                prospect_id: prospectId,
                email_status: 'pending',
                updated_at: new Date().toISOString()
            }))

            const { error: linksError } = await supabase
                .from('campaign_prospects')
                .upsert(linksToInsert, {
                    onConflict: 'campaign_id,prospect_id',
                    ignoreDuplicates: false
                })

            if (linksError) {
                console.error('⚠️ Warning: Failed to upsert campaign links:', linksError)
            }
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

        // 3. Payload Webhook N8N — enrichi avec les signatures trackées
        const webhookPayload = {
            user_id: user.id,
            job_id: job.id,
            campaign_id: campaignId,
            prospect_ids: prospectIds,
            // Optionnel : map prospect_id → signature HTML pour que N8N puisse l'utiliser directement
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
