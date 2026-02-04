import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Play, AlertCircle, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

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
                    schedules.map((schedule: any) => {
                        const activeDays = schedule.days_of_week || []
                        const weekDays = [
                            { val: 1, label: 'L' },
                            { val: 2, label: 'M' },
                            { val: 3, label: 'M' },
                            { val: 4, label: 'J' },
                            { val: 5, label: 'V' },
                            { val: 6, label: 'S' },
                            { val: 7, label: 'D' },
                        ]

                        return (
                            <Card key={schedule.id} className="flex flex-col h-full transition-all duration-300 border-slate-200/60 bg-white/80 backdrop-blur-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200/60 group relative overflow-hidden rounded-2xl">
                                {/* Decorational Gradients/Reflections */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none" />

                                {/* Clickable Overlay */}
                                <Link href={`/campaigns/${schedule.campaign_id}?tab=planning`} className="absolute inset-0 z-0" />

                                <CardHeader className="pb-3 z-10 relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <Badge variant="outline" className="bg-white/50 backdrop-blur border-indigo-100 text-indigo-600 text-[10px] uppercase tracking-wider font-bold shadow-sm">
                                            Mail Prospection
                                        </Badge>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100/50 px-2.5 py-1 rounded-full border border-slate-100">
                                            <Clock className="w-3.5 h-3.5 text-indigo-500/70" />
                                            <span>{schedule.time_window_start.slice(0, 5)} - {schedule.time_window_end.slice(0, 5)}</span>
                                        </div>
                                    </div>

                                    <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors duration-300 line-clamp-1">
                                        {schedule.campaign.campaign_name}
                                    </CardTitle>
                                    <CardDescription className="line-clamp-1 text-slate-500">
                                        {schedule.campaign.target_audience || "Audience non définie"}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="flex-1 z-10 relative pointer-events-none">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/60 hover:border-indigo-100/50 transition-colors">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Vitesse</div>
                                            <div className="text-lg font-bold text-slate-900 flex items-baseline gap-1">
                                                {schedule.daily_limit}
                                                <span className="text-xs font-medium text-slate-400">/ jour</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/60 hover:border-indigo-100/50 transition-colors">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">En attente</div>
                                            <div className="text-lg font-bold text-slate-900">{schedule.stats.pending}</div>
                                        </div>
                                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/60 col-span-2 flex justify-between items-center hover:border-emerald-100/50 transition-colors">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Envoyés</div>
                                            <div className="text-lg font-bold text-emerald-600">{schedule.stats.sent}</div>
                                        </div>
                                    </div>

                                    {/* Days Visualization */}
                                    <div className="mb-2">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Jours d'envoi</div>
                                        <div className="flex justify-between items-center gap-1">
                                            {weekDays.map((d) => {
                                                const isActive = activeDays.includes(d.val)
                                                return (
                                                    <div
                                                        key={d.val}
                                                        className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300",
                                                            isActive
                                                                ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 scale-105 opacity-100"
                                                                : "bg-slate-100 text-slate-300 scale-95 border border-slate-100"
                                                        )}
                                                    >
                                                        {d.label}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </CardContent>

                                <div className="p-5 pt-0 mt-auto z-10 relative">
                                    <Button
                                        className="w-full bg-slate-900/95 hover:bg-slate-800 text-white gap-2 pointer-events-auto rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all duration-300"
                                        asChild
                                    >
                                        <Link href={`/campaigns/${schedule.campaign_id}?tab=planning`}>
                                            En savoir plus
                                            <Play className="w-3 h-3 ml-1 fill-current opacity-70" />
                                        </Link>
                                    </Button>
                                </div>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}
