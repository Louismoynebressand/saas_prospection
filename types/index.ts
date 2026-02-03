export type ScrapeStatus = 'queued' | 'running' | 'done' | 'error' | 'ALLfinish';

export interface SearchJobPage {
    id: number
    created_at: string
    id_user: string
    query: string
    filters?: unknown
    results_count?: number
    status?: string
}

// ===== CAMPAIGN-PROSPECT MANAGEMENT =====

export type EmailStatus = 'not_generated' | 'generated' | 'sent' | 'opened' | 'clicked' | 'bounced' | 'replied'

export interface CampaignProspectLink {
    id: string
    campaign_id: string
    prospect_id: string
    email_status: EmailStatus
    generated_email_subject?: string
    generated_email_content?: string
    email_generated_at?: string
    email_sent_at?: string
    created_at: string
    updated_at: string

    // Relations (optional, loaded via JOIN)
    campaign?: Campaign
    prospect?: ScrapeProspect
}

// Extended Prospect interface with campaign links
export interface ProspectWithCampaigns extends ScrapeProspect {
    campaigns?: CampaignProspectLink[]
}

// Extended Campaign interface with prospect links  
export interface CampaignWithProspects extends Campaign {
    prospects?: CampaignProspectLink[]
    prospect_count?: number
    generated_count?: number
    sent_count?: number
}

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
    closing_phrase?: string;

    // Signature customization options
    signature_show_phone?: boolean;
    signature_show_email?: boolean;
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

// ===== DEEP SEARCH SYSTEM =====

export interface DeepSearchJob {
    id: string
    user_id: string
    prospect_ids: string[]
    prospects_total: number
    prospects_processed: number
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
    error_message?: string
    created_at: string
    started_at?: string
    completed_at?: string
}

export interface ProspectWithFlags extends ScrapeProspect {
    hasEmail: boolean
    hasDeepSearch: boolean
}

export interface DeepSearchRequest {
    user_id: string
    job_id: string
    prospect_ids: string[]
}

export interface DeepSearchResponse {
    job_id: string
    status: 'processing' | 'completed' | 'error'
    prospects_count: number
}

// ===== PROSPECT IMPORT SYSTEM =====

export interface ProspectImportData {
    titre: string // obligatoire
    email?: string
    site_web?: string
    telephone?: string
    rue?: string
    ville?: string
    code_postal?: string
    secteur?: string
    categorie?: string
    score_total?: number
    nombre_avis?: number
    latitude?: number
    longitude?: number
    url_google_maps?: string
    notes?: string
}

export interface ProspectImportValidation {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

export interface ProspectImportResult {
    success: boolean
    imported_count: number
    failed_count: number
    errors?: Array<{ line: number; error: string }>
}

