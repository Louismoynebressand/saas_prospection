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
import { Loader2, Search, Users, Database } from "lucide-react"
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
            // Reset on close
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

        // 1. Check Active Schedule
        const { data: schedule } = await supabase
            .from('campaign_schedules')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('status', 'active')
            .single()

        setHasActiveSchedule(!!schedule)

        // 2. Check Quotas
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

    // ... (loadProspects and loadSearches remain same)

    const handleAddProspects = async () => {
        try {
            setLoading(true)

            let prospectIds: string[] = []

            if (mode === 'prospects') {
                prospectIds = Array.from(selectedProspectIds)

                // Validation email + deep search checks... (existing code)
                const selectedProspects = prospects.filter(p => prospectIds.includes(p.id_prospect))
                const noEmail = selectedProspects.filter(p => !p.hasEmail)

                if (noEmail.length > 0) {
                    toast.error(`❌ ${noEmail.length} prospect(s) sans email ne peuvent pas être ajoutés à une campagne`)
                    setLoading(false)
                    return
                }

            } else {
                // Si sélection par recherches, charger tous les prospects de ces recherches
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

            // --- QUOTA CHECK ---
            if (hasActiveSchedule && quotas) {
                const remaining = quotas.limit - quotas.used
                if (prospectIds.length > remaining) {
                    toast.error(`Quota insuffisant !`, {
                        description: `Vous voulez générer ${prospectIds.length} emails mais il ne vous reste que ${remaining} crédits.`
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout des prospects')
            }

            const result = await response.json()
            toast.success(`${result.added} prospect(s) ajouté(s) à la campagne`)
            if (hasActiveSchedule) {
                toast.info("Génération lancée", { description: "Les emails pour ces prospects ont été mis en file d'attente." })
            }

            onOpenChange(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error('Error adding prospects:', error)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleProspect = (prospectId: string) => {
        const newSet = new Set(selectedProspectIds)
        if (newSet.has(prospectId)) {
            newSet.delete(prospectId)
        } else {
            newSet.add(prospectId)
        }
        setSelectedProspectIds(newSet)
    }

    const toggleSearch = (searchId: number) => {
        const newSet = new Set(selectedSearchIds)
        if (newSet.has(searchId)) {
            newSet.delete(searchId)
        } else {
            newSet.add(searchId)
        }
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
        const prospectData = typeof p.data_scrapping === 'string' ? JSON.parse(p.data_scrapping) : p.data_scrapping || {}
        const name = prospectData.title || prospectData.name || ''
        const company = prospectData.company || prospectData.companyName || p.secteur || ''
        const email = Array.isArray(p.email_adresse_verified)
            ? p.email_adresse_verified[0] || ''
            : p.email_adresse_verified || ''
        const searchLower = searchTerm.toLowerCase()

        return name.toLowerCase().includes(searchLower) ||
            company.toLowerCase().includes(searchLower) ||
            email.toLowerCase().includes(searchLower)
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Ajouter des prospects à la campagne</DialogTitle>
                    <DialogDescription>
                        Sélectionnez les prospects individuellement ou importez tous les prospects d'une recherche
                    </DialogDescription>
                </DialogHeader>

                {/* WARNING ALERT */}
                {hasActiveSchedule && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-md">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <Search className="h-5 w-5 text-amber-500" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-amber-800">
                                    Campagne Active détectée
                                </h3>
                                <div className="mt-2 text-sm text-amber-700">
                                    <p>
                                        Cette campagne a une planification en cours. L'ajout de prospects déclenchera <strong>automatiquement la génération de leur email</strong> pour les ajouter à la file d'attente.
                                        Cela utilisera vos crédits "Cold Email".
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="flex-1 flex flex-col">
                    {/* ... Tabs List ... */}
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="prospects">
                            <Users className="w-4 h-4 mr-2" />
                            Prospects individuels
                        </TabsTrigger>
                        <TabsTrigger value="searches">
                            <Database className="w-4 h-4 mr-2" />
                            Par recherche
                        </TabsTrigger>
                    </TabsList>

                    {/* ... Content ... */}
                    <TabsContent value="prospects" className="flex-1 flex flex-col mt-4 space-y-4">
                        {/* ... Search Bar ... */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher par nom, entreprise ou email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button onClick={toggleSelectAll} variant="outline" size="sm">
                                {selectedProspectIds.size === filteredProspects.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </Button>
                        </div>

                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{selectedProspectIds.size} prospect(s) sélectionné(s)</span>
                            {/* QUOTA DISPLAY */}
                            {hasActiveSchedule && quotas && (
                                <span className={cn(
                                    "font-semibold",
                                    (quotas.limit - quotas.used) < selectedProspectIds.size ? "text-red-600" : "text-green-600"
                                )}>
                                    Crédits restants : {quotas.limit - quotas.used}
                                </span>
                            )}
                        </div>

                        <ScrollArea className="h-[350px] border rounded-lg">
                            <div className="p-4 space-y-2">
                                {filteredProspects.map((prospect) => {
                                    // ... prospect mapping ...
                                    const data = typeof prospect.data_scrapping === 'string'
                                        ? JSON.parse(prospect.data_scrapping)
                                        : prospect.data_scrapping || {}
                                    const name = data.title || data.name || 'Prospect'
                                    const company = data.company || data.companyName || prospect.secteur || 'N/A'
                                    const jobTitle = data.jobTitle || data.position || ''
                                    const email = Array.isArray(prospect.email_adresse_verified)
                                        ? prospect.email_adresse_verified[0]
                                        : prospect.email_adresse_verified

                                    return (
                                        <div
                                            key={prospect.id_prospect}
                                            className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() => toggleProspect(prospect.id_prospect)}
                                        >
                                            <Checkbox
                                                checked={selectedProspectIds.has(prospect.id_prospect)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedProspectIds(new Set([...selectedProspectIds, prospect.id_prospect]))
                                                    } else {
                                                        const newSet = new Set(selectedProspectIds)
                                                        newSet.delete(prospect.id_prospect)
                                                        setSelectedProspectIds(newSet)
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="font-semibold text-gray-900">{name}</div>
                                                    {jobTitle && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {jobTitle}
                                                        </Badge>
                                                    )}
                                                    {!prospect.hasEmail && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            ❌ Pas d'email
                                                        </Badge>
                                                    )}
                                                    {!prospect.hasDeepSearch && (
                                                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-600 bg-orange-50">
                                                            ⚠️ Pas de Deep Search
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    🏢 {company}
                                                </div>
                                                {email && (
                                                    <div className="text-xs text-gray-500 mt-1 truncate">
                                                        ✉️ {email}
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-400 mt-1">
                                                    Ajouté le {new Date(prospect.created_at).toLocaleDateString('fr-FR')}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {filteredProspects.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Aucun prospect trouvé
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="searches" className="flex-1 flex flex-col mt-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                {selectedSearchIds.size} recherche(s) sélectionnée(s)
                            </div>
                            <Button onClick={toggleSelectAll} variant="outline" size="sm">
                                {selectedSearchIds.size === searches.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </Button>
                        </div>

                        {/* QUOTA DISPLAY FOR SEARCHES */}
                        {hasActiveSchedule && quotas && (
                            <div className="text-right text-sm">
                                <span className={cn(
                                    "font-semibold",
                                    // estimating usage is hard for searches without summing, assume block on execution or warn here
                                    "text-muted-foreground"
                                )}>
                                    Crédits restants : {quotas.limit - quotas.used}
                                </span>
                            </div>
                        )}

                        <ScrollArea className="h-[350px] border rounded-lg">
                            <div className="p-4 space-y-2">
                                {searches.map((search) => (
                                    <div
                                        key={search.id_jobs}
                                        className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => toggleSearch(search.id_jobs)}
                                    >
                                        <Checkbox
                                            checked={selectedSearchIds.has(search.id_jobs)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedSearchIds(new Set([...selectedSearchIds, search.id_jobs]))
                                                } else {
                                                    const newSet = new Set(selectedSearchIds)
                                                    newSet.delete(search.id_jobs)
                                                    setSelectedSearchIds(newSet)
                                                }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900 mb-2">
                                                {search.request_search}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="default" className="text-xs font-medium">
                                                    👥 {search.prospectCount || 0} prospects
                                                </Badge>
                                                <Badge
                                                    variant={search.statut === 'ALLfinish' ? 'default' : 'secondary'}
                                                    className="text-xs"
                                                >
                                                    {search.statut}
                                                </Badge>
                                                <span className="text-xs text-gray-500">
                                                    📅 {new Date(search.created_at).toLocaleDateString('fr-FR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {searches.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Aucune recherche trouvée
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4 border-t items-center">
                    {/* UPGRADE BUTTON IF QUOTA EXCEEDED */}
                    {hasActiveSchedule && quotas && (mode === 'prospects' ? selectedProspectIds.size : 0) > (quotas.limit - quotas.used) && (
                        <div className="flex-1 flex items-center text-sm text-red-600 font-bold mr-4">
                            🚫 Quota insuffisant pour l'automatisation
                        </div>
                    )}

                    <Button onClick={() => onOpenChange(false)} variant="outline">
                        Annuler
                    </Button>

                    {hasActiveSchedule && quotas && (mode === 'prospects' ? selectedProspectIds.size : 0) > (quotas.limit - quotas.used) ? (
                        <Button
                            onClick={() => window.open('/billing', '_blank')}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            Augmenter mon quota
                        </Button>
                    ) : (
                        <Button
                            onClick={handleAddProspects}
                            disabled={loading || (mode === 'prospects' ? selectedProspectIds.size === 0 : selectedSearchIds.size === 0)}
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Ajouter {mode === 'prospects' ? selectedProspectIds.size : selectedSearchIds.size}
                            {mode === 'prospects' ? ' prospect(s)' : ' recherche(s)'}
                        </Button>
                    )}
                </div>
            </DialogContent >
        </Dialog >
    )
}
