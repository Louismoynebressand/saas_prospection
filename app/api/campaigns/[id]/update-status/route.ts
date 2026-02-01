import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailStatus } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/campaigns/[id]/update-status
 * Manually update email status for a prospect
 * Body: { prospectId: string, newStatus: EmailStatus }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectId, newStatus } = body

        if (!prospectId || !newStatus) {
            return NextResponse.json({ error: 'prospectId and newStatus required' }, { status: 400 })
        }

        const validStatuses: EmailStatus[] = ['not_generated', 'generated', 'sent', 'bounced', 'replied']
        if (!validStatuses.includes(newStatus)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        // Get campaign with user check
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select('id, user_id')
            .eq('id', params.id)
            .single()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.id !== campaign.user_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Update status
        const updateData: any = {
            email_status: newStatus,
            updated_at: new Date().toISOString()
        }

        // Set timestamps based on status
        if (newStatus === 'sent' && !updateData.email_sent_at) {
            updateData.email_sent_at = new Date().toISOString()
        }

        const { data: updated, error: updateError } = await supabase
            .from('campaign_prospects')
            .update(updateData)
            .eq('campaign_id', params.id)
            .eq('prospect_id', prospectId)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating status:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, updated })
    } catch (error: any) {
        console.error('Error in PATCH /api/campaigns/[id]/update-status:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
