import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/campaigns/[id]/send-email
 * Envoie les emails générés pour un ou plusieurs prospects via n8n.
 * Crée une entrée dans email_sends avant l'appel n8n pour le tracking.
 *
 * Body: { prospectId?: string, prospectIds?: string[], smtpConfigurationId?: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectId, prospectIds, smtpConfigurationId } = body
        const { id: campaignId } = await params

        // Normalise en tableau
        const targetProspectIds = prospectId ? [prospectId] : prospectIds
        if (!targetProspectIds || !Array.isArray(targetProspectIds) || targetProspectIds.length === 0) {
            return NextResponse.json({ error: 'prospectId or prospectIds required' }, { status: 400 })
        }

        // Vérification propriété campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select('id, user_id')
            .eq('id', campaignId)
            .single()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.id !== campaign.user_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Récupérer la config d'envoi si fournie (pour savoir from_email, provider, etc.)
        let sendingConfig: Record<string, unknown> | null = null
        if (smtpConfigurationId) {
            const { data: cfg } = await supabase
                .from('smtp_configurations')
                .select('id, provider, from_email, from_name, mailgun_domain, mailgun_region')
                .eq('id', smtpConfigurationId)
                .eq('user_id', user.id)
                .single()
            sendingConfig = cfg
        }

        // Récupérer les prospects de la campagne
        const { data: campaignProspects, error: cpError } = await supabase
            .from('campaign_prospects')
            .select('*')
            .eq('campaign_id', campaignId)
            .in('prospect_id', targetProspectIds)

        if (cpError || !campaignProspects || campaignProspects.length === 0) {
            return NextResponse.json({ error: 'No prospects found in campaign' }, { status: 404 })
        }

        const results = []

        for (const cp of campaignProspects) {
            // Vérifier que l'email est généré
            if (cp.email_status === 'not_generated' || !cp.generated_email_content) {
                results.push({ prospect_id: cp.prospect_id, success: false, error: 'Email not generated yet' })
                continue
            }

            try {
                // ----------------------------------------------------------------
                // 1. Créer l'entrée email_sends AVANT l'envoi pour le tracking
                //    → On obtient un email_send_id à passer à n8n
                // ----------------------------------------------------------------
                const emailContent = cp.generated_email_content || {}
                const { data: emailSend } = await supabase
                    .from('email_sends')
                    .insert({
                        user_id: user.id,
                        campaign_id: campaignId,
                        lead_id: cp.prospect_id,
                        sending_account_id: smtpConfigurationId || null,
                        provider: sendingConfig?.provider === 'mailgun_api' ? 'mailgun' : 'smtp',
                        from_email: (sendingConfig?.from_email as string) || '',
                        to_email: cp.prospect_email || '',
                        subject: emailContent.subject || '',
                        html: emailContent.body || emailContent.html || '',
                        status: 'prepared',
                    })
                    .select('id')
                    .single()

                const emailSendId = emailSend?.id || null

                // ----------------------------------------------------------------
                // 2. Appeler n8n avec l'email_send_id et la config
                // ----------------------------------------------------------------
                const N8N_WEBHOOK = process.env.N8N_SENDING_WEBHOOK_URL
                    || 'https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_envoi_mail_smtp'

                const webhookRes = await fetch(N8N_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prospect_id: cp.prospect_id,
                        campaign_id: campaignId,
                        user_id: user.id,
                        smtp_configuration_id: smtpConfigurationId || null,
                        email_send_id: emailSendId,     // ← Pour le tracking Mailgun
                        email_order: 1
                    })
                })

                if (!webhookRes.ok) {
                    const errorText = await webhookRes.text()
                    throw new Error(`Webhook failed: ${webhookRes.status} ${errorText}`)
                }

                // ----------------------------------------------------------------
                // 3. n8n a REÇU la demande, mais n'a pas encore envoyé le mail.
                //    → email_sends reste "prepared" (sera mis à "accepted" par callback)
                //    → campaign_prospects passe à "sending" (en cours)
                //    Le callback /api/webhooks/email-events mettra "sent" quand confirmé.
                // ----------------------------------------------------------------
                // email_sends reste à 'prepared' — pas de mise à jour ici volontairement

                await supabase.from('campaign_prospects').update({
                    email_status: 'sending',
                    updated_at: new Date().toISOString()
                }).eq('id', cp.id)

                results.push({
                    prospect_id: cp.prospect_id,
                    email_send_id: emailSendId,
                    success: true,
                    status: 'sending'
                })

            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unknown error'
                console.error(`Failed to send email for prospect ${cp.prospect_id}:`, message)
                results.push({ prospect_id: cp.prospect_id, success: false, error: message })
            }
        }

        const successCount = results.filter(r => r.success).length
        return NextResponse.json({ success: true, sent: successCount, total: results.length, results })

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error in POST /api/campaigns/[id]/send-email:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
