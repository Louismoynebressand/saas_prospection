"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { LogOut, Menu } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/providers/SidebarContext"

export function Topbar() {
    const pathname = usePathname()
    const { toggle } = useSidebar()
    const [userProfile, setUserProfile] = useState<{
        first_name: string
        last_name: string
        company_name: string
    } | null>(null)

    useEffect(() => {
        const supabase = createClient()

        const fetchProfile = async (user: any) => {
            if (!user) {
                setUserProfile(null)
                return
            }
            const profile = {
                first_name: user.user_metadata?.first_name || user.user_metadata?.firstName || '',
                last_name: user.user_metadata?.last_name || user.user_metadata?.lastName || '',
                company_name: user.user_metadata?.company_name || user.user_metadata?.companyName || ''
            }
            setUserProfile(profile)
        }

        supabase.auth.getUser().then((response: any) => {
            const user = response.data?.user
            if (user) fetchProfile(user)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: string, session: any) => {
                const user = session?.user
                fetchProfile(user)
            }
        )

        return () => { subscription.unsubscribe() }
    }, [])

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    const getTitle = () => {
        if (pathname === "/dashboard") return "Tableau de bord"
        if (pathname === "/recherche-prospect") return "Recherche Prospect"
        if (pathname === "/searches") return "Historique"
        if (pathname.startsWith("/searches/")) return "Détail recherche"
        if (pathname === "/prospects") return "Prospects"
        if (pathname.startsWith("/prospects/")) return "Fiche prospect"
        if (pathname === "/emails") return "Prospection Mail"
        if (pathname === "/email-verifier") return "Vérif. Emails"
        if (pathname === "/settings") return "Configuration"
        if (pathname === "/billing") return "Forfait"
        if (pathname.startsWith("/campaigns")) return "Campagnes"
        return "SUPER Prospect"
    }

    return (
        <header className="flex h-14 md:h-16 items-center border-b bg-card/50 px-3 md:px-6 backdrop-blur-sm sticky top-0 z-10 justify-between gap-2">
            {/* Left: Hamburger (mobile/tablet portrait) + Title */}
            <div className="flex items-center gap-2 min-w-0">
                {/* Hamburger — visible sur mobile et tablette portrait uniquement */}
                <button
                    id="sidebar-toggle-btn"
                    onClick={toggle}
                    className="lg:hidden flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    aria-label="Ouvrir le menu"
                >
                    <Menu className="h-5 w-5" />
                </button>

                <h1 className="text-base md:text-lg font-semibold truncate">{getTitle()}</h1>
            </div>

            {/* Right: User menu */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                {userProfile && userProfile.first_name && userProfile.last_name ? (
                    <div className="flex items-center gap-2 md:gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-2 md:gap-3 hover:bg-muted/50 px-2 md:px-3 py-2 h-auto">
                                    {/* Name — hidden on small mobile, visible on md+ */}
                                    <div className="text-left hidden sm:block">
                                        <p className="text-sm font-medium leading-none">
                                            {userProfile.first_name} {userProfile.last_name}
                                        </p>
                                        {userProfile.company_name && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {userProfile.company_name}
                                            </p>
                                        )}
                                    </div>
                                    {/* Avatar */}
                                    <div className="relative h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center shrink-0">
                                        <span className="text-xs md:text-sm font-semibold text-primary">
                                            {userProfile.first_name[0]}{userProfile.last_name[0]}
                                        </span>
                                    </div>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {/* Show name in dropdown on mobile */}
                                <div className="px-2 py-1.5 sm:hidden border-b mb-1">
                                    <p className="text-sm font-medium">{userProfile.first_name} {userProfile.last_name}</p>
                                    {userProfile.company_name && (
                                        <p className="text-xs text-muted-foreground">{userProfile.company_name}</p>
                                    )}
                                </div>
                                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Se déconnecter
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ) : (
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                )}
            </div>
        </header>
    )
}
