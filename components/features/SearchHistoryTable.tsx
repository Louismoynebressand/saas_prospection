"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MoreHorizontal, Search as SearchIcon, MapPin, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ScrapeJob } from "@/types"
import { DEMO_USER_ID } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function SearchHistoryTable({ limit }: { limit?: number }) {
    const router = useRouter()
    const [searches, setSearches] = useState<ScrapeJob[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSearches = async () => {
        try {
            let query = supabase
                .from('scrape_jobs')
                .select('*')
                .eq('id_user', DEMO_USER_ID)
                .order('created_at', { ascending: false })

            if (limit) {
                query = query.limit(limit)
            }

            const { data, error } = await query

            if (error) throw error
            if (data) setSearches(data as ScrapeJob[])
        } catch (error) {
            console.error('Error fetching searches:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSearches()

        // Realtime subscription
        const subscription = supabase
            .channel('scrape_jobs_list_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_jobs' }, (payload) => {
                fetchSearches()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [limit])

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase()
        switch (s) {
            case 'queued': return <Badge variant="secondary">En file d'attente</Badge>
            case 'running': return <Badge variant="warning" className="animate-pulse">En cours</Badge>
            case 'done':
            case 'allfinish': return <Badge variant="success">Terminé</Badge>
            case 'error': return <Badge variant="destructive">Erreur</Badge>
            default: return <Badge variant="outline">{status || 'Inconnu'}</Badge>
        }
    }

    const parseQuery = (jsonQuery: string) => {
        if (!jsonQuery) return "N/A"
        try {
            const parsed = JSON.parse(jsonQuery)
            return typeof parsed === 'string' ? parsed : jsonQuery
        } catch (e) {
            return jsonQuery
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (searches.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground bg-card border rounded-md">
                Aucune recherche pour le moment.
            </div>
        )
    }

    return (
        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Recherche</TableHead>
                        <TableHead>Localisation</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Résultats</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {searches.map((search) => (
                        <TableRow
                            key={search.id_jobs}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => router.push(`/searches/${search.id_jobs}`)}
                        >
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                                    {parseQuery(search.request_search)}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    {search.resuest_ville || "Zone définie"}
                                </div>
                            </TableCell>
                            <TableCell>
                                {format(new Date(search.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell>{getStatusBadge(search.statut)}</TableCell>
                            <TableCell className="text-right">
                                -
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/searches/${search.id_jobs}`);
                                }}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
