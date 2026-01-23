"use client"

import { useEffect, useState } from "react"
import { Users, Search as SearchIcon, Database, ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { DEMO_USER_ID } from "@/lib/utils"

export function DashboardStats() {
    const [stats, setStats] = useState({
        totalSearches: 0,
        activeSearches: 0,
        totalProspects: 0,
        emailsFound: 0
    })

    const fetchStats = async () => {
        try {
            // 1. Total Searches for current demo user
            const { count: totalSearches } = await supabase
                .from('scrape_jobs')
                .select('*', { count: 'exact', head: true })
                .eq('id_user', DEMO_USER_ID)

            // 2. Active Searches (queued or running)
            const { count: activeSearches } = await supabase
                .from('scrape_jobs')
                .select('*', { count: 'exact', head: true })
                .eq('id_user', DEMO_USER_ID)
                .in('statut', ['queued', 'running'])

            // 3. Total Prospects for the demo user
            const { count: totalProspects } = await supabase
                .from('scrape_prospect')
                .select('*', { count: 'exact', head: true })
                .eq('id_user', DEMO_USER_ID)

            // 4. Enrich rate (checking email_adresse_verified)
            const { count: emailsFound } = await supabase
                .from('scrape_prospect')
                .select('*', { count: 'exact', head: true })
                .eq('id_user', DEMO_USER_ID)
                .not('email_adresse_verified', 'is', null)

            setStats({
                totalSearches: totalSearches || 0,
                activeSearches: activeSearches || 0,
                totalProspects: totalProspects || 0,
                emailsFound: emailsFound || 0
            })
        } catch (error) {
            console.error("Error fetching stats:", error)
        }
    }

    useEffect(() => {
        fetchStats()

        const searchSub = supabase
            .channel('dashboard_stats_scrape_jobs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_jobs' }, () => {
                fetchStats()
            })
            .subscribe()

        const prospectSub = supabase
            .channel('dashboard_stats_scrape_prospects')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_prospect' }, () => {
                fetchStats()
            })
            .subscribe()

        return () => {
            searchSub.unsubscribe()
            prospectSub.unsubscribe()
        }
    }, [])

    const enrichRate = stats.totalProspects > 0
        ? Math.round((stats.emailsFound / stats.totalProspects) * 100)
        : 0

    return (
        <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Recherches</CardTitle>
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalSearches}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {stats.activeSearches > 0 && (
                            <span className="text-primary flex items-center gap-1 font-medium bg-primary/10 px-1 rounded-sm">
                                <ArrowUpRight className="h-3 w-3" /> {stats.activeSearches} active(s)
                            </span>
                        )}
                    </p>
                </CardContent>
            </Card>
            <Card className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Prospects</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalProspects}</div>
                    <p className="text-xs text-muted-foreground">Profils détectés</p>
                </CardContent>
            </Card>
            <Card className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Enrichissement</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{enrichRate}%</div>
                    <p className="text-xs text-muted-foreground">{stats.emailsFound} emails trouvés</p>
                </CardContent>
            </Card>
        </div>
    )
}
