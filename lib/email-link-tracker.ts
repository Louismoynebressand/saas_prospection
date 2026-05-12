/**
 * lib/email-link-tracker.ts
 * 
 * Utilitaires pour générer des liens de tracking traçables dans les signatures d'email.
 * À utiliser lors de la génération d'email pour remplacer les URLs brutes.
 */

import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LinkType = 'phone' | 'email' | 'website' | 'custom'

export interface SignatureLinkDef {
    type: LinkType
    url: string
    label: string
}

export interface TrackedLinkRecord {
    id: string
    short_code: string
    link_type: LinkType
    original_url: string
    link_label: string
    tracking_url: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Génère un short_code alphanumérique aléatoire de 8 caractères
 */
function generateShortCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const randomValues = new Uint8Array(8)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomValues)
        for (let i = 0; i < 8; i++) {
            result += chars[randomValues[i] % chars.length]
        }
    } else {
        for (let i = 0; i < 8; i++) {
            result += chars[Math.floor(Math.random() * chars.length)]
        }
    }
    return result
}

/**
 * Retourne l'URL de base de l'application (pour les liens de tracking)
 */
export function getBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    // Force the production domain to avoid Vercel Authentication on preview deployments
    return 'https://saas-prospection.vercel.app';
}

/**
 * Construit l'URL de tracking complète à partir d'un short_code
 */
export function buildTrackingUrl(shortCode: string): string {
    return `${getBaseUrl()}/api/track/${shortCode}`
}

// ─── Extraction des liens de signature ───────────────────────────────────────

/**
 * Extrait tous les liens présents dans une signature de campagne.
 * Retourne uniquement les liens activés et non-vides.
 */
export function extractSignatureLinks(campaign: Record<string, any>): SignatureLinkDef[] {
    const links: SignatureLinkDef[] = []

    // Téléphone
    if (campaign.signature_phone && campaign.signature_show_phone !== false) {
        const phone = String(campaign.signature_phone).trim()
        if (phone) {
            links.push({
                type: 'phone',
                url: `tel:${phone.replace(/\s/g, '')}`,
                label: phone,
            })
        }
    }

    // Email de signature
    if (campaign.signature_email && campaign.signature_show_email !== false) {
        const email = String(campaign.signature_email).trim()
        if (email) {
            links.push({
                type: 'email',
                url: `mailto:${email}`,
                label: email,
            })
        }
    }

    // Site web
    if (campaign.my_website && campaign.signature_show_website !== false) {
        const website = String(campaign.my_website).trim()
        if (website) {
            links.push({
                type: 'website',
                url: website.startsWith('http') ? website : `https://${website}`,
                label: campaign.signature_website_text || 'Visitez notre site web',
            })
        }
    }

    // Lien personnalisé (Calendly, devis, etc.)
    if (campaign.signature_custom_link_url && campaign.signature_custom_link_text) {
        const customUrl = String(campaign.signature_custom_link_url).trim()
        if (customUrl) {
            links.push({
                type: 'custom',
                url: customUrl.startsWith('http') ? customUrl : `https://${customUrl}`,
                label: String(campaign.signature_custom_link_text).trim(),
            })
        }
    }

    return links
}

// ─── Création des liens en base ───────────────────────────────────────────────

/**
 * Crée les enregistrements de tracking dans Supabase pour un prospect donné.
 * Retourne les records créés avec leurs tracking URLs.
 */
export async function createTrackedLinksForProspect(
    campaignId: string,
    prospectId: number | string,
    links: SignatureLinkDef[]
): Promise<TrackedLinkRecord[]> {
    if (links.length === 0) return []

    const supabase = await createClient()
    const records: TrackedLinkRecord[] = []

    for (const link of links) {
        // Générer un short_code unique (retry si collision)
        let shortCode = generateShortCode()
        let attempts = 0
        while (attempts < 5) {
            const { data: existing } = await supabase
                .from('email_tracked_links')
                .select('id')
                .eq('short_code', shortCode)
                .single()
            if (!existing) break
            shortCode = generateShortCode()
            attempts++
        }

        const { data, error } = await supabase
            .from('email_tracked_links')
            .insert({
                campaign_id: campaignId,
                prospect_id: Number(prospectId),
                link_type: link.type,
                link_label: link.label,
                original_url: link.url,
                short_code: shortCode,
            })
            .select()
            .single()

        if (error) {
            console.error(`[LinkTracker] Failed to create tracked link for type=${link.type}:`, error)
            continue
        }

        records.push({
            id: data.id,
            short_code: shortCode,
            link_type: link.type,
            original_url: link.url,
            link_label: link.label,
            tracking_url: buildTrackingUrl(shortCode),
        })
    }

    return records
}

