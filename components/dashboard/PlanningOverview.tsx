"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Clock, ArrowRight, ChevronLeft, ChevronRight, Loader2, Play } from "lucide-react"
import { format, addDays, isSameDay, startOfDay } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Schedule {
    id: string
    campaign_id: string
    daily_limit: number
    time_window_start: string
    time_window_end: string
    days_of_week: number[]
    status: string
    start_date: string
    cold_email_campaigns: {
        name: string
    }
}

export function PlanningOverview() {
    const supabase = createClient()
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [loading, setLoading] = useState(true)
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        fetchSchedules()
    }, [])

    const fetchSchedules = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Join schedules with cold_email_campaigns to get name
            const { data, error } = await supabase
                .from('campaign_schedules')
                .select(`
                    *,
                    cold_email_campaigns (name)
                `)
                .eq('status', 'active')

            if (data) {
                // Filter manually for user ownership via campaigns if RLS doesn't handle deep join perfectly on this query
                // Or assume campaigns RLS handles it.
                setSchedules(data as any[])
            }
        } catch (error) {
            console.error("Error fetching schedules:", error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <Card className="border-slate-200 shadow-sm animate-pulse">
                <CardHeader className="pb-2">
                    <div className="h-5 w-40 bg-slate-200 rounded"></div>
                </CardHeader>
                <CardContent className="h-40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </CardContent>
            </Card>
        )
    }

    if (schedules.length === 0) {
        return (
            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-indigo-500" />
                        Planification
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-8 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                        <Clock className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-slate-800">Aucune campagne planifiée</p>
                    <p className="text-sm text-slate-500 mb-4 max-w-xs">
                        Automatisez vos envois quotidiens en planifiant une campagne.
                    </p>
                    <Button variant="outline" size="sm" asChild className="bg-white hover:bg-indigo-50 hover:text-indigo-600 border-slate-200">
                        <Link href="/campaigns">
                            Planifier maintenant <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    const currentSchedule = schedules[currentIndex]

    // Calendar Generation
    const today = startOfDay(new Date())
    const next7Days = Array.from({ length: 7 }).map((_, i) => addDays(today, i))

    // Helper: is active day
    const isActiveDay = (date: Date) => {
        const dayOfWeek = date.getDay() || 7
        return currentSchedule.days_of_week.includes(dayOfWeek)
    }

    return (
        <Card className="border-slate-200 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-base flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-indigo-500" />
                        Planification en cours
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-none ml-2 text-xs">
                            Actif
                        </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                        Campagne : <span className="font-semibold text-gray-900">{currentSchedule.cold_email_campaigns?.name}</span>
                    </CardDescription>
                </div>

                {schedules.length > 1 && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex(prev => prev - 1)}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-xs font-mono text-muted-foreground">{currentIndex + 1} / {schedules.length}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentIndex === schedules.length - 1}
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </CardHeader>

            <CardContent className="pb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* INFO COLUMN */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">Configuration</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-indigo-900">{currentSchedule.daily_limit}</span>
                                <span className="text-sm text-slate-500">emails / jour</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">Horaires</span>
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-slate-50 py-1 px-2 rounded w-fit">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {currentSchedule.time_window_start.slice(0, 5)} - {currentSchedule.time_window_end.slice(0, 5)}
                            </div>
                        </div>
                    </div>

                    {/* CALENDAR COLUMN */}
                    <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">Cette semaine</span>
                            <span className="text-[10px] text-slate-400">Prochains 7 jours</span>
                        </div>
                        <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-none">
                            {next7Days.map((date, i) => {
                                const active = isActiveDay(date)
                                const istoday = isSameDay(date, today)
                                return (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex flex-col items-center justify-center flex-1 min-w-[3rem] h-16 rounded-lg border text-xs transition-all",
                                            istoday ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-100 bg-white",
                                            !active && "opacity-50 bg-slate-50 border-dashed"
                                        )}
                                    >
                                        <span className={cn("text-[10px] uppercase font-bold mb-0.5", istoday ? "text-indigo-600" : "text-slate-400")}>
                                            {format(date, "EEE", { locale: fr })}
                                        </span>
                                        <span className={cn("text-base font-bold", istoday ? "text-indigo-900" : "text-slate-700")}>
                                            {format(date, "dd")}
                                        </span>
                                        {active && (
                                            <div className="mt-1 w-1 h-1 rounded-full bg-emerald-500" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <Button variant="ghost" size="sm" asChild className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                        <Link href={`/campaigns/${currentSchedule.campaign_id}`}>
                            Gérer la campagne <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
