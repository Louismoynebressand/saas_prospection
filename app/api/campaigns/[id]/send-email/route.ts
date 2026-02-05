import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/campaigns/[id]/send-email
 * Send generated emails for one or more prospects
 * Body: { prospectId: string } OR { prospectIds: string[] }
 * 
 * NOTE: For now, this simulates sending. Actual email service integration needed.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectId, prospectIds, smtpConfigurationId } = body
        const { id: campaignId } = await params

        // Normalize to array
        const targetProspectIds = prospectId ? [prospectId] : prospectIds
        if (!targetProspectIds || !Array.isArray(targetProspectIds) || targetProspectIds.length === 0) {
            return NextResponse.json({ error: 'prospectId or prospectIds required' }, { status: 400 })
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

        // Get campaign prospects to verify emails are generated
        const { data: campaignProspects, error: cpError } = await supabase
            .from('campaign_prospects')
            .select('*')
            .eq('campaign_id', campaignId)
            .in('prospect_id', targetProspectIds)

        if (cpError || !campaignProspects || campaignProspects.length === 0) {
            return NextResponse.json({ error: 'No prospects found in campaign' }, { status: 404 })
        }

        const results = []

        for (const cp of campaignProspects) {
            // Check if email is generated
            if (cp.email_status === 'not_generated' || !cp.generated_email_content) {
                results.push({
                    prospect_id: cp.prospect_id,
                    success: false,
                    error: 'Email not generated yet'
                })
                continue
            }

            try {
                // Call n8n webhook to trigger real sending
                const webhookRes = await fetch('https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_envoi_mail_smtp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prospect_id: cp.prospect_id,
                        campaign_id: campaignId,
                        user_id: user.id,
                        smtp_configuration_id: smtpConfigurationId, // Passed from frontend or undefined (handled by n8n if optional, but we should probably require it if the user wants strict control)
                        email_order: 1 // Default to 1st email for manual trigger
                    })
                })

                if (!webhookRes.ok) {
                    const errorText = await webhookRes.text()
                    throw new Error(`Webhook failed: ${webhookRes.status} ${errorText}`)
                }

                // Update status in database upon success
                const { error: updateError } = await supabase
                    .from('campaign_prospects')
                    .update({
                        email_status: 'sent',
                        email_sent_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', cp.id)

                if (updateError) {
                    throw updateError
                }

                results.push({
                    prospect_id: cp.prospect_id,
                    success: true,
                    sent_at: new Date().toISOString()
                })

            } catch (err: any) {
                console.error(`Failed to send email for prospect ${cp.prospect_id}:`, err)
                results.push({
                    prospect_id: cp.prospect_id,
                    success: false,
                    error: err.message || 'Unknown error'
                })
            }
        }

        const successCount = results.filter(r => r.success).length

        return NextResponse.json({
            success: true,
            sent: successCount,
            total: results.length,
            results
        })
    } catch (error: any) {
        console.error('Error in POST /api/campaigns/[id]/send-email:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
