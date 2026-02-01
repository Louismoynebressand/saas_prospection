import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/campaigns/[id]/generate-email
 * Generate personalized email for one or more prospects
 * Body: { prospectId: string } OR { prospectIds: string[] }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectId, prospectIds } = body
        const { id: campaignId } = await params

        // Normalize to array
        const targetProspectIds = prospectId ? [prospectId] : prospectIds
        if (!targetProspectIds || !Array.isArray(targetProspectIds) || targetProspectIds.length === 0) {
            return NextResponse.json({ error: 'prospectId or prospectIds required' }, { status: 400 })
        }

        // Get campaign with user check
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select('*')
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

        // Get prospects data
        const { data: prospects, error: prospectError } = await supabase
            .from('scrape_prospect')
            .select('*')
            .in('id_prospect', targetProspectIds)

        if (prospectError || !prospects || prospects.length === 0) {
            return NextResponse.json({ error: 'Prospects not found' }, { status: 404 })
        }

        const results = []

        // Generate email for each prospect via n8n webhook
        for (const prospect of prospects) {
            try {
                // Ensure campaign_prospect link exists
                const { data: existingLink, error: linkError } = await supabase
                    .from('campaign_prospects')
                    .select('id')
                    .eq('campaign_id', campaignId)
                    .eq('prospect_id', prospect.id_prospect)
                    .maybeSingle()

                let campaignProspectId: string

                if (linkError || !existingLink) {
                    // Create link if it doesn't exist
                    const { data: newLink, error: createError } = await supabase
                        .from('campaign_prospects')
                        .insert({
                            campaign_id: campaignId,
                            prospect_id: prospect.id_prospect,
                            email_status: 'not_generated'
                        })
                        .select('id')
                        .single()

                    if (createError || !newLink) {
                        throw new Error('Failed to create campaign prospect link')
                    }
                    campaignProspectId = newLink.id
                } else {
                    campaignProspectId = existingLink.id
                }

                // Call n8n webhook to generate email
                const webhookUrl = process.env.N8N_GENERATE_EMAIL_WEBHOOK || 'https://neuraflow-n8n.app.n8n.cloud/webhook/generate-cold-email'

                const webhookPayload = {
                    user_id: user.id,
                    campaign_id: campaignId,
                    prospect_id: prospect.id_prospect.toString(),
                    campaign_prospect_id: campaignProspectId
                }

                console.log('📤 Calling n8n webhook:', webhookUrl, webhookPayload)

                const webhookResponse = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(webhookPayload),
                    signal: AbortSignal.timeout(30000) // 30s timeout
                })

                if (!webhookResponse.ok) {
                    throw new Error(`Webhook failed: ${webhookResponse.statusText}`)
                }

                const webhookResult = await webhookResponse.json()
                console.log('📥 n8n webhook result:', webhookResult)

                if (webhookResult.status === 'finished') {
                    // Verify the email was saved in DB by n8n
                    const { data: updatedLink } = await supabase
                        .from('campaign_prospects')
                        .select('generated_email_subject, generated_email_content, email_status')
                        .eq('id', campaignProspectId)
                        .single()

                    results.push({
                        prospect_id: prospect.id_prospect,
                        success: true,
                        subject: updatedLink?.generated_email_subject || webhookResult.email_subject,
                        content: updatedLink?.generated_email_content || webhookResult.email_content_text
                    })
                } else {
                    throw new Error(webhookResult.message || 'Email generation failed')
                }
            } catch (err: any) {
                console.error('Error generating email for prospect:', err)
                results.push({
                    prospect_id: prospect.id_prospect,
                    success: false,
                    error: err.message
                })
            }
        }

        const successCount = results.filter(r => r.success).length

        return NextResponse.json({
            success: true,
            generated: successCount,
            total: results.length,
            results
        })
    } catch (error: any) {
        console.error('Error in POST /api/campaigns/[id]/generate-email:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
