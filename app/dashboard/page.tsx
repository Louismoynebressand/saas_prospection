"use client"
// TEST PUSH - Dashboard with new KPIs (16:47)

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { KPIWidget } from "@/components/dashboard/KPIWidget"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { LastJobWidget } from "@/components/dashboard/LastJobWidget"
import { Users, Search, Mail, ShieldCheck, Sparkles, Rocket, Send } from "lucide-react"

interface DashboardStats {
    totalProspects: number
    totalSearches: number
    activeSearches: number
    emailsScanned: number
    emailsGenerated: number
    activeCampaigns: number
    emailsSent: number
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalProspects: 0,
        totalSearches: 0,
        activeSearches: 0,
        emailsScanned: 0,
        emailsGenerated: 0,
        activeCampaigns: 0,
        emailsSent: 0
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchDashboardStats = async () => {
        try {
            setError(null)
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setLoading(false)
                return
            }

            // Parallel queries for performance
            const [
                prospectsResult,
                searchesResult,
                activeSearchesResult,
                emailsScannedResult,
                emailsGeneratedResult,
                activeCampaignsResult,
                emailsSentResult
            ] = await Promise.all([
                // Total prospects scraped
                supabase
                    .from('scrape_prospect')
                    .select('*', { count: 'exact', head: true })
                    .eq('id_user', user.id),

                // Total searches
                supabase
                    .from('scrape_jobs')
                    .select('*', { count: 'exact', head: true })
                    .eq('id_user', user.id),

                // Active searches (queued or running)
                supabase
                    .from('scrape_jobs')
                    .select('*', { count: 'exact', head: true })
                    .eq('id_user', user.id)
                    .in('statut', ['queued', 'running']),

                // Emails scanned (from email verification)
                supabase
                    .from('email_verification_results')
                    .select('*', { count: 'exact', head: true })
                    .eq('id_user', user.id),

                // Emails generated (from cold email generation)
                supabase
                    .from('cold_email_generations')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id),

                // Active Campaigns
                supabase
                    .from('campaigns')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_active', true),

                // Emails Sent (via campaign links)
                supabase
                    .from('campaign_prospect_links')
                    .select('*', { count: 'exact', head: true })
                    .in('email_status', ['sent', 'opened', 'clicked', 'replied']) // Count any interaction as sent initially
            ])

