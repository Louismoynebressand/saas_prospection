import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const stepSchema = z.object({
    id: z.string().uuid().optional(),
    step_order: z.number().min(1),
    delay_days: z.number().min(0),
    agent_instructions: z.string().optional()
})

const stepsPayloadSchema = z.array(stepSchema)

/**
 * GET /api/campaigns/[id]/steps
 * Get all steps for a campaign
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

        // Verify campaign ownership
        const { data: campaign } = await supabase
            .from('cold_email_campaigns')
            .select('user_id')
            .eq('id', campaignId)
            .single()

        if (!campaign || campaign.user_id !== user.id) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
        }

        const { data: steps, error } = await supabase
            .from('campaign_steps')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('step_order', { ascending: true })

        if (error) throw error

        return NextResponse.json({ steps })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * PUT /api/campaigns/[id]/steps
 * Sync all steps for a campaign (upsert and delete missing)
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { id: campaignId } = await params
        const body = await request.json()

        const steps = stepsPayloadSchema.parse(body.steps)

        // Verify auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Verify campaign ownership
        const { data: campaign } = await supabase
            .from('cold_email_campaigns')
            .select('user_id')
            .eq('id', campaignId)
            .single()

        if (!campaign || campaign.user_id !== user.id) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
        }

        // Validate step_order is unique and sequential
        const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order)
        for (let i = 0; i < sortedSteps.length; i++) {
            if (sortedSteps[i].step_order !== i + 1) {
                return NextResponse.json({ error: 'Les étapes doivent être séquentielles (1, 2, 3...)' }, { status: 400 })
            }
        }

        // Upsert steps
        const upsertData = sortedSteps.map(step => ({
            ...(step.id ? { id: step.id } : {}),
            campaign_id: campaignId,
            step_order: step.step_order,
            delay_days: step.delay_days,
            agent_instructions: step.agent_instructions || null,
            updated_at: new Date().toISOString()
        }))

        const { data: upsertedSteps, error: upsertError } = await supabase
            .from('campaign_steps')
            .upsert(upsertData, { onConflict: 'id' })
            .select()

        if (upsertError) throw upsertError

        // Delete steps that are no longer in the payload
        const upsertedIds = upsertedSteps.map(s => s.id)
        if (upsertedIds.length > 0) {
            await supabase
                .from('campaign_steps')
                .delete()
                .eq('campaign_id', campaignId)
                .not('id', 'in', `(${upsertedIds.join(',')})`)
        } else {
            // Delete all if empty
            await supabase
                .from('campaign_steps')
                .delete()
                .eq('campaign_id', campaignId)
        }

        return NextResponse.json({ success: true, steps: upsertedSteps })
    } catch (error: any) {
        console.error('Error syncing steps:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