// ─── Construction du HTML de signature avec liens tracés ─────────────────────

/**
 * Génère le HTML de la signature en remplaçant les URLs brutes par les URLs de tracking.
 * Prend les données de campagne + les liens tracés créés.
 */
export function buildTrackedSignatureHtml(
    campaign: Record<string, any>,
    trackedLinks: TrackedLinkRecord[]
): string {
    // Map type → tracking URL
    const trackingByType: Partial<Record<LinkType, TrackedLinkRecord>> = {}
    trackedLinks.forEach(tl => { trackingByType[tl.link_type] = tl })

    const elements: string[] = []
    const order: string[] = campaign.signature_elements_order || [
        'name', 'title', 'phone', 'email', 'website', 'custom_link', 'ps'
    ]

    for (const element of order) {
        switch (element) {
            case 'name':
                if (campaign.signature_name) {
                    elements.push(`<div style="margin-bottom:4px"><strong style="font-size:15px;color:#111">${escHtml(campaign.signature_name)}</strong></div>`)
                }
                break

            case 'title': {
                const parts = [campaign.signature_title, campaign.signature_company].filter(Boolean)
                if (parts.length > 0) {
                    elements.push(`<div style="margin-bottom:4px;font-size:13px;color:#555">${parts.map(escHtml).join(' • ')}</div>`)
                }
                break
            }

            case 'phone': {
                const phone = campaign.signature_phone
                if (phone && campaign.signature_show_phone !== false) {
                    const tl = trackingByType['phone']
                    const href = tl ? tl.tracking_url : `tel:${String(phone).replace(/\s/g, '')}`
                    elements.push(`<div style="margin-bottom:4px;font-size:13px">📞 <a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:none">${escHtml(phone)}</a></div>`)
                }
                break
            }

            case 'email': {
                const sigEmail = campaign.signature_email
                if (sigEmail && campaign.signature_show_email !== false) {
                    const tl = trackingByType['email']
                    const href = tl ? tl.tracking_url : `mailto:${sigEmail}`
                    elements.push(`<div style="margin-bottom:4px;font-size:13px">✉️ <a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:none">${escHtml(sigEmail)}</a></div>`)
                }
                break
            }

            case 'website': {
                const website = campaign.my_website
                if (website && campaign.signature_show_website !== false) {
                    const tl = trackingByType['website']
                    const href = tl ? tl.tracking_url : website
                    const label = campaign.signature_website_text || 'Visitez notre site web'
                    elements.push(`<div style="margin-bottom:4px;font-size:13px">🌐 <a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:none">${escHtml(label)}</a></div>`)
                }
                break
            }

            case 'custom_link': {
                const customUrl = campaign.signature_custom_link_url
                const customText = campaign.signature_custom_link_text
                if (customUrl && customText) {
                    const tl = trackingByType['custom']
                    const href = tl ? tl.tracking_url : customUrl
                    elements.push(`<div style="margin-bottom:4px;font-size:13px">🔗 <a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:none">${escHtml(customText)}</a></div>`)
                }
                break
            }

            case 'ps':
                if (campaign.signature_ps) {
                    elements.push(`<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;font-style:italic">${escHtml(campaign.signature_ps)}</div>`)
                }
                break
        }
    }

    if (elements.length === 0) return ''

    return `<div style="font-family:Arial,sans-serif;margin-top:24px;padding-top:16px;border-top:2px solid #e5e7eb">${elements.join('')}</div>`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
