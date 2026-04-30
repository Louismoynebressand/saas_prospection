"use server"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/webhooks/email-events
 *
 * Webhook polyvalent appelé par n8n pour :
 * 1. Confirmer l'envoi d'un email (avec mailgun_id éventuel) → met à jour email_sends + campaign_prospects
 * 2. Signaler un événement email (ouvert, cliqué, bounce, répondu)
 *
 * Payload attendu (envoi Mailgun via n8n) :
 * {
 *   "event": "sent" | "accepted",
 *   "campaign_id": "uuid",
 *   "prospect_id": "string",
 *   "user_id": "uuid",
 *   "email_send_id": "uuid",         ← ID créé par l'app avant d'appeler n8n
 *   "mailgun_id": "xxx@mg.domain",   ← ID retourné par Mailgun à n8n
 *   "status": "en cours d'envoi",    ← Texte libre de n8n
 *   "from_email": "...",
 *   "to_email": "...",
 *   "subject": "..."
 * }
 *
 * Payload attendu (événement email, backward compat) :
 * {
 *   "event": "opened" | "clicked" | "bounced" | "replied",
 *   "campaign_prospect_id": "uuid",
 *   "timestamp": "2026-02-01T22:00:00Z"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            event,
            // Backward compat (événements anciens)
            campaign_prospect_id,
            timestamp,
            // Nouvelles données de confirmation d'envoi
            campaign_id,
            prospect_id,
            user_id,
            email_send_id,
            mailgun_id,
            from_email,
            to_email,
            subject,
        } = body

        if (!event) {
            return NextResponse.json({ error: 'event required' }, { status: 400 })
        }

        const supabase = await createClient()
        const now = new Date().toISOString()

        // ================================================================
        // CAS 1 : Confirmation d'envoi Mailgun depuis n8n
        //         event = "sent" | "accepted" + mailgun_id présent
        // ================================================================
        if ((event === 'sent' || event === 'accepted') && (campaign_id || email_send_id)) {

            // 1a. Mettre à jour email_sends avec le mailgun_id si on a l'email_send_id
            if (email_send_id) {
                const updateData: Record<string, unknown> = {
                    status: 'accepted',
                    sent_at: now,
                }
                if (mailgun_id) updateData.provider_message_id = mailgun_id.replace(/[<>]/g, '')
                if (from_email) updateData.from_email = from_email
                if (to_email) updateData.to_email = to_email
                if (subject) updateData.subject = subject

                const { error: sendUpdateError } = await supabase
                    .from('email_sends')
                    .update(updateData)
                    .eq('id', email_send_id)

                if (sendUpdateError) {
                    console.error('Failed to update email_sends:', sendUpdateError)
                }
            } else if (campaign_id && prospect_id && mailgun_id) {
                // Fallback : pas d'email_send_id → créer l'entrée maintenant
                await supabase.from('email_sends').insert({
                    user_id: user_id || null,
                    campaign_id,
                    lead_id: prospect_id || null,
                    provider: 'mailgun',
                    provider_message_id: mailgun_id.replace(/[<>]/g, ''),
                    from_email: from_email || '',
                    to_email: to_email || '',
                    subject: subject || '',
                    status: 'accepted',
                    sent_at: now,
                })
            }

            // 1b. Mettre à jour campaign_prospects
            if (campaign_id && prospect_id) {
                await supabase.from('campaign_prospects')
                    .update({
                        email_status: 'sent',
                        email_sent_at: now,
                        updated_at: now,
                    })
                    .eq('campaign_id', campaign_id)
                    .eq('prospect_id', prospect_id)
            }

            console.log(`✅ [email-events] Envoi confirmé – mailgun_id: ${mailgun_id || 'N/A'} – email_send_id: ${email_send_id || 'N/A'}`)
            return NextResponse.json({ success: true, action: 'send_confirmed' })
        }

        // ================================================================
        // CAS 2 : Événement email (backward compat) — opened/clicked/bounced/replied
        // ================================================================
        const statusMap: Record<string, string> = {
            'opened': 'opened',
            'clicked': 'clicked',
            'bounced': 'bounced',
            'replied': 'replied',
        }

        const newStatus = statusMap[event]
        if (!newStatus) {
            return NextResponse.json({ error: `Invalid event type: ${event}` }, { status: 400 })
        }

        if (!campaign_prospect_id) {
            return NextResponse.json({ error: 'campaign_prospect_id required for event tracking' }, { status: 400 })
        }

        const updateData: Record<string, unknown> = {
            email_status: newStatus,
            updated_at: now,
        }
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

        console.log(`✅ [email-events] Event "${event}" processed for campaign_prospect ${campaign_prospect_id}`)
        return NextResponse.json({ success: true, action: 'event_processed' })

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error in email-events webhook:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
