"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, Calendar as CalendarIcon, Send, CheckCircle2, AlertTriangle, MoreHorizontal, Mail, XCircle, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PlanningTabProps {
    schedule: any
    queueStats: {
        pending: number
        sent: number
        failed: number
        total: number
    }
    onUpdate?: () => void // Callback to refresh parent
}

export function PlanningTab({ schedule, queueStats, onUpdate }: PlanningTabProps) {
    const supabase = createClient()
    const [smtpName, setSmtpName] = useState<string>("Chargement...")
    const [canceling, setCanceling] = useState(false)

    useEffect(() => {
        if (schedule?.smtp_configuration_id) {
            const fetchSmtp = async () => {
                const { data } = await supabase
                    .from('smtp_configurations')
                    .select('from_email, provider')
                    .eq('id', schedule.smtp_configuration_id)
                    .single()
                if (data) {
                    setSmtpName(`${data.from_email} (${data.provider})`)
                } else {
                    setSmtpName("Inconnu")
                }
            }
            fetchSmtp()
        } else if (schedule) {
            setSmtpName("Par défaut (1er disponible)")
        }
    }, [schedule, supabase])

    const handleCancel = async () => {
        setCanceling(true)
        try {
            const res = await fetch(`/api/campaigns/${schedule.campaign_id}/schedule`, {
                method: 'DELETE'
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Planification annulée", { description: "La file d'attente a été vidée." })
                if (onUpdate) onUpdate()
            } else {
                throw new Error(data.error || "Erreur lors de l'annulation")
            }
        } catch (error: any) {
            console.error("Cancellation Error:", error)
            toast.error("Erreur", { description: error.message })
        } finally {
            setCanceling(false)
        }
    }

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

    const estimatedDays = schedule.daily_limit > 0 ? Math.ceil(queueStats.pending / schedule.daily_limit) : 0
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + estimatedDays) // Rough estimation

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
                    <CardContent className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-lg">{schedule.daily_limit} / jour</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <Clock className="w-3 h-3" /> {schedule.time_window_start?.slice(0, 5)} - {schedule.time_window_end?.slice(0, 5)}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2" title={smtpName}>
                            <Mail className="w-3 h-3" /> <span className="truncate max-w-[150px]">{smtpName}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Timeline / Forecast */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-indigo-600" />
                            Prévisions d'envoi
                        </CardTitle>
                        <CardDescription>
                            Basé sur votre limite de {schedule.daily_limit} mails/jour.
                        </CardDescription>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={canceling}>
                                {canceling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                Arrêter la campagne
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Arrêter la planification ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cela supprimera la planification actuelle et retirera tous les prospects de la file d'attente.
                                    Les emails déjà envoyés ne seront pas affectés.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
                                    Confirmer l'arrêt
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

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
