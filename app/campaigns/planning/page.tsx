import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Play, AlertCircle, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

export default async function GlobalPlanningPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return <div>Veuillez vous connecter.</div>
    }

    // Fetch all active schedules with campaign details
    const { data: schedules, error } = await supabase
        .from('campaign_schedules')
        .select(`
            *,
            campaign:cold_email_campaigns (
                id,
                campaign_name,
                status
            )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

    // Also fetch queue stats for each campaign (optional, but good for overview)
    // For MVP, we might skip detailed stats per card or do a separate fetch if complex.
    // Let's just list them for now.

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <Link key={schedule.id} href={`/campaigns/${schedule.campaign_id}?tab=planning`} className="block group">
                            <Card className="h-full hover:shadow-md transition-all border-slate-200 hover:border-indigo-200 hover:bg-slate-50">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                                {schedule.campaign.campaign_name}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs font-normal bg-white">
                                                    {schedule.daily_limit} mails/jour
                                                </Badge>
                                            </CardDescription>
                                        </div>
                                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-full">
                                            <Play className="w-4 h-4 fill-current" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span>
                                                {schedule.time_window_start.slice(0, 5)} - {schedule.time_window_end.slice(0, 5)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span>
                                                Débuté le {format(new Date(schedule.start_date), "d MMM yyyy", { locale: fr })}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))
                )}
            </div>

            {/* Future: Add Calendar Grid View Here */}
        </div>
    )
}
