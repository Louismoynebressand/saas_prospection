/**
 * POST /api/campaigns/[id]/regenerate-tracking
 * 
 * Force la régénération des liens de tracking pour un ou tous les prospects
 * d'une campagne. 
 * 
 * - Supprime les anciens liens trackés (pour ce prospect/campagne)
 * - Recrée les liens trackés avec les données actuelles de la signature
 * - Met à jour campaign_prospects.signature_tracked_html
 * 
 * Body: { prospectIds?: number[] }  (si absent = tous les prospects de la campagne)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    extractSignatureLinks,
    createTrackedLinksForProspect,
    buildTrackedSignatureHtml
} from '@/lib/email-link-tracker'

export const dynamic = 'force-dynamic'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: campaignId } = await params
        const body = await request.json().catch(() => ({}))
        const prospectIds: number[] | undefined = body.prospectIds

        // Verify campaign ownership
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select(`
                id, user_id,
                my_website, signature_name, signature_title, signature_company,
                signature_phone, signature_email, signature_ps,
                signature_show_phone, signature_show_email, signature_show_website,
                signature_website_text, signature_custom_link_url, signature_custom_link_text,
                signature_elements_order
            `)
            .eq('id', campaignId)
            .eq('user_id', user.id)
            .single()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
        }

        // Get target prospect IDs
        let targetProspectIds: number[]
        if (prospectIds && prospectIds.length > 0) {
            targetProspectIds = prospectIds
        } else {
            // All prospects in this campaign
            const { data: cpList, error: cpErr } = await supabase
                .from('campaign_prospects')
                .select('prospect_id')
                .eq('campaign_id', campaignId)

            if (cpErr || !cpList) {
                return NextResponse.json({ error: 'Failed to fetch campaign prospects' }, { status: 500 })
            }
            targetProspectIds = cpList.map((cp: any) => Number(cp.prospect_id))
        }

        if (targetProspectIds.length === 0) {
            return NextResponse.json({ success: true, regenerated: 0, message: 'No prospects to process' })
        }

        // Extract signature links from current campaign data
        const signatureLinks = extractSignatureLinks(campaign)
        
        if (signatureLinks.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No trackable links found in campaign signature. Make sure you have phone, email, website or custom link configured in the signature settings.',
                hint: 'Check signature_phone, signature_email, my_website fields in your campaign'
            }, { status: 400 })
        }

        const results: { prospectId: number; success: boolean; linksCreated: number; error?: string }[] = []

        for (const prospectId of targetProspectIds) {
            try {
                // 1. Delete old tracked links for this prospect/campaign
                await supabase
                    .from('email_tracked_links')
                    .delete()
                    .eq('campaign_id', campaignId)
                    .eq('prospect_id', prospectId)

                // 2. Create new tracked links
                const tracked = await createTrackedLinksForProspect(
                    campaignId,
                    prospectId,
                    signatureLinks
                )

                // 3. Build HTML with tracked links
                const signatureHtml = buildTrackedSignatureHtml(campaign, tracked)

                // 4. Update campaign_prospects with new signature HTML
                await supabase
                    .from('campaign_prospects')
                    .update({
                        signature_tracked_html: signatureHtml,
                        links_click_count: 0, // reset click count
                        updated_at: new Date().toISOString()
                    })
                    .eq('campaign_id', campaignId)
                    .eq('prospect_id', prospectId)

                results.push({ prospectId, success: true, linksCreated: tracked.length })
            } catch (err: any) {
                console.error(`[RegenerateTracking] Failed for prospect ${prospectId}:`, err)
                results.push({ prospectId, success: false, linksCreated: 0, error: err.message })
            }
        }

        const successCount = results.filter(r => r.success).length
        const totalLinksCreated = results.reduce((sum, r) => sum + r.linksCreated, 0)

        return NextResponse.json({
            success: true,
            regenerated: successCount,
            failed: results.length - successCount,
            total_links_created: totalLinksCreated,
            signature_links_config: signatureLinks.map(l => ({ type: l.type, label: l.label })),
            results
        })
    } catch (error: any) {
        console.error('[RegenerateTracking] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
