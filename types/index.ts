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
    // metadata or other fields if exists
}

export interface ScrapeProspect {
    id_prospect: string; // uuid
    created_at: string;
    id_user: string;
    id_jobs: number; // fk to scrape_jobs

    // Extracted fields (if available directly or within json)
    ville?: string;
    email_adresse_verified?: string[]; // jsonb or array? Assuming array based on usage or jsonb

    // Raw data
    data_scrapping?: any; // jsonb
    deep_search?: any; // jsonb
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
        searchId: number; // Changed to number for id_jobs
    };
}
