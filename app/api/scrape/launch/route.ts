import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'

const launchSchema = z.object({
    mapsUrl: z.string(),
    query: z.string(),
    city: z.string(),
    maxResults: z.number(),
    enrichmentEnabled: z.boolean(),
    debugId: z.string().uuid()
})

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    let debugId: string | undefined = undefined

    try {
        // Parse and validate payload
        const body = await request.json()
        const validated = launchSchema.parse(body)
        debugId = validated.debugId

        // Get user from session
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        // Create the scrape_jobs row FIRST
        const { data: newJob, error: jobError } = await supabase
            .from('scrape_jobs')
            .insert({
                id_user: user.id,
                statut: 'queued',
                debug_id: debugId
            })
            .select()
            .single()

        if (jobError || !newJob) {
            throw new Error(`Failed to create job: ${jobError?.message || 'Unknown error'}`)
        }

        const jobId = newJob.id_jobs

        // Construct the payload exactly as n8n expects it
        const payload = {
            job: {
                id: jobId,
                source: "google_maps",
                mapsUrl: validated.mapsUrl,
                query: validated.query,
                location: {
                    city: validated.city,
                    radiusKm: 10,
                    geo: {
                        lat: null,
                        lng: null
                    }
                },
                limits: {
                    maxResults: validated.maxResults
                },
                options: {
                    deepScan: validated.enrichmentEnabled,
                    enrichEmails: validated.enrichmentEnabled
                }
            },
            actor: {
                userId: user.id,
                sessionId: null
            },
            meta: {
                searchId: jobId,
                debugId
            }
        }

        logInfo('Scrape job launch requested', {
            jobId,
            debugId,
            userId: user.id
        })

        // Get webhook URL from server env
        const webhookUrl = process.env.SCRAPE_WEBHOOK_URL || process.env.NEXT_PUBLIC_SCRAPE_WEBHOOK_URL
        if (!webhookUrl) {
            throw new Error('SCRAPE_WEBHOOK_URL not configured on server')
        }

        // Call n8n webhook with timeout
        console.log(`[API] calling webhook: ${webhookUrl}`); // DEBUG LOG

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s max

        try {
            const webhookResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SuperProspect/2.0'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            console.log(`[API] webhook response: ${webhookResponse.status}`); // DEBUG LOG

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text()
                console.error(`[API] webhook error body: ${errorText}`); // DEBUG LOG
                throw new Error(`Webhook returned ${webhookResponse.status}: ${errorText}`)
            }

            const duration = Date.now() - startTime

            logInfo('Scrape job launched successfully', {
                jobId,
                debugId,
                duration
            })

            return NextResponse.json({
                ok: true,
                jobId,
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
