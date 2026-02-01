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

    // Basic Info (Step 1)
    campaign_name: string;
    my_company_name?: string;
    my_website?: string;

    // Positioning & Offer (Step 2)
    pitch?: string;
    main_offer?: string;
    pain_points?: string[];
    main_promise?: string;
    secondary_benefits?: any; // jsonb
    service_to_sell?: string;

    // Targeting & Proof (Step 3)
    objective?: 'BOOK_MEETING' | 'DEMO' | 'FREE_TRIAL' | 'QUOTE' | 'DISCOUNT' | 'CALLBACK' | 'DOWNLOAD' | 'WEBINAR';
    target_audience?: string;
    target_sectors?: any; // jsonb
    target_company_size?: string;
    target_job_titles?: any; // jsonb

    // Nice-to-have fields
    differentiators?: any; // jsonb
    proof_points?: any; // jsonb
    case_studies?: any; // jsonb
    objection_handling?: any; // jsonb
    guarantees?: string;
    pricing_hint?: string;
    call_to_action?: string;

    // Signature (Step 4)
    signature_name?: string;
    signature_title?: string;
    signature_company?: string;
    signature_phone?: string;
    signature_email?: string;
    signature_ps?: string;

    // Signature customization options
    signature_show_phone?: boolean;
    signature_show_website?: boolean;
    signature_website_text?: string;
    signature_custom_link_url?: string;
    signature_custom_link_text?: string;
    signature_elements_order?: string[];
    signature_html?: string;

    // Email Parameters
    desired_tone?: string;
    formal?: boolean;
    email_length?: 'CONCISE' | 'STANDARD' | 'DETAILED';
    personalization_level?: 'LOW' | 'MEDIUM' | 'HIGH';
    language?: 'fr' | 'en';

    // Legacy/Optional fields
    allowed_pain_themes?: any; // jsonb
    forbidden_words?: any; // jsonb
    allowed_metrics?: any; // jsonb
    constraints?: any; // jsonb

    // Status & Metadata
    is_active: boolean;
    is_default?: boolean;
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    version?: number;
    last_used_at?: string;
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
