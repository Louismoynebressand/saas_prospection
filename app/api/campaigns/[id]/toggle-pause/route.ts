import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/campaigns/[id]/toggle-pause
 * Toggle the status of a campaign between ACTIVE and PAUSED.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { id: campaignId } = await params

        // Auth check
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch current campaign status
        const { data: campaign, error: fetchError } = await supabase
            .from('cold_email_campaigns')
            .select('status, user_id')
            .eq('id', campaignId)
            .single()

        if (fetchError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        if (campaign.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Determine new status
        // Handle both 'active' and 'ACTIVE' casing just in case
        const isCurrentlyActive = campaign.status?.toLowerCase() === 'active'
        const newStatus = isCurrentlyActive ? 'PAUSED' : 'ACTIVE'

        // Update campaign
        const { error: updateError } = await supabase
            .from('cold_email_campaigns')
            .update({ status: newStatus })
            .eq('id', campaignId)

        if (updateError) {
            console.error('Error toggling pause:', updateError)
            return NextResponse.json({ error: 'Failed to update campaign status' }, { status: 500 })
        }

        return NextResponse.json({ success: true, newStatus })
    } catch (error: any) {
        console.error('Error in PATCH /api/campaigns/[id]/toggle-pause:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
