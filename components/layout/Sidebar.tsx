"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, List, Search, Users, Settings, CreditCard, Mail, LogOut, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Historique", href: "/searches", icon: List },
    { name: "Prospects", href: "/prospects", icon: Users },
    { name: "Mails", href: "/emails", icon: Mail },
]

const settingsNavigation = [
    { name: "Configuration", href: "/settings", icon: Settings },
    { name: "Forfait", href: "/billing", icon: CreditCard },
]

// Mock quota data (to be replaced with real data later)
const quotas = {
    scraps: { used: 67, total: 100 },
    deepSearch: { used: 34, total: 100 },
    coldEmails: { used: 45, total: 100 }
}

export function Sidebar() {
    const pathname = usePathname()

    const handleLogout = () => {
        alert("Déconnexion (Fonctionnalité à venir)")
    }

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground shadow-sm z-20">
            <div className="flex h-16 items-center px-6 border-b">
                <div className="flex items-center gap-2 font-bold text-xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                        N
                    </span>
                    <span className="tracking-tight">SUPER <span className="text-primary">Prospect</span></span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-3">
                {/* Main Navigation */}
                <nav className="space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                        const Icon = item.icon
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

                <Separator className="my-4" />

                {/* Quotas Section */}
                <div className="space-y-4 px-3 py-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <TrendingUp className="h-3 w-3" />
                        Quotas
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Scraps</span>
                                <span className="font-medium">{quotas.scraps.used}/{quotas.scraps.total}</span>
                            </div>
                            <Progress value={(quotas.scraps.used / quotas.scraps.total) * 100} className="h-1.5" />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Deep Search</span>
                                <span className="font-medium">{quotas.deepSearch.used}/{quotas.deepSearch.total}</span>
                            </div>
                            <Progress value={(quotas.deepSearch.used / quotas.deepSearch.total) * 100} className="h-1.5" />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Cold Emails</span>
                                <span className="font-medium">{quotas.coldEmails.used}/{quotas.coldEmails.total}</span>
                            </div>
                            <Progress value={(quotas.coldEmails.used / quotas.coldEmails.total) * 100} className="h-1.5" />
                        </div>
                    </div>
                </div>

                <Separator className="my-4" />

                {/* Settings Navigation */}
                <nav className="space-y-1">
                    {settingsNavigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href)
                        const Icon = item.icon
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