            setStats({
                totalProspects: prospectsResult.count || 0,
                totalSearches: searchesResult.count || 0,
                activeSearches: activeSearchesResult.count || 0,
                emailsScanned: emailsScannedResult.count || 0,
                emailsGenerated: emailsGeneratedResult.count || 0,
                activeCampaigns: activeCampaignsResult.count || 0,
                emailsSent: emailsSentResult.count || 0
            })
            setLoading(false)
        } catch (err: any) {
            console.error('Error fetching dashboard stats:', err)
            setError(err.message || 'Erreur de chargement')
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDashboardStats()

        // Real-time subscriptions
        const supabase = createClient()

        const prospectsChannel = supabase.channel('dashboard_prospects')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_prospect' }, fetchDashboardStats)
            .subscribe()

        const jobsChannel = supabase.channel('dashboard_jobs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_jobs' }, fetchDashboardStats)
            .subscribe()

        const emailsChannel = supabase.channel('dashboard_emails')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cold_email_generations' }, fetchDashboardStats)
            .subscribe()

        const campaignsChannel = supabase.channel('dashboard_campaigns')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, fetchDashboardStats)
            .subscribe()

        return () => {
            supabase.removeChannel(prospectsChannel)
            supabase.removeChannel(jobsChannel)
            supabase.removeChannel(emailsChannel)
            supabase.removeChannel(campaignsChannel)
        }
    }, [])

    const hasData = stats.totalProspects > 0 || stats.totalSearches > 0

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto relative">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-3xl opacity-50 animate-pulse" />
                <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-indigo-500/10 rounded-full blur-3xl opacity-40 delay-700 animate-pulse" />
                <div className="absolute top-[40%] left-[30%] w-[20%] h-[20%] bg-fuchsia-400/5 rounded-full blur-3xl opacity-30 delay-1000" />
            </div>

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-900 to-indigo-900 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                        Tableau de bord
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Vue d'ensemble de votre activité de prospection
                    </p>
                </div>
                <QuickActions />
            </div>

            {/* KPI Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <KPIWidget
                    title="Prospects scrapés"
                    icon={Users}
                    value={stats.totalProspects}
                    subtitle="Profils détectés au total"
                    loading={loading}
                    error={error || undefined}
                    onRetry={fetchDashboardStats}
                    isEmpty={!loading && stats.totalProspects === 0}
                    emptyMessage="Aucun prospect pour le moment"
                    className="border-violet-200/50"
                    emptyAction={{
                        label: "Lancer une recherche",
                        href: "/recherche-prospect"
                    }}
                />

                <KPIWidget
                    title="Recherches effectuées"
                    icon={Search}
                    value={stats.totalSearches}
                    subtitle={
                        stats.activeSearches > 0
                            ? `${stats.activeSearches} en cours`
                            : "Toutes terminées"
                    }
                    loading={loading}
                    error={error || undefined}
                    onRetry={fetchDashboardStats}
                    isEmpty={!loading && stats.totalSearches === 0}
                    emptyMessage="Aucune recherche lancée"
                    className="border-indigo-200/50"
                    emptyAction={{
                        label: "Commencer",
                        href: "/recherche-prospect"
                    }}
                />

                <KPIWidget
                    title="Campagnes Actives"
                    icon={Rocket}
                    value={stats.activeCampaigns}
                    subtitle="Campagnes en cours"
                    loading={loading}
                    error={error || undefined}
                    onRetry={fetchDashboardStats}
                    isEmpty={!loading && stats.activeCampaigns === 0}
                    emptyMessage="Aucune campagne active"
                    className="border-fuchsia-200/50"
                    emptyAction={{
                        label: "Créer une campagne",
                        href: "/campaigns"
                    }}
                />

                <KPIWidget
                    title="Emails scannés"
                    icon={ShieldCheck}
                    value={stats.emailsScanned}
                    subtitle="Vérifications effectuées"
                    loading={loading}
                    error={error || undefined}
                    onRetry={fetchDashboardStats}
                    isEmpty={!loading && stats.emailsScanned === 0}
                    emptyMessage="Aucune vérification"
                    className="border-blue-200/50"
                    emptyAction={{
                        label: "Vérifier des emails",
                        href: "/email-verifier"
                    }}
                />

                <KPIWidget
                    title="Emails générés"
                    icon={Mail}
                    value={stats.emailsGenerated}
                    subtitle="Cold emails créés"
                    loading={loading}
                    error={error || undefined}
                    onRetry={fetchDashboardStats}
                    isEmpty={!loading && stats.emailsGenerated === 0}
                    emptyMessage="Aucun email généré"
                    className="border-cyan-200/50"
                    emptyAction={{
                        label: "Générer des emails",
                        href: "/emails"
                    }}
                />
                <KPIWidget
                    title="Emails Envoyés"
                    icon={Send}
                    value={stats.emailsSent}
                    subtitle="Envoyés aux prospects"
                    loading={loading}
                    error={error || undefined}
                    onRetry={fetchDashboardStats}
                    isEmpty={!loading && stats.emailsSent === 0}
                    emptyMessage="Aucun envoi effectué"
                    className="border-emerald-200/50"
                    emptyAction={{
                        label: "Voir les campagnes",
                        href: "/campaigns"
                    }}
                />
            </div>

            {/* Activity Feed & Last Job */}
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ActivityFeed />
                </div>
                <div>
                    <LastJobWidget />
                </div>
            </div>

            {/* Empty State CTA */}
            {!loading && !hasData && (
                <div className="text-center py-12 px-4 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-fuchsia-500/5 to-indigo-500/5 rounded-2xl -z-10 blur-xl block" />
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-500/10 mb-4 animate-bounce duration-[3000ms]">
                        <Sparkles className="h-8 w-8 text-violet-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 bg-gradient-to-br from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        Bienvenue sur SUPER Prospect
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        Commencez par lancer votre première recherche de prospects sur Google Maps
                    </p>
                    <QuickActions />
                </div>
            )}
        </div>
    )
}
