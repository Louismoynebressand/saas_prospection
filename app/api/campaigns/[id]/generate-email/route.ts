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

        // Webhook URL (Nouveau)
        const HARDCODED_URL = "https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_generateur_cold_mail"
        const webhookUrl = process.env.N8N_WEBHOOK_COLD_EMAIL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL || HARDCODED_URL

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

        // 2. Initialisation des liens Prospect-Campagne (campaign_prospects)
        const linksToUpsert = prospectIds.map(prospectId => ({
            campaign_id: campaignId,
            prospect_id: prospectId,
            email_status: 'not_generated',
            updated_at: new Date().toISOString()
        }))

        const { error: linksError } = await supabase
            .from('campaign_prospects')
            .upsert(linksToUpsert, {
                onConflict: 'campaign_id,prospect_id',
                ignoreDuplicates: false
            })

        if (linksError) {
            console.error('⚠️ Warning: Failed to upsert campaign links:', linksError)
        }

        // 2.5. Mise à jour du Quota (Incrémentation)
        const { data: quota } = await supabase
            .from('quotas')
            .select('cold_emails_used, cold_emails_limit')
            .eq('user_id', user.id)
            .single()

        if (quota) {
            const { error: usageError } = await supabase
                .from('quotas')
                .update({
                    cold_emails_used: (quota.cold_emails_used || 0) + prospectIds.length
                })
                .eq('user_id', user.id)

            if (usageError) {
                console.error('❌ Failed to update quota usage:', usageError)
            } else {
                console.log(`✅ Quota updated: +${prospectIds.length} used`)
            }
        }

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
