/**
 * GET /api/debug-tracking
 * Endpoint de diagnostic pour vérifier l'état du système de tracking.
 * Accessible uniquement en dev ou avec la clé admin.
 * 
 * Usage: /api/debug-tracking?campaign_id=xxx&prospect_id=yyy
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')
    const prospectId = searchParams.get('prospect_id')

    // Use service role to bypass RLS for diagnostics
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const report: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        base_url: process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app',
    }

    // 1. Count all tracked links
    const { count: totalLinks } = await supabase
        .from('email_tracked_links')
        .select('*', { count: 'exact', head: true })

    report.total_tracked_links_in_db = totalLinks

    // 2. Count all click events
    const { count: totalClicks } = await supabase
        .from('email_link_clicks')
        .select('*', { count: 'exact', head: true })

    report.total_click_events_in_db = totalClicks

    // 3. Links with clicks > 0
    const { count: linksWithClicks } = await supabase
        .from('email_tracked_links')
        .select('*', { count: 'exact', head: true })
        .gt('click_count', 0)

    report.links_with_clicks = linksWithClicks

    // 4. Latest 5 tracked links
    const { data: latestLinks } = await supabase
        .from('email_tracked_links')
        .select('id, short_code, link_type, link_label, click_count, campaign_id, prospect_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

    report.latest_5_links = latestLinks

    // 5. If campaign_id provided, show links for that campaign
    if (campaignId) {
        const { data: campaignLinks, count: cCount } = await supabase
            .from('email_tracked_links')
            .select('*', { count: 'exact' })
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false })
            .limit(20)

        report.campaign_tracked_links = {
            count: cCount,
            links: campaignLinks?.map(l => ({
                short_code: l.short_code,
                link_type: l.link_type,
                link_label: l.link_label,
                original_url: l.original_url,
                tracking_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app'}/api/track/${l.short_code}`,
                click_count: l.click_count,
                prospect_id: l.prospect_id,
                created_at: l.created_at
            }))
        }
    }

    // 6. If prospect_id provided
    if (prospectId) {
        const { data: prospectLinks } = await supabase
            .from('email_tracked_links')
            .select('*')
            .eq('prospect_id', prospectId)
            .order('created_at', { ascending: false })
            .limit(10)

        report.prospect_tracked_links = prospectLinks?.map(l => ({
            short_code: l.short_code,
            link_type: l.link_type,
            original_url: l.original_url,
            tracking_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app'}/api/track/${l.short_code}`,
            click_count: l.click_count,
            campaign_id: l.campaign_id,
        }))

        // Also check campaign_prospects signature_tracked_html
        if (campaignId) {
            const { data: cp } = await supabase
                .from('campaign_prospects')
                .select('prospect_id, signature_tracked_html, links_click_count, email_status')
                .eq('campaign_id', campaignId)
                .eq('prospect_id', prospectId)
                .single()

            report.campaign_prospect_record = {
                prospect_id: cp?.prospect_id,
                email_status: cp?.email_status,
                links_click_count: cp?.links_click_count,
                has_signature_tracked_html: !!cp?.signature_tracked_html,
                signature_contains_track_url: cp?.signature_tracked_html?.includes('/api/track/') ?? false,
                signature_html_preview: cp?.signature_tracked_html?.substring(0, 400) ?? null
            }
        }
    }

    // 7. Test RPC function
    const { data: rpcTest, error: rpcError } = await supabase.rpc('process_tracked_link_click', {
        p_short_code: '__nonexistent_test__',
        p_ip_address: '0.0.0.0',
        p_user_agent: 'debug-test'
    })
    report.rpc_function_status = rpcError
        ? `ERROR: ${rpcError.message}`
        : `OK (returned null for nonexistent code as expected)`

    return NextResponse.json(report, { status: 200 })
}
