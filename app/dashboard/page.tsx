"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { KPIWidget } from "@/components/dashboard/KPIWidget"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { LastJobWidget } from "@/components/dashboard/LastJobWidget"
import { Users, Search, Mail, ShieldCheck, Sparkles } from "lucide-react"

interface DashboardStats {
    totalProspects: number
    totalSearches: number
    activeSearches: number
    emailsScanned: number
    emailsGenerated: number
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalProspects: 0,
        totalSearches: 0,
        activeSearches: 0,
        emailsScanned: 0,
        emailsGenerated: 0
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
                emailsGeneratedResult
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
                    .eq('user_id', user.id)
            ])

            setStats({
                totalProspects: prospectsResult.count || 0,
                totalSearches: searchesResult.count || 0,
                activeSearches: activeSearchesResult.count || 0,
                emailsScanned: emailsScannedResult.count || 0,
                emailsGenerated: emailsGeneratedResult.count || 0
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

        const prospectsChannel = supabase
            .channel('dashboard_prospects')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'scrape_prospect'
            }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        const jobsChannel = supabase
            .channel('dashboard_jobs')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'scrape_jobs'
            }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        const emailsChannel = supabase
            .channel('dashboard_emails')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'cold_email_generations'
            }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(prospectsChannel)
            supabase.removeChannel(jobsChannel)
            supabase.removeChannel(emailsChannel)
        }
    }, [])

    const hasData = stats.totalProspects > 0 || stats.totalSearches > 0

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        Tableau de bord
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Vue d'ensemble de votre activité de prospection
                    </p>
                </div>
                <QuickActions />
            </div>

            {/* KPI Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                    emptyAction={{
                        label: "Commencer",
                        href: "/recherche-prospect"
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
                    emptyAction={{
                        label: "Générer des emails",
                        href: "/emails"
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
                <div className="text-center py-12 px-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-500/10 mb-4">
                        <Sparkles className="h-8 w-8 text-violet-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
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
