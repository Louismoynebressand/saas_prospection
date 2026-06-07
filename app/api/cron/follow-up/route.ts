import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/follow-up
 * 
 * Cron job that checks for prospects eligible for follow-up emails.
 * Triggered automatically by Vercel Cron.
 */
export async function GET(request: Request) {
    try {
        // Authenticate cron request (Vercel Cron Securing)
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const supabase = await createClient()

        // 1. Fetch prospects that haven't replied/bounced and have received at least one email, AND whose campaign is active
        const { data: activeProspects, error: prospectsError } = await supabase
            .from('campaign_prospects')
            .select('id, prospect_id, campaign_id, current_step, last_email_sent_at, email_status, cold_email_campaigns!inner(status)')
            .in('cold_email_campaigns.status', ['active', 'ACTIVE'])
            .not('email_status', 'in', '("replied","bounced","unsubscribed","pending")')
            .not('last_email_sent_at', 'is', null)

        if (prospectsError) {
            throw prospectsError
        }

        if (!activeProspects || activeProspects.length === 0) {
            return NextResponse.json({ success: true, message: 'No prospects require follow-up' })
        }

        // 2. Fetch all campaign steps to check delays
        const { data: allSteps, error: stepsError } = await supabase
            .from('campaign_steps')
            .select('campaign_id, step_order, delay_days')

        if (stepsError) {
            throw stepsError
        }

        const triggeredCampaigns: Record<string, any> = {}

        // 3. Process prospects and see if they are eligible for the next step
        const now = new Date()

        for (const cp of activeProspects) {
            const currentStep = cp.current_step || 1
            const nextStepOrder = currentStep + 1

            const nextStep = allSteps?.find(s => s.campaign_id === cp.campaign_id && s.step_order === nextStepOrder)
            
            if (nextStep && cp.last_email_sent_at) {
                const lastSent = new Date(cp.last_email_sent_at)
                const delayMs = nextStep.delay_days * 24 * 60 * 60 * 1000
                const eligibleDate = new Date(lastSent.getTime() + delayMs)

                if (now >= eligibleDate) {
                    // Eligible for follow-up!
                    if (!triggeredCampaigns[cp.campaign_id]) {
                        triggeredCampaigns[cp.campaign_id] = {
                            prospectIds: [],
                            step: nextStepOrder
                        }
                    }
                    triggeredCampaigns[cp.campaign_id].prospectIds.push(cp.prospect_id)
                }
            }
        }

        let totalTriggered = 0

        // 4. Trigger cold-email generation for eligible prospects
        for (const [campaignId, data] of Object.entries(triggeredCampaigns)) {
            // Internally call our own API or handle directly. We can use fetch or just replicate the job insert logic
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            const response = await fetch(`${appUrl}/api/cold-email/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {})
                },
                body: JSON.stringify({
                    campaignId: campaignId,
                    prospectIds: data.prospectIds,
                    step: data.step
                })
            })

            if (response.ok) {
                // Update their current_step in DB
                await supabase
                    .from('campaign_prospects')
                    .update({ current_step: data.step })
                    .eq('campaign_id', campaignId)
                    .in('prospect_id', data.prospectIds)

                totalTriggered += data.prospectIds.length
            } else {
                console.error(`Failed to trigger follow-up for campaign ${campaignId}`)
            }
        }

        logInfo(`Cron Follow-up executed`, { triggeredCount: totalTriggered })

        return NextResponse.json({
            success: true,
            message: `Triggered follow-up for ${totalTriggered} prospects`
        })

    } catch (error: any) {
        logError('Cron follow-up failed', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
