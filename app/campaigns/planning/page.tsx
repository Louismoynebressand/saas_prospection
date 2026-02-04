import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Play, AlertCircle, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { PlanningCard } from "@/components/features/PlanningCard"

export default async function GlobalPlanningPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return <div>Veuillez vous connecter.</div>
    }

    // Fetch all active schedules with campaign details
    const { data: schedulesData, error } = await supabase
        .from('campaign_schedules')
        .select(`
            *,
            campaign:cold_email_campaigns (
                id,
                campaign_name,
                status,
                target_audience
            )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

    // Enrich with Queue Stats
    const schedules = await Promise.all(
        (schedulesData || []).map(async (schedule: any) => {
            const { count: pending } = await supabase
                .from('email_queue')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', schedule.campaign_id)
                .eq('status', 'pending')

            const { count: sent } = await supabase
                .from('email_queue')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', schedule.campaign_id)
                .eq('status', 'sent')

            return {
                ...schedule,
                stats: {
                    pending: pending || 0,
                    sent: sent || 0
                }
            }
        })
    )

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Planning Global</h1>
                    <p className="text-muted-foreground mt-2">
                        Vue d'ensemble de toutes vos campagnes de prospection actives.
                    </p>
                </div>
            </div>

            {/* Grid of Active Schedules */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {!schedules || schedules.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-slate-50">
                        <div className="bg-indigo-50 p-4 rounded-full mb-4">
                            <Calendar className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Aucune campagne planifiée</h3>
                        <p className="text-muted-foreground max-w-sm mt-2">
                            Vos planifications actives apparaîtront ici.
                        </p>
                        <Button className="mt-6" asChild>
                            <Link href="/emails">Voir mes campagnes</Link>
                        </Button>
                    </div>
                ) : (
                    schedules.map((schedule: any) => (
                        <div key={schedule.id} className="h-full">
                            <PlanningCard schedule={schedule} stats={schedule.stats} />
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
