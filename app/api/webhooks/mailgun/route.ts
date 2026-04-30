import { NextRequest, NextResponse } from "next/server"
import { verifyMailgunWebhookSignature } from "@/lib/mailgun"
import { createClient } from "@/lib/supabase/server"

// Mailgun event → statut email_sends
const EVENT_STATUS_MAP: Record<string, string> = {
    accepted: "accepted",
    delivered: "delivered",
    failed: "failed",
    opened: "opened",
    clicked: "clicked",
    complained: "complained",
    unsubscribed: "unsubscribed",
}

// Mailgun event → timestamp field dans email_sends
const EVENT_TIMESTAMP_FIELD: Record<string, string> = {
    delivered: "delivered_at",
    opened: "opened_at",
    clicked: "clicked_at",
    failed: "failed_at",
    complained: "complained_at",
    unsubscribed: "unsubscribed_at",
}

// Mailgun event → statut campaign_prospects.email_status
const PROSPECT_STATUS_MAP: Record<string, string> = {
    accepted: "sent",
    delivered: "sent",
    opened: "opened",
    clicked: "clicked",
    failed: "bounced",
    complained: "bounced",
    unsubscribed: "bounced",
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Structure d'un webhook Mailgun
        // https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/
        const signature = body.signature
        const eventData = body["event-data"]

        if (!signature || !eventData) {
            console.error("[Mailgun Webhook] Missing signature or event-data")
            return NextResponse.json({ error: "Payload invalide" }, { status: 400 })
        }

        // Vérification de la signature Mailgun
        const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY
        if (signingKey) {
            const isValid = await verifyMailgunWebhookSignature(
                String(signature.timestamp),
                String(signature.token),
                String(signature.signature),
                signingKey
            )
            if (!isValid) {
                console.error("[Mailgun Webhook] Invalid signature")
                return NextResponse.json({ error: "Signature invalide" }, { status: 401 })
            }
        } else {
            // En dev, on log un avertissement mais on continue
            console.warn("[Mailgun Webhook] MAILGUN_WEBHOOK_SIGNING_KEY non défini — signature non vérifiée")
        }

        // Extraction des données de l'événement
        const eventType: string = eventData.event || ""
        const recipient: string = eventData.recipient || ""
        const timestamp: number = eventData.timestamp || 0
        const messageHeaders = eventData.message?.headers || {}
        const providerMessageId: string = (messageHeaders["message-id"] || eventData.id || "").replace(/[<>]/g, "")
        const url: string = eventData.url || ""
        const deliveryStatus = eventData["delivery-status"] || {}
        const reason: string = deliveryStatus.description || deliveryStatus.message || ""
        const severity: string = eventData.severity || ""

        // Custom variables envoyées lors de l'envoi
        const userVariables = eventData["user-variables"] || {}
        const campaignId: string = userVariables.campaign_id || ""
        const leadId: string = userVariables.lead_id || ""
        const emailSendId: string = userVariables.email_send_id || ""

        const supabase = await createClient()

        // ----------------------------------------------------------------
        // 1. Insérer l'événement dans email_events
        // ----------------------------------------------------------------
        const { error: insertEventError } = await supabase
            .from("email_events")
            .insert({
                email_send_id: emailSendId || null,
                provider: "mailgun",
                event_type: eventType,
                recipient,
                provider_message_id: providerMessageId || null,
                event_timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : null,
                url: url || null,
                reason: reason || null,
                severity: severity || null,
                raw_payload: body,
            })

        if (insertEventError) {
            console.error("[Mailgun Webhook] Failed to insert email_event:", insertEventError)
            // On continue malgré l'erreur d'insertion pour traiter le reste
        }

        // ----------------------------------------------------------------
        // 2. Mettre à jour email_sends si on peut identifier l'envoi
        // ----------------------------------------------------------------
        const newStatus = EVENT_STATUS_MAP[eventType]
        const timestampField = EVENT_TIMESTAMP_FIELD[eventType]
        const eventTs = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString()

        if (newStatus) {
            // Trouver l'email_send via l'ID custom variable en priorité, sinon via provider_message_id
            let sendQuery = supabase.from("email_sends").update({
                status: newStatus,
                ...(timestampField ? { [timestampField]: eventTs } : {}),
                ...(eventType === "failed" ? { error_message: reason || "Erreur Mailgun" } : {}),
            })

            if (emailSendId) {
                await sendQuery.eq("id", emailSendId)
            } else if (providerMessageId) {
                await sendQuery.eq("provider_message_id", providerMessageId)
            }
        }

        // ----------------------------------------------------------------
        // 3. Mettre à jour campaign_prospects si applicable
        // ----------------------------------------------------------------
        const prospectStatus = PROSPECT_STATUS_MAP[eventType]
        if (prospectStatus && (campaignId || leadId)) {
            const updateData: Record<string, string> = {
                email_status: prospectStatus,
                updated_at: new Date().toISOString(),
            }

            // Ajouter timestamp d'ouverture si applicable
            if (eventType === "opened") {
                updateData.email_opened_at = eventTs
            }

            let prospectQuery = supabase.from("campaign_prospects").update(updateData)

            if (campaignId && leadId) {
                prospectQuery = prospectQuery
                    .eq("campaign_id", campaignId)
                    .eq("prospect_id", leadId)
            } else if (campaignId) {
                // Fallback : chercher via l'email du destinataire + campaign_id
                const { data: prospect } = await supabase
                    .from("scrape_prospect")
                    .select("id")
                    .eq("email", recipient)
                    .limit(1)
                    .single()

                if (prospect) {
                    prospectQuery = prospectQuery
                        .eq("campaign_id", campaignId)
                        .eq("prospect_id", prospect.id)
                } else {
                    prospectQuery = null as unknown as typeof prospectQuery
                }
            }

            if (prospectQuery) {
                const { error: prospectError } = await prospectQuery
                if (prospectError) {
                    console.error("[Mailgun Webhook] Failed to update campaign_prospects:", prospectError)
                }
            }
        }

        console.log(`✅ [Mailgun Webhook] Event "${eventType}" traité pour ${recipient}`)
        return NextResponse.json({ success: true })

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur serveur"
        console.error("[Mailgun Webhook] Unhandled error:", message)
        // Toujours retourner 200 pour que Mailgun ne re-tente pas indéfiniment
        return NextResponse.json({ success: false, error: message }, { status: 200 })
    }
}
