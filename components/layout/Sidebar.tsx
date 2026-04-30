"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard, List, Search, Users, Settings, CreditCard,
    Mail, LogOut, TrendingUp, ShieldCheck, ChevronDown, Calendar,
    X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSidebar } from "@/components/providers/SidebarContext"

export function Sidebar() {
    const pathname = usePathname()
    const { isOpen, close } = useSidebar()
    const [isQuotaExpanded, setIsQuotaExpanded] = useState(false)
    const [quotas, setQuotas] = useState<{
        scraps: { used: number; total: number }
        deepSearch: { used: number; total: number }
        coldEmails: { used: number; total: number }
        checkEmails: { used: number; total: number }
    } | null>(null)

    const fetchQuotas = async (userId: string) => {
        try {
            const supabase = createClient()
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
                setQuotas({
                    scraps: { used: 0, total: 20 },
                    deepSearch: { used: 0, total: 5 },
                    coldEmails: { used: 0, total: 20 },
                    checkEmails: { used: 0, total: 20 }
                })
            }
        } catch (err) {
            console.error("Exception fetching quotas:", err)
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

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
            async (event: string, session: any) => {
                const user = session?.user

                if (user) {
                    const fetchDataPromise = fetchQuotas(user.id)
                    const timeoutPromise = new Promise((resolve) => {
                        setTimeout(() => {
                            console.error("⚠️ [Sidebar] Data fetch timed out (5s). Forcing UI load.")
                            resolve("timeout")
                        }, 5000)
                    })
                    await Promise.race([fetchDataPromise, timeoutPromise])

                    if (!channel) {
                        let debounceTimer: NodeJS.Timeout
                        channel = supabase
                            .channel(`quotas-updates-${user.id}`)
                            .on(
                                'postgres_changes',
                                { event: '*', schema: 'public', table: 'quotas', filter: `user_id=eq.${user.id}` },
                                () => {
                                    clearTimeout(debounceTimer)
                                    debounceTimer = setTimeout(() => { fetchQuotas(user.id) }, 2000)
                                }
                            )
                            .subscribe()
                    }
                } else {
                    setQuotas(null)
                    if (channel) {
                        supabase.removeChannel(channel)
                        channel = null
                    }
                }
            }
        )

        return () => {
            authSubscription?.unsubscribe()
            if (channel) { supabase.removeChannel(channel) }
        }
    }, [])

    // Close drawer on navigation (mobile)
    useEffect(() => {
        close()
    }, [pathname])

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

    const getGlobalQuotaValid = () => {
        if (!quotas) return 0
        const s = (quotas.scraps.used / quotas.scraps.total)
        const d = (quotas.deepSearch.used / quotas.deepSearch.total)
        const c = (quotas.coldEmails.used / quotas.coldEmails.total)
        const e = (quotas.checkEmails.used / quotas.checkEmails.total)
        return Math.min(100, Math.round(((s + d + c + e) / 4) * 100))
    }

    const sidebarContent = (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 font-bold text-xl text-primary">
                        <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">N</div>
                        {/* Label visible on desktop and mobile drawer, hidden on tablet collapsed */}
                        <span className="sidebar-label">SUPER Prospect</span>
                    </div>
                    {/* Close button — mobile only */}
                    <button
                        onClick={close}
                        className="md:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Fermer le menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <Button className="w-full gap-2 mb-6 sidebar-label-flex" size="lg" asChild>
                    <Link href="/recherche-prospect">
                        <Search className="h-4 w-4 shrink-0" />
                        <span className="sidebar-label">Nouvelle recherche</span>
                    </Link>
                </Button>

                {/* Compact icon button for tablet collapsed */}
                <Button
                    className="w-full mb-6 sidebar-icon-only justify-center"
                    size="icon"
                    asChild
                >
                    <Link href="/recherche-prospect" title="Nouvelle recherche">
                        <Search className="h-5 w-5" />
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
                                title={item.name}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 relative overflow-hidden group",
                                    isActive
                                        ? "bg-gradient-to-r from-violet-500/10 to-indigo-500/10 text-indigo-700 shadow-sm border-l-4 border-indigo-500 pl-2"
                                        : "text-muted-foreground hover:bg-slate-50 hover:text-foreground hover:pl-4"
                                )}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-transparent opacity-100 pointer-events-none" />
                                )}
                                {isActive && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                )}
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="sidebar-label">{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t bg-card p-4">
                <div className="grid gap-2 mb-4">
                    {configNavigation.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                title={item.name}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/5 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="sidebar-label">{item.name}</span>
                            </Link>
                        )
                    })}
                </div>

                <Button
                    variant="outline"
                    className="w-full mb-4 sidebar-label-flex bg-white border-2 border-purple-300 text-purple-700 
                               hover:bg-purple-50 hover:border-purple-400
                               shadow-[0_0_15px_rgba(168,85,247,0.3)] 
                               hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]
                               transition-all duration-300 font-bold"
                    asChild
                >
                    <Link href="/billing">
                        <TrendingUp className="mr-2 h-4 w-4 shrink-0" />
                        <span className="sidebar-label">Upgrade Plan</span>
                    </Link>
                </Button>

                {/* Upgrade icon-only for collapsed tablet */}
                <Button
                    variant="outline"
                    className="w-full mb-4 sidebar-icon-only justify-center border-purple-300 text-purple-700"
                    size="icon"
                    asChild
                >
                    <Link href="/billing" title="Upgrade Plan">
                        <TrendingUp className="h-4 w-4" />
                    </Link>
                </Button>

                {/* Quotas — hidden in collapsed mode */}
                <div className="pt-4 border-t sidebar-label">
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

                            {isQuotaExpanded && (
                                <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                    {[
                                        { label: "Scraps", data: quotas.scraps },
                                        { label: "Deep Search", data: quotas.deepSearch },
                                        { label: "Cold Emails", data: quotas.coldEmails },
                                        { label: "Check Emails", data: quotas.checkEmails },
                                    ].map(({ label, data }) => (
                                        <div key={label} className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                                <span>{label}</span>
                                                <span>{data.used}/{data.total}</span>
                                            </div>
                                            <Progress value={(data.used / data.total) * 100} className="h-1" />
                                        </div>
                                    ))}
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

    return (
        <>
            {/* ─── DESKTOP + TABLET LANDSCAPE (≥ 1024px): sidebar normale ─── */}
            <div className="hidden lg:flex h-screen w-64 flex-col border-r bg-card shrink-0">
                {sidebarContent}
            </div>

            {/* ─── TABLET PORTRAIT (768–1023px): sidebar collapsed icons ─── */}
            <div className="hidden md:flex lg:hidden h-screen w-16 flex-col border-r bg-card shrink-0 sidebar-collapsed">
                {sidebarContent}
            </div>

            {/* ─── MOBILE (< 768px): Drawer overlay ─── */}
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={close}
                aria-hidden="true"
            />
            {/* Drawer panel */}
            <div
                className={cn(
                    "fixed top-0 left-0 z-50 h-full w-72 bg-card border-r shadow-2xl transition-transform duration-300 ease-in-out md:hidden flex flex-col",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {sidebarContent}
            </div>
        </>
    )
}
