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
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-indigo-700">
                        <RefreshCw className="h-4 w-4" />
                        Emails Générés
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold animate-in fade-in">
                        {loading ? "-" : stats.generated}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Prêts ou envoyés</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
                        <MailCheck className="h-4 w-4" />
                        Emails Envoyés
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold animate-in fade-in">
                        {loading ? "-" : stats.sent}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Campagnes actives</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-600">
                        <Eye className="h-4 w-4" />
                        Taux Ouverture
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold animate-in fade-in">
                        {loading ? "-" : `${openRate}%`}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Estimé</p>
                </CardContent>
            </Card>
        </>
    )
}
