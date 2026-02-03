import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'

// Schema pour valider le payload
const generateEmailSchema = z.object({
    campaignId: z.string().uuid(),
    prospectIds: z.array(z.union([z.string(), z.number()])).min(1)
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
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        userId = user.id

        logInfo('Cold Email generation requested', {
            userId,
            campaignId: validated.campaignId,
            prospectCount: validated.prospectIds.length
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
            .eq('user_id', user.id)
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
                user_id: user.id,
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
            email_status: 'not_generated', // Status initial
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
                .eq('user_id', user.id)

            if (usageError) {
                console.error('❌ Failed to update quota usage:', usageError)
            } else {
                console.log(`✅ Quota updated: +${validated.prospectIds.length} used`)
            }
        }

        // 5. Payload Webhook N8N
        const webhookPayload = {
            user_id: user.id,
            job_id: job.id,
            campaign_id: validated.campaignId,
            prospect_ids: validated.prospectIds
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
