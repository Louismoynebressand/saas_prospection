import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns/[id]/prospects
 * Get all prospects linked to a campaign
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { id: campaignId } = await params

        // Get campaign with user check
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select('id, user_id')
            .eq('id', campaignId)
            .single()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.id !== campaign.user_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Get campaign prospects with prospect data
        const { data: campaignProspects, error } = await supabase
            .from('campaign_prospects')
            .select(`
                id,
                campaign_id,
                prospect_id,
                email_status,
                generated_email_subject,
                generated_email_content,
                email_generated_at,
                email_sent_at,
                created_at,
                updated_at,
                scrape_prospect (*)
            `)
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching campaign prospects:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ prospects: campaignProspects || [] })
    } catch (error: any) {
        console.error('Error in GET /api/campaigns/[id]/prospects:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * POST /api/campaigns/[id]/prospects
 * Add prospects to a campaign
 * Body: { prospectIds: string[] } OR { searchIds: string[] }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectIds, searchIds } = body
        const { id: campaignId } = await params

        // Get campaign with user check
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select('id, user_id')
            .eq('id', campaignId)
            .single()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.id !== campaign.user_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        let finalProspectIds: string[] = []

        // If prospect IDs provided directly
        if (prospectIds && Array.isArray(prospectIds)) {
            finalProspectIds = prospectIds
        }
        // If search IDs provided, get all prospects from those searches
        else if (searchIds && Array.isArray(searchIds)) {
            const { data: prospects, error: prospectError } = await supabase
                .from('scrape_prospect')
                .select('id_prospect')
                .in('id_jobs', searchIds)
                .eq('id_user', user.id)

            if (prospectError) {
                return NextResponse.json({ error: prospectError.message }, { status: 500 })
            }

            finalProspectIds = prospects?.map(p => p.id_prospect) || []
        } else {
            return NextResponse.json({ error: 'Either prospectIds or searchIds required' }, { status: 400 })
        }

        if (finalProspectIds.length === 0) {
            return NextResponse.json({ error: 'No prospects to add' }, { status: 400 })
        }

        // Create campaign_prospect links (ignore duplicates)
        const linksToCreate = finalProspectIds.map(prospectId => ({
            campaign_id: campaignId,
            prospect_id: prospectId,
            email_status: 'not_generated' as const
        }))

        const { data: created, error: insertError } = await supabase
            .from('campaign_prospects')
            .upsert(linksToCreate, { onConflict: 'campaign_id,prospect_id', ignoreDuplicates: true })
            .select()

        if (insertError) {
            console.error('Error creating campaign prospects:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        // =================================================================================
        // SMART AUTOMATION: If Campaign has ACTIVE SCHEDULE -> Auto-Queue & Trigger Generation
        // =================================================================================
        if (created && created.length > 0) {
            // 1. Check for Active Schedule
            const { data: schedule } = await supabase
                .from('campaign_schedules')
                .select('id')
                .eq('campaign_id', campaignId)
                .eq('status', 'active')
                .maybeSingle() // Use maybeSingle to avoid error if none found

            if (schedule) {
                console.log(`[Smart Auto] Active schedule found (${schedule.id}) for campaign ${campaignId}. Queueing ${created.length} new prospects.`)

                // 2. Add to Email Queue
                const queueItems = created.map(p => ({
                    campaign_id: campaignId,
                    prospect_id: p.prospect_id,
                    schedule_id: schedule.id,
                    status: 'pending',
                    priority: 0
                }))

                const { error: queueError } = await supabase
                    .from('email_queue')
                    .upsert(queueItems, { onConflict: 'campaign_id, prospect_id', ignoreDuplicates: true })

                if (queueError) {
                    console.error('[Smart Auto] Failed to queue prospects:', queueError)
                } else {
                    // 3. Trigger Generation for "not_generated"
                    const ungeneratedProspects = created
                        .filter(p => p.email_status === 'not_generated')
                        .map(p => p.prospect_id)

                    if (ungeneratedProspects.length > 0) {
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

                                fetch(webhookUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(webhookPayload)
                                }).catch(err => console.error("[Smart Auto] Generation Webhook Failed:", err))

                                console.log(`[Smart Auto] Triggered generation for ${ungeneratedProspects.length} prospects.`)
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            added: created?.length || 0,
            links: created
        })
    } catch (error: any) {
        console.error('Error in POST /api/campaigns/[id]/prospects:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * DELETE /api/campaigns/[id]/prospects
 * Remove prospects from a campaign
 * Body: { prospectIds: string[] }
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectIds } = body
        const { id: campaignId } = await params

        if (!prospectIds || !Array.isArray(prospectIds)) {
            return NextResponse.json({ error: 'prospectIds required' }, { status: 400 })
        }

        // Get campaign with user check
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select('id, user_id')
            .eq('id', campaignId)
            .single()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.id !== campaign.user_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Delete campaign_prospect links
        const { error: deleteError } = await supabase
            .from('campaign_prospects')
            .delete()
            .eq('campaign_id', campaignId)
            .in('prospect_id', prospectIds)

        if (deleteError) {
            console.error('Error deleting campaign prospects:', deleteError)
            return NextResponse.json({ error: deleteError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, removed: prospectIds.length })
    } catch (error: any) {
        console.error('Error in DELETE /api/campaigns/[id]/prospects:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
