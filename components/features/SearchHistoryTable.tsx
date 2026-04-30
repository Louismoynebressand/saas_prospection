"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MoreHorizontal, Search as SearchIcon, Loader2, Sparkles, XCircle, RefreshCw, AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/fetch-client"
import { ScrapeJob } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"

export function SearchHistoryTable({ limit }: { limit?: number }) {
    const router = useRouter()
    const supabase = createClient()
    const [searches, setSearches] = useState<ScrapeJob[]>([])
    const [counts, setCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

    const fetchSearches = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            let jobsQuery = supabase
                .from('scrape_jobs')
                .select(`id_jobs, id_user, request_search, resuest_ville, statut, created_at`)
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })

            if (limit) jobsQuery = jobsQuery.limit(limit)

            const { data, error } = await jobsQuery
            if (error) throw error

            if (data) {
                setSearches(data as ScrapeJob[])

                const { data: countsData } = await supabase
                    .from('scrape_jobs_with_counts')
                    .select('id_jobs, prospects_count')
                    .eq('id_user', user.id)

                const countMap: Record<string, number> = {}
                if (countsData) {
                    countsData.forEach((item: any) => {
                        countMap[item.id_jobs] = item.prospects_count || 0
                    })
                }
                setCounts(countMap)
            }
        } catch (error) {
            console.error('Error fetching searches:', error)
        } finally {
            setLoading(false)
        }
    }, [supabase, limit])

    useEffect(() => {
        fetchSearches()
        const subscription = supabase
            .channel('scrape_jobs_list_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_jobs' }, () => fetchSearches())
            .subscribe()
        return () => { supabase.removeChannel(subscription) }
    }, [fetchSearches, supabase])

    // ── Cancel a stuck job ─────────────────────────────────────────────────────
    const handleCancel = async (job: ScrapeJob) => {
        setActionLoading(prev => ({ ...prev, [`cancel-${job.id_jobs}`]: true }))
        try {
            const { error } = await supabase
                .from('scrape_jobs')
                .update({ statut: 'cancelled' })
                .eq('id_jobs', job.id_jobs)
            if (error) throw error
            toast.success("Recherche annulée")
            fetchSearches()
        } catch (err: any) {
            toast.error("Erreur lors de l'annulation", { description: err.message })
        } finally {
            setActionLoading(prev => ({ ...prev, [`cancel-${job.id_jobs}`]: false }))
        }
    }

    // ── Relaunch a stuck job ───────────────────────────────────────────────────
    const handleRelaunch = async (job: ScrapeJob) => {
        const query = job.request_search?.replace(/^"|"$/g, '') || ''
        const city = job.resuest_ville || ''

        if (!query || !city) {
            toast.error("Impossible de relancer", { description: "Données manquantes (requête ou ville)" })
            return
        }

        setActionLoading(prev => ({ ...prev, [`relaunch-${job.id_jobs}`]: true }))
        try {
            // 1. Cancel the stuck job
            await supabase.from('scrape_jobs').update({ statut: 'cancelled' }).eq('id_jobs', job.id_jobs)

            // 2. Geocode city via FR gov API
            let lat = 0, lng = 0
            try {
                const geoRes = await fetch(
                    `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(city)}&fields=centre&boost=population&limit=1`
                )
                const geoData = await geoRes.json()
                if (geoData[0]?.centre?.coordinates) {
                    [lng, lat] = geoData[0].centre.coordinates
                }
            } catch { /* fallback to name-based URL */ }

            const mapsUrl = lat && lng
                ? `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lng},13z`
                : `https://www.google.com/maps/search/${encodeURIComponent(query + ' ' + city + ', France')}`

            // 3. Relaunch via API
            const debugId = uuidv4()
            const response = await authenticatedFetch('/api/scrape/launch', {
                method: 'POST',
                body: JSON.stringify({
                    mapsUrl,
                    query,
                    city,
                    maxResults: 10,
                    enrichmentEnabled: true,
                    debugId
                })
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Erreur lors du relancement')
            }

            toast.success("Recherche relancée ! 🚀", { description: `"${query}" à ${city}` })
            fetchSearches()
        } catch (err: any) {
            toast.error("Erreur lors du relancement", { description: err.message })
        } finally {
            setActionLoading(prev => ({ ...prev, [`relaunch-${job.id_jobs}`]: false }))
        }
    }

    const getStatusBadge = (status: string) => {
        const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
            pending:   { label: "En attente", variant: "secondary" },
            queued:    { label: "En file",    variant: "outline" },
            running:   { label: "En cours",   variant: "default" },
            done:      { label: "Terminé",    variant: "default" },
            ALLfinish: { label: "Terminé",    variant: "default" },
            error:     { label: "Erreur",     variant: "destructive" },
            cancelled: { label: "Annulé",     variant: "secondary" },
        }
        const config = statusMap[status] || { label: status, variant: "secondary" as const }
        return <Badge variant={config.variant}>{config.label}</Badge>
    }

    const formatSearchTitle = (job: ScrapeJob) => {
        try {
            let searchQuery = "Recherche"
            let location = ""
            if (job.request_search) {
                try { searchQuery = JSON.parse(job.request_search) || job.request_search.replace(/"/g, '') }
                catch { searchQuery = job.request_search.replace(/"/g, '') }
            }
            if (job.resuest_ville) location = job.resuest_ville
            return location && searchQuery ? `${searchQuery} • ${location}` : searchQuery || "Recherche"
        } catch { return "Recherche" }
    }

    const isStuck = (status: string) => ['queued', 'running', 'pending'].includes(status)

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (searches.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <SearchIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune recherche pour le moment</p>
                <p className="text-sm">Lancez votre première recherche pour voir l&apos;historique</p>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table className="min-w-[580px] md:min-w-0">
                <TableHeader>
                    <TableRow>
                        <TableHead className="py-2">Recherche</TableHead>
                        <TableHead className="py-2 w-[80px]">Prospects</TableHead>
                        <TableHead className="py-2 w-[110px]">Deep Search</TableHead>
                        <TableHead className="py-2 w-[90px]">Statut</TableHead>
                        <TableHead className="py-2 w-[90px]">Date</TableHead>
                        <TableHead className="py-2 w-[130px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {searches.map((job) => (
                        <TableRow
                            key={job.id_jobs}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/searches/${job.id_jobs}`)}
                        >
                            <TableCell className="py-2.5 font-medium">
                                <div className="flex items-center gap-2">
                                    {isStuck(job.statut) ? (
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                    ) : (
                                        <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="font-semibold text-foreground text-sm">
                                        {formatSearchTitle(job)}
                                    </span>
                                </div>
                                {isStuck(job.statut) && (
                                    <p className="text-xs text-amber-600 mt-0.5 ml-6">
                                        En attente — peut nécessiter un relancement
                                    </p>
                                )}
                            </TableCell>
                            <TableCell className="py-2.5">
                                <Badge variant="outline" className="text-xs">{counts[job.id_jobs] ?? 0}</Badge>
                            </TableCell>
                            <TableCell className="py-2.5">
                                {(counts[job.id_jobs] ?? 0) > 0 ? (
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-purple-500 fill-purple-100" />
                                        <span className="text-xs font-medium text-purple-700">Oui</span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground">Non</span>
                                )}
                            </TableCell>
                            <TableCell className="py-2.5">{getStatusBadge(job.statut)}</TableCell>
                            <TableCell className="py-2.5 text-muted-foreground text-xs">
                                {format(new Date(job.created_at), "d MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                                {isStuck(job.statut) ? (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                            disabled={actionLoading[`relaunch-${job.id_jobs}`]}
                                            onClick={() => handleRelaunch(job)}
                                        >
                                            {actionLoading[`relaunch-${job.id_jobs}`]
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <RefreshCw className="h-3 w-3 mr-1" />
                                            }
                                            Relancer
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-red-50"
                                            disabled={actionLoading[`cancel-${job.id_jobs}`]}
                                            onClick={() => handleCancel(job)}
                                        >
                                            {actionLoading[`cancel-${job.id_jobs}`]
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <XCircle className="h-3 w-3" />
                                            }
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="ghost" size="sm" className="h-7">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
