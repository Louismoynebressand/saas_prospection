"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MoreHorizontal, Search as SearchIcon, MapPin, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ScrapeJob } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function SearchHistoryTable({ limit }: { limit?: number }) {
    const router = useRouter()
    const supabase = createClient()
    const [searches, setSearches] = useState<ScrapeJob[]>([])
    const [counts, setCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)

    const fetchSearches = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                console.error('No authenticated user found')
                setLoading(false)
                return
            }

            // Fetch jobs from scrape_jobs (has all fields including JSON)
            let jobsQuery = supabase
                .from('scrape_jobs')
                .select(`
                    id_jobs,
                    id_user,
                    request_search,
                    resuest_ville,
                    statut,
                    created_at
                `)
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })

            if (limit) {
                jobsQuery = jobsQuery.limit(limit)
            }

            const { data, error } = await jobsQuery

            if (error) {
                console.error('Error fetching jobs:', error)
                throw error
            }

            if (data) {
                setSearches(data as ScrapeJob[])

                // Fetch counts from view (eliminates N+1 queries!)
                const { data: countsData, error: countsError } = await supabase
                    .from('scrape_jobs_with_counts')
                    .select('id_jobs, prospects_count')
                    .eq('id_user', user.id)

                if (countsError) {
                    console.error('Error fetching counts:', countsError)
                }

                const countMap: Record<string, number> = {}
                if (countsData) {
                    countsData.forEach(item => {
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

        // Realtime subscription
        const subscription = supabase
            .channel('scrape_jobs_list_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_jobs' }, () => {
                fetchSearches()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [fetchSearches, supabase])

    const getStatusBadge = (status: string) => {
        const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
            pending: { label: "En attente", variant: "secondary" },
            queued: { label: "En file", variant: "outline" },
            running: { label: "En cours", variant: "default" },
            done: { label: "Terminé", variant: "default" },
            ALLfinish: { label: "Terminé", variant: "default" },
            error: { label: "Erreur", variant: "destructive" }
        }
        const config = statusMap[status] || { label: status, variant: "secondary" as const }
        return <Badge variant={config.variant}>{config.label}</Badge>
    }

    const formatSearchTerms = (job: ScrapeJob) => {
        try {
            const search = typeof job.request_search === 'string'
                ? JSON.parse(job.request_search)
                : job.request_search
            return search?.quoiQui || "Recherche"
        } catch {
            return "Recherche"
        }
    }

    const formatLocation = (job: ScrapeJob) => {
        try {
            const ville = typeof job.resuest_ville === 'string'
                ? JSON.parse(job.resuest_ville)
                : job.resuest_ville
            return ville?.ville || ville?.ou || ""
        } catch {
            return ""
        }
    }

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
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Recherche</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Prospects</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {searches.map((job) => (
                    <TableRow
                        key={job.id_jobs}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/searches/${job.id_jobs}`)}
                    >
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                <SearchIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate max-w-[200px]">
                                    {formatSearchTerms(job)}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">
                                    {formatLocation(job) || "—"}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline">
                                {counts[job.id_jobs] ?? 0}
                            </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(job.statut)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(job.created_at), "d MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                            <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
