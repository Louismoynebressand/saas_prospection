export type ScrapeStatus = 'queued' | 'running' | 'done' | 'error' | 'ALLfinish';

export interface ScrapeJob {
    id_jobs: number; // bigint
    created_at: string;
    id_user: string;
    request_search: string; // JSON string "query"
    request_url?: string;
    resuest_ville?: string;
    request_count?: number;
    localisation?: {
        lat: number;
        lng: number;
    };
    deepscan?: boolean;
    enrichie_emails?: boolean;
    statut: string; // 'ALLfinish', 'queued', etc.
}

export interface ScrapeProspect {
    id_prospect: string; // can be bigint (int8) in DB, string in frontend
    created_at: string;
    id_user: string;
    id_jobs: number | string;

    // Extracted fields
    ville?: string;
    secteur?: string;
    email_adresse_verified?: string | string[]; // Can be single string in DB

    // Validation fields
    check_email?: boolean;
    succed_validation_smtp_email?: boolean;
    check_email_tentative?: string;
    email_scrap_etat?: string;

    // Raw data
    data_scrapping?: any; // jsonb/text
    deep_search?: any; // jsonb
    resume?: string;
}

export interface WebhookPayload {
    job: {
        source: string;
        mapsUrl?: string | null;
        query: string;
        location: {
            city: string;
            radiusKm?: number | null;
            geo?: {
                lat: number | null;
                lng: number | null;
            }
        };
        limits: {
            maxResults: number;
        };
        options: {
            deepScan: boolean;
            enrichEmails: boolean;
        };
    };
    actor: {
        userId: string;
        sessionId?: string | null;
    };
    meta?: {
        searchId: number;
    };
}
