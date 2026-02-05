import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format, getYear } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarIcon, Clock, Mail, Play, AlertCircle, Loader2, ArrowRight, CheckCircle2, Sparkles, X, Plus } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { getHolidaysForRange } from "@/lib/date-utils"

interface CampaignSchedulerModalProps {
    campaignId: string
    onScheduled?: () => void
    hasSchedule?: boolean
}

export function CampaignSchedulerModal({ campaignId, onScheduled, hasSchedule = false }: CampaignSchedulerModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const supabase = createClient()


    // Form State
    const [startDate, setStartDate] = useState<Date | undefined>(new Date())
    const [dailyLimit, setDailyLimit] = useState([20])
    const [timeWindow, setTimeWindow] = useState({ start: "08:00", end: "18:00" })
    const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon-Fri default
    const [selectedSmtpId, setSelectedSmtpId] = useState<string>("")

    // Holiday State
    const [excludeHolidays, setExcludeHolidays] = useState(false)
    const [blockedDates, setBlockedDates] = useState<string[]>([])
    const [customBlockDate, setCustomBlockDate] = useState<Date | undefined>(undefined)

    // SMTP Check State
    const [checkingSmtp, setCheckingSmtp] = useState(true)
    const [smtpConfigs, setSmtpConfigs] = useState<any[]>([])

    useEffect(() => {
        if (open) {
            checkSmtpConfig()
        }
    }, [open])

    // Load default holidays when toggle is ON
    useEffect(() => {
        if (excludeHolidays && blockedDates.length === 0) {
            const currentYear = getYear(new Date())
            const nextYear = currentYear + 1
            const holidays = getHolidaysForRange(currentYear, nextYear)
            setBlockedDates(holidays.map(h => h.dateString))
        }
    }, [excludeHolidays])

    const checkSmtpConfig = async () => {
        setCheckingSmtp(true)
        try {
            const { data, error } = await supabase
                .from('smtp_configurations')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (!error && data && data.length > 0) {
                setSmtpConfigs(data)
                // Default to the first one if not already selected
                if (!selectedSmtpId) {
                    setSelectedSmtpId(data[0].id)
                }
            } else {
                setSmtpConfigs([])
            }
        } catch (err) {
            console.error("Failed to check SMTP config", err)
            setSmtpConfigs([])
        } finally {
            setCheckingSmtp(false)
        }
    }

    const handleSchedule = async () => {
        if (!startDate) {
            toast.error("Veuillez choisir une date de début")
            return
        }

        if (smtpConfigs.length === 0) {
            toast.error("Veuillez d'abord configurer un compte d'envoi (SMTP)")
            return
        }

        if (!selectedSmtpId) {
            toast.error("Veuillez sélectionner un compte d'envoi")
            return
        }

        setLoading(true)
        try {
            // Call API to create schedule and generate queue
            const res = await fetch(`/api/campaigns/${campaignId}/schedule`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    start_date: startDate.toISOString(),
                    daily_limit: dailyLimit[0],
                    time_window_start: timeWindow.start,
                    time_window_end: timeWindow.end,
                    days_of_week: days,
                    smtp_configuration_id: selectedSmtpId,
                    exclude_holidays: excludeHolidays,
                    blocked_dates: blockedDates
                })
            })

            const data = await res.json()

            if (res.ok) {
                toast.success("Campagne planifiée avec succès !", {
                    description: `${data.queued_count} emails mis en file d'attente.`
                })
                setOpen(false)
                if (onScheduled) onScheduled()
            } else {
                throw new Error(data.error || "Erreur lors de la planification")
            }
        } catch (error: any) {
            console.error("Scheduling Error:", error)
            toast.error("Erreur technique", { description: error.message })
        } finally {
            setLoading(false)
        }
    }

    const toggleDay = (day: number) => {
        setDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort()
        )
    }

    const addCustomDate = () => {
        if (!customBlockDate) return
        const dateStr = format(customBlockDate, "yyyy-MM-dd")
        if (!blockedDates.includes(dateStr)) {
            setBlockedDates(prev => [...prev, dateStr].sort())
            toast.success("Date ajoutée aux exclusions")
        }
        setCustomBlockDate(undefined)
    }

    const removeBlockedDate = (dateStr: string) => {
        setBlockedDates(prev => prev.filter(d => d !== dateStr))
    }

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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    className={cn(
                        "transition-all duration-300 shadow-sm gap-2 text-white font-medium border-0",
                        hasSchedule
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed hover:bg-slate-100 shadow-none"
                            : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_20px_rgba(99,102,241,0.6)]"
                    )}
                    disabled={hasSchedule}
                >
                    {hasSchedule ? (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Planifié
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            Planifier l'envoi des mails
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Clock className="w-5 h-5 text-emerald-600" />
                        Planifier l'envoi
                    </DialogTitle>
                    <DialogDescription>
                        Configurez la vitesse et les horaires d'envoi automatique.
                    </DialogDescription>
                </DialogHeader>

                {checkingSmtp ? (
                    <div className="py-8 flex justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    </div>
                ) : smtpConfigs.length === 0 ? (
                    <div className="py-6 flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-gray-900">Aucun compte d'envoi configuré</h3>
                            <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                Vous devez connecter une adresse email (SMTP) pour envoyer vos campagnes.
                            </p>
                        </div>
                        <Button asChild variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                            <Link href="/emails">
                                Configurer SMTP <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6 py-4">

                        {/* 0. SMTP Selection */}
                        <div className="space-y-3">
                            <Label className="font-semibold text-gray-700">Compte d'envoi</Label>
                            <Select value={selectedSmtpId} onValueChange={setSelectedSmtpId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choisir un email d'envoi" />
                                </SelectTrigger>
                                <SelectContent>
                                    {smtpConfigs.map(config => (
                                        <SelectItem key={config.id} value={config.id}>
                                            {config.from_email} ({config.provider})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 1. Start Date */}
                        <div className="space-y-3">
                            <Label className="font-semibold text-gray-700">Date de début</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        initialFocus
                                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* 2. Daily Limit */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="font-semibold text-gray-700">Vitesse d'envoi</Label>
                                <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                    {dailyLimit[0]} mails / jour
                                </span>
                            </div>
                            <Slider
                                value={dailyLimit}
                                onValueChange={setDailyLimit}
                                max={100}
                                min={1}
                                step={1}
                                className="py-1"
                            />
                            <p className="text-xs text-muted-foreground">
                                Estimation : Pour 100 prospects, cela prendra environ <span className="font-bold text-gray-900">{Math.ceil(100 / dailyLimit[0])} jours</span>.
                            </p>
                        </div>

                        {/* 3. Time Window & Days */}
                        <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 rounded-lg border">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Plage Horaire</Label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            type="time"
                                            className="pl-8 bg-white"
                                            value={timeWindow.start}
                                            onChange={e => setTimeWindow({ ...timeWindow, start: e.target.value })}
                                        />
                                    </div>
                                    <span className="text-gray-400">-</span>
                                    <div className="relative flex-1">
                                        <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            type="time"
                                            className="pl-8 bg-white"
                                            value={timeWindow.end}
                                            onChange={e => setTimeWindow({ ...timeWindow, end: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Jours actifs</Label>
                                <div className="flex justify-between gap-1">
                                    {weekDays.map((d) => (
                                        <button
                                            key={d.val}
                                            onClick={() => toggleDay(d.val)}
                                            className={cn(
                                                "w-8 h-8 rounded-full text-xs font-bold transition-all",
                                                days.includes(d.val)
                                                    ? "bg-indigo-600 text-white shadow-sm scale-105"
                                                    : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                                            )}
                                        >
                                            {d.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 4. Holiday Exclusion */}
                        <div className="space-y-4 pt-2 border-t">
                            <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-semibold">Jours fériés & Vacances</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Ne pas envoyer d'emails les jours fériés (France) ou jours spécifiques.
                                    </p>
                                </div>
                                <Switch
                                    checked={excludeHolidays}
                                    onCheckedChange={setExcludeHolidays}
                                />
                            </div>

                            {excludeHolidays && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-md border text-sm custom-scrollbar">
                                        {blockedDates.length === 0 && <span className="text-xs text-muted-foreground italic">Aucune date bloquée</span>}
                                        {blockedDates.map(date => (
                                            <Badge key={date} variant="secondary" className="bg-white border text-slate-600 gap-1 pl-2 pr-1">
                                                {format(new Date(date), "d MMM yyyy", { locale: fr })}
                                                <button onClick={() => removeBlockedDate(date)} className="hover:bg-slate-100 rounded-full p-0.5 transition-colors">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    size="sm"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal h-9",
                                                        !customBlockDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {customBlockDate ? format(customBlockDate, "PPP", { locale: fr }) : <span>Ajouter une date...</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={customBlockDate}
                                                    onSelect={setCustomBlockDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <Button size="sm" onClick={addCustomDate} disabled={!customBlockDate} variant="secondary">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                    <Button
                        onClick={handleSchedule}
                        disabled={loading || checkingSmtp || smtpConfigs.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Lancer l'automatisation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
