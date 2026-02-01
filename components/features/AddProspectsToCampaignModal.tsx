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
import type { ScrapeProspect } from "@/types"

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
    const [prospects, setProspects] = useState<ScrapeProspect[]>([])
    const [searches, setSearches] = useState<SearchJob[]>([])
    const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
    const [selectedSearchIds, setSelectedSearchIds] = useState<Set<number>>(new Set())
    const [searchTerm, setSearchTerm] = useState('')
    const [mode, setMode] = useState<'prospects' | 'searches'>('prospects')

    useEffect(() => {
        if (open) {
            loadProspects()
            loadSearches()
        } else {
            // Reset on close
            setSelectedProspectIds(new Set())
            setSelectedSearchIds(new Set())
            setSearchTerm('')
        }
    }, [open])

    const loadProspects = async () => {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('scrape_prospect')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error
            setProspects(data || [])
        } catch (error: any) {
            console.error('Error loading prospects:', error)
            toast.error('Erreur lors du chargement des prospects')
        }
    }

    const loadSearches = async () => {
        try {
            const supabase = createClient()

            // Get searches
            const { data: searchData, error: searchError } = await supabase
                .from('scrape_jobs')
                .select('id_jobs, request_search, request_count, statut, created_at')
                .order('created_at', { ascending: false })
                .limit(50)

            if (searchError) throw searchError

            // Get prospect count for each search
            const searchesWithCounts = await Promise.all(
                (searchData || []).map(async (search: SearchJob) => {
                    const { count } = await supabase
                        .from('scrape_prospect')
                        .select('*', { count: 'exact', head: true })
                        .eq('id_jobs', search.id_jobs)

                    return {
                        ...search,
                        prospectCount: count || 0
                    }
                })
            )

            setSearches(searchesWithCounts)
        } catch (error: any) {
            console.error('Error loading searches:', error)
            toast.error('Erreur lors du chargement des recherches')
        }
    }

    const handleAddProspects = async () => {
        try {
            setLoading(true)

            let body: any = {}
            if (mode === 'prospects') {
                if (selectedProspectIds.size === 0) {
                    toast.error('Aucun prospect sélectionné')
                    return
                }
                body = { prospectIds: Array.from(selectedProspectIds) }
            } else {
                if (selectedSearchIds.size === 0) {
                    toast.error('Aucune recherche sélectionnée')
                    return
                }
                body = { searchIds: Array.from(selectedSearchIds) }
            }

            const response = await fetch(`/api/campaigns/${campaignId}/prospects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout des prospects')
            }

            const result = await response.json()
            toast.success(`${result.added} prospect(s) ajouté(s) à la campagne`)

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

                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="flex-1 flex flex-col">
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

                    <TabsContent value="prospects" className="flex-1 flex flex-col mt-4 space-y-4">
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

                        <div className="text-sm text-muted-foreground">
                            {selectedProspectIds.size} prospect(s) sélectionné(s)
                        </div>

                        <ScrollArea className="flex-1 border rounded-lg">
                            <div className="p-4 space-y-2">
                                {filteredProspects.map((prospect) => {
                                    const data = typeof prospect.data_scrapping === 'string'
                                        ? JSON.parse(prospect.data_scrapping)
                                        : prospect.data_scrapping || {}
                                    const name = data.title || data.name || 'Prospect'
                                    const company = data.company || data.companyName || prospect.secteur
                                    const email = prospect.email_adresse_verified

                                    return (
                                        <div
                                            key={prospect.id_prospect}
                                            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
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
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium">{name}</div>
                                                <div className="text-sm text-muted-foreground">{company}</div>
                                                {email && <div className="text-xs text-muted-foreground">{email}</div>}
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

                        <ScrollArea className="flex-1 border rounded-lg">
                            <div className="p-4 space-y-2">
                                {searches.map((search) => (
                                    <div
                                        key={search.id_jobs}
                                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
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
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium">{search.request_search}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                    {search.prospectCount || 0} prospects
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(search.created_at).toLocaleDateString()}
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

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button onClick={() => onOpenChange(false)} variant="outline">
                        Annuler
                    </Button>
                    <Button
                        onClick={handleAddProspects}
                        disabled={loading || (mode === 'prospects' ? selectedProspectIds.size === 0 : selectedSearchIds.size === 0)}
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Ajouter {mode === 'prospects' ? selectedProspectIds.size : selectedSearchIds.size}
                        {mode === 'prospects' ? ' prospect(s)' : ' recherche(s)'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
