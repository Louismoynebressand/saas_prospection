"use client"

import { usePathname } from "next/navigation"

export function Topbar() {
    const pathname = usePathname()

    const getTitle = () => {
        if (pathname === "/dashboard") return "Dashboard"
        if (pathname === "/searches") return "Historique des recherches"
        if (pathname.startsWith("/searches/")) return "Détail recherche"
        if (pathname.startsWith("/prospects/")) return "Fiche prospect"
        return "Application"
    }

    return (
        <header className="flex h-16 items-center border-b bg-card/50 px-6 backdrop-blur-sm sticky top-0 z-10">
            <h1 className="text-lg font-semibold">{getTitle()}</h1>
            <div className="ml-auto flex items-center gap-4">
                {/* Add notifications or other actions here later */}
            </div>
        </header>
    )
}
