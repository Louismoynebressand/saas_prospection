"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScrapeProspect } from "@/types"

export interface ProspectRow {
    id: string
    company: string
    category: string
    email: string | null
    phone: string | null
    city: string | null
    createdAt: Date
    jobId: string | null
    jobName: string | null
    website: string | null
    instagram: string | null
    linkedin: string | null
    address: string | null
    rating: string | null
    siret: string | null
    sector: string | null
    emailVerified: boolean
    hasDeepSearch: boolean
    openingHours: string | null
    reviews: string | null
    rappelDate: string | null
    rappelNotes: string | null
    crmStatus: string | null
    // Campaign data
    campaignIds: string[]
    campaignNames: string[]
    campaignEmailStatuses: string[]
}

export interface ProspectFilters {
    searchQuery: string
    jobIds: Set<string>          // filter by scrape jobs
    categories: Set<string>
    cities: Set<string>
    hasEmail: boolean
    hasPhone: boolean
    hasWebsite: boolean
    hasInstagram: boolean
    hasDeepSearch: boolean
    inCampaign: boolean
    campaignId: string           // specific campaign
    emailStatuses: Set<string>   // campaign email statuses
    dateFilter: 'all' | 'today' | 'week' | 'month' | 'custom'
    customDateFrom: Date | undefined
    customDateTo: Date | undefined
    sortBy: keyof ProspectRow | null
    sortDir: 'asc' | 'desc'
}

export const DEFAULT_FILTERS: ProspectFilters = {
    searchQuery: '',
    jobIds: new Set(),
    categories: new Set(),
    cities: new Set(),
    hasEmail: false,
    hasPhone: false,
    hasWebsite: false,
    hasInstagram: false,
    hasDeepSearch: false,
    inCampaign: false,
    campaignId: '',
    emailStatuses: new Set(),
    dateFilter: 'all',
    customDateFrom: undefined,
    customDateTo: undefined,
    sortBy: 'createdAt',
    sortDir: 'desc',
}

export interface ScrapJob {
    id_jobs: string
    request_search: string
    resuest_ville?: string
    created_at: string
    statut: string
}

export interface CampaignInfo {
    id: string
    name: string
}

const safeParse = (data: any): Record<string, any> => {
    if (!data) return {}
    if (typeof data === 'string') {
        try { return JSON.parse(data) } catch { return {} }
    }
    return data
}

const extractEmail = (p: ScrapeProspect): string | null => {
    let rawEmail = p.email_adresse_verified
    if (!rawEmail) return null
    if (typeof rawEmail === 'string') {
        const t = rawEmail.trim()
        if (!t || t === '[]' || t === 'null') return null
        if (t.startsWith('[')) {
            try {
                const arr = JSON.parse(t)
                return Array.isArray(arr) && arr.length > 0 ? String(arr[0]).trim() || null : null
            } catch { return null }
        }
        return t.includes('@') ? t : null
    }
    if (Array.isArray(rawEmail)) {
        return rawEmail.length > 0 ? String(rawEmail[0]).trim() || null : null
    }
    return null
}

