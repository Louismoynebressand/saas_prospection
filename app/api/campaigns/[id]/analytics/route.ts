import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns/[id]/analytics
 * Get funnel statistics for a campaign.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { id: campaignId } = await params

        // Verify auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Check ownership
        const { data: campaign } = await supabase
            .from('cold_email_campaigns')
            .select('user_id')
            .eq('id', campaignId)
            .single()

        if (!campaign || campaign.user_id !== user.id) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
        }

        // Fetch prospects
        const { data: prospects, error } = await supabase
            .from('campaign_prospects')
            .select('email_status, email_sent_at, email_opened_at, email_clicked_at')
            .eq('campaign_id', campaignId)

        if (error) throw error

        let total = prospects.length
        let sent = 0
        let opened = 0
        let clicked = 0
        let replied = 0

        prospects.forEach(p => {
            // Check based on timestamps or fallback to status
            const hasSent = p.email_sent_at || ['sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced'].includes(p.email_status)
            const hasOpened = p.email_opened_at || ['opened', 'clicked', 'replied'].includes(p.email_status)
            const hasClicked = p.email_clicked_at || ['clicked'].includes(p.email_status)
            const hasReplied = p.email_status === 'replied'

            if (hasSent) sent++
            if (hasOpened) opened++
            if (hasClicked) clicked++
            if (hasReplied) replied++
        })

        return NextResponse.json({
            analytics: { total, sent, opened, clicked, replied }
        })
    } catch (error: any) {
        console.error('Error fetching analytics:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
