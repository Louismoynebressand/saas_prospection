/**
 * Email Signature Generator
 * Utilities for generating HTML email signatures with customizable elements
 */

export interface SignatureData {
    signature_name?: string;
    signature_title?: string;
    signature_company?: string;
    signature_phone?: string;
    signature_email?: string;
    signature_ps?: string;
    my_website?: string;
    signature_show_phone?: boolean;
    signature_show_website?: boolean;
    signature_website_text?: string;
    signature_custom_link_url?: string;
    signature_custom_link_text?: string;
}

export interface SignatureConfig extends SignatureData {
    signature_elements_order: string[];
}

export type SignatureElement =
    | 'name'
    | 'title'
    | 'company'
    | 'phone'
    | 'email'
    | 'website'
    | 'custom_link'
    | 'ps';

/**
 * Get default order of signature elements
 */
export function getDefaultElementsOrder(): SignatureElement[] {
    return ['name', 'title', 'company', 'phone', 'email', 'website', 'custom_link', 'ps'];
}

/**
 * Generate HTML for a single signature element
 */
function generateElementHTML(
    element: SignatureElement,
    data: SignatureData
): string | null {
    switch (element) {
        case 'name':
            if (!data.signature_name) return null;
            return `<tr><td style="padding: 2px 0;"><strong style="font-size: 16px; color: #1a1a1a;">${escapeHtml(data.signature_name)}</strong></td></tr>`;

        case 'title':
            if (!data.signature_title && !data.signature_company) return null;
            const parts = [];
            if (data.signature_title) parts.push(escapeHtml(data.signature_title));
            if (data.signature_company) parts.push(escapeHtml(data.signature_company));
            return `<tr><td style="padding: 2px 0; color: #666; font-size: 14px;">${parts.join(' • ')}</td></tr>`;

        case 'company':
            // Handled in 'title' element
            return null;

        case 'phone':
            if (!data.signature_phone || data.signature_show_phone === false) return null;
            return `<tr><td style="padding: 2px 0; color: #333; font-size: 14px;">📞 <a href="tel:${escapeHtml(data.signature_phone)}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(data.signature_phone)}</a></td></tr>`;

        case 'email':
            if (!data.signature_email) return null;
            return `<tr><td style="padding: 2px 0; color: #333; font-size: 14px;">✉️ <a href="mailto:${escapeHtml(data.signature_email)}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(data.signature_email)}</a></td></tr>`;

        case 'website':
            if (!data.my_website || data.signature_show_website === false) return null;
            const websiteText = data.signature_website_text || 'Visitez notre site web';
            return `<tr><td style="padding: 2px 0; color: #333; font-size: 14px;">🌐 <a href="${escapeHtml(data.my_website)}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(websiteText)}</a></td></tr>`;

        case 'custom_link':
            if (!data.signature_custom_link_url || !data.signature_custom_link_text) return null;
            return `<tr><td style="padding: 2px 0; color: #333; font-size: 14px;">🔗 <a href="${escapeHtml(data.signature_custom_link_url)}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(data.signature_custom_link_text)}</a></td></tr>`;

        case 'ps':
            if (!data.signature_ps) return null;
            return `<tr><td style="padding: 10px 0 0 0; color: #666; font-size: 13px; font-style: italic; border-top: 1px solid #e5e7eb; margin-top: 8px;">${escapeHtml(data.signature_ps)}</td></tr>`;

        default:
            return null;
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Generate complete HTML signature
 */
export function generateSignatureHTML(config: SignatureConfig): string {
    const { signature_elements_order, ...data } = config;
    const order = signature_elements_order || getDefaultElementsOrder();

    const elements = order
        .map(element => generateElementHTML(element as SignatureElement, data))
        .filter(html => html !== null);

    if (elements.length === 0) {
        return '';
    }

    return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; max-width: 600px;">
    <tbody>
        ${elements.join('\n        ')}
    </tbody>
</table>
    `.trim();
}

/**
 * Validate signature configuration
 */
export function validateSignatureConfig(config: SignatureConfig): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!config.signature_name) {
        errors.push('Le nom est requis');
    }

    if (config.signature_custom_link_url && !config.signature_custom_link_text) {
        errors.push('Le texte du lien personnalisé est requis si vous fournissez une URL');
    }

    if (config.signature_custom_link_text && !config.signature_custom_link_url) {
        errors.push('L\'URL du lien personnalisé est requise si vous fournissez un texte');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Generate preview-safe HTML (for browser rendering)
 */
export function generateSignaturePreview(config: SignatureConfig): string {
    // Same as generateSignatureHTML but with additional wrapper styles for preview
    const html = generateSignatureHTML(config);

    return `
<div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
    ${html}
</div>
    `.trim();
}
