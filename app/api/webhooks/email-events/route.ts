"use server"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/webhooks/email-events
 * 
 * Webhook pour recevoir les événements email (ouvert, cliqué, rebond, répondu)
 * depuis le service email ou n8n
 * 
 * Payload attendu:
 * {
 *   "event": "opened" | "clicked" | "bounced" | "replied",
 *   "campaign_prospect_id": "uuid",
 *   "timestamp": "2026-02-01T22:00:00Z"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { event, campaign_prospect_id, timestamp } = body

        if (!event || !campaign_prospect_id) {
            return NextResponse.json({ error: 'event and campaign_prospect_id required' }, { status: 400 })
        }

        const supabase = await createClient()

        // Mapping événement → statut
        const statusMap: Record<string, string> = {
            'opened': 'opened',
            'clicked': 'clicked',
            'bounced': 'bounced',
            'replied': 'replied'
        }

        const newStatus = statusMap[event]
        if (!newStatus) {
            return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
        }

        // Mise à jour du statut
        const updateData: any = {
            email_status: newStatus,
            updated_at: new Date().toISOString()
        }

        // Ajouter timestamp spécifique si ouverture
        if (event === 'opened' && timestamp) {
            updateData.email_opened_at = timestamp
        }

        const { error } = await supabase
            .from('campaign_prospects')
            .update(updateData)
            .eq('id', campaign_prospect_id)

        if (error) {
            console.error('Error updating email status:', error)
            return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
        }

        console.log(`✅ Email event processed: ${event} for ${campaign_prospect_id}`)

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Error in email-events webhook:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