export function useProspectsData() {
    const [rawProspects, setRawProspects] = useState<ScrapeProspect[]>([])
    const [scrapeJobs, setScrapeJobs] = useState<ScrapJob[]>([])
    const [campaigns, setCampaigns] = useState<CampaignInfo[]>([])
    const [campaignProspects, setCampaignProspects] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState<ProspectFilters>(DEFAULT_FILTERS)

    const fetchData = useCallback(async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            // Parallel fetch
            const [prospectsRes, jobsRes, campaignsRes, cpRes] = await Promise.all([
                supabase
                    .from('scrape_prospect')
                    .select(`id_prospect, id_jobs, id_user, created_at, data_scrapping, deep_search, email_adresse_verified, ville, secteur, rappel_date, rappel_notes, crm_status`)
                    .eq('id_user', user.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('scrape_jobs')
                    .select('id_jobs, request_search, resuest_ville, created_at, statut')
                    .eq('id_user', user.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('cold_email_campaigns')
                    .select('id, name')
                    .eq('user_id', user.id),
                supabase
                    .from('campaign_prospects')
                    .select('prospect_id, campaign_id, email_status')
                    .in('campaign_id',
                        // We get campaign IDs in a second step since we can't nest easily
                        // For now fetch all then filter
                        (await supabase.from('cold_email_campaigns').select('id').eq('user_id', user.id)).data?.map((c: any) => c.id) || []
                    )
            ])

            // Fallback if rappel columns don't exist
            let prospects = prospectsRes.data
            if (prospectsRes.error) {
                const { data: fallback } = await supabase
                    .from('scrape_prospect')
                    .select(`id_prospect, id_jobs, id_user, created_at, data_scrapping, deep_search, email_adresse_verified, ville, secteur`)
                    .eq('id_user', user.id)
                    .order('created_at', { ascending: false })
                prospects = fallback
            }

            if (prospects) setRawProspects(prospects as ScrapeProspect[])
            if (jobsRes.data) setScrapeJobs(jobsRes.data)
            if (campaignsRes.data) setCampaigns(campaignsRes.data)
            if (cpRes.data) setCampaignProspects(cpRes.data)
        } catch (err) {
            console.error('useProspectsData fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // Build campaign lookup maps
    const campaignMap = useMemo(() => {
        const m: Record<string, string> = {}
        campaigns.forEach(c => { m[c.id] = c.name })
        return m
    }, [campaigns])

    const prospectCampaignMap = useMemo(() => {
        const m: Record<string, { campaignId: string; campaignName: string; emailStatus: string }[]> = {}
        campaignProspects.forEach((cp: any) => {
            const pid = String(cp.prospect_id)
            if (!m[pid]) m[pid] = []
            m[pid].push({
                campaignId: cp.campaign_id,
                campaignName: campaignMap[cp.campaign_id] || cp.campaign_id,
                emailStatus: cp.email_status
            })
        })
        return m
    }, [campaignProspects, campaignMap])

    // Build scrape job name map
    const jobNameMap = useMemo(() => {
        const m: Record<string, string> = {}
        scrapeJobs.forEach(j => {
            let name = j.request_search || ''
            try { name = JSON.parse(name) } catch { name = name.replace(/"/g, '') }
            if (j.resuest_ville) name = `${name} • ${j.resuest_ville}`
            m[j.id_jobs] = name
        })
        return m
    }, [scrapeJobs])

    // Process raw prospects into ProspectRow[]
    const allRows = useMemo((): ProspectRow[] => {
        return rawProspects.map(p => {
            const raw = safeParse(p.data_scrapping)
            const deep = safeParse(p.deep_search)

            const company = deep.nom_complet || raw.Titre || raw.title || deep.nom_raison_sociale || raw.name || 'Société Inconnue'
            const email = extractEmail(p)

            const campData = prospectCampaignMap[String(p.id_prospect)] || []

            const instagram = deep.socials?.instagram || deep.instagram || raw.instagram || null
            const website = raw['Site web'] || raw.website || deep.socials?.website || deep.website || null

            return {
                id: String(p.id_prospect),
                company,
                category: raw['Nom de catégorie'] || p.secteur || 'N/A',
                email,
                phone: raw['Téléphone'] || raw.phone || null,
                city: p.ville || raw.Ville || raw.ville || null,
                createdAt: new Date(p.created_at),
                jobId: p.id_jobs ? String(p.id_jobs) : null,
                jobName: p.id_jobs ? (jobNameMap[String(p.id_jobs)] || String(p.id_jobs)) : null,
                website,
                instagram,
                linkedin: deep.socials?.linkedin || deep.linkedin || raw.linkedin || null,
                address: raw.address || raw.Rue || raw['Adresse complète'] || null,
                rating: raw['Score total'] || raw.rating || null,
                siret: deep.siret_siege || deep.siret || null,
                sector: p.secteur || null,
                emailVerified: !!email,
                hasDeepSearch: !!p.deep_search && Object.keys(safeParse(p.deep_search)).length > 0,
                openingHours: raw["Horaires d'ouverture"] || raw.horaires || raw['Hours'] || null,
                reviews: raw["Nombre d'avis"] || raw.reviews || null,
                rappelDate: (p as any).rappel_date || null,
                rappelNotes: (p as any).rappel_notes || null,
                crmStatus: (p as any).crm_status || null,
                campaignIds: campData.map(c => c.campaignId),
                campaignNames: campData.map(c => c.campaignName),
                campaignEmailStatuses: campData.map(c => c.emailStatus),
            }
        })
    }, [rawProspects, prospectCampaignMap, jobNameMap])

    // Apply all filters
    const processedData = useMemo((): ProspectRow[] => {
        let data = [...allRows]

        // Search
        if (filters.searchQuery.trim()) {
            const q = filters.searchQuery.toLowerCase()
            data = data.filter(r =>
                r.company.toLowerCase().includes(q) ||
                r.category.toLowerCase().includes(q) ||
                (r.city?.toLowerCase().includes(q)) ||
                (r.email?.toLowerCase().includes(q)) ||
                (r.jobName?.toLowerCase().includes(q))
            )
        }

        // Job filter
        if (filters.jobIds.size > 0) {
            data = data.filter(r => r.jobId && filters.jobIds.has(r.jobId))
        }

        // Category
        if (filters.categories.size > 0) {
            data = data.filter(r => filters.categories.has(r.category))
        }

        // Cities
        if (filters.cities.size > 0) {
            data = data.filter(r => r.city && filters.cities.has(r.city))
        }

        // Quick toggles
        if (filters.hasEmail) data = data.filter(r => r.emailVerified)
        if (filters.hasPhone) data = data.filter(r => !!r.phone)
        if (filters.hasWebsite) data = data.filter(r => !!r.website)
        if (filters.hasInstagram) data = data.filter(r => !!r.instagram)
        if (filters.hasDeepSearch) data = data.filter(r => r.hasDeepSearch)

        // Campaign filters
        if (filters.inCampaign) {
            data = data.filter(r => r.campaignIds.length > 0)
            if (filters.campaignId) {
                data = data.filter(r => r.campaignIds.includes(filters.campaignId))
            }
        }

        // Email status in campaign
        if (filters.emailStatuses.size > 0) {
            data = data.filter(r =>
                r.campaignEmailStatuses.some(s => filters.emailStatuses.has(s))
            )
        }

        // Date
        const now = new Date()
        if (filters.dateFilter === 'today') {
            data = data.filter(r => now.getTime() - r.createdAt.getTime() < 86400000)
        } else if (filters.dateFilter === 'week') {
            data = data.filter(r => now.getTime() - r.createdAt.getTime() < 7 * 86400000)
        } else if (filters.dateFilter === 'month') {
            data = data.filter(r => now.getTime() - r.createdAt.getTime() < 30 * 86400000)
        } else if (filters.dateFilter === 'custom') {
            data = data.filter(r => {
                if (filters.customDateFrom && r.createdAt < filters.customDateFrom) return false
                if (filters.customDateTo) {
                    const end = new Date(filters.customDateTo)
                    end.setHours(23, 59, 59, 999)
                    if (r.createdAt > end) return false
                }
                return true
            })
        }

        // Sort
        if (filters.sortBy) {
            const key = filters.sortBy
            const dir = filters.sortDir === 'asc' ? 1 : -1
            data.sort((a, b) => {
                const av = a[key]
                const bv = b[key]
                if (av === null || av === undefined) return 1
                if (bv === null || bv === undefined) return -1
                if (av instanceof Date && bv instanceof Date) return dir * (av.getTime() - bv.getTime())
                return dir * String(av).localeCompare(String(bv), 'fr', { numeric: true })
            })
        }

        return data
    }, [allRows, filters])

    // Derived lists for filter options
    const availableCategories = useMemo(() => {
        const s = new Set(allRows.map(r => r.category).filter(c => c && c !== 'N/A'))
        return Array.from(s).sort()
    }, [allRows])

    const availableCities = useMemo(() => {
        const s = new Set(allRows.map(r => r.city).filter(Boolean) as string[])
        return Array.from(s).sort()
    }, [allRows])

    const setFilter = useCallback(<K extends keyof ProspectFilters>(key: K, val: ProspectFilters[K]) => {
        setFilters(prev => ({ ...prev, [key]: val }))
    }, [])

    const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

    return {
        loading, rawProspects, allRows, processedData, filters, setFilters, setFilter, resetFilters,
        scrapeJobs, campaigns, availableCategories, availableCities, fetchData
    }
}
