"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, List, Search, Users, Settings, CreditCard, Mail, LogOut, TrendingUp, Loader2, ShieldCheck, ChevronDown, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function Sidebar() {
    const pathname = usePathname()
    const [isQuotaExpanded, setIsQuotaExpanded] = useState(false)
    const [quotas, setQuotas] = useState<{
        scraps: { used: number; total: number }
        deepSearch: { used: number; total: number }
        coldEmails: { used: number; total: number }
        checkEmails: { used: number; total: number }
    } | null>(null)

    // Removed fetchProfile logic

    const fetchQuotas = async (userId: string) => {
        try {
            const supabase = createClient()
            // Fetch Quotas
            const { data: quotaData, error } = await supabase
                .from('quotas')
                .select(`
                    user_id,
                    scraps_used,
                    scraps_limit,
                    deep_search_used,
                    deep_search_limit,
                    cold_emails_used,
                    cold_emails_limit,
                    check_email_used,
                    check_email_limit
                `)
                .eq('user_id', userId)
                .single()

            if (error) {
                console.error("Error fetching quotas:", error)
                // Set default quotas immediately to exit loading state
                setQuotas({
                    scraps: { used: 0, total: 20 },
                    deepSearch: { used: 0, total: 5 },
                    coldEmails: { used: 0, total: 20 },
                    checkEmails: { used: 0, total: 20 }
                })
                return
            }

            if (quotaData) {
                setQuotas({
                    scraps: { used: quotaData.scraps_used || 0, total: quotaData.scraps_limit || 20 },
                    deepSearch: { used: quotaData.deep_search_used || 0, total: quotaData.deep_search_limit || 5 },
                    coldEmails: { used: quotaData.cold_emails_used || 0, total: quotaData.cold_emails_limit || 20 },
                    checkEmails: { used: quotaData.check_email_used || 0, total: quotaData.check_email_limit || 20 }
                })
            } else {
                // No data returned - set defaults
                console.warn("No quota data found for user, using defaults")
                setQuotas({
                    scraps: { used: 0, total: 20 },
                    deepSearch: { used: 0, total: 5 },
                    coldEmails: { used: 0, total: 20 },
                    checkEmails: { used: 0, total: 20 }
                })
            }
        } catch (err) {
            console.error("Exception fetching quotas:", err)
            // Always set default quotas to prevent infinite loading
            setQuotas({
                scraps: { used: 0, total: 20 },
                deepSearch: { used: 0, total: 5 },
                coldEmails: { used: 0, total: 20 },
                checkEmails: { used: 0, total: 20 }
            })
        }
    }

    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel> | null = null

        // Listen to auth state changes to handle session availability
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
            async (event: string, session: any) => {
                const user = session?.user

                if (user) {
                    // User is authenticated - fetch data immediately
                    // Add timeout safeguard to prevent infinite loading if Supabase SDK hangs
                    const fetchDataPromise = fetchQuotas(user.id)

                    const timeoutPromise = new Promise((resolve) => {
                        setTimeout(() => {
                            console.error("⚠️ [Sidebar] Data fetch timed out (5s). Forcing UI load.")
                            resolve("timeout")
                        }, 5000)
                    })

                    await Promise.race([fetchDataPromise, timeoutPromise])

                    // Setup Realtime subscription AFTER having a valid user
                    if (!channel) {
                        let debounceTimer: NodeJS.Timeout

                        channel = supabase
                            .channel(`quotas-updates-${user.id}`)
                            .on(
                                'postgres_changes',
                                {
                                    event: '*',
                                    schema: 'public',
                                    table: 'quotas',
                                    filter: `user_id=eq.${user.id}` // Server-side filter
                                },
                                () => {
                                    // Quota changed - refetch with DEBOUNCE
                                    // Prevents flooding during mass-inserts (scraping)
                                    clearTimeout(debounceTimer)
                                    debounceTimer = setTimeout(() => {
                                        fetchQuotas(user.id)
                                    }, 2000)
                                }
                            )
                            .subscribe()
                    }
                } else {
                    // User logged out - reset state
                    setQuotas(null)

                    // Cleanup channel if exists
                    if (channel) {
                        supabase.removeChannel(channel)
                        channel = null
                    }
                }
            }
        )

        // Cleanup on unmount
        return () => {
            authSubscription?.unsubscribe()
            if (channel) {
                supabase.removeChannel(channel)
            }
        }
    }, [])

    const navigation = [
        { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
        { name: "Recherche Prospect", href: "/recherche-prospect", icon: Search },
        { name: "Historique", href: "/searches", icon: List },
        { name: "Prospects", href: "/prospects", icon: Users },
        { name: "Prospection Mail", href: "/emails", icon: Mail },
        { name: "Planning Global", href: "/campaigns/planning", icon: Calendar },
        { name: "Vérificateur Emails", href: "/email-verifier", icon: ShieldCheck },
    ]

    const configNavigation = [
        { name: "Configuration", href: "/settings", icon: Settings },
        { name: "Forfait", href: "/billing", icon: CreditCard },
    ]

    // Calculate Global Quota Percentage
    const getGlobalQuotaValid = () => {
        if (!quotas) return 0
        const s = (quotas.scraps.used / quotas.scraps.total)
        const d = (quotas.deepSearch.used / quotas.deepSearch.total)
        const c = (quotas.coldEmails.used / quotas.coldEmails.total)
        const e = (quotas.checkEmails.used / quotas.checkEmails.total)
        return Math.min(100, Math.round(((s + d + c + e) / 4) * 100))
    }

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-card">
            {/* Header & Main Nav - Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <div className="flex items-center gap-2 font-bold text-xl text-primary mb-8">
                    <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center">N</div>
                    SUPER Prospect
                </div>

                <Button className="w-full gap-2 mb-6" size="lg" asChild>
                    <Link href="/recherche-prospect">
                        <Search className="h-4 w-4" />
                        Nouvelle recherche
                    </Link>
                </Button>

                <nav className="space-y-1">
                    {navigation.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground hover:pl-4"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* Footer Section - Always Visible */}
            <div className="flex-shrink-0 border-t bg-card p-6">

                <div className="grid gap-2 mb-4">
                    {configNavigation.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/5 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        )
                    })}
                </div>

                {/* Upgrade Button - Above Quotas */}
                <Button
                    variant="outline"
                    className="w-full mb-4 bg-white border-2 border-purple-300 text-purple-700 
                               hover:bg-purple-50 hover:border-purple-400
                               shadow-[0_0_15px_rgba(168,85,247,0.3)] 
                               hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]
                               transition-all duration-300 font-bold"
                    asChild
                >
                    <Link href="/billing">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Upgrade Plan
                    </Link>
                </Button>

                {/* Condensed Quotas Section */}
                <div className="pt-4 border-t">
                    {quotas ? (
                        <div className="space-y-2">
                            <div
                                className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => setIsQuotaExpanded(!isQuotaExpanded)}
                            >
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <TrendingUp className="h-3 w-3" />
                                    Quota global
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-primary">{getGlobalQuotaValid()}%</span>
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isQuotaExpanded && "rotate-180")} />
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isQuotaExpanded && (
                                <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Scraps</span>
                                            <span>{quotas.scraps.used}/{quotas.scraps.total}</span>
                                        </div>
                                        <Progress value={(quotas.scraps.used / quotas.scraps.total) * 100} className="h-1" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Deep Search</span>
                                            <span>{quotas.deepSearch.used}/{quotas.deepSearch.total}</span>
                                        </div>
                                        <Progress value={(quotas.deepSearch.used / quotas.deepSearch.total) * 100} className="h-1" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Cold Emails</span>
                                            <span>{quotas.coldEmails.used}/{quotas.coldEmails.total}</span>
                                        </div>
                                        <Progress value={(quotas.coldEmails.used / quotas.coldEmails.total) * 100} className="h-1" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Check Emails</span>
                                            <span>{quotas.checkEmails.used}/{quotas.checkEmails.total}</span>
                                        </div>
                                        <Progress value={(quotas.checkEmails.used / quotas.checkEmails.total) * 100} className="h-1" />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-4 bg-muted rounded w-full"></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
