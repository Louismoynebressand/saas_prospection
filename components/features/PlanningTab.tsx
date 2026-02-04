"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Clock, Mail, AlertTriangle, XCircle, Loader2, Save, Edit, Send, Plus } from "lucide-react"
import { format, addDays, isSameDay, startOfDay, isBefore } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface PlanningTabProps {
    schedule: any
    queueStats: {
        pending: number
        sent: number
        failed: number
        total: number
    }
    onUpdate?: () => void
    onAddProspects?: () => void
}

export function PlanningTab({ schedule, queueStats, onUpdate, onAddProspects }: PlanningTabProps) {
    const supabase = createClient()
    const [smtpName, setSmtpName] = useState<string>("Chargement...")
    const [canceling, setCanceling] = useState(false)

    // Edit State
    const [editOpen, setEditOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editDailyLimit, setEditDailyLimit] = useState([20])
    const [editTimeWindow, setEditTimeWindow] = useState({ start: "08:00", end: "18:00" })
    const [editDays, setEditDays] = useState<number[]>([])
    const [editSmtpId, setEditSmtpId] = useState<string>("")
    const [smtpConfigs, setSmtpConfigs] = useState<any[]>([])

    useEffect(() => {
        if (schedule) {
            setEditDailyLimit([schedule.daily_limit])
            setEditTimeWindow({ start: schedule.time_window_start, end: schedule.time_window_end })
            setEditDays(schedule.days_of_week || [])
            setEditSmtpId(schedule.smtp_configuration_id || "")
        }

        if (schedule?.smtp_configuration_id) {
            const fetchSmtp = async () => {
                const { data } = await supabase
                    .from('smtp_configurations')
                    .select('id, from_email, provider, is_active')
                    .eq('is_active', true)

                if (data) {
                    setSmtpConfigs(data)
                    const found = data.find((c: any) => c.id === schedule.smtp_configuration_id)
                    if (found) {
                        setSmtpName(`${found.from_email} (${found.provider})`)
                    } else {
                        setSmtpName("Inconnu / Inactif")
                    }
                }
            }
            fetchSmtp()
        } else if (schedule) {
            setSmtpName("Par défaut (1er disponible)")
            const fetchAll = async () => {
                const { data } = await supabase.from('smtp_configurations').select('*').eq('is_active', true)
                if (data) setSmtpConfigs(data)
            }
            fetchAll()
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

    const handleUpdate = async () => {
        setEditing(true)
        try {
            const res = await fetch(`/api/campaigns/${schedule.campaign_id}/schedule`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    daily_limit: editDailyLimit[0],
                    time_window_start: editTimeWindow.start,
                    time_window_end: editTimeWindow.end,
                    days_of_week: editDays,
                    smtp_configuration_id: editSmtpId
                })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Planification mise à jour")
                setEditOpen(false)
                if (onUpdate) onUpdate()
            } else {
                throw new Error(data.error || "Erreur lors de la mise à jour")
            }
        } catch (error: any) {
            toast.error("Erreur", { description: error.message })
        } finally {
            setEditing(false)
        }
    }

    const toggleEditDay = (day: number) => {
        setEditDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort()
        )
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

    // FORECAST CALCULATION
    const remainingEmails = queueStats.pending
    const dailyLimit = schedule.daily_limit || 1
    const activeDays = schedule.days_of_week || [1, 2, 3, 4, 5]

    // Low Stock Logic
    const daysStock = remainingEmails / (dailyLimit || 1)
    const isCriticalStock = daysStock < 5
    const isWarningStock = daysStock >= 5 && daysStock < 10

    // Logic: Start Timeline from TODAY to see context.
    const scheduleStart = startOfDay(new Date(schedule.start_date))
    const today = startOfDay(new Date())

    let simulationDate = today
    let simulatedRemaining = remainingEmails

    const timelineData = []
    let daysToFinish = 0

    for (let i = 0; i < 365; i++) {
        // Stop if done (and we have shown at least 15 days for visual context)
        if (simulatedRemaining <= 0 && i > 15) break

        const dayOfWeek = simulationDate.getDay() || 7 // 1-7
        const isBeforeStart = isBefore(simulationDate, scheduleStart)
        const isOffDay = !activeDays.includes(dayOfWeek)
        const isActive = !isBeforeStart && !isOffDay

        let sentCount = 0
        if (isActive && simulatedRemaining > 0) {
            sentCount = Math.min(simulatedRemaining, dailyLimit)
            simulatedRemaining -= sentCount
        }

        if (i < 30) {
            timelineData.push({
                date: new Date(simulationDate),
                sent: sentCount,
                isActive,
                isBeforeStart,
                isOffDay,
                isToday: isSameDay(simulationDate, today),
            })
        }

        if (sentCount > 0 || simulatedRemaining > 0) {
            if (simulatedRemaining > 0) daysToFinish = i
        }

        simulationDate = addDays(simulationDate, 1)
    }

    const endDate = addDays(today, daysToFinish + 1)

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
        <div className="space-y-6">

            {/* LOW STOCK ALERT */}
            {(isCriticalStock || isWarningStock) && remainingEmails > 0 && (
                <div className={cn(
                    "border-l-4 p-4 rounded-md flex items-start gap-3",
                    isCriticalStock ? "bg-red-50 border-red-500" : "bg-amber-50 border-amber-500"
                )}>
                    {isCriticalStock ? (
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    )}
                    <div>
                        <h4 className={cn("font-semibold text-sm", isCriticalStock ? "text-red-900" : "text-amber-900")}>
                            {isCriticalStock ? "Stock Critique : Interruption Imminente" : "Attention : Stock Faible"}
                        </h4>
                        <p className={cn("text-sm mt-1", isCriticalStock ? "text-red-700" : "text-amber-700")}>
                            Il ne vous reste que <strong>{Math.floor(daysStock)} jours d'avance</strong> ({remainingEmails} emails) au rythme actuel.
                            Ajoutez des prospects rapidement pour maintenir votre campagne.
                        </p>
                        {onAddProspects && (
                            <Button
                                variant={isCriticalStock ? "destructive" : "outline"}
                                size="sm"
                                onClick={onAddProspects}
                                className="mt-3 bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter des prospects maintenant
                            </Button>
                        )}
                    </div>
                </div>
            )}

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

                {/* CONFIGURATION CARD */}
                <Card className="bg-white border-slate-200 col-span-1 md:col-span-1">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-600 uppercase">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-lg">{schedule.daily_limit} / jour</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                <Clock className="w-3 h-3" /> {schedule.time_window_start?.slice(0, 5)} - {schedule.time_window_end?.slice(0, 5)}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2" title={smtpName}>
                                <Mail className="w-3 h-3" /> <span className="truncate max-w-[150px]">{smtpName}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            {/* BIGGER EDIT BUTTON */}
                            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start border-slate-300 font-medium">
                                        <Edit className="w-4 h-4 mr-2" />
                                        Modifier la planification
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Modifier la planification</DialogTitle>
                                        <DialogDescription>Ajustez les paramètres en cours de route.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label>Vitesse d'envoi</Label>
                                                <span className="text-sm font-bold">{editDailyLimit[0]} mails/jour</span>
                                            </div>
                                            <Slider value={editDailyLimit} onValueChange={setEditDailyLimit} max={100} min={1} step={1} />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Compte d'envoi</Label>
                                            <Select value={editSmtpId} onValueChange={setEditSmtpId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Choisir un compte" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {smtpConfigs.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.from_email} ({c.provider})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Début</Label>
                                                <Input type="time" value={editTimeWindow.start} onChange={e => setEditTimeWindow({ ...editTimeWindow, start: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Fin</Label>
                                                <Input type="time" value={editTimeWindow.end} onChange={e => setEditTimeWindow({ ...editTimeWindow, end: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Jours actifs</Label>
                                            <div className="flex justify-between gap-1">
                                                {weekDays.map((d) => (
                                                    <button
                                                        key={d.val}
                                                        onClick={() => toggleEditDay(d.val)}
                                                        className={cn(
                                                            "w-8 h-8 rounded-full text-xs font-bold transition-all",
                                                            editDays.includes(d.val)
                                                                ? "bg-indigo-600 text-white shadow-sm"
                                                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                        )}
                                                    >
                                                        {d.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                                        <Button onClick={handleUpdate} disabled={editing} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                                            {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Enregistrer
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* ADD PROSPECTS BUTTON */}
                            {onAddProspects && (
                                <Button onClick={onAddProspects} className="w-full justify-start bg-indigo-600 hover:bg-indigo-700 font-medium">
                                    <Send className="w-4 h-4 mr-2" />
                                    Ajouter des prospects
                                </Button>
                            )}
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
                            Fin estimée le <span className="font-bold text-gray-900">{format(endDate, "d MMMM yyyy", { locale: fr })}</span>
                        </CardDescription>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={canceling} className="opacity-90 hover:opacity-100">
                                {canceling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                Arrêter
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
                    <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-2 mb-6">
                        {timelineData.map((day, i) => {
                            let statusText = ""
                            let statusClass = ""

                            if (day.isBeforeStart) {
                                statusText = "Attente"
                                statusClass = "bg-gray-50 border-gray-100 text-gray-400"
                            } else if (day.isOffDay) {
                                statusText = "Pause"
                                statusClass = "bg-slate-50 border-slate-100 text-gray-400 opacity-60"
                            } else {
                                statusClass = "bg-white border-slate-200"
                            }

                            if (day.isToday) {
                                statusClass += " border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                            }

                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-2 rounded border text-xs h-16 transition-colors",
                                        statusClass
                                    )}
                                >
                                    <span className={cn("font-semibold mb-1", day.isToday ? "text-indigo-700" : "text-gray-500")}>
                                        {format(day.date, "d MMM", { locale: fr })}
                                    </span>
                                    {day.isActive ? (
                                        <Badge variant="secondary" className="px-1.5 h-5 text-[10px] bg-emerald-100 text-emerald-800">
                                            {day.sent}
                                        </Badge>
                                    ) : (
                                        <span className="text-[10px] uppercase font-medium">
                                            {statusText}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                        Affichage des 30 prochains jours.
                    </p>

                </CardContent>
            </Card>
        </div>
    )
}
