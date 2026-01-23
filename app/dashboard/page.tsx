import { Suspense } from "react"
import { LaunchSearchForm } from "@/components/features/LaunchSearchForm"
import { DashboardStats } from "@/components/features/DashboardStats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
    return (
        <div className="space-y-6">
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
