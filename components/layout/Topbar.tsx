"use client"

import { usePathname } from "next/navigation"

export function Topbar() {
    const pathname = usePathname()

    const getTitle = () => {
        if (pathname === "/dashboard") return "Tableau de bord"
        if (pathname === "/recherche-prospect") return "Recherche Prospect"
        if (pathname === "/searches") return "Historique des recherches"
        if (pathname.startsWith("/searches/")) return "Détail recherche"
        if (pathname === "/prospects") return "Liste des prospects"
        if (pathname.startsWith("/prospects/")) return "Fiche prospect"
        if (pathname === "/emails") return "Prospection Mail"
        if (pathname === "/email-verifier") return "Vérification Emails"
        if (pathname === "/settings") return "Configuration"
        if (pathname === "/billing") return "Forfait et Facturation"
        return "SUPER Prospect"
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
