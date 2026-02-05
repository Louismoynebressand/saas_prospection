import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/campaigns/[id]/schedule
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: campaignId } = await params
    const supabase = await createClient()

    try {
        const body = await req.json()
        const {
            start_date,
            daily_limit,
            time_window_start,
            time_window_end,
            days_of_week,
            smtp_configuration_id,
            exclude_holidays,
            blocked_dates,
            enable_warmup,
            warmup_start_limit,
            warmup_increment,
            warmup_days_per_step,
            warmup_target_limit
        } = body

        // Validation: max daily limit is 50
        if (daily_limit > 50) {
            return NextResponse.json({ success: false, error: "La limite quotidienne ne peut pas dépasser 50 emails" }, { status: 400 })
        }

        if (!smtp_configuration_id) {
            return NextResponse.json({ success: false, error: "SMTP Configuration ID is required" }, { status: 400 })
        }

        // 1. Create Schedule
        // If warm-up is enabled, use warmup_start_limit as initial daily_limit
        const effectiveDailyLimit = enable_warmup ? warmup_start_limit : daily_limit

        const { data: schedule, error: schedError } = await supabase
            .from('campaign_schedules')
            .insert({
                campaign_id: campaignId,
                start_date,
                daily_limit: effectiveDailyLimit,
                time_window_start,
                time_window_end,
                days_of_week,
                status: 'active',
                smtp_configuration_id,
                exclude_holidays: exclude_holidays || false,
                blocked_dates: blocked_dates || [],
                enable_warmup: enable_warmup || false,
                warmup_start_limit: warmup_start_limit || 2,
                warmup_increment: warmup_increment || 1,
                warmup_days_per_step: warmup_days_per_step || 2,
                warmup_target_limit: warmup_target_limit || daily_limit,
                warmup_current_day: enable_warmup ? 0 : null
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

// DELETE /api/campaigns/[id]/schedule
// Cancel a schedule: Delete the schedule record and remove pending items from queue
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: campaignId } = await params
    const supabase = await createClient()

    try {
        // 1. Get Active Schedule
        const { data: schedule, error: schedError } = await supabase
            .from('campaign_schedules')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('status', 'active')
            .single()

        if (schedError || !schedule) {
            return NextResponse.json({ success: false, error: "No active schedule found to cancel" }, { status: 404 })
        }

        // 2. Delete Pending Queue Items
        const { error: queueError } = await supabase
            .from('email_queue')
            .delete()
            .eq('campaign_id', campaignId)
            .eq('status', 'pending')

        if (queueError) throw queueError

        // 3. Update Schedule Status to Cancelled (or Delete it)
        // Let's delete it for now to keep it clean, or mark as cancelled.
        // User asked to "supprimer annuler", so let's delete.
        const { error: deleteError } = await supabase
            .from('campaign_schedules')
            .delete()
            .eq('id', schedule.id)

        if (deleteError) throw deleteError

        return NextResponse.json({ success: true, message: "Planning annulé et file d'attente nettoyée" })

    } catch (error: any) {
        console.error("Schedule Cancellation Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// PUT /api/campaigns/[id]/schedule
// Update an existing active schedule
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: campaignId } = await params
    const supabase = await createClient()

    try {
        const body = await req.json()
        const {
            daily_limit,
            time_window_start,
            time_window_end,
            days_of_week,
            smtp_configuration_id,
            exclude_holidays,
            blocked_dates,
            enable_warmup,
            warmup_start_limit,
            warmup_increment,
            warmup_days_per_step,
            warmup_target_limit
        } = body

        // Validation: max daily limit is 50
        if (daily_limit > 50) {
            return NextResponse.json({ success: false, error: "La limite quotidienne ne peut pas dépasser 50 emails" }, { status: 400 })
        }

        // 1. Get Active Schedule with full details
        const { data: schedule, error: schedError } = await supabase
            .from('campaign_schedules')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('status', 'active')
            .single()

        if (schedError || !schedule) {
            return NextResponse.json({ success: false, error: "No active schedule found to update" }, { status: 404 })
        }

        // 2. Update Schedule
        const updates: any = {}

        // Handle warm-up state transitions
        if (enable_warmup && !schedule.enable_warmup) {
            // Enabling warm-up for the first time
            updates.daily_limit = warmup_start_limit
            updates.warmup_current_day = 0
        } else if (enable_warmup && schedule.enable_warmup) {
            // Warm-up already enabled, keep current progress unless manually changed
            if (daily_limit) updates.daily_limit = schedule.daily_limit // Keep current limit
        } else if (!enable_warmup && schedule.enable_warmup) {
            // Disabling warm-up
            if (daily_limit) updates.daily_limit = daily_limit
            updates.warmup_current_day = null
        } else {
            // Warm-up not enabled, normal update
            if (daily_limit) updates.daily_limit = daily_limit
        }

        if (time_window_start) updates.time_window_start = time_window_start
        if (time_window_end) updates.time_window_end = time_window_end
        if (days_of_week) updates.days_of_week = days_of_week
        if (smtp_configuration_id) updates.smtp_configuration_id = smtp_configuration_id
        if (exclude_holidays !== undefined) updates.exclude_holidays = exclude_holidays
        if (blocked_dates) updates.blocked_dates = blocked_dates

        // Warm-up parameters
        if (enable_warmup !== undefined) updates.enable_warmup = enable_warmup
        if (warmup_start_limit) updates.warmup_start_limit = warmup_start_limit
        if (warmup_increment) updates.warmup_increment = warmup_increment
        if (warmup_days_per_step) updates.warmup_days_per_step = warmup_days_per_step
        if (warmup_target_limit) updates.warmup_target_limit = warmup_target_limit

        updates.updated_at = new Date().toISOString()

        const { error: updateError } = await supabase
            .from('campaign_schedules')
            .update(updates)
            .eq('id', schedule.id)

        if (updateError) throw updateError

        return NextResponse.json({ success: true, message: "Planning mis à jour" })

    } catch (error: any) {
        console.error("Schedule Update Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
