"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { ScrapeJob } from "@/types"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Clock, MapPin } from "lucide-react"
import Link from "next/link"

export function ActivityFeed() {
    const [recentJobs, setRecentJobs] = useState<ScrapeJob[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchRecentActivity = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('scrape_jobs')
                .select('*')
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })
                .limit(5)

            if (data) {
                setRecentJobs(data as ScrapeJob[])
            }
            setLoading(false)
        }

        fetchRecentActivity()
    }, [])

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase()
        switch (s) {
            case 'queued':
                return <Badge variant="secondary" className="text-xs">En attente</Badge>
            case 'running':
                return <Badge variant="warning" className="text-xs animate-pulse">En cours</Badge>
            case 'done':
            case 'allfinish':
                return <Badge variant="success" className="text-xs">Terminé</Badge>
            case 'error':
                return <Badge variant="destructive" className="text-xs">Erreur</Badge>
            default:
                return <Badge variant="outline" className="text-xs">{status}</Badge>
        }
    }

    const parseQuery = (jsonQuery: string) => {
        if (!jsonQuery) return "Recherche"
        try {
            const parsed = JSON.parse(jsonQuery)
            return typeof parsed === 'string' ? parsed : jsonQuery
        } catch (e) {
            return jsonQuery
        }
    }

    return (
        <Card className="col-span-full lg:col-span-3">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : recentJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Aucune activité récente</p>
                        <p className="text-xs mt-1">Lancez votre première recherche pour commencer</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentJobs.map((job) => (
                            <Link
                                key={job.id_jobs}
                                href={`/searches/${job.id_jobs}`}
                                className="
                                    flex items-start gap-3 p-3 rounded-lg
                                    transition-all duration-200
                                    hover:bg-muted/50 hover:shadow-sm
                                    active:scale-[0.99]
                                    group
                                "
                            >
                                <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors">
                                    <MapPin className="h-5 w-5 text-violet-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-medium text-sm truncate">
                                            {parseQuery(job.request_search)}
                                        </p>
                                        {getStatusBadge(job.statut)}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span>{job.resuest_ville || "Non spécifié"}</span>
                                        <span>•</span>
                                        <Clock className="h-3 w-3" />
                                        <span>{format(new Date(job.created_at), "d MMM HH:mm", { locale: fr })}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
