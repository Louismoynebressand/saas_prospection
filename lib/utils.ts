import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const extractProspectEmail = (prospect: any): string | null => {
    if (!prospect) return null;

    // 1. Check email_adresse_verified
    if (prospect.email_adresse_verified) {
        let e = prospect.email_adresse_verified;
        if (Array.isArray(e) && e.length > 0 && e[0]) return String(e[0]).trim();
        if (typeof e === 'string') {
            const trimmed = e.trim();
            if (trimmed && trimmed !== '[]' && trimmed !== 'null') {
                if (trimmed.startsWith('[')) {
                    try {
                        const arr = JSON.parse(trimmed);
                        if (Array.isArray(arr) && arr.length > 0 && arr[0]) return String(arr[0]).trim();
                    } catch { /* ignore */ }
                } else {
                    return trimmed;
                }
            }
        }
    }

    // 2. Check data_scrapping
    if (prospect.data_scrapping) {
        let raw = prospect.data_scrapping;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw) } catch { raw = {} }
        }
        if (raw && typeof raw === 'object' && raw.Email) return String(raw.Email).trim();
    }

    // 3. Check deep_search
    if (prospect.deep_search) {
        let deep = prospect.deep_search;
        if (typeof deep === 'string') {
            try { deep = JSON.parse(deep) } catch { deep = {} }
        }
        if (deep && typeof deep === 'object' && Array.isArray(deep.emails) && deep.emails.length > 0 && deep.emails[0]) {
            return String(deep.emails[0]).trim();
        }
    }

    return null;
}
