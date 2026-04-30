"use client"

import { createClient } from "@/lib/supabase/client"
import { LaunchSearchForm } from "@/components/features/LaunchSearchForm"
import { DashboardStats } from "@/components/features/DashboardStats"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function RechercheProspectPage() {
    const [showNoPlanDialog, setShowNoPlanDialog] = useState(false)

    useEffect(() => {
        const checkSubscription = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) return

            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('status')
                .eq('user_id', user.id)
                .single()

            if (!subscription || subscription.status !== 'active') {
                setShowNoPlanDialog(true)
            }
        }
        checkSubscription()
    }, [])

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative max-w-[1400px] mx-auto">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-5%] left-[10%] w-[35%] h-[35%] bg-amber-500/10 rounded-full blur-3xl opacity-50 animate-pulse" />
                <div className="absolute top-[30%] right-[-5%] w-[40%] h-[40%] bg-rose-500/10 rounded-full blur-3xl opacity-40 delay-500 animate-pulse" />
            </div>

            <Dialog open={showNoPlanDialog} onOpenChange={() => { }}>
                <DialogContent className="sm:max-w-md" onInteractOutside={(e: any) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Aucun forfait actif</DialogTitle>
                        <DialogDescription>
                            Vous n'avez pas de forfait actif. Pour utiliser l'application, veuillez choisir un plan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center">
                        <Button asChild className="w-full sm:w-auto">
                            <Link href="/onboarding">
                                Choisir un forfait
                            </Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight truncate bg-gradient-to-r from-amber-600 to-rose-600 dark:from-amber-200 dark:to-rose-300 bg-clip-text text-transparent pb-1">
                    Recherche Prospect
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm md:text-base">
                    Lancez une nouvelle recherche de prospects sur Google Maps.
                </p>
            </div>

            <DashboardStats />

            <div className="grid gap-4 md:grid-cols-7">
                <div className="col-span-4">
                    <LaunchSearchForm />
                </div>
                <div className="col-span-3">
                    <div className="col-span-3">
                        <ActivityFeed />
                    </div>
                </div>
            </div>
        </div>
    )
}
