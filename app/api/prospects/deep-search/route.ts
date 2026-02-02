import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'

// Schema pour valider le payload
const deepSearchSchema = z.object({
    prospectIds: z.array(z.number()).min(1),
    userId: z.string(),
    jobId: z.union([z.string(), z.number()]).optional()
})

/**
 * POST /api/prospects/deep-search
 * 
 * Déclenche un Deep Search pour une liste de prospects.
 * Pattern COPIÉ EXACTEMENT de /api/scrape/launch qui fonctionne.
 * 
 * Flow simplifié:
 * 1. Valider le payload
 * 2. Appeler le webhook n8n
 * 3. Retourner le résultat
 * 
 * Note: La gestion des quotas est faite AVANT cet appel, dans le client.
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()
    let userId: string | undefined = undefined

    try {
        // Parse and validate payload
        const body = await request.json()
        const validated = deepSearchSchema.parse(body)
        userId = validated.userId

        logInfo('Deep Search job launch requested', {
            userId,
            prospectCount: validated.prospectIds.length,
            jobId: validated.jobId
        })

        // Get user for auth verification
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Vérifier que l'userId du payload correspond à l'utilisateur authentifié
        if (user.id !== validated.userId) {
            return NextResponse.json({ error: 'Unauthorized: user mismatch' }, { status: 403 })
        }

        // Get webhook URL from server env (checking both secure and public for compatibility)
        const webhookUrl = process.env.N8N_DEEP_SEARCH_WEBHOOK || process.env.NEXT_PUBLIC_N8N_DEEP_SEARCH_WEBHOOK

        console.log('🔍 [DEBUG] Webhook URL from env:', webhookUrl ? `${webhookUrl.substring(0, 50)}...` : 'NOT FOUND')

        if (!webhookUrl) {
            throw new Error('N8N_DEEP_SEARCH_WEBHOOK not configured on server')
        }

        // Préparer le payload pour n8n (format simple)
        const webhookPayload = {
            user_id: validated.userId,
            job_id: validated.jobId || Date.now(), // Générer un ID si non fourni
            prospect_ids: validated.prospectIds
        }

        // Call n8n webhook with timeout
        console.log(`📤 [Deep Search] Calling webhook: ${webhookUrl}`)
        console.log(`📦 [Deep Search] Payload:`, JSON.stringify(webhookPayload, null, 2))

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

            // Handle timeout
            if (fetchError.name === 'AbortError') {
                throw new Error('Webhook timeout after 30 seconds')
            }

            throw fetchError
        }

    } catch (error: any) {
        const duration = Date.now() - startTime

        logError('Deep Search job launch failed', error, {
            userId,
            duration
        })

        return NextResponse.json(
            {
                ok: false,
                error: error.message || 'Internal server error',
                userId,
                duration
            },
            { status: 500 }
        )
    }
}
