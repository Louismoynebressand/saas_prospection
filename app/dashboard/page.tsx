"use client"

import { createClient } from "@/lib/supabase/client"
import { LaunchSearchForm } from "@/components/features/LaunchSearchForm"
import { DashboardStats } from "@/components/features/DashboardStats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function DashboardPage() {
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
        <div className="space-y-6">
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
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">Bienvenue sur votre espace de prospection.</p>
            </div>

            <DashboardStats />

            <div className="grid gap-4 md:grid-cols-7">
                <div className="col-span-4">
                    <LaunchSearchForm />
                </div>
                <div className="col-span-3">
                    {/* Recent Activity or Quick Tips placeholder */}
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Activité Récente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground text-center py-8">
                                Aucune activité récente.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
