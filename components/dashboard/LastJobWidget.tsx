"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/client"
import { ScrapeJob } from "@/types"
import { getJobStages, getJobProgress, normalizeStatus, getStatusVariant, getStatusLabel, isJobActive } from "@/lib/jobStatus"

export function LastJobWidget() {
    const [lastJob, setLastJob] = useState<ScrapeJob | null>(null)
    const [loading, setLoading] = useState(true)

    const parseQuery = (jsonQuery: string) => {
        if (!jsonQuery) return "N/A"
        try {
            const parsed = JSON.parse(jsonQuery)
            return typeof parsed === 'string' ? parsed : jsonQuery
        } catch (e) {
            return jsonQuery
        }
    }

    useEffect(() => {
        const supabase = createClient()

        const fetchLastJob = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }

            const { data } = await supabase
                .from('scrape_jobs')
                .select('*')
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (data) {
                setLastJob(data as ScrapeJob)
            }
            setLoading(false)
        }

        fetchLastJob()

        // Real-time updates
        const channel = supabase
            .channel('last_job_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'scrape_jobs'
            }, fetchLastJob)
            .subscribe()

        return () => { channel.unsubscribe() }
    }, [])

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Dernière recherche</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-20 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!lastJob) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Dernière recherche</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Aucune recherche pour le moment
                    </p>
                </CardContent>
            </Card>
        )
    }

    const stages = getJobStages(lastJob)
    const progress = getJobProgress(lastJob.statut, stages)
    const active = isJobActive(lastJob.statut)

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle className="text-sm">Dernière recherche</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium truncate flex-1">
                        {parseQuery(lastJob.request_search)}
                    </span>
                    <Badge variant={getStatusVariant(lastJob.statut)} className="shrink-0">
                        {getStatusLabel(lastJob.statut)}
                    </Badge>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{progress}%</span>
                        {active && (
                            <span className="flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                En cours
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-muted-foreground">
                        {format(new Date(lastJob.created_at), 'HH:mm', { locale: fr })}
                    </span>
                    <Link
                        href={`/searches/${lastJob.id_jobs}`}
                        className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                        Voir détails
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            </CardContent>
        </Card>
    )
}
