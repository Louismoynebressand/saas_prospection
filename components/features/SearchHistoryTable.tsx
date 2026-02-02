"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MoreHorizontal, Search as SearchIcon, MapPin, Loader2, Sparkles } from "lucide-react"
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

    const formatSearchTitle = (job: ScrapeJob) => {
        try {
            // request_search is stored as JSON string of the actual query
            let searchQuery = "Recherche"
            let location = ""

            // Extract search query
            if (job.request_search) {
                if (typeof job.request_search === 'string') {
                    try {
                        // It's stored as JSON string, try to parse
                        const parsed = JSON.parse(job.request_search)
                        searchQuery = parsed || job.request_search.replace(/"/g, '')
                    } catch {
                        // If parsing fails, use as is (removing quotes)
                        searchQuery = job.request_search.replace(/"/g, '')
                    }
                } else {
                    searchQuery = job.request_search
                }
            }

            // Extract location (ville)
            if (job.resuest_ville) {
                if (typeof job.resuest_ville === 'string') {
                    location = job.resuest_ville
                }
            }

            // Format: "Query • Location" or just "Query"
            if (location && searchQuery) {
                return `${searchQuery} • ${location}`
            }
            return searchQuery || "Recherche"
        } catch (error) {
            console.error('Error formatting search title:', error)
            return "Recherche"
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
                    <TableHead>Prospects</TableHead>
                    <TableHead>Deep Search</TableHead>
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
                                <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-semibold text-foreground">
                                    {formatSearchTitle(job)}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline">
                                {counts[job.id_jobs] ?? 0}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            {/* TODO: Could be enhanced with real deep search count if needed */}
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Sparkles className="h-4 w-4 text-purple-600/50" />
                                <span className="text-xs">-</span>
                            </div>
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
