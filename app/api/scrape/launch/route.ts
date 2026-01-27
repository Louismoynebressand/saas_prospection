import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'

const launchSchema = z.object({
    jobId: z.string(), // Changed to string UUID
    debugId: z.string().uuid(),
    payload: z.object({
        job: z.object({
            id: z.string(), // Changed to string UUID
            source: z.string(),
            mapsUrl: z.string(),
            query: z.string(),
            location: z.object({
                city: z.string(),
                radiusKm: z.number().optional(),
                geo: z.object({
                    lat: z.number().nullable(),
                    lng: z.number().nullable()
                })
            }),
            limits: z.object({
                maxResults: z.number()
            }),
            options: z.object({
                deepScan: z.boolean(),
                enrichEmails: z.boolean()
            })
        }),
        actor: z.object({
            userId: z.string(),
            sessionId: z.string().nullable()
        }),
        meta: z.object({
            searchId: z.string(), // Changed to string UUID
            debugId: z.string().uuid()
        })
    })
})

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    let debugId: string | undefined = undefined

    try {
        // Parse and validate payload
        const body = await request.json()
        const validated = launchSchema.parse(body)
        debugId = validated.debugId

        logInfo('Scrape job launch requested', {
            jobId: validated.jobId,
            debugId,
            userId: validated.payload.actor.userId
        })

        // Get webhook URL from server env (checking both secure and public for compatibility)
        const webhookUrl = process.env.SCRAPE_WEBHOOK_URL || process.env.NEXT_PUBLIC_SCRAPE_WEBHOOK_URL
        if (!webhookUrl) {
            throw new Error('SCRAPE_WEBHOOK_URL not configured on server')
        }

        // Call n8n webhook with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s max

        try {
            const webhookResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SuperProspect/2.0'
                },
                body: JSON.stringify(validated.payload),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text()
                throw new Error(`Webhook returned ${webhookResponse.status}: ${errorText}`)
            }

            const duration = Date.now() - startTime

            logInfo('Scrape job launched successfully', {
                jobId: validated.jobId,
                debugId,
                duration
            })

            return NextResponse.json({
                ok: true,
                jobId: validated.jobId,
                debugId,
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

        logError('Scrape job launch failed', error, {
            debugId,
            duration
        })

        // Try to update job status to error if we have debugId
        if (debugId) {
            try {
                const supabase = await createClient()
                const { error: updateError } = await supabase
                    .from('scrape_jobs')
                    .update({ statut: 'error' })
                    .eq('debug_id', debugId)

                if (updateError) {
                    logError('Failed to update job status to error', updateError, { debugId })
                }
            } catch (updateErr) {
                logError('Exception updating job status', updateErr, { debugId })
            }
        }

        return NextResponse.json(
            {
                ok: false,
                error: error.message || 'Internal server error',
                debugId,
                duration
            },
            { status: 500 }
        )
    }
}
