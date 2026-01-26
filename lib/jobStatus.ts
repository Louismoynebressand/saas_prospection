/**
 * Job Status State Machine
 * Centralized status management for scraping jobs
 */

export enum JobStatus {
    QUEUED = 'queued',
    SCRAPING = 'scraping',
    DEEP_SCAN = 'deep_scan',
    ENRICHING = 'enriching',
    DONE = 'done',
    ERROR = 'error'
}

export interface JobStage {
    key: JobStatus
    label: string
    description: string
    progress: number // 0-100
}

/**
 * Normalize database status values to standard enum
 */
export function normalizeStatus(dbStatus: string | undefined | null): JobStatus {
    if (!dbStatus) return JobStatus.QUEUED

    const normalized = dbStatus.toLowerCase().trim()

    switch (normalized) {
        case 'queued':
            return JobStatus.QUEUED
        case 'running':
        case 'scrapping':
        case 'scrapping en cours':
            return JobStatus.SCRAPING
        case 'deep_scan':
        case 'deep scanning':
        case 'deepscan':
            return JobStatus.DEEP_SCAN
        case 'enriching':
        case 'enrichissement':
        case 'enriching emails':
            return JobStatus.ENRICHING
        case 'done':
        case 'allfinish':
        case 'terminé':
        case 'completed':
            return JobStatus.DONE
        case 'error':
        case 'erreur':
        case 'failed':
            return JobStatus.ERROR
        default:
            // If unknown, check if contains keywords
            if (normalized.includes('scan')) return JobStatus.DEEP_SCAN
            if (normalized.includes('enrich')) return JobStatus.ENRICHING
            if (normalized.includes('error') || normalized.includes('fail')) return JobStatus.ERROR
            return JobStatus.QUEUED
    }
}

/**
 * Get human-readable label for status
 */
export function getStatusLabel(status: string): string {
    const normalized = normalizeStatus(status)

    switch (normalized) {
        case JobStatus.QUEUED:
            return 'En file d\'attente'
        case JobStatus.SCRAPING:
            return 'Scraping en cours'
        case JobStatus.DEEP_SCAN:
            return 'Deep Scan'
        case JobStatus.ENRICHING:
            return 'Enrichissement'
        case JobStatus.DONE:
            return 'Terminé'
        case JobStatus.ERROR:
            return 'Erreur'
    }
}

/**
 * Get badge variant for status
 */
export function getStatusVariant(status: string): 'secondary' | 'warning' | 'success' | 'destructive' {
    const normalized = normalizeStatus(status)

    switch (normalized) {
        case JobStatus.QUEUED:
            return 'secondary'
        case JobStatus.SCRAPING:
        case JobStatus.DEEP_SCAN:
        case JobStatus.ENRICHING:
            return 'warning'
        case JobStatus.DONE:
            return 'success'
        case JobStatus.ERROR:
            return 'destructive'
    }
}

/**
 * Check if job is still active (not done or error)
 */
export function isJobActive(status: string): boolean {
    const normalized = normalizeStatus(status)
    return normalized !== JobStatus.DONE && normalized !== JobStatus.ERROR
}

/**
 * Get job stages based on job configuration
 */
export function getJobStages(job: {
    deepscan?: boolean
    enrichie_emails?: boolean
}): JobStage[] {
    const stages: JobStage[] = [
        {
            key: JobStatus.QUEUED,
            label: 'Job créé',
            description: 'En attente de démarrage',
            progress: 0
        },
        {
            key: JobStatus.SCRAPING,
            label: 'Scraping Google Maps',
            description: 'Collecte des données',
            progress: 25
        }
    ]

    let currentProgress = 25
    const remainingSteps = [job.deepscan, job.enrichie_emails].filter(Boolean).length + 1 // +1 for done
    const stepIncrement = 75 / (remainingSteps || 1)

    if (job.deepscan) {
        currentProgress += stepIncrement
        stages.push({
            key: JobStatus.DEEP_SCAN,
            label: 'Deep Scan',
            description: 'Analyse des sites web',
            progress: Math.round(currentProgress)
        })
    }

    if (job.enrichie_emails) {
        currentProgress += stepIncrement
        stages.push({
            key: JobStatus.ENRICHING,
            label: 'Enrichissement',
            description: 'Vérification emails',
            progress: Math.round(currentProgress)
        })
    }

    stages.push({
        key: JobStatus.DONE,
        label: 'Terminé',
        description: 'Recherche complétée',
        progress: 100
    })

    return stages
}

/**
 * Calculate current progress percentage
 */
export function getJobProgress(
    currentStatus: string,
    stages: JobStage[]
): number {
    const normalized = normalizeStatus(currentStatus)

    // Error state shows 0% progress
    if (normalized === JobStatus.ERROR) return 0

    const currentStage = stages.find(s => s.key === normalized)
    return currentStage?.progress ?? 0
}

/**
 * Get current stage index
 */
export function getCurrentStageIndex(
    currentStatus: string,
    stages: JobStage[]
): number {
    const normalized = normalizeStatus(currentStatus)
    return stages.findIndex(s => s.key === normalized)
}
