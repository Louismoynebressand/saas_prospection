"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MoreHorizontal, Search as SearchIcon, MapPin, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ScrapeJob } from "@/types"
import { DEMO_USER_ID } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SearchHistoryTable({ limit }: { limit?: number }) {
    const [searches, setSearches] = useState<SearchJob[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSearches = async () => {
        try {
            let query = supabase
                .from('searches')
                .select('*')
                .order('created_at', { ascending: false })

            if (limit) {
                query = query.limit(limit)
            }

            const { data, error } = await query

            if (error) throw error
            if (data) setSearches(data as SearchJob[])
        } catch (error) {
            console.error('Error fetching searches:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSearches()

        // Realtime subscription could go here
        const subscription = supabase
            .channel('searches_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'searches' }, (payload) => {
                fetchSearches()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [limit])

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'queued': return <Badge variant="secondary">En file d'attente</Badge>
            case 'running': return <Badge variant="warning" className="animate-pulse">En cours</Badge>
            case 'done': return <Badge variant="success">Terminé</Badge>
            case 'error': return <Badge variant="destructive">Erreur</Badge>
            default: return <Badge variant="outline">{status}</Badge>
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
            <div className="text-center p-8 text-muted-foreground">
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
                        <TableRow key={search.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                                    {search.query}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    {search.city || "Zone définie"}
                                </div>
                            </TableCell>
                            <TableCell>
                                {format(new Date(search.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell>{getStatusBadge(search.status)}</TableCell>
                            <TableCell className="text-right">
                                {search.result_count !== null ? search.result_count : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/searches/${search.id}`}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
