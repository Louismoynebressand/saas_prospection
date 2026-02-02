import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'

// Schema pour valider le payload
const deepSearchSchema = z.object({
    prospectIds: z.array(z.number()).min(1)
})

/**
 * POST /api/prospects/deep-search
 * 
 * Déclenche un Deep Search pour une liste de prospects.
 * 
 * CORRECTION FORCEE : Ajout d'une URL en dur si les variables d'environnement manquent.
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()
    let userId: string | undefined = undefined

    try {
        // Parse and validate payload
        const body = await request.json()
        const validated = deepSearchSchema.parse(body)

        // Get user for auth verification
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        userId = user.id

        logInfo('Deep Search job launch requested', {
            userId,
            prospectCount: validated.prospectIds.length,
        })

        // Get webhook URL from server env OR HARDCODED FALLBACK
        // C'est nécessaire car sur Vercel les env vars peuvent manquer si pas configurées
        const HARDCODED_URL = "https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_deep-search-prospect-&-check-email"

        const webhookUrl = process.env.N8N_DEEP_SEARCH_WEBHOOK || process.env.NEXT_PUBLIC_N8N_DEEP_SEARCH_WEBHOOK || HARDCODED_URL

        console.log('🔍 [DEBUG] Webhook URL strategy:', {
            env_std: !!process.env.N8N_DEEP_SEARCH_WEBHOOK,
            env_public: !!process.env.NEXT_PUBLIC_N8N_DEEP_SEARCH_WEBHOOK,
            hardcoded: !!HARDCODED_URL,
            final_url: webhookUrl.substring(0, 50) + '...'
        })

        if (!webhookUrl) {
            throw new Error('N8N_DEEP_SEARCH_WEBHOOK not configured on server (even hardcoded fallback failed)')
        }

        // Create job in database to track progress
        const { data: job, error: jobError } = await supabase
            .from('deep_search_jobs')
            .insert({
                user_id: user.id,
                prospect_ids: validated.prospectIds,
                prospects_total: validated.prospectIds.length,
                status: 'pending'
            })
            .select()
            .single()

        if (jobError || !job) {
            console.error('❌ Failed to create deep search job:', jobError)
            throw new Error('Failed to create tracking job')
        }

        logInfo('Deep Search job created in DB', { jobId: job.id })

        // Préparer le payload pour n8n (format simple)
        const webhookPayload = {
            user_id: user.id,
            job_id: job.id, // Use real UUID from database
            prospect_ids: validated.prospectIds
        }

        // Call n8n webhook with timeout
        console.log(`📤 [Deep Search] Calling webhook: ${webhookUrl}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s max

        try {
            const webhookResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SuperProspect/2.0'
                },
                body: JSON.stringify(webhookPayload),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            console.log(`✅ [Deep Search] Webhook response: ${webhookResponse.status}`)

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text()
                console.error(`❌ [Deep Search] Webhook error body: ${errorText}`)
                throw new Error(`Webhook returned ${webhookResponse.status}: ${errorText}`)
            }

            const duration = Date.now() - startTime

            logInfo('Deep Search job launched successfully', {
                userId,
                prospectCount: validated.prospectIds.length,
                duration
            })

            return NextResponse.json({
                ok: true,
                userId,
                prospectCount: validated.prospectIds.length,
                jobId: webhookPayload.job_id,
                duration
            })

        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            if (fetchError.name === 'AbortError') {
                throw new Error('Webhook timeout after 30 seconds')
            }
            throw fetchError
        }

    } catch (error: any) {
        logError('Deep Search job launch failed', error, { userId })
        return NextResponse.json(
            { ok: false, error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
