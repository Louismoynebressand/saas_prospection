
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

// Placeholder URL - To be replaced by environment variable or user input
const PLACEHOLDER_WEBHOOK_URL = "https://n8n.srv903375.hstgr.cloud/webhook/test-smtp-config-placeholder"

export async function verifySmtpWithWebhook(config: SmtpConfigForVerification): Promise<VerificationResult> {
    const webhookUrl = process.env.N8N_WEBHOOK_SMTP_TEST || PLACEHOLDER_WEBHOOK_URL

    try {
        // Normalize payload
        const payload = {
            smtp_host: config.smtp_host,
            smtp_port: config.smtp_port,
            smtp_user: config.smtp_user,
            smtp_password: config.smtp_password || config.pass,
            from_email: config.from_email || config.smtp_user,
            from_name: config.from_name,
            provider: config.provider
        }

        console.log("Verifying SMTP Config via Webhook:", webhookUrl)

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            throw new Error(`Webhook responded with status: ${response.status}`)
        }

        const data = await response.json()

        // Interpret N8N response
        // Expecting { success: true/false, message: "..." }
        // Adjust based on actual N8N output structure if needed
        return {
            success: data.success === true || data.result === true, // Handle variants
            message: data.message || data.error || (data.success ? "Connexion vérifiée" : "Echec de connexion"),
            details: data
        }

    } catch (error: any) {
        console.error("SMTP Verification Webhook Failed:", error)
        return {
            success: false,
            message: "Erreur lors de la vérification (Webhook inaccessible ou erreur technique)",
            details: error.message
        }
    }
}
