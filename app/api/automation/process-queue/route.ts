import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendMailgunEmail } from "@/lib/mailgun"

// CRON Endpoint to process the queue
// Secured by a shared secret (CRON_SECRET)
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow local dev testing if secret is not set, otherwise secure it
        if (process.env.NODE_ENV === 'production' || process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const supabase = await createClient()

    try {
        // 1. Get Active Schedules
        // Only process schedules that are active and within the time window
        const now = new Date()
        const currentTime = now.toTimeString().slice(0, 8) // "HH:MM:SS"
        const currentDay = now.getDay() || 7 // 1=Mon, 7=Sun (JS 0=Sun)

        // Fetch active schedules
        // Note: Time window filtering is hard to do purely in SQL due to TZ complexities, 
        // so we fetch active ones and filter in code for MVP simplicity.
        const { data: schedules, error: schedError } = await supabase
            .from('campaign_schedules')
            .select('*')
            .eq('status', 'active')

        if (schedError) throw schedError

        const results = []

        for (const schedule of schedules) {
            // Check Days
            if (!schedule.days_of_week.includes(currentDay)) {
                results.push({ campaign: schedule.campaign_id, status: 'skipped (wrong day)' })
                continue
            }

            // Check Time Window
            if (currentTime < schedule.time_window_start || currentTime > schedule.time_window_end) {
                results.push({ campaign: schedule.campaign_id, status: 'skipped (out of window)' })
                continue
            }

            // Check Quota for Today
            // Count emails sent TODAY for this campaign
            const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
            const { count: sentToday, error: countError } = await supabase
                .from('email_queue')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', schedule.campaign_id)
                .eq('status', 'sent')
                .gte('sent_at', startOfDay.toISOString())

            if (countError) throw countError

            const remainingQuota = schedule.daily_limit - (sentToday || 0)

            if (remainingQuota <= 0) {
                results.push({ campaign: schedule.campaign_id, status: 'skipped (quota reached)' })
                continue
            }

            // Fetch Items to Process
            // Get pending items, prioritized, limited by remaining quota
            const { data: queueItems, error: itemsError } = await supabase
                .from('email_queue')
                .select(`
                    id, 
                    prospect_id,
                    prospect:scrape_prospect (
                        id_prospect, email, first_name, last_name, company, position,
                        campaign_prospects!inner(campaign_id)
                    )
                `)
                .eq('campaign_id', schedule.campaign_id)
                .eq('status', 'pending')
                .order('priority', { ascending: false }) // Higher priority first
                .order('created_at', { ascending: true }) // FIFO
                .limit(remainingQuota)

            if (itemsError) throw itemsError
            if (!queueItems || queueItems.length === 0) {
                results.push({ campaign: schedule.campaign_id, status: 'skipped (empty queue)' })
                continue
            }

            // PROCESS ITEMS
            let processedCount = 0
            for (const item of queueItems) {
                const prospect = item.prospect as any

                // Re-fetch campaign details (including user_id for SMTP)
                const { data: campaignData } = await supabase
                    .from('cold_email_campaigns')
                    .select('campaign_name, user_id')
                    .eq('id', schedule.campaign_id)
                    .single()

                if (!campaignData) {
                    await supabase.from('email_queue').update({ status: 'failed', error_message: 'Campaign not found' }).eq('id', item.id)
                    continue
                }

                // Get Generated Email Content
                const { data: generatedEmail, error: emailError } = await supabase
                    .from('generated_emails')
                    .select('*')
                    .eq('prospect_id', prospect.id_prospect)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (emailError || !generatedEmail) {
                    await supabase.from('email_queue').update({ status: 'failed', error_message: 'No generated email found' }).eq('id', item.id)
                    continue
                }

                // FETCH SMTP CONFIGURATION
                // Use the one defined in the schedule, or fallback (if legacy)
                let smtpConfig = null

                if (schedule.smtp_configuration_id) {
                    const { data: specificConfig, error: specificError } = await supabase
                        .from('smtp_configurations')
                        .select('*')
                        .eq('id', schedule.smtp_configuration_id)
                        .single()

                    if (!specificError && specificConfig) {
                        smtpConfig = specificConfig
                    }
                }

                // Fallback: If no specific config or it failed to load, try getting the user's default (first active)
                if (!smtpConfig) {
                    const { data: fallbackConfig, error: fallbackError } = await supabase
                        .from('smtp_configurations')
                        .select('*')
                        .eq('user_id', campaignData.user_id)
                        .eq('is_active', true)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single()

                    if (!fallbackError && fallbackConfig) {
                        smtpConfig = fallbackConfig
                    }
                }

                if (!smtpConfig) {
                    await supabase.from('email_queue').update({ status: 'failed', error_message: 'No active sending configuration found' }).eq('id', item.id)
                    continue
                }

                // ================================================================
                // BIFURCATION : Mailgun API natif vs SMTP via n8n
                // ================================================================
                const isMailgun = smtpConfig.provider === 'mailgun_api'

                if (isMailgun) {
                    // ---- MAILGUN API NATIF ----
                    try {
                        if (!smtpConfig.mailgun_api_key || !smtpConfig.mailgun_domain) {
                            throw new Error('Configuration Mailgun incomplète (api_key ou domain manquant)')
                        }

                        // Créer d'abord le tracking email_sends
                        const { data: emailSend, error: sendInsertError } = await supabase
                            .from('email_sends')
                            .insert({
                                user_id: campaignData.user_id,
                                campaign_id: schedule.campaign_id,
                                lead_id: prospect.id_prospect,
                                sending_account_id: smtpConfig.id,
                                provider: 'mailgun',
                                from_email: smtpConfig.from_email,
                                to_email: prospect.email,
                                subject: generatedEmail.subject,
                                html: generatedEmail.body,
                                status: 'prepared',
                            })
                            .select('id')
                            .single()

                        if (sendInsertError) {
                            console.error('Failed to insert email_send tracking:', sendInsertError)
                        }

                        const result = await sendMailgunEmail(
                            {
                                id: smtpConfig.id,
                                mailgun_domain: smtpConfig.mailgun_domain,
                                mailgun_region: smtpConfig.mailgun_region || 'US',
                                mailgun_api_key: smtpConfig.mailgun_api_key,
                                from_email: smtpConfig.from_email,
                                from_name: smtpConfig.from_name,
                                reply_to: smtpConfig.reply_to,
                                tracking_opens: smtpConfig.tracking_opens !== false,
                                tracking_clicks: smtpConfig.tracking_clicks !== false,
                            },
                            {
                                to: prospect.email,
                                subject: generatedEmail.subject,
                                html: generatedEmail.body,
                                text: generatedEmail.body_text || undefined,
                                campaign_id: schedule.campaign_id,
                                lead_id: prospect.id_prospect,
                                email_send_id: emailSend?.id || undefined,
                                user_id: campaignData.user_id,
                            }
                        )

                        if (result.success) {
                            // Mettre à jour le tracking email_sends
                            if (emailSend?.id) {
                                await supabase.from('email_sends').update({
                                    status: 'accepted',
                                    provider_message_id: result.messageId || null,
                                    sent_at: new Date().toISOString(),
                                    raw_provider_response: result.rawResponse as Record<string, unknown>,
                                }).eq('id', emailSend.id)
                            }

                            // Marquer la queue comme envoyée
                            await supabase.from('email_queue').update({
                                status: 'sent',
                                sent_at: new Date().toISOString()
                            }).eq('id', item.id)

                            // Mettre à jour campaign_prospects
                            await supabase.from('campaign_prospects')
                                .update({ email_status: 'sent', email_sent_at: new Date().toISOString() })
                                .eq('campaign_id', schedule.campaign_id)
                                .eq('prospect_id', prospect.id_prospect)

                            console.log(`✅ [Mailgun] Email envoyé à ${prospect.email} (msgId: ${result.messageId})`)
                            processedCount++
                        } else {
                            const errMsg = result.error || 'Erreur Mailgun inconnue'
                            if (emailSend?.id) {
                                await supabase.from('email_sends').update({
                                    status: 'failed',
                                    failed_at: new Date().toISOString(),
                                    error_message: errMsg,
                                }).eq('id', emailSend.id)
                            }
                            await supabase.from('email_queue').update({ status: 'failed', error_message: errMsg }).eq('id', item.id)
                            console.error(`❌ [Mailgun] Échec envoi à ${prospect.email}: ${errMsg}`)
                        }
                    } catch (err: any) {
                        const errMsg = err.message || 'Erreur Mailgun'
                        console.error('Mailgun Send Error:', err)
                        await supabase.from('email_queue').update({ status: 'failed', error_message: errMsg }).eq('id', item.id)
                    }

                } else {
                    // ---- SMTP VIA n8n (comportement existant inchangé) ----
                    const payload = {
                        to: prospect.email,
                        subject: generatedEmail.subject,
                        body: generatedEmail.body,
                        prospect_id: prospect.id_prospect,
                        campaign_id: schedule.campaign_id,
                        smtp_config: {
                            host: smtpConfig.smtp_host,
                            port: smtpConfig.smtp_port,
                            user: smtpConfig.smtp_user,
                            pass: smtpConfig.smtp_password,
                            from_name: smtpConfig.from_name || campaignData.campaign_name,
                            from_email: smtpConfig.from_email
                        },
                        metadata: {
                            first_name: prospect.first_name,
                            last_name: prospect.last_name,
                            company: prospect.company,
                            campaign_name: campaignData.campaign_name
                        }
                    }

                    const HARDCODED_WEBHOOK = "https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_envoi_mail_smtp"
                    const webhookUrl = process.env.N8N_SENDING_WEBHOOK_URL || HARDCODED_WEBHOOK

                    if (!webhookUrl) {
                        await supabase.from('email_queue').update({ status: 'failed', error_message: 'Configuration Error: Missing Webhook URL' }).eq('id', item.id)
                        console.error("Missing N8N_SENDING_WEBHOOK_URL")
                        continue
                    }

                    try {
                        const response = await fetch(webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        })

                        if (response.ok) {
                            await supabase.from('email_queue').update({
                                status: 'sent',
                                sent_at: new Date().toISOString()
                            }).eq('id', item.id)

                            await supabase.from('campaign_prospects')
                                .update({ email_status: 'sent', email_sent_at: new Date().toISOString() })
                                .eq('campaign_id', schedule.campaign_id)
                                .eq('prospect_id', prospect.id_prospect)

                            processedCount++
                        } else {
                            throw new Error(`Webhook error: ${response.statusText}`)
                        }
                    } catch (err: any) {
                        console.error("SMTP/n8n Sending Error:", err)
                        await supabase.from('email_queue').update({ status: 'failed', error_message: err.message }).eq('id', item.id)
                    }
                }
            }
            results.push({ campaign: schedule.campaign_id, processed: processedCount })
        }

        return NextResponse.json({ success: true, results })

    } catch (error: any) {
        console.error("Cron Job Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
