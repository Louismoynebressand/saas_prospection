/**
 * lib/mailgun.ts
 * Utilitaire serveur uniquement pour l'intégration Mailgun.
 * Ne jamais importer côté client.
 */

export interface MailgunConfig {
    id: string
    mailgun_domain: string
    mailgun_region: 'US' | 'EU'
    mailgun_api_key: string
    from_email: string
    from_name?: string | null
    reply_to?: string | null
    tracking_opens?: boolean
    tracking_clicks?: boolean
}

export interface MailgunEmailData {
    to: string
    subject: string
    html: string
    text?: string
    // Custom variables pour retrouver l'envoi côté webhook
    campaign_id?: string
    lead_id?: string
    email_send_id?: string
    user_id?: string
}

export interface MailgunSendResult {
    success: boolean
    messageId?: string
    error?: string
    rawResponse?: unknown
}

/**
 * Retourne l'URL de base Mailgun selon la région.
 */
export function getMailgunBaseUrl(region: 'US' | 'EU'): string {
    return region === 'EU'
        ? 'https://api.eu.mailgun.net'
        : 'https://api.mailgun.net'
}

/**
 * Construit les credentials Basic Auth Mailgun.
 */
function buildAuthHeader(apiKey: string): string {
    return 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
}

/**
 * Envoie un email via l'API Mailgun.
 * Doit être appelé uniquement côté serveur (route API / cron).
 */
export async function sendMailgunEmail(
    config: MailgunConfig,
    emailData: MailgunEmailData
): Promise<MailgunSendResult> {
    const baseUrl = getMailgunBaseUrl(config.mailgun_region)
    const endpoint = `${baseUrl}/v3/${config.mailgun_domain}/messages`

    const fromStr = config.from_name
        ? `${config.from_name} <${config.from_email}>`
        : config.from_email

    // Mailgun attend un FormData (application/x-www-form-urlencoded ou multipart)
    const formData = new URLSearchParams()
    formData.append('from', fromStr)
    formData.append('to', emailData.to)
    formData.append('subject', emailData.subject)
    formData.append('html', emailData.html)

    if (emailData.text) {
        formData.append('text', emailData.text)
    }

    if (config.reply_to) {
        formData.append('h:Reply-To', config.reply_to)
    }

    // Tracking
    formData.append('o:tracking-opens', config.tracking_opens !== false ? 'yes' : 'no')
    formData.append('o:tracking-clicks', config.tracking_clicks !== false ? 'yes' : 'no')

    // Custom variables pour retrouver l'envoi dans les webhooks
    if (emailData.campaign_id) {
        formData.append('v:campaign_id', emailData.campaign_id)
    }
    if (emailData.lead_id) {
        formData.append('v:lead_id', emailData.lead_id)
    }
    if (emailData.email_send_id) {
        formData.append('v:email_send_id', emailData.email_send_id)
    }
    if (emailData.user_id) {
        formData.append('v:user_id', emailData.user_id)
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: buildAuthHeader(config.mailgun_api_key),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        })

        const rawResponse = await response.json()

        if (response.ok && rawResponse.id) {
            return {
                success: true,
                // Mailgun retourne l'ID entre <> : "<messageId@domain>"
                messageId: rawResponse.id.replace(/[<>]/g, ''),
                rawResponse,
            }
        } else {
            return {
                success: false,
                error: rawResponse.message || `HTTP ${response.status}`,
                rawResponse,
            }
        }
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : 'Erreur réseau Mailgun'
        return { success: false, error }
    }
}

/**
 * Vérifie la signature d'un webhook Mailgun.
 * Utilise HMAC-SHA256 avec la Webhook Signing Key.
 * https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#verify-webhook-events
 */
export async function verifyMailgunWebhookSignature(
    timestamp: string,
    token: string,
    signature: string,
    signingKey: string
): Promise<boolean> {
    try {
        const encodedKey = new TextEncoder().encode(signingKey)
        const encodedData = new TextEncoder().encode(timestamp + token)

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            encodedKey,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )

        const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encodedData)
        const computedSignature = Buffer.from(signatureBuffer).toString('hex')

        return computedSignature === signature
    } catch (err) {
        console.error('[Mailgun] Signature verification error:', err)
        return false
    }
}

/**
 * Vérifie qu'un domaine existe sur Mailgun (pour le test de connexion).
 */
export async function checkMailgunDomain(
    apiKey: string,
    domain: string,
    region: 'US' | 'EU'
): Promise<{ success: boolean; domainData?: unknown; error?: string }> {
    const baseUrl = getMailgunBaseUrl(region)
    const endpoint = `${baseUrl}/v3/domains/${domain}`

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                Authorization: buildAuthHeader(apiKey),
            },
        })

        const data = await response.json()

        if (response.ok) {
            return { success: true, domainData: data }
        } else {
            return {
                success: false,
                error: data.message || `HTTP ${response.status} — Domaine introuvable ou clé invalide`,
            }
        }
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : 'Erreur réseau'
        return { success: false, error }
    }
}
