/**
 * Safely parse a JSON string or passthrough an object.
 * 
 * Handles sentinel strings like "aucune_donnée_trouve", plain text values,
 * and any malformed JSON without throwing.
 * 
 * @param raw - The value to parse (string, object, null, undefined)
 * @param fallback - Value to return if parsing fails (default: {})
 */
export function safeJsonParse<T = Record<string, any>>(raw: any, fallback: T = {} as T): T {
    if (raw === null || raw === undefined) return fallback
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw as T
    if (Array.isArray(raw)) return raw as unknown as T
    if (typeof raw === 'string') {
        const trimmed = raw.trim()
        // Only attempt parse if it looks like JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return JSON.parse(trimmed) as T
            } catch {
                return fallback
            }
        }
        // Sentinel value or plain text — return fallback silently
    }
    return fallback
}

/**
 * Extract name from a prospect's data_scrapping JSON.
 */
export function extractProspectName(dataScrapping: any, deepSearch?: any): string {
    const data = safeJsonParse(dataScrapping)
    const deep = safeJsonParse(deepSearch)
    return (
        data.Titre || data.title || data.nom_complet || data.name ||
        (data.nom ? `${data.prenom || ''} ${data.nom}`.trim() : null) ||
        deep.nom_raison_sociale || deep.nom_complet ||
        'Prospect'
    )
}

/**
 * Extract company from a prospect's data.
 */
export function extractProspectCompany(dataScrapping: any, deepSearch?: any, secteur?: string): string {
    const data = safeJsonParse(dataScrapping)
    const deep = safeJsonParse(deepSearch)
    return data.company || data.companyName || data.societe || data['Nom de catégorie'] || secteur || deep.nom_raison_sociale || ''
}

/**
 * Extract email string from prospect.email_adresse_verified (may be array, JSON string, or plain string).
 */
export function extractProspectEmail(rawEmail: any): string {
    if (!rawEmail) return ''
    if (Array.isArray(rawEmail) && rawEmail.length > 0) return String(rawEmail[0])
    if (typeof rawEmail === 'string') {
        const trimmed = rawEmail.trim()
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed)
                if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0])
            } catch { /* fall through */ }
        }
        return trimmed
    }
    return ''
}
