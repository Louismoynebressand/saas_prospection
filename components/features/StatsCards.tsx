"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, Eye, RefreshCw, MailCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function StatsCards() {
    const [stats, setStats] = useState({
        generated: 0,
        sent: 0,
        opened: 0
    })
    const [loading, setLoading] = useState(true)

    const fetchStats = async () => {
        try {
            const supabase = createClient()

            // 1. Total Generated (excludes 'not_generated')
            const { count: generatedCount, error: genError } = await supabase
                .from('campaign_prospects')
                .select('*', { count: 'exact', head: true })
                .neq('email_status', 'not_generated')

            // 2. Total Sent (sent, opened, clicked, replied, bounced)
            const { count: sentCount, error: sentError } = await supabase
                .from('campaign_prospects')
                .select('*', { count: 'exact', head: true })
                .in('email_status', ['sent', 'opened', 'clicked', 'replied', 'bounced'])

            // 3. Total Opened (opened, clicked, replied) - implied opened
            const { count: openedCount, error: openError } = await supabase
                .from('campaign_prospects')
                .select('*', { count: 'exact', head: true })
                .in('email_status', ['opened', 'clicked', 'replied'])

            if (genError || sentError || openError) {
                console.error("Error fetching stats", { genError, sentError, openError })
                return
            }

            setStats({
                generated: generatedCount || 0,
                sent: sentCount || 0,
                opened: openedCount || 0
            })
        } catch (error) {
            console.error("Stats fetching failed", error)
            toast.error("Erreur chargement stats")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()

        // Refresh every 30s
        const interval = setInterval(fetchStats, 30000)
        return () => clearInterval(interval)
    }, [])

    const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0

    return (
        <>
            <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md border-indigo-100 dark:border-indigo-900/30 hover:shadow-lg hover:shadow-indigo-200/40 transition-all hover:-translate-y-0.5 min-h-[120px]">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-indigo-400/10 to-transparent opacity-80 pointer-events-none" />
                <CardHeader className="pb-3 relative z-10">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                        <RefreshCw className="h-4 w-4" />
                        Emails Générés
                    </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                    <div className="text-2xl font-bold animate-in fade-in">
                        {loading ? "-" : stats.generated}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Prêts ou envoyés</p>
                </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md border-emerald-100 dark:border-emerald-900/30 hover:shadow-lg hover:shadow-emerald-200/40 transition-all hover:-translate-y-0.5 min-h-[120px]">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent opacity-80 pointer-events-none" />
                <CardHeader className="pb-3 relative z-10">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <MailCheck className="h-4 w-4" />
                        Emails Envoyés
                    </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                    <div className="text-2xl font-bold animate-in fade-in">
                        {loading ? "-" : stats.sent}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Campagnes actives</p>
                </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-md border-cyan-100 dark:border-cyan-900/30 hover:shadow-lg hover:shadow-cyan-200/40 transition-all hover:-translate-y-0.5 min-h-[120px]">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-cyan-400/10 to-transparent opacity-80 pointer-events-none" />
                <CardHeader className="pb-3 relative z-10">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                        <Eye className="h-4 w-4" />
                        Taux Ouverture
                    </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                    <div className="text-2xl font-bold animate-in fade-in">
                        {loading ? "-" : `${openRate}%`}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Estimé</p>
                </CardContent>
            </Card>
        </>
    )
}
