
export interface SmtpConfigForVerification {
    smtp_host: string
    smtp_port: number
    smtp_user: string
    smtp_password?: string // password might be passed as 'pass' or 'smtp_password'
    pass?: string // for compatibility
    from_email?: string
    from_name?: string
    provider?: string
}

export interface VerificationResult {
    success: boolean
    message?: string
    details?: any
}

// Webhook URL - can be overridden via environment variable
const DEFAULT_WEBHOOK_URL = "https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_test_configuration_smtp"

export async function verifySmtpWithWebhook(config: SmtpConfigForVerification): Promise<VerificationResult> {
    const webhookUrl = process.env.N8N_WEBHOOK_SMTP_TEST || DEFAULT_WEBHOOK_URL

    // Normalize payload
    const payload = {
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_user: config.smtp_user,
        smtp_password: config.smtp_password || config.pass,
        from_email: config.from_email || config.smtp_user,
        from_name: config.from_name || "",
        provider: config.provider || "custom"
    }

    console.log(`📤 [SMTP Test] Calling webhook: ${webhookUrl}`)

    // Create abort controller for timeout (30s max like other webhooks)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'NeuraFlow/1.0'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        console.log(`📥 [SMTP Test] Webhook response: ${webhookResponse.status}`)

        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text()
            console.error(`❌ [SMTP Test] Webhook error body: ${errorText}`)
            return {
                success: false,
                message: `Erreur webhook (${webhookResponse.status}): ${errorText}`,
                details: errorText
            }
        }

        // Parse response - N8N returns an array with one object
        const data = await webhookResponse.json()
        console.log(`✅ [SMTP Test] Webhook response data:`, data)

        // Handle array response from n8n
        const result = Array.isArray(data) ? data[0] : data

        // Check if validation is successful
        // Expected format: { "statut": "finish", "validation SMTP": "Valide" | "Refuse", "raison_refus": "..." }
        const isValid = result?.["validation SMTP"] === "Valide" || result?.validation_smtp === "Valide"

        if (isValid) {
            return {
                success: true,
                message: "✅ Configuration SMTP validée avec succès !",
                details: result
            }
        } else {
            // If refused, extract the reason
            const refusalReason = result?.raison_refus || result?.error || "Échec de connexion SMTP"
            return {
                success: false,
                message: refusalReason,
                details: result
            }
        }

    } catch (error: any) {
        clearTimeout(timeoutId)

        // Handle timeout
        if (error.name === 'AbortError') {
            console.error("⏱️ [SMTP Test] Webhook timeout after 30 seconds")
            return {
                success: false,
                message: "Délai d'attente dépassé (30s). Le serveur SMTP ne répond pas.",
                details: "timeout"
            }
        }

        console.error("❌ [SMTP Test] Webhook error:", error)
        return {
            success: false,
            message: `Erreur de connexion: ${error.message}`,
            details: error.message
        }
    }
}
