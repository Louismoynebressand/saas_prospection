"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MapPin, Calendar, Activity, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { ScrapeJob } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProspectListTable } from "@/components/features/ProspectListTable"
import { Skeleton } from "@/components/ui/skeleton"

export default function SearchDetailsPage() {
    const params = useParams()
    const id = params.id as string
    const [search, setSearch] = useState<SearchJob | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchSearch = async () => {
        const { data: searchData, error } = await supabase
            .from('searches')
            .select('*')
            .eq('id', id)
            .single()

        if (searchData) setSearch(searchData as SearchJob)
        setLoading(false)
    }

    useEffect(() => {
        fetchSearch()

        // Subscribe to search updates (status, result_count)
        const subscription = supabase
            .channel(`search_detail_${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'searches',
                filter: `id=eq.${id}`
            }, (payload) => {
                setSearch(payload.new as SearchJob)
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [id])

    if (loading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
        </div>
    }

    if (!search) {
        return <div>Recherche non trouvée</div>
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'queued': return <Badge variant="secondary">En file d'attente</Badge>
            case 'running': return <Badge variant="warning" className="animate-pulse">En cours</Badge>
            case 'done': return <Badge variant="success">Terminé</Badge>
            case 'error': return <Badge variant="destructive">Erreur</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/searches">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{search.query}</h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                        <MapPin className="h-3 w-3" /> {search.city || "Zone"}
                        <span className="text-gray-300">|</span>
                        <Calendar className="h-3 w-3" /> {format(new Date(search.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                </div>
                <div className="ml-auto">
                    {getStatusBadge(search.status)}
                </div>
            </div>

            {search.status === 'error' && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md text-sm border border-destructive/20">
                    <strong>Erreur :</strong> {search.error_message}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Statut</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{search.status}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Résultats</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{search.result_count || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Source</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{search.source}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Prospects</CardTitle>
                    {['queued', 'running'].includes(search.status) && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </CardHeader>
                <CardContent>
                    {/* ProspectListTable handles its own fetching but could also subscribe. 
                  For now we rely on its own internal logic or pass a refresh trigger. 
                  Refactoring ProspectListTable to be Realtime as well is better. 
               */}
                    <ProspectListTable searchId={search.id} />
                </CardContent>
            </Card>
        </div>
    )
}
