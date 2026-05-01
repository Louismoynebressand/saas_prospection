"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
    Loader2, Search, Users, Database, Zap,
    Mail, MailX, AlertTriangle, CheckCircle2, CreditCard
} from "lucide-react"
import type { ScrapeProspect, ProspectWithFlags } from "@/types"
import { cn } from "@/lib/utils"

interface SearchJob {
    id_jobs: number
    request_search: string
    request_count?: number
    statut: string
    created_at: string
    prospectCount?: number
}

interface AddProspectsToCampaignModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    campaignId: string
    onSuccess?: () => void
}

export function AddProspectsToCampaignModal({
    open,
    onOpenChange,
    campaignId,
    onSuccess
}: AddProspectsToCampaignModalProps) {
    const [loading, setLoading] = useState(false)
    const [prospects, setProspects] = useState<ProspectWithFlags[]>([])
    const [searches, setSearches] = useState<SearchJob[]>([])
    const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
    const [selectedSearchIds, setSelectedSearchIds] = useState<Set<number>>(new Set())
    const [searchTerm, setSearchTerm] = useState('')
    const [mode, setMode] = useState<'prospects' | 'searches'>('prospects')
    const [hasActiveSchedule, setHasActiveSchedule] = useState(false)
    const [quotas, setQuotas] = useState<{ used: number; limit: number } | null>(null)
    const [quotaLoading, setQuotaLoading] = useState(false)

    useEffect(() => {
        if (open) {
            loadProspects()
            loadSearches()
            checkCampaignStatusAndQuotas()
        } else {
            setSelectedProspectIds(new Set())
            setSelectedSearchIds(new Set())
            setSearchTerm('')
            setHasActiveSchedule(false)
            setQuotas(null)
        }
    }, [open])

    const checkCampaignStatusAndQuotas = async () => {
        setQuotaLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: schedule } = await supabase
            .from('campaign_schedules')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('status', 'active')
            .single()

        setHasActiveSchedule(!!schedule)

        const { data: quotaData } = await supabase
            .from('quotas')
            .select('cold_emails_used, cold_emails_limit')
            .eq('user_id', user.id)
            .single()

        if (quotaData) {
            setQuotas({
                used: quotaData.cold_emails_used || 0,
                limit: quotaData.cold_emails_limit || 0
            })
        }
        setQuotaLoading(false)
    }

    const loadProspects = async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('scrape_prospect')
                .select('*')
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error

            const enrichedProspects: ProspectWithFlags[] = (data || []).map((p: ScrapeProspect) => {
                const hasEmail = !!p.email_adresse_verified
                const deepSearch = typeof p.deep_search === 'string'
                    ? JSON.parse(p.deep_search)
                    : p.deep_search
                const hasDeepSearch = !!(deepSearch && Object.keys(deepSearch).length > 0)
                return { ...p, hasEmail, hasDeepSearch }
            })

            setProspects(enrichedProspects)
        } catch (error: any) {
            toast.error('Erreur lors du chargement des prospects')
        }
    }

    const loadSearches = async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: searchData, error: searchError } = await supabase
                .from('scrape_jobs')
                .select('id_jobs, request_search, request_count, statut, created_at')
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (searchError) throw searchError

            const searchesWithCounts = await Promise.all(
                (searchData || []).map(async (search: SearchJob) => {
                    const { count } = await supabase
                        .from('scrape_prospect')
                        .select('*', { count: 'exact', head: true })
                        .eq('id_jobs', search.id_jobs)
                        .eq('id_user', user.id)
                    return { ...search, prospectCount: count || 0 }
                })
            )

            setSearches(searchesWithCounts)
        } catch (error: any) {
            toast.error('Erreur lors du chargement des recherches')
        }
    }

    const handleAddProspects = async () => {
        try {
            setLoading(true)
            let prospectIds: string[] = []

            if (mode === 'prospects') {
                prospectIds = Array.from(selectedProspectIds)
                const selectedProspects = prospects.filter(p => prospectIds.includes(p.id_prospect))
                const noEmail = selectedProspects.filter(p => !p.hasEmail)

                if (noEmail.length > 0) {
                    toast.error(`${noEmail.length} prospect(s) sans email ne peuvent pas être ajoutés`)
                    setLoading(false)
                    return
                }
            } else {
                const selectedJobIds = Array.from(selectedSearchIds)
                if (selectedJobIds.length > 0) {
                    const supabase = createClient()
                    const { data, error } = await supabase
                        .from('scrape_prospect')
                        .select('id_prospect')
                        .in('id_job_scrap', selectedJobIds)

                    if (error) throw error
                    prospectIds = data?.map((p: any) => p.id_prospect) || []
                }
            }

            if (prospectIds.length === 0) {
                toast.error('Aucun prospect sélectionné')
                setLoading(false)
                return
            }

            if (hasActiveSchedule && quotas) {
                const remaining = quotas.limit - quotas.used
                if (prospectIds.length > remaining) {
                    toast.error(`Quota insuffisant`, {
                        description: `${prospectIds.length} emails requis, ${remaining} crédits disponibles.`
                    })
                    setLoading(false)
                    return
                }
            }

            const body = mode === 'prospects'
                ? { prospectIds }
                : { searchIds: Array.from(selectedSearchIds) }

            const response = await fetch(`/api/campaigns/${campaignId}/prospects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!response.ok) throw new Error("Erreur lors de l'ajout des prospects")

            const result = await response.json()
            toast.success(`${result.added} prospect(s) ajouté(s) à la campagne`)
            if (hasActiveSchedule) {
                toast.info("Génération lancée", { description: "Les emails ont été mis en file d'attente." })
            }

            onOpenChange(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleProspect = (prospectId: string) => {
        const newSet = new Set(selectedProspectIds)
        newSet.has(prospectId) ? newSet.delete(prospectId) : newSet.add(prospectId)
        setSelectedProspectIds(newSet)
    }

    const toggleSearch = (searchId: number) => {
        const newSet = new Set(selectedSearchIds)
        newSet.has(searchId) ? newSet.delete(searchId) : newSet.add(searchId)
        setSelectedSearchIds(newSet)
    }

    const toggleSelectAll = () => {
        if (mode === 'prospects') {
            if (selectedProspectIds.size === filteredProspects.length) {
                setSelectedProspectIds(new Set())
            } else {
                setSelectedProspectIds(new Set(filteredProspects.map(p => p.id_prospect)))
            }
        } else {
            if (selectedSearchIds.size === searches.length) {
                setSelectedSearchIds(new Set())
            } else {
                setSelectedSearchIds(new Set(searches.map(s => s.id_jobs)))
            }
        }
    }

    const filteredProspects = prospects.filter(p => {
        if (!searchTerm) return true
        const data = typeof p.data_scrapping === 'string' ? JSON.parse(p.data_scrapping) : p.data_scrapping || {}
        const name = data.title || data.name || ''
        const company = data.company || data.companyName || p.secteur || ''
        const email = Array.isArray(p.email_adresse_verified)
            ? p.email_adresse_verified[0] || ''
            : p.email_adresse_verified || ''
        const q = searchTerm.toLowerCase()
        return name.toLowerCase().includes(q) || company.toLowerCase().includes(q) || email.toLowerCase().includes(q)
    })

    const creditsRemaining = quotas ? quotas.limit - quotas.used : 0
    const selectedCount = mode === 'prospects' ? selectedProspectIds.size : selectedSearchIds.size
    const isQuotaExceeded = hasActiveSchedule && quotas !== null && mode === 'prospects' && selectedProspectIds.size > creditsRemaining

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Wide on desktop, full-width on mobile */}
            <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl h-[90vh] sm:h-auto sm:max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">

                {/* ── HEADER ── */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                    <DialogTitle className="text-xl font-bold text-slate-900">
                        Ajouter des prospects à la campagne
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 mt-1">
                        Sélectionnez individuellement ou importez toute une recherche
                    </DialogDescription>
                </div>

                {/* ── SCROLLABLE BODY ── */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">

                    {/* ACTIVE CAMPAIGN ALERT */}
                    {hasActiveSchedule && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 shadow-sm">
                            <div className="flex-shrink-0 mt-0.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-amber-600" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-amber-900">Campagne active — envoi automatique</p>
                                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                    L'ajout de prospects déclenchera <strong>automatiquement la génération de leur email</strong> et les placera en file d'attente.
                                    Cela consomme vos crédits Cold Email.
                                </p>
                                {quotas && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                                        <span className={cn(
                                            "text-xs font-bold",
                                            creditsRemaining < 10 ? "text-red-600" : "text-amber-700"
                                        )}>
                                            {creditsRemaining} crédits restants / {quotas.limit}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TABS */}
                    <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl h-10">
                            <TabsTrigger value="prospects" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700">
                                <Users className="w-4 h-4 mr-2" />
                                Prospects individuels
                            </TabsTrigger>
                            <TabsTrigger value="searches" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700">
                                <Database className="w-4 h-4 mr-2" />
                                Par recherche
                            </TabsTrigger>
                        </TabsList>

                        {/* ── TAB: PROSPECTS INDIVIDUELS ── */}
                        <TabsContent value="prospects" className="mt-4 space-y-3">
                            {/* Search + Select All */}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Rechercher par nom, entreprise ou email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-slate-50 border-slate-200 focus:bg-white h-9"
                                    />
                                </div>
                                <Button
                                    onClick={toggleSelectAll}
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
                                >
                                    {selectedProspectIds.size === filteredProspects.length && filteredProspects.length > 0
                                        ? 'Désélectionner' : 'Tout sélectionner'}
                                </Button>
                            </div>

                            {/* Counter row */}
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    <span className="font-semibold text-slate-700">{selectedProspectIds.size}</span> sélectionné(s) sur {filteredProspects.length}
                                </span>
                                {isQuotaExceeded && (
                                    <span className="flex items-center gap-1 text-red-600 font-semibold">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Quota dépassé
                                    </span>
                                )}
                                {hasActiveSchedule && !isQuotaExceeded && selectedProspectIds.size > 0 && (
                                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Quota OK
                                    </span>
                                )}
                            </div>

                            {/* List — fixed height, no overflow */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                <ScrollArea className="h-[280px] sm:h-[320px]">
                                    <div className="p-2 space-y-1">
                                        {filteredProspects.map((prospect) => {
                                            const data = typeof prospect.data_scrapping === 'string'
                                                ? JSON.parse(prospect.data_scrapping)
                                                : prospect.data_scrapping || {}
                                            const name = data.title || data.name || 'Prospect'
                                            const company = data.company || data.companyName || prospect.secteur || ''
                                            const email = Array.isArray(prospect.email_adresse_verified)
                                                ? prospect.email_adresse_verified[0]
                                                : prospect.email_adresse_verified
                                            const isSelected = selectedProspectIds.has(prospect.id_prospect)

                                            return (
                                                <div
                                                    key={prospect.id_prospect}
                                                    onClick={() => toggleProspect(prospect.id_prospect)}
                                                    className={cn(
                                                        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 select-none",
                                                        isSelected
                                                            ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                                                            : "hover:bg-slate-50 border border-transparent hover:border-slate-200",
                                                        !prospect.hasEmail && "opacity-70"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleProspect(prospect.id_prospect)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-0.5 shrink-0 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-semibold text-sm text-slate-900 truncate">{name}</span>
                                                            {!prospect.hasEmail ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200 shrink-0">
                                                                    <MailX className="w-3 h-3" />
                                                                    Sans email
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                                    <Mail className="w-3 h-3" />
                                                                    Email ✓
                                                                </span>
                                                            )}
                                                            {!prospect.hasDeepSearch && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                                                                    ⚡ Pas de Deep Search
                                                                </span>
                                                            )}
                                                        </div>
                                                        {company && (
                                                            <p className="text-xs text-slate-500 mt-0.5 truncate">🏢 {company}</p>
                                                        )}
                                                        {email && (
                                                            <p className="text-xs text-slate-400 mt-0.5 truncate">✉️ {email}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {filteredProspects.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                                <Search className="w-8 h-8 mb-2 opacity-40" />
                                                <p className="text-sm">Aucun prospect trouvé</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </TabsContent>

                        {/* ── TAB: PAR RECHERCHE ── */}
                        <TabsContent value="searches" className="mt-4 space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    <span className="font-semibold text-slate-700">{selectedSearchIds.size}</span> recherche(s) sélectionnée(s)
                                </span>
                                {hasActiveSchedule && quotas && (
                                    <span className="font-semibold text-slate-600">
                                        {creditsRemaining} crédits disponibles
                                    </span>
                                )}
                                <Button onClick={toggleSelectAll} variant="outline" size="sm"
                                    className="border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50">
                                    {selectedSearchIds.size === searches.length && searches.length > 0
                                        ? 'Désélectionner' : 'Tout sélectionner'}
                                </Button>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                <ScrollArea className="h-[320px] sm:h-[360px]">
                                    <div className="p-2 space-y-1">
                                        {searches.map((search) => {
                                            const isSelected = selectedSearchIds.has(search.id_jobs)
                                            const isDone = search.statut === 'ALLfinish'

                                            return (
                                                <div
                                                    key={search.id_jobs}
                                                    onClick={() => toggleSearch(search.id_jobs)}
                                                    className={cn(
                                                        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 select-none",
                                                        isSelected
                                                            ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                                                            : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSearch(search.id_jobs)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-0.5 shrink-0 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate mb-1.5">
                                                            {search.request_search}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                                <Users className="w-3 h-3" />
                                                                {search.prospectCount} prospects
                                                            </span>
                                                            <span className={cn(
                                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                                                                isDone
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-slate-100 text-slate-500 border-slate-200"
                                                            )}>
                                                                {isDone ? '✓ Terminé' : search.statut}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400">
                                                                {new Date(search.created_at).toLocaleDateString('fr-FR')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {searches.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                                <Database className="w-8 h-8 mb-2 opacity-40" />
                                                <p className="text-sm">Aucune recherche disponible</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* ── FOOTER ── */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
                    {/* Quota warning */}
                    {isQuotaExceeded && (
                        <p className="text-xs text-red-600 font-semibold flex items-center gap-1.5 flex-1">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Quota insuffisant ({selectedProspectIds.size} requis, {creditsRemaining} dispo)
                        </p>
                    )}
                    {!isQuotaExceeded && <div className="flex-1" />}

                    <div className="flex items-center gap-2">
                        <Button onClick={() => onOpenChange(false)} variant="outline" className="border-slate-200">
                            Annuler
                        </Button>

                        {isQuotaExceeded ? (
                            <Button onClick={() => window.open('/billing', '_blank')} className="bg-purple-600 hover:bg-purple-700 text-white">
                                Augmenter le quota
                            </Button>
                        ) : (
                            <Button
                                onClick={handleAddProspects}
                                disabled={loading || selectedCount === 0}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-[140px]"
                            >
                                {loading
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : null
                                }
                                {loading
                                    ? 'Ajout en cours...'
                                    : `Ajouter ${selectedCount > 0 ? selectedCount : ''} ${mode === 'prospects' ? 'prospect(s)' : 'recherche(s)'}`
                                }
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
