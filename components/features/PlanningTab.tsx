"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, Calendar as CalendarIcon, Send, CheckCircle2, AlertTriangle, MoreHorizontal } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface PlanningTabProps {
    schedule: any // Type this properly if shared types available
    queueStats: {
        pending: number
        sent: number
        failed: number
        total: number
    }
}

export function PlanningTab({ schedule, queueStats }: PlanningTabProps) {
    if (!schedule) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-slate-50">
                <div className="bg-indigo-50 p-4 rounded-full mb-4">
                    <Clock className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Aucune planification active</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                    Lancez une planification pour automatiser l'envoi de vos emails quotidiens.
                </p>
            </div>
        )
    }

    const estimatedDays = Math.ceil(queueStats.pending / (schedule.daily_limit || 1))
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + estimatedDays) // Rough estimation, doesn't account for weekends yet

    return (
        <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-indigo-50 border-indigo-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-600 uppercase">File d'attente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-indigo-900">{queueStats.pending}</div>
                        <p className="text-xs text-indigo-600 mt-1">Emails prêts à partir</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50 border-emerald-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-600 uppercase">Envoyés (Total)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-900">{queueStats.sent}</div>
                        <p className="text-xs text-emerald-600 mt-1">Depuis le début</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 uppercase">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900">{schedule.daily_limit} / jour</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <Clock className="w-3 h-3" /> {schedule.time_window_start?.slice(0, 5)} - {schedule.time_window_end?.slice(0, 5)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Timeline / Forecast */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-indigo-600" />
                        Prévisions d'envoi
                    </CardTitle>
                    <CardDescription>
                        Basé sur votre limite de {schedule.daily_limit} mails/jour.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 border rounded-lg bg-slate-50">
                            <div className="p-3 bg-white border rounded-full shadow-sm">
                                <Send className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">En cours d'exécution</h4>
                                <p className="text-sm text-muted-foreground">
                                    Prochain envoi lors du créneau {schedule.time_window_start?.slice(0, 5)} - {schedule.time_window_end?.slice(0, 5)}.
                                </p>
                            </div>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                Actif
                            </Badge>
                        </div>

                        <div className="relative pl-8 border-l-2 border-indigo-100 space-y-8 ml-4">
                            {/* Today Point */}
                            <div className="relative">
                                <div className="absolute -left-[39px] top-1 w-5 h-5 rounded-full bg-indigo-600 border-4 border-white shadow-sm" />
                                <h5 className="font-bold text-gray-900">Aujourd'hui</h5>
                                <p className="text-sm text-muted-foreground">Traitement de la file d'attente...</p>
                            </div>

                            {/* End Point */}
                            <div className="relative">
                                <div className="absolute -left-[39px] top-1 w-5 h-5 rounded-full bg-slate-300 border-4 border-white" />
                                <h5 className="font-bold text-gray-900">Fin estimée : {format(endDate, "d MMMM yyyy", { locale: fr })}</h5>
                                <p className="text-sm text-muted-foreground">Si aucun prospect n'est ajouté.</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
