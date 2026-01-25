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

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                // Fetch Profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, company_name')
                    .eq('id', user.id)
                    .single()

                if (profile) setUserProfile(profile)

                // Fetch Quotas
                const { data: quotaData } = await supabase
                    .from('quotas')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (quotaData) {
                    setQuotas({
                        scraps: { used: quotaData.scraps_used, total: quotaData.scraps_limit },
                        deepSearch: { used: quotaData.deep_search_used, total: quotaData.deep_search_limit },
                        coldEmails: { used: quotaData.cold_emails_used, total: quotaData.cold_emails_limit },
                        checkEmails: { used: quotaData.check_email_used, total: quotaData.check_email_limit }
                    })
                } else {
                    // Fallback to zeros to avoid infinite loading
                    setQuotas({
                        scraps: { used: 0, total: 20 }, // Default values or fetch from plans? For now 0 to show UI.
                        deepSearch: { used: 0, total: 5 },
                        coldEmails: { used: 0, total: 20 },
                        checkEmails: { used: 0, total: 20 }
                    })
                }
            }
            setLoadingProfile(false)
        }

        fetchData()
    }, [])

    const navigation = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
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
                    <Link href="/dashboard">
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
