"use client"

import { useEffect, useState, useRef } from "react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ProspectListTable } from "@/components/features/ProspectListTable"
import { JobStepper } from "@/components/features/JobStepper"
import { Skeleton } from "@/components/ui/skeleton"

export default function SearchDetailsPage() {
    const params = useParams()
    const id = params.id as string
    const [search, setSearch] = useState<ScrapeJob | null>(null)
    const [loading, setLoading] = useState(true)
    const pollInterval = useRef<NodeJS.Timeout | null>(null)

    const fetchSearch = async () => {
        console.log('[DEBUG] Fetching search with id:', id, 'type:', typeof id)
        const { data: searchData, error } = await supabase
            .from('scrape_jobs')
            .select('*')
            .eq('id_jobs', id)
            .single()

        console.log('[DEBUG] Search result:', { searchData, error })
        if (searchData) setSearch(searchData as ScrapeJob)
        setLoading(false)
    }

    useEffect(() => {
        fetchSearch()

        // 1. Realtime subscription (Backup/Instant)
        const subscription = supabase
            .channel(`scrape_job_detail_${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'scrape_jobs',
                filter: `id_jobs=eq.${id}`
            }, (payload) => {
                setSearch(payload.new as ScrapeJob)
            })
            .subscribe()

        // 2. Polling every 10s as requested by user
        pollInterval.current = setInterval(() => {
            fetchSearch()
        }, 10000)

        return () => {
            subscription.unsubscribe()
            if (pollInterval.current) clearInterval(pollInterval.current)
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
        const s = status?.toLowerCase()
        switch (s) {
            case 'queued': return <Badge variant="secondary">En file d'attente</Badge>
            case 'running': return <Badge variant="warning" className="animate-pulse">En cours</Badge>
            case 'done':
            case 'allfinish': return <Badge variant="success">Terminé</Badge>
            case 'error': return <Badge variant="destructive">Erreur</Badge>
            default: return <Badge variant="outline">{status}</Badge>
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

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/searches">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{parseQuery(search.request_search)}</h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                        <MapPin className="h-3 w-3" /> {search.resuest_ville || "Zone"}
                        <span className="text-gray-300">|</span>
                        <Calendar className="h-3 w-3" /> {format(new Date(search.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                </div>
                <div className="ml-auto">
                    {getStatusBadge(search.statut)}
                </div>
            </div>

            {/* Job Progress Stepper */}
            <JobStepper job={search} />

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Statut</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{search.statut === 'ALLfinish' ? 'done' : search.statut}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Limites</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{search.request_count || "-"}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Prospects</CardTitle>
                    {['queued', 'running'].includes(search.statut?.toLowerCase()) && (
                        <div className="flex items-center gap-2 text-primary text-sm font-medium">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Mise à jour automatique...
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {/* Added polling to table content too via a prop if needed, 
                  but Table already has its own Realtime. 
                  Adding a refresh trigger for consistency.
              */}
                    <ProspectListTable searchId={String(search.id_jobs)} autoRefresh={['queued', 'running'].includes(search.statut?.toLowerCase())} />
                </CardContent>
            </Card>
        </div>
    )
}
