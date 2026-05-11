import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

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

        // Guard: reject if a job is already pending/running for this campaign
        const { data: existingJob } = await supabase
            .from('cold_email_jobs')
            .select('id, status, prospect_ids')
            .eq('campaign_id', campaignId)
            .in('status', ['pending', 'running'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existingJob) {
            const count = Array.isArray(existingJob.prospect_ids) ? existingJob.prospect_ids.length : '?'
            return NextResponse.json({
                error: `Une génération est déjà en cours (${count} prospect(s) — statut: ${existingJob.status}). Attendez qu'elle se termine avant de relancer.`,
                activeJobId: existingJob.id
            }, { status: 409 })
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

                // STEP 1: Delete old cold_email_generations rows (MUST come before webhook)
                const { error: deleteGenError } = await supabase
                    .from('cold_email_generations')
                    .delete()
                    .eq('campaign_id', campaignId)
                    .in('prospect_id', generatedIds)

                if (deleteGenError) {
                    console.error('❌ Failed to delete old cold_email_generations:', deleteGenError)
                    return NextResponse.json({ error: 'Failed to clean up old generated emails before regeneration' }, { status: 500 })
                }
                console.log(`✅ Deleted old cold_email_generations for ${generatedIds.length} prospect(s)`)

                // STEP 2: Reset campaign_prospects to 'pending' so UI shows loading state
                const { error: resetError } = await supabase
                    .from('campaign_prospects')
                    .update({
                        email_status: 'pending',
                        generated_email_subject: null,
                        generated_email_content: null,
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

        // 3. Payload Webhook N8N
        const webhookPayload = {
            user_id: user.id,
            job_id: job.id,
            campaign_id: campaignId,
            prospect_ids: prospectIds
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
