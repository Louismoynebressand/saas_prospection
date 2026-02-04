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
                        <Card key={schedule.id} className="flex flex-col h-full hover:shadow-lg transition-all border-slate-200 hover:border-indigo-200 group relative overflow-hidden">
                            {/* Clickable Overlay */}
                            <Link href={`/campaigns/${schedule.campaign_id}?tab=planning`} className="absolute inset-0 z-0" />

                            <CardHeader className="pb-3 z-10 relative">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] uppercase tracking-wider font-semibold">
                                        Mail Prospection
                                    </Badge>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded-full">
                                        <Clock className="w-3 h-3" />
                                        <span>{schedule.time_window_start.slice(0, 5)} - {schedule.time_window_end.slice(0, 5)}</span>
                                    </div>
                                </div>

                                <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-1">
                                    {schedule.campaign.campaign_name}
                                </CardTitle>
                                <CardDescription className="line-clamp-1">
                                    {schedule.campaign.target_audience || "Audience non définie"}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="flex-1 z-10 relative pointer-events-none">
                                {/* Inner content needs pointer-events-none to let parent click through, usually. 
                                    But buttons need pointer-events-auto. 
                                    Actually, standard HTML rule: nested interactive elements are tricky.
                                    Better approach: Make the card title logic clickable or just the "En savoir plus" button 
                                    AND the card overall, but buttons need higher z-index.
                                */}

                                <div className="grid grid-cols-2 gap-4 mt-2 mb-6">
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Vitesse</div>
                                        <div className="text-lg font-bold text-slate-900">{schedule.daily_limit} <span className="text-xs font-normal text-slate-500">/j</span></div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="text-xs text-muted-foreground uppercase font-medium mb-1">En attente</div>
                                        <div className="text-lg font-bold text-slate-900">{schedule.stats.pending}</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 col-span-2">
                                        <div className="flex justify-between items-center">
                                            <div className="text-xs text-muted-foreground uppercase font-medium">Total Envoyés</div>
                                            <div className="text-lg font-bold text-emerald-600">{schedule.stats.sent}</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>

                            <div className="p-6 pt-0 mt-auto z-10 relative">
                                <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-2 pointer-events-auto" asChild>
                                    <Link href={`/campaigns/${schedule.campaign_id}?tab=planning`}>
                                        En savoir plus <Play className="w-3 h-3 ml-1" />
                                    </Link>
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
