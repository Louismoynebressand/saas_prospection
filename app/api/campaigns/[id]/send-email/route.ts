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

        // Récupérer les prospects
        const { data: campaignProspectsData, error: cpError } = await supabase
            .from('campaign_prospects')
            .select('*')
            .eq('campaign_id', campaignId)
            .in('prospect_id', targetProspectIds)

        if (cpError) {
            return NextResponse.json({ error: 'DB Error on prospects: ' + cpError.message }, { status: 500 })
        }

        if (!campaignProspectsData || campaignProspectsData.length === 0) {
            return NextResponse.json({ error: 'No prospects found in campaign' }, { status: 404 })
        }

        // Fetch cold_email_generations separately
        const { data: generationsData, error: genError } = await supabase
            .from('cold_email_generations')
            .select('id, prospect_id, step, subject, message, created_at')
            .eq('campaign_id', campaignId)
            .in('prospect_id', targetProspectIds)

        if (genError) {
            return NextResponse.json({ error: 'DB Error on generations: ' + genError.message }, { status: 500 })
        }

        // Fetch scrape_prospect separately
        const { data: scrapeData, error: scrapeError } = await supabase
            .from('scrape_prospect')
            .select('id_prospect, email_adresse_verified')
            .in('id_prospect', targetProspectIds)

        if (scrapeError) {
            return NextResponse.json({ error: 'DB Error on scrape: ' + scrapeError.message }, { status: 500 })
        }

        // Merge them in memory
        const campaignProspects = campaignProspectsData.map(cp => {
            const cpGens = generationsData?.filter(g => g.prospect_id === cp.prospect_id) || []
            const sp = scrapeData?.find(s => s.id_prospect === cp.prospect_id) || null
            return {
                ...cp,
                cold_email_generations: cpGens,
                scrape_prospect: sp
            }
        })


        const results = []

        for (const cp of campaignProspects) {
            // Récupérer le dernier email généré (celui avec le step le plus grand, ou plus récent)
            const sortedEmails = cp.cold_email_generations?.sort((a: any, b: any) => {
                if (b.step !== a.step) return (b.step || 1) - (a.step || 1)
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            }) || []
            
            const latestEmail = sortedEmails.length > 0 ? sortedEmails[0] : null

            // Fallback for backward compatibility
            const hasBackwardCompatContent = !!cp.generated_email_content
            
            if (cp.email_status === 'not_generated' || (!latestEmail && !hasBackwardCompatContent)) {
                results.push({ prospect_id: cp.prospect_id, success: false, error: 'Email not generated yet' })
                continue
            }

            try {
                // ----------------------------------------------------------------
                // 1. Créer l'entrée email_sends AVANT l'envoi pour le tracking
                //    → On obtient un email_send_id à passer à n8n
                // ----------------------------------------------------------------
                let htmlContent = ''
                if (latestEmail?.message) {
                    htmlContent = latestEmail.message
                } else if (typeof cp.generated_email_content === 'string') {
                    htmlContent = cp.generated_email_content
                } else if (cp.generated_email_content) {
                    htmlContent = cp.generated_email_content.body || cp.generated_email_content.html || ''
                }

                const subject = latestEmail?.subject || cp.generated_email_subject || ''

                // Extraire l'email correctement
                let prospectEmail = ''
                const rawEmail = (cp as any).scrape_prospect?.email_adresse_verified
                if (Array.isArray(rawEmail) && rawEmail.length > 0) {
                    prospectEmail = rawEmail[0]
                } else if (typeof rawEmail === 'string' && rawEmail.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(rawEmail)
                        prospectEmail = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : rawEmail
                    } catch {
                        prospectEmail = rawEmail
                    }
                } else if (typeof rawEmail === 'string' && rawEmail.length > 0) {
                    prospectEmail = rawEmail
                }

                const { data: emailSend, error: insertError } = await supabase
                    .from('email_sends')
                    .insert({
                        user_id: user.id,
                        campaign_id: campaignId,
                        lead_id: cp.prospect_id,
                        sending_account_id: smtpConfigurationId || null,
                        provider: sendingConfig?.provider === 'mailgun_api' ? 'mailgun' : 'smtp',
                        from_email: (sendingConfig?.from_email as string) || '',
                        to_email: prospectEmail,
                        subject: subject,
                        html: htmlContent,
                        status: 'prepared',
                    })
                    .select('id')
                    .single()

                if (insertError) {
                    console.error(`Failed to insert email_sends for prospect ${cp.prospect_id}:`, insertError)
                    throw new Error(`Failed to create email_sends: ${insertError.message}`)
                }

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
