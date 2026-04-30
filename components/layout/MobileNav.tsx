"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard, Search, Users, Zap,
    MoreHorizontal, List, Calendar, ShieldCheck,
    Settings, CreditCard, LogOut, X, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

const primaryNav = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Recherche", href: "/recherche-prospect", icon: Search },
    { name: "Prospects", href: "/prospects", icon: Users },
    { name: "Campagnes", href: "/emails", icon: Zap },
]

const moreNav = [
    { name: "Historique", href: "/searches", icon: List, desc: "Recherches passées" },
    { name: "Planning", href: "/campaigns/planning", icon: Calendar, desc: "Vue calendrier" },
    { name: "Vérif. Emails", href: "/email-verifier", icon: ShieldCheck, desc: "Validation emails" },
    { name: "Configuration", href: "/settings", icon: Settings, desc: "Paramètres compte" },
    { name: "Forfait", href: "/billing", icon: CreditCard, desc: "Abonnement & facturation" },
]

export function MobileNav() {
    const pathname = usePathname()
    const router = useRouter()
    const [sheetOpen, setSheetOpen] = useState(false)

    // Close sheet on route change
    useEffect(() => {
        setSheetOpen(false)
    }, [pathname])

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    const isMoreActive = moreNav.some(item =>
        pathname === item.href || pathname.startsWith(item.href + "/")
    )

    return (
        <>
            {/* ─── Backdrop overlay for sheet ─── */}
            {sheetOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                    onClick={() => setSheetOpen(false)}
                />
            )}

            {/* ─── "Plus" Bottom Sheet ─── */}
            <div
                className={cn(
                    "md:hidden fixed left-0 right-0 z-50 bg-card/98 backdrop-blur-xl rounded-t-2xl shadow-2xl border-t transition-transform duration-300 ease-out",
                    sheetOpen ? "translate-y-0" : "translate-y-full"
                )}
                style={{
                    bottom: "64px",
                    paddingBottom: "env(safe-area-inset-bottom)",
                }}
            >
                {/* Sheet handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
                </div>

                {/* Sheet header */}
                <div className="flex items-center justify-between px-5 pb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Autres sections</p>
                    <button
                        onClick={() => setSheetOpen(false)}
                        className="h-7 w-7 flex items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Sheet nav items */}
                <div className="px-3 pb-3 space-y-1">
                    {moreNav.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150",
                                    isActive
                                        ? "bg-indigo-500/10 text-indigo-600"
                                        : "text-foreground/80 hover:bg-muted/70"
                                )}
                            >
                                <div className={cn(
                                    "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                                    isActive ? "bg-indigo-500/20" : "bg-muted/60"
                                )}>
                                    <Icon className={cn("h-4.5 w-4.5", isActive ? "text-indigo-600" : "text-muted-foreground")} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-sm font-medium", isActive && "text-indigo-600")}>{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                            </Link>
                        )
                    })}
                </div>

                {/* Logout */}
                <div className="px-3 pb-4 border-t mx-3 mt-1 pt-3">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all text-red-600 hover:bg-red-50"
                    >
                        <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                            <LogOut className="h-4.5 w-4.5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-red-600">Déconnexion</p>
                            <p className="text-xs text-red-400">Se déconnecter du compte</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* ─── Bottom Navigation Bar ─── */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="flex items-stretch h-16">
                    {primaryNav.map((item) => {
                        const Icon = item.icon
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/dashboard" && pathname.startsWith(item.href))

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-200 relative select-none",
                                    isActive
                                        ? "text-indigo-600"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {/* Active bar */}
                                {isActive && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                                )}

                                <span className={cn(
                                    "flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200",
                                    isActive ? "bg-indigo-500/10" : ""
                                )}>
                                    <Icon className={cn(
                                        "h-5 w-5 transition-all duration-200",
                                        isActive ? "text-indigo-600 scale-110" : ""
                                    )} />
                                </span>
                                <span className={cn("leading-none", isActive ? "text-indigo-600 font-semibold" : "")}>{item.name}</span>
                            </Link>
                        )
                    })}

                    {/* "Plus" button */}
                    <button
                        onClick={() => setSheetOpen(v => !v)}
                        className={cn(
                            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-200 relative select-none",
                            (sheetOpen || isMoreActive)
                                ? "text-indigo-600"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {(sheetOpen || isMoreActive) && (
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        )}
                        <span className={cn(
                            "flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200",
                            (sheetOpen || isMoreActive) ? "bg-indigo-500/10" : ""
                        )}>
                            {sheetOpen
                                ? <X className="h-5 w-5 text-indigo-600" />
                                : <MoreHorizontal className={cn("h-5 w-5 transition-all duration-200", isMoreActive ? "text-indigo-600" : "")} />
                            }
                        </span>
                        <span className={cn("leading-none", (sheetOpen || isMoreActive) ? "text-indigo-600 font-semibold" : "")}>Plus</span>
                    </button>
                </div>
            </nav>
        </>
    )
}
