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

        // Generate email for each prospect
        for (const prospect of prospects) {
            try {
                // Extract prospect info from data_scrapping
                const prospectData = typeof prospect.data_scrapping === 'string'
                    ? JSON.parse(prospect.data_scrapping)
                    : prospect.data_scrapping || {}

                const prospectName = prospectData.title || prospectData.name || 'Prospect'
                const prospectCompany = prospectData.company || prospectData.companyName || prospect.secteur || 'Votre entreprise'
                const prospectTitle = prospectData.jobTitle || prospectData.position || ''

                // Simple email generation (can be enhanced with AI later)
                const subject = `${campaign.main_offer || campaign.pitch || 'Proposition pour ' + prospectCompany}`

                let emailContent = `Bonjour ${prospectName},\n\n`
                emailContent += `${campaign.pitch || ''}\n\n`
                emailContent += `${campaign.main_promise || ''}\n\n`

                if (campaign.signature_html) {
                    emailContent += `\n${campaign.signature_html}`
                } else {
                    emailContent += `\nCordialement,\n${campaign.signature_name || ''}\n${campaign.signature_title || ''}`
                }

                // Update campaign_prospects table
                const { error: updateError } = await supabase
                    .from('campaign_prospects')
                    .update({
                        email_status: 'generated',
                        generated_email_subject: subject,
                        generated_email_content: emailContent,
                        email_generated_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('campaign_id', campaignId)
                    .eq('prospect_id', prospect.id_prospect)

                if (updateError) {
                    console.error('Error updating prospect email:', updateError)
                    results.push({
                        prospect_id: prospect.id_prospect,
                        success: false,
                        error: updateError.message
                    })
                } else {
                    results.push({
                        prospect_id: prospect.id_prospect,
                        success: true,
                        subject,
                        content: emailContent
                    })
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
