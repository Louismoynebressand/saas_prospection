"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard, Search, Users, Zap, Settings
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Recherche", href: "/recherche-prospect", icon: Search },
    { name: "Prospects", href: "/prospects", icon: Users },
    { name: "Campagnes", href: "/emails", icon: Zap },
    { name: "Paramètres", href: "/settings", icon: Settings },
]

export function MobileNav() {
    const pathname = usePathname()

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border/60"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="flex items-stretch h-16">
                {navItems.map((item) => {
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
                            {/* Active indicator bar */}
                            {isActive && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
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
                            <span className={cn(
                                "leading-none",
                                isActive ? "text-indigo-600 font-semibold" : ""
                            )}>
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
