import { ProspectImportData, ProspectImportValidation } from '@/types'

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
    if (!email || email.trim() === '') return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
}

/**
 * Validates phone number (basic French format)
 */
export function validatePhone(phone: string): boolean {
    if (!phone || phone.trim() === '') return false
    // Accept various formats: +33, 0033, or starting with 0
    const phoneRegex = /^(\+33|0033|0)[1-9](\d{8}|\s\d{2}\s\d{2}\s\d{2}\s\d{2})$/
    const cleaned = phone.replace(/[\s.-]/g, '')
    return phoneRegex.test(cleaned) || cleaned.length >= 10
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): boolean {
    if (!url || url.trim() === '') return false
    try {
        new URL(url.trim())
        return true
    } catch {
        return false
    }
}

/**
 * Main validation function for prospect import data
 */
export function validateProspectData(data: ProspectImportData): ProspectImportValidation {
    const errors: string[] = []
    const warnings: string[] = []

    // ===== REQUIRED FIELDS =====
    if (!data.titre || data.titre.trim() === '') {
        errors.push('Le champ "Titre" est obligatoire')
    }

    // ===== RECOMMENDED FIELDS =====
    if (!data.email || data.email.trim() === '') {
        warnings.push('Email manquant (fortement recommandé)')
    } else if (!validateEmail(data.email)) {
        warnings.push('Format email invalide')
    }

    if (!data.site_web || data.site_web.trim() === '') {
        warnings.push('Site web manquant (fortement recommandé pour Deep Search)')
    } else if (!validateUrl(data.site_web)) {
        warnings.push('Format URL du site web invalide')
    }

    if (!data.telephone || data.telephone.trim() === '') {
        warnings.push('Téléphone manquant (fortement recommandé pour appels à froid)')
    } else if (!validatePhone(data.telephone)) {
        warnings.push('Format téléphone invalide')
    }

    if (!data.rue && !data.ville && !data.code_postal) {
        warnings.push('Adresse complète manquante (recommandée pour améliorer Deep Search)')
    }

    if (!data.secteur || data.secteur.trim() === '') {
        warnings.push('Secteur manquant (recommandé pour Deep Search)')
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    }
}

/**
 * Batch validation for multiple prospects
 */
export function validateProspectBatch(
    prospects: ProspectImportData[]
): Array<{ index: number; validation: ProspectImportValidation; data: ProspectImportData }> {
    return prospects.map((data, index) => ({
        index,
        data,
        validation: validateProspectData(data),
    }))
}
