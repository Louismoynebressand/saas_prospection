"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, List, Search, Users, Settings, CreditCard, Mail, LogOut, TrendingUp, Loader2, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function Sidebar() {
    const pathname = usePathname()
    const [userProfile, setUserProfile] = useState<{
        first_name: string | null
        last_name: string | null
        company_name: string | null
    } | null>(null)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [quotas, setQuotas] = useState<{
        scraps: { used: number; total: number }
        deepSearch: { used: number; total: number }
        coldEmails: { used: number; total: number }
        checkEmails: { used: number; total: number }
    } | null>(null)

    const fetchProfile = async (userId: string) => {
        try {
            const supabase = createClient()
            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, company_name')
                .eq('id', userId)
                .single()

            if (profile) setUserProfile(profile)
        } catch (err) {
            console.error("Error fetching profile:", err)
        }
    }

    const fetchQuotas = async (userId: string) => {
        try {
            const supabase = createClient()
            // Fetch Quotas
            const { data: quotaData, error } = await supabase
                .from('quotas')
                .select('*')
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
            async (event, session) => {
                const user = session?.user

                if (user) {
                    // User is authenticated - fetch data immediately
                    await Promise.all([
                        fetchProfile(user.id),
                        fetchQuotas(user.id)
                    ])
                    setLoadingProfile(false)

                    // Setup Realtime subscription AFTER having a valid user
                    if (!channel) {
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
                                    // Quota changed - refetch
                                    fetchQuotas(user.id)
                                }
                            )
                            .subscribe()
                    }
                } else {
                    // User logged out - reset state
                    setQuotas(null)
                    setUserProfile(null)
                    setLoadingProfile(false)

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
        { name: "Vérificateur Emails", href: "/email-verifier", icon: ShieldCheck },
    ]

    const configNavigation = [
        { name: "Configuration", href: "/settings", icon: Settings },
        { name: "Forfait", href: "/billing", icon: CreditCard },
    ]

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card">
            <div className="p-6">
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

            <div className="mt-auto p-6 pt-0">
                {/* Quotas Section */}
                <div className="mb-6 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <TrendingUp className="h-3 w-3" />
                        Quotas
                    </div>

                    {quotas ? (
                        <>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Scraps</span>
                                    <span className="font-medium">{quotas.scraps.used}/{quotas.scraps.total}</span>
                                </div>
                                <Progress value={(quotas.scraps.used / quotas.scraps.total) * 100} className="h-1.5" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Deep Search</span>
                                    <span className="font-medium">{quotas.deepSearch.used}/{quotas.deepSearch.total}</span>
                                </div>
                                <Progress value={(quotas.deepSearch.used / quotas.deepSearch.total) * 100} className="h-1.5" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Cold Emails</span>
                                    <span className="font-medium">{quotas.coldEmails.used}/{quotas.coldEmails.total}</span>
                                </div>
                                <Progress value={(quotas.coldEmails.used / quotas.coldEmails.total) * 100} className="h-1.5" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Check Emails</span>
                                    <span className="font-medium">{quotas.checkEmails.used}/{quotas.checkEmails.total}</span>
                                </div>
                                <Progress value={(quotas.checkEmails.used / quotas.checkEmails.total) * 100} className="h-1.5" />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-4 bg-muted rounded w-full"></div>
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                            <div className="h-4 bg-muted rounded w-5/6"></div>
                        </div>
                    )}

                    <Button
                        variant="default"
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                        asChild
                    >
                        <Link href="/billing">
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Upgrade Plan
                        </Link>
                    </Button>
                </div>

                <Separator className="my-4" />

                <nav className="space-y-1 mb-4">
                    {configNavigation.map((item) => {
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

            {/* User Profile & Logout */}
            <div className="border-t p-4 space-y-2">
                {userProfile ? (
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 mb-2">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {userProfile.first_name?.[0]}{userProfile.last_name?.[0]}
                        </div>
                        <div className="text-sm flex-1 truncate">
                            <p className="font-medium truncate">{userProfile.first_name} {userProfile.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{userProfile.company_name}</p>
                        </div>
                    </div>
                ) : loadingProfile ? (
                    <div className="flex items-center gap-3 rounded-lg bg-muted/20 p-3 mb-2 animate-pulse">
                        <div className="h-8 w-8 rounded-full bg-muted"></div>
                        <div className="space-y-2 flex-1">
                            <div className="h-3 w-20 bg-muted rounded"></div>
                            <div className="h-2 w-16 bg-muted rounded"></div>
                        </div>
                    </div>
                ) : null}

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={async () => {
                        await fetch('/auth/logout', { method: 'POST' })
                        window.location.href = '/login'
                    }}
                >
                    <LogOut className="h-4 w-4" />
                    Déconnexion
                </Button>
            </div>
        </div>
    )
}
