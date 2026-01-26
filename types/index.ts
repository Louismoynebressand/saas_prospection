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

export interface Campaign {
    id: string;
    user_id: string;
    nom_campagne: string;
    is_active: boolean;
    is_default: boolean;
    nom_entreprise_client?: string;
    site_web_client?: string;
    phrase_positionnement_client?: string;
    offre_principale_client?: string;
    promesse_principale?: string;
    benefices_secondaires?: string[];
    service_a_vendre?: string;
    type_de_prospect_vise?: string;
    themes_de_douleurs_autorises?: string[];
    mots_interdits?: string[];
    ton_souhaite?: string;
    vouvoiement?: boolean;
    chiffres_autorises?: string[];
    contraintes?: {
        sans_signature?: boolean;
        sans_liens?: boolean;
        min_mots?: number;
        max_mots?: number;
        max_faits_specifiques?: number;
    };
    created_at: string;
    updated_at: string;
}

export interface ColdEmailJob {
    id: string;
    user_id: string;
    campaign_id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    prospect_ids: string[];
    error_message?: string;
    started_at?: string;
    completed_at?: string;
    created_at: string;
}

export interface ColdEmailGeneration {
    id: string;
    job_id: string;
    user_id: string;
    campaign_id: string;
    prospect_id: string;
    subject?: string;
    message: string;
    model_meta?: any;
    created_at: string;
}
