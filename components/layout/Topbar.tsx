"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { LogOut, User } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function Topbar() {
    const pathname = usePathname()
    // const router = useRouter() // Might not be needed if we use window.location
    const [userProfile, setUserProfile] = useState<{
        first_name: string | null
        last_name: string | null
        company_name: string | null
    } | null>(null)

    useEffect(() => {
        const fetchProfile = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, company_name')
                    .eq('id', user.id)
                    .single()

                if (profile) setUserProfile(profile)
            }
        }
        fetchProfile()
    }, [])

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

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
        <header className="flex h-16 items-center border-b bg-card/50 px-6 backdrop-blur-sm sticky top-0 z-10 justify-between">
            <h1 className="text-lg font-semibold">{getTitle()}</h1>

            <div className="flex items-center gap-4">
                {userProfile && (
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium leading-none">
                                {userProfile.first_name} {userProfile.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {userProfile.company_name}
                            </p>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 p-0">
                                    <span className="text-sm font-semibold text-primary">
                                        {userProfile.first_name?.[0]}{userProfile.last_name?.[0]}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Se déconnecter
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>
        </header>
    )
}
