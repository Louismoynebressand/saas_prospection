"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard, Search, Users, Mail, Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"

const mobileNav = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Recherche", href: "/recherche-prospect", icon: Search },
    { name: "Prospects", href: "/prospects", icon: Users },
    { name: "Emails", href: "/emails", icon: Mail },
    { name: "Planning", href: "/campaigns/planning", icon: Calendar },
]

export function MobileNav() {
    const pathname = usePathname()

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="flex items-stretch h-16">
                {mobileNav.map((item) => {
                    const Icon = item.icon
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href))

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all duration-200 relative",
                                isActive
                                    ? "text-indigo-600"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {/* Active indicator bar */}
                            {isActive && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-500 rounded-full" />
                            )}

                            {/* Icon with active bg bubble */}
                            <span
                                className={cn(
                                    "flex items-center justify-center w-9 h-7 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-indigo-500/10"
                                        : "bg-transparent"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive ? "text-indigo-600" : "")} />
                            </span>

                            <span className={cn(isActive ? "text-indigo-600 font-semibold" : "")}>
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
