import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/campaigns/[id]/schedule
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: campaignId } = await params
    const supabase = await createClient()

    try {
        const body = await req.json()
        const { start_date, daily_limit, time_window_start, time_window_end, days_of_week } = body

        // 1. Create Schedule
        const { data: schedule, error: schedError } = await supabase
            .from('campaign_schedules')
            .insert({
                campaign_id: campaignId,
                start_date,
                daily_limit,
                time_window_start,
                time_window_end,
                days_of_week,
                status: 'active'
            })
            .select()
            .single()

        if (schedError) throw schedError

        // 2. Identify Prospects to Queue
        // Only queue prospects that:
        // - Are in this campaign
        // - Have NOT been sent an email yet (email_status != 'sent')
        // - Are not blocked/bounced
        // - Are not already in the queue for this campaign

        // Fetch eligible prospects
        const { data: prospects, error: prospError } = await supabase
            .from('campaign_prospects')
            .select('prospect_id, email_status')
            .eq('campaign_id', campaignId)
            .neq('email_status', 'sent')
            .neq('email_status', 'bounced')

        if (prospError) throw prospError

        if (!prospects || prospects.length === 0) {
            return NextResponse.json({ success: true, message: "Aucun prospect à planifier", queued_count: 0 })
        }

        // 3. Populate Queue
        // Note: For large campaigns, this should be batched. For MVP (<1000), single insert is fine.
        const queueItems = prospects.map(p => ({
            campaign_id: campaignId,
            prospect_id: p.prospect_id,
            schedule_id: schedule.id,
            status: 'pending',
            priority: 0 // Default priority
        }))

        // Upsert to avoid duplicates (constraint on campaign_id, prospect_id)
        const { error: queueError } = await supabase
            .from('email_queue')
            .upsert(queueItems, { onConflict: 'campaign_id, prospect_id', ignoreDuplicates: true })

        if (queueError) throw queueError

        // 4. Trigger Instant Generation for Ungenerated Prospects
        const ungeneratedProspects = prospects
            .filter(p => p.email_status === 'not_generated')
            .map(p => p.prospect_id)

        let generationTriggered = false

        if (ungeneratedProspects.length > 0) {
            // Get User ID for the Job
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                // Create Job
                const { data: job, error: jobError } = await supabase
                    .from('cold_email_jobs')
                    .insert({
                        user_id: user.id,
                        campaign_id: campaignId,
                        prospect_ids: ungeneratedProspects,
                        status: 'pending',
                        started_at: new Date().toISOString()
                    })
                    .select()
                    .single()

                if (!jobError && job) {
                    // Trigger N8N Webhook
                    const HARDCODED_URL = "https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_generateur_cold_mail"
                    const webhookUrl = process.env.N8N_WEBHOOK_COLD_EMAIL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL || HARDCODED_URL

                    if (webhookUrl) {
                        const webhookPayload = {
                            user_id: user.id,
                            job_id: job.id,
                            campaign_id: campaignId,
                            prospect_ids: ungeneratedProspects
                        }

                        // Fire and Forget (don't await strictly or block response)
                        fetch(webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(webhookPayload)
                        }).catch(err => console.error("Generation Webhook Failed:", err))

                        generationTriggered = true
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            schedule_id: schedule.id,
            queued_count: queueItems.length,
            generation_triggered: generationTriggered,
            generated_count: ungeneratedProspects.length
        })

    } catch (error: any) {
        console.error("Schedule Creation Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
