import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Clock, Mail, AlertTriangle, XCircle, Loader2, Save, Edit, Send, Plus, X, Calendar as CalendarIconLucide, Wand2, Zap, CheckCircle2, Eye, User } from "lucide-react"
import { format, addDays, isSameDay, startOfDay, isBefore, getYear } from "date-fns"
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
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { getHolidaysForRange } from "@/lib/date-utils"

interface PlanningTabProps {
    schedule: any
    campaign?: any  // Campaign object to show/switch email_mode
    queueStats: {
        pending: number
        sent: number
        failed: number
        total: number
    }
    onUpdate?: () => void
    onAddProspects?: () => void
}

export function PlanningTab({ schedule, campaign, queueStats, onUpdate, onAddProspects }: PlanningTabProps) {
    const supabase = createClient()
    const [smtpName, setSmtpName] = useState<string>("Chargement...")
    const [canceling, setCanceling] = useState(false)

    // Email mode state (for inline switch)
    const [emailMode, setEmailMode] = useState<string>((campaign as any)?.email_mode || "BALANCED")
    const [switchingMode, setSwitchingMode] = useState(false)

    // Edit State
    const [editOpen, setEditOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editDailyLimit, setEditDailyLimit] = useState([20])
    const [editTimeWindow, setEditTimeWindow] = useState({ start: "08:00", end: "18:00" })
    const [editDays, setEditDays] = useState<number[]>([])
    const [editSmtpId, setEditSmtpId] = useState<string>("")

    // Holiday Edit State
    const [editExcludeHolidays, setEditExcludeHolidays] = useState(false)
    const [editBlockedDates, setEditBlockedDates] = useState<string[]>([])
    const [customBlockDate, setCustomBlockDate] = useState<Date | undefined>(undefined)

    // Warm-up Edit State
    const [editEnableWarmup, setEditEnableWarmup] = useState(false)
    const [editWarmupStartLimit, setEditWarmupStartLimit] = useState([2])
    const [editWarmupIncrement, setEditWarmupIncrement] = useState(1)
    const [editWarmupDaysPerStep, setEditWarmupDaysPerStep] = useState(2)

    // Auto-generate
    const [editAutoGenerate, setEditAutoGenerate] = useState(false)

    const [smtpConfigs, setSmtpConfigs] = useState<any[]>([])

    // Today's sends
    const [todaySent, setTodaySent] = useState<any[]>([])
    const [loadingToday, setLoadingToday] = useState(false)
    const [emailPreview, setEmailPreview] = useState<any | null>(null)

    // Timeline State
    const [daysToShow, setDaysToShow] = useState(30)

    useEffect(() => {
        if (schedule) {
            setEditDailyLimit([schedule.daily_limit])
            setEditTimeWindow({ start: schedule.time_window_start, end: schedule.time_window_end })
            setEditDays(schedule.days_of_week || [])
            setEditSmtpId(schedule.smtp_configuration_id || "")
            setEditExcludeHolidays(schedule.exclude_holidays || false)
            setEditBlockedDates(schedule.blocked_dates || [])
            setEditEnableWarmup(schedule.enable_warmup || false)
            setEditWarmupStartLimit([schedule.warmup_start_limit || 2])
            setEditWarmupIncrement(schedule.warmup_increment || 1)
            setEditWarmupDaysPerStep(schedule.warmup_days_per_step || 2)
            setEditAutoGenerate(schedule.auto_generate || false)
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

    // Load today's sent emails for this campaign
    useEffect(() => {
        if (!schedule?.campaign_id) return
        const fetchTodaySent = async () => {
            setLoadingToday(true)
            try {
                const todayStart = new Date()
                todayStart.setHours(0, 0, 0, 0)

                // PRIMARY: email_sends table covers both manual and automatic sends
                const { data: emailSendsData } = await supabase
                    .from('email_sends')
                    .select('id, lead_id, to_email, subject, status, created_at, sent_at')
                    .eq('campaign_id', schedule.campaign_id)
                    .in('status', ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])
                    .gte('created_at', todayStart.toISOString())
                    .order('created_at', { ascending: false })

                // FALLBACK: campaign_prospects with sent_at (for older records)
                const { data: cpData } = await supabase
                    .from('campaign_prospects')
                    .select(`
                        prospect_id,
                        email_status,
                        sent_at,
                        generated_email_subject,
                        prospect:scrape_prospect(
                            id_prospect,
                            data_scrapping,
                            deep_search,
                            email_adresse_verified
                        )
                    `)
                    .eq('campaign_id', schedule.campaign_id)
                    .in('email_status', ['sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced'])
                    .gte('sent_at', todayStart.toISOString())

                // Build prospect map from cpData
                const prospectMap: Record<string, any> = {}
                if (cpData) {
                    cpData.forEach((cp: any) => {
                        prospectMap[cp.prospect_id] = cp
                    })
                }

                // Merge: use email_sends as base, enrich with prospect data
                const leadIds = emailSendsData?.map((s: any) => s.lead_id).filter(Boolean) || []
                
                // Get prospect data for these leads
                let prospectData: any[] = []
                if (leadIds.length > 0) {
                    const { data: prospects } = await supabase
                        .from('scrape_prospect')
                        .select('id_prospect, data_scrapping, deep_search, email_adresse_verified')
                        .in('id_prospect', leadIds)
                    prospectData = prospects || []
                }

                const prospectById: Record<string, any> = {}
                prospectData.forEach((p: any) => { prospectById[p.id_prospect] = p })

                // Deduplicate by lead_id (keep latest)
                const seen = new Set<string>()
                const enriched: any[] = []

                // Process email_sends first (most reliable source)
                if (emailSendsData) {
                    // Also fetch prospects by email for rows where lead_id is NULL (old auto-sends)
                    const nullLeadEmails = emailSendsData
                        .filter((s: any) => !s.lead_id && s.to_email)
                        .map((s: any) => s.to_email)
                    
                    let prospectByEmail: Record<string, any> = {}
                    if (nullLeadEmails.length > 0) {
                        // Try to find prospects via campaign_prospects joined with email
                        const { data: cpForEmails } = await supabase
                            .from('campaign_prospects')
                            .select(`
                                prospect_id,
                                email_status,
                                sent_at,
                                generated_email_subject,
                                prospect:scrape_prospect(id_prospect, data_scrapping, deep_search, email_adresse_verified)
                            `)
                            .eq('campaign_id', schedule.campaign_id)
                        
                        if (cpForEmails) {
                            cpForEmails.forEach((cp: any) => {
                                let pEmail = cp.prospect?.email_adresse_verified
                                if (typeof pEmail === 'string' && pEmail.startsWith('[')) { try { pEmail = JSON.parse(pEmail)?.[0] } catch {} }
                                if (Array.isArray(pEmail)) pEmail = pEmail[0]
                                if (pEmail) prospectByEmail[String(pEmail).toLowerCase()] = { ...cp, pEmail }
                            })
                        }
                    }

                    for (const send of emailSendsData) {
                        // Use lead_id if available, otherwise use send.id for dedup
                        const dedupKey = send.lead_id ? `lead_${send.lead_id}` : `send_${send.id}`
                        if (seen.has(dedupKey)) continue
                        seen.add(dedupKey)

                        let p = send.lead_id ? prospectById[send.lead_id] : null
                        let cpRecord = send.lead_id ? prospectMap[send.lead_id] : null

                        // For null lead_id, try to find by email
                        if (!p && send.to_email) {
                            const cpMatch = prospectByEmail[send.to_email.toLowerCase()]
                            if (cpMatch) {
                                p = cpMatch.prospect
                                cpRecord = cpMatch
                                // Mark this prospect as seen by lead_id too
                                if (cpMatch.prospect_id) {
                                    seen.add(`lead_${cpMatch.prospect_id}`)
                                    prospectMap[cpMatch.prospect_id] = cpMatch
                                }
                            }
                        }

                        const raw = (() => { try { return typeof p?.data_scrapping === 'string' ? JSON.parse(p.data_scrapping) : (p?.data_scrapping || {}) } catch { return {} } })()
                        const deep = (() => { try { return typeof p?.deep_search === 'string' ? JSON.parse(p.deep_search) : (p?.deep_search || {}) } catch { return {} } })()
                        const name = deep.nom_complet || raw.Titre || raw.title || raw.name || (send.to_email ? send.to_email.split('@')[0] : 'Prospect')
                        const company = deep.nom_raison_sociale || raw.company || raw.companyName || raw.Société || ''
                        let email = send.to_email || p?.email_adresse_verified
                        if (typeof email === 'string' && email.startsWith('[')) { try { email = JSON.parse(email)?.[0] } catch {} }
                        if (Array.isArray(email)) email = email[0]
                        enriched.push({
                            prospect_id: send.lead_id || cpRecord?.prospect_id,
                            email_status: cpRecord?.email_status || send.status,
                            sent_at: send.sent_at || send.created_at,
                            generated_email_subject: send.subject || cpRecord?.generated_email_subject,
                            prospect: p,
                            name, company, email,
                            source: 'email_sends'
                        })
                    }
                }

                // Also add from campaign_prospects if not already seen (e.g. older records with sent_at)
                if (cpData) {
                    for (const cp of cpData) {
                        if (seen.has(String(cp.prospect_id))) continue
                        seen.add(String(cp.prospect_id))
                        const raw = (() => { try { return typeof cp.prospect?.data_scrapping === 'string' ? JSON.parse(cp.prospect.data_scrapping) : (cp.prospect?.data_scrapping || {}) } catch { return {} } })()
                        const deep = (() => { try { return typeof cp.prospect?.deep_search === 'string' ? JSON.parse(cp.prospect.deep_search) : (cp.prospect?.deep_search || {}) } catch { return {} } })()
                        const name = deep.nom_complet || raw.Titre || raw.title || raw.name || 'Prospect'
                        const company = deep.nom_raison_sociale || raw.company || raw.companyName || raw.Société || ''
                        let email = cp.prospect?.email_adresse_verified
                        if (typeof email === 'string' && email.startsWith('[')) { try { email = JSON.parse(email)?.[0] } catch {} }
                        if (Array.isArray(email)) email = email[0]
                        enriched.push({ ...cp, name, company, email, source: 'campaign_prospects' })
                    }
                }

                setTodaySent(enriched)
            } catch (err) {
                console.error('Error fetching today sent:', err)
            } finally {
                setLoadingToday(false)
            }
        }
        fetchTodaySent()
    }, [schedule?.campaign_id, supabase])


    // Load holidays logic for edit (only if turning ON for the first time)
    useEffect(() => {
        if (editExcludeHolidays && editBlockedDates.length === 0 && editOpen) {
            const currentYear = getYear(new Date())
            const nextYear = currentYear + 1
            const holidays = getHolidaysForRange(currentYear, nextYear)
            setEditBlockedDates(holidays.map(h => h.dateString))
        }
    }, [editExcludeHolidays, editOpen])


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
                    smtp_configuration_id: editSmtpId,
                    exclude_holidays: editExcludeHolidays,
                    blocked_dates: editBlockedDates,
                    enable_warmup: editEnableWarmup,
                    warmup_start_limit: editWarmupStartLimit[0],
                    warmup_increment: editWarmupIncrement,
                    warmup_days_per_step: editWarmupDaysPerStep,
                    warmup_target_limit: editDailyLimit[0],
                    auto_generate: editAutoGenerate
                })
            })
            const data = await res.json()
            if (res.ok) {
                const stats = data.today_stats
                if (stats && stats.sent_today > 0) {
                    toast.success("Planification mise à jour", {
                        description: `${stats.sent_today} email(s) déjà envoyé(s) aujourd'hui. Il reste ${stats.remaining_today} envoi(s) autorisé(s) aujourd'hui sur les ${stats.new_daily_limit} configurés. La limite complète reprendra demain.`,
                        duration: 9000,
                    })
                } else {
                    toast.success("Planification mise à jour", {
                        description: `Nouvelle limite : ${editDailyLimit[0]} emails/jour. Les changements prennent effet immédiatement.`,
                    })
                }
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

    const handleSwitchMode = async () => {
        if (!campaign?.id) return
        const newMode = emailMode === 'BALANCED' ? 'SHORT_DIRECT' : 'BALANCED'
        setSwitchingMode(true)
        try {
            const { error } = await supabase
                .from('cold_email_campaigns')
                .update({ email_mode: newMode })
                .eq('id', campaign.id)
            if (!error) {
                setEmailMode(newMode)
                toast.success(`Mode "${newMode === 'BALANCED' ? 'Équilibré' : 'Court & Direct'}" activé`)
            } else {
                toast.error('Erreur lors du changement de mode')
            }
        } finally {
            setSwitchingMode(false)
        }
    }

    const addCustomDate = () => {
        if (!customBlockDate) return
        const dateStr = format(customBlockDate, "yyyy-MM-dd")
        if (!editBlockedDates.includes(dateStr)) {
            setEditBlockedDates(prev => [...prev, dateStr].sort())
            toast.success("Date ajoutée")
        }
        setCustomBlockDate(undefined)
    }

    const removeBlockedDate = (dateStr: string) => {
        setEditBlockedDates(prev => prev.filter(d => d !== dateStr))
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
    // Use LIVE data from schedule for simulation
    const blockedDatesSet = new Set(schedule.blocked_dates || [])
    const isExcludingHolidays = schedule.exclude_holidays || false

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

    for (let i = 0; i < daysToShow; i++) {
        // Dynamic limit controlled by "Load More"

        const dayOfWeek = simulationDate.getDay() || 7 // 1-7
        const dateStr = format(simulationDate, "yyyy-MM-dd")

        const isBeforeStart = isBefore(simulationDate, scheduleStart)
        const isOffDay = !activeDays.includes(dayOfWeek)
        const isBlocked = isExcludingHolidays && blockedDatesSet.has(dateStr)

        const isActive = !isBeforeStart && !isOffDay && !isBlocked

        let sentCount = 0
        if (isActive && simulatedRemaining > 0) {
            sentCount = Math.min(simulatedRemaining, dailyLimit)
            simulatedRemaining -= sentCount
        }

        timelineData.push({
            date: new Date(simulationDate),
            sent: sentCount,
            isActive,
            isBeforeStart,
            isOffDay,
            isBlocked,
            isToday: isSameDay(simulationDate, today),
        })

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
                    "border-l-4 p-4 rounded-md flex items-start gap-3 shadow-sm",
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

            <div className="flex flex-col lg:flex-row gap-4">
                {/* COMPACT STATS COLUMN */}
                <div className="flex flex-row lg:flex-col gap-4 lg:w-48 shrink-0">
                    <Card className="flex-1 bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">File d'attente</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold text-slate-900">{queueStats.pending}</div>
                            <p className="text-[10px] text-slate-400 mt-0.5">En attente</p>
                        </CardContent>
                    </Card>
                    <Card className="flex-1 bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Envoyés</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold text-emerald-600">{queueStats.sent}</div>
                            <p className="text-[10px] text-slate-400 mt-0.5">Total</p>
                        </CardContent>
                    </Card>
                </div>

                {/* WIDER CONFIGURATION CARD */}
                <Card className="flex-1 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            Configuration Actuelle
                        </CardTitle>
                        {/* BIGGER EDIT BUTTON MOVED HERE FOR COMPACTNESS */}
                        <Dialog open={editOpen} onOpenChange={setEditOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                                    <Edit className="w-4 h-4 mr-1.5" />
                                    Modifier
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Modifier la planification</DialogTitle>
                                    <DialogDescription>Ajustez les paramètres en cours de route.</DialogDescription>
                                </DialogHeader>

                                {/* ALERTE : recalcul du quota du jour */}
                                <div className="flex items-start gap-3 p-3 rounded-md bg-blue-50 border border-blue-200">
                                    <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                    <div className="text-xs text-blue-700">
                                        <strong>ℹ️ Modification en cours de journée</strong>
                                        <p className="mt-1">
                                            Si des emails ont déjà été envoyés aujourd'hui, ils seront comptabilisés dans la nouvelle limite.
                                            La limite complète reprendra <strong>dès demain</strong>.
                                            Exemple : nouvelle limite 10/jour, 3 déjà envoyés → 7 de plus autorisés aujourd'hui.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <Label>Vitesse d'envoi</Label>
                                            <span className={cn(
                                                "text-sm font-bold px-2 py-1 rounded",
                                                editDailyLimit[0] >= 20 ? "text-red-600 bg-red-50" :
                                                    editDailyLimit[0] >= 10 ? "text-amber-600 bg-amber-50" :
                                                        "text-emerald-600 bg-emerald-50"
                                            )}>
                                                {editDailyLimit[0]} mails/jour
                                            </span>
                                        </div>
                                        <Slider value={editDailyLimit} onValueChange={setEditDailyLimit} max={50} min={1} step={1} />
                                        {/* Volume Warnings */}
                                        {editDailyLimit[0] >= 20 && (
                                            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 animate-in fade-in slide-in-from-top-2">
                                                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                                <p className="text-xs text-red-700">
                                                    <strong>Volume élevé :</strong> Pour les domaines peu utilisés, un volume trop important risque de placer vos mails en spam.
                                                </p>
                                            </div>
                                        )}
                                        {editDailyLimit[0] >= 10 && editDailyLimit[0] < 20 && (
                                            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                                <p className="text-xs text-amber-700">
                                                    <strong>Attention :</strong> Assurez-vous que votre domaine a déjà envoyé des emails régulièrement.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Warm-up Section */}
                                    <div className="space-y-4 pt-2 border-t">
                                        <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-semibold">🔥 Warm-up progressif</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Recommandé pour les nouveaux domaines.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={editEnableWarmup}
                                                onCheckedChange={setEditEnableWarmup}
                                            />
                                        </div>

                                        {editEnableWarmup && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-sm">Limite de départ</Label>
                                                        <span className="text-sm font-bold text-blue-600">{editWarmupStartLimit[0]} mails/jour</span>
                                                    </div>
                                                    <Slider
                                                        value={editWarmupStartLimit}
                                                        onValueChange={setEditWarmupStartLimit}
                                                        max={10}
                                                        min={2}
                                                        step={1}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">Augmentation</Label>
                                                        <Select value={String(editWarmupIncrement)} onValueChange={(v) => setEditWarmupIncrement(Number(v))}>
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="1">+1 mail</SelectItem>
                                                                <SelectItem value="2">+2 mails</SelectItem>
                                                                <SelectItem value="3">+3 mails</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">Jours/palier</Label>
                                                        <Select value={String(editWarmupDaysPerStep)} onValueChange={(v) => setEditWarmupDaysPerStep(Number(v))}>
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="2">2 jours</SelectItem>
                                                                <SelectItem value="3">3 jours</SelectItem>
                                                                <SelectItem value="4">4 jours</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-white rounded-md border border-blue-200">
                                                    <p className="text-xs text-blue-700 font-medium mb-1">📈 Progression :</p>
                                                    <p className="text-xs text-blue-600">
                                                        {editWarmupStartLimit[0]} → ... → {editDailyLimit[0]} mails/jour
                                                    </p>
                                                </div>
                                            </div>
                                        )}
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

                                    {/* HOLIDAY SECTION IN EDIT */}
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="flex flex-row items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-semibold">Jours fériés</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Exclure les jours fériés.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={editExcludeHolidays}
                                                onCheckedChange={setEditExcludeHolidays}
                                            />
                                        </div>

                                        {editExcludeHolidays && (
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-md border text-sm custom-scrollbar">
                                                    {editBlockedDates.length === 0 && <span className="text-xs text-muted-foreground italic">Aucune date bloquée</span>}
                                                    {editBlockedDates.map(date => (
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
                                                                <CalendarIconLucide className="mr-2 h-4 w-4" />
                                                                {customBlockDate ? format(customBlockDate, "PPP", { locale: fr }) : <span>Ajouter...</span>}
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
                                                    <Button size="sm" onClick={addCustomDate} disabled={!customBlockDate} variant="secondary" className="gap-2">
                                                        <Plus className="w-4 h-4" />
                                                        Ajouter
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>

                                {/* AUTO-GENERATE TOGGLE */}
                                <div className={cn(
                                    "flex items-center justify-between gap-4 px-4 py-3 rounded-xl border mt-2",
                                    editAutoGenerate ? "bg-violet-50 border-violet-200" : "bg-slate-50 border-slate-200"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <Wand2 className={cn("w-5 h-5 shrink-0", editAutoGenerate ? "text-violet-600" : "text-slate-400")} />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Génération automatique des emails</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                n8n génère les emails manquants avant chaque envoi si le quota n'est pas atteint
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={editAutoGenerate}
                                        onCheckedChange={setEditAutoGenerate}
                                        className="data-[state=checked]:bg-violet-600 shrink-0"
                                    />
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
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <div className="text-xs text-slate-400 uppercase font-semibold">Vitesse</div>
                                <div className="text-xl font-bold text-slate-900">{schedule.daily_limit} <span className="text-xs font-normal text-slate-500">mails/jour</span></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-slate-400 uppercase font-semibold">Fenêtre</div>
                                <div className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
                                    {schedule.time_window_start?.slice(0, 5)} - {schedule.time_window_end?.slice(0, 5)}
                                </div>
                            </div>
                            <div className="space-y-1 overflow-hidden">
                                <div className="text-xs text-slate-400 uppercase font-semibold">Compte actif</div>
                                <div className="text-sm font-semibold text-slate-700 truncate" title={smtpName}>
                                    {smtpName}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 mt-2">
                            {schedule.exclude_holidays ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                    🏝️ Jours fériés exclus ({schedule.blocked_dates?.length || 0} dates)
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-slate-500 border-slate-200">
                                    Jours fériés inclus
                                </Badge>
                            )}
                        </div>

                        {/* AUTO-GENERATE BANNER — toujours visible */}
                        <div className={cn(
                            "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all",
                            schedule.auto_generate
                                ? "bg-violet-50 border-violet-200"
                                : "bg-slate-50 border-slate-200"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                    schedule.auto_generate ? "bg-violet-100" : "bg-slate-100"
                                )}>
                                    <Wand2 className={cn("w-4 h-4", schedule.auto_generate ? "text-violet-600" : "text-slate-400")} />
                                </div>
                                <div>
                                    <p className={cn(
                                        "text-sm font-semibold",
                                        schedule.auto_generate ? "text-violet-900" : "text-slate-600"
                                    )}>
                                        Génération automatique
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {schedule.auto_generate
                                            ? "n8n génère les emails manquants avant chaque envoi"
                                            : "Désactivée — emails générés manuellement uniquement"
                                        }
                                    </p>
                                </div>
                            </div>
                            <Badge className={cn(
                                "shrink-0 font-bold text-xs",
                                schedule.auto_generate
                                    ? "bg-violet-600 text-white hover:bg-violet-700"
                                    : "bg-slate-200 text-slate-500"
                            )}>
                                {schedule.auto_generate ? "ON" : "OFF"}
                            </Badge>
                        </div>

                        {/* EMAIL MODE BANNER */}
                        {campaign && (
                            <div className={cn(
                                "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all",
                                emailMode === 'BALANCED'
                                    ? "bg-indigo-50 border-indigo-200"
                                    : "bg-emerald-50 border-emerald-200"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base",
                                        emailMode === 'BALANCED' ? "bg-indigo-100" : "bg-emerald-100"
                                    )}>
                                        {emailMode === 'BALANCED' ? '⚖️' : '⚡'}
                                    </div>
                                    <div>
                                        <p className={cn(
                                            "text-sm font-semibold",
                                            emailMode === 'BALANCED' ? "text-indigo-900" : "text-emerald-900"
                                        )}>
                                            Mode email actif
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {emailMode === 'BALANCED'
                                                ? "Équilibré / Professionnel — email complet structuré"
                                                : "Court & Direct — question directe 3-5 lignes"
                                            }
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSwitchMode}
                                    disabled={switchingMode}
                                    className={cn(
                                        "shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                                        emailMode === 'BALANCED'
                                            ? "border-indigo-300 text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                                            : "border-emerald-300 text-emerald-700 bg-emerald-100 hover:bg-emerald-200",
                                        "disabled:opacity-50"
                                    )}
                                >
                                    {switchingMode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Changer'}
                                </button>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 mt-2">
                            {onAddProspects && (
                                <Button onClick={onAddProspects} variant="outline" size="sm" className="w-full justify-center bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Ajouter des prospects
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* TODAY'S SENDS */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b border-slate-100 px-6 py-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Mail className="w-5 h-5 text-emerald-500" />
                            Envois d'aujourd'hui
                        </CardTitle>
                        <CardDescription>
                            {todaySent.length === 0 && !loadingToday
                                ? "Aucun email envoyé aujourd'hui pour cette campagne"
                                : `${todaySent.length} email${todaySent.length > 1 ? 's' : ''} envoyé${todaySent.length > 1 ? 's' : ''} aujourd'hui`
                            }
                        </CardDescription>
                    </div>
                    {loadingToday && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </CardHeader>
                <CardContent className="p-0">
                    {todaySent.length === 0 && !loadingToday ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Mail className="w-8 h-8 opacity-20 mb-2" />
                            <p className="text-sm">Aucun envoi aujourd'hui</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {todaySent.map((item: any, i: number) => {
                                const statusColors: Record<string, string> = {
                                    sent: 'bg-blue-100 text-blue-700',
                                    delivered: 'bg-teal-100 text-teal-700',
                                    opened: 'bg-cyan-100 text-cyan-700',
                                    clicked: 'bg-indigo-100 text-indigo-700',
                                    replied: 'bg-emerald-100 text-emerald-700',
                                }
                                const statusLabels: Record<string, string> = {
                                    sent: 'Envoyé', delivered: 'Délivré', opened: 'Ouvert',
                                    clicked: 'Cliqué', replied: 'Répondu',
                                }
                                return (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors cursor-pointer group"
                                        onClick={() => setEmailPreview(item)}
                                    >
                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                            <User className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">
                                                {item.name}
                                                {item.company && <span className="ml-1.5 text-xs font-normal text-slate-500">{item.company}</span>}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">
                                                {item.email || '—'}
                                            </p>
                                        </div>
                                        {/* Subject preview */}
                                        <div className="flex-1 min-w-0 hidden md:block">
                                            <p className="text-xs text-slate-600 truncate font-medium">{item.generated_email_subject || '(sans objet)'}</p>
                                        </div>
                                        {/* Time + status */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-slate-400">
                                                {item.sent_at ? new Date(item.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', statusColors[item.email_status] || 'bg-slate-100 text-slate-500')}>
                                                {statusLabels[item.email_status] || item.email_status}
                                            </span>
                                            <Eye className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* EMAIL PREVIEW DIALOG */}
            <Dialog open={!!emailPreview} onOpenChange={(open) => { if (!open) setEmailPreview(null) }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-500" />
                            Aperçu de l'email envoyé
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-700">{emailPreview?.name}</span>
                            {emailPreview?.company && <span className="text-slate-500">• {emailPreview.company}</span>}
                            {emailPreview?.email && <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{emailPreview.email}</span>}
                            {emailPreview?.sent_at && (
                                <span className="text-xs text-slate-400 ml-auto">
                                    Envoyé à {new Date(emailPreview.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {emailPreview && (
                        <div className="space-y-4">
                            {/* Subject */}
                            <div className="border rounded-lg p-4 bg-slate-50">
                                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Objet</p>
                                <p className="font-semibold text-slate-900 text-base">{emailPreview.generated_email_subject || '(sans objet)'}</p>
                            </div>

                            {/* Body */}
                            <div className="border rounded-lg p-6 bg-white shadow-sm">
                                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-3">Corps du message</p>
                                {emailPreview.generated_email_content ? (
                                    <div
                                        className="prose prose-sm max-w-none text-slate-800 leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                            __html: emailPreview.generated_email_content
                                                .replace(/\n/g, '<br/>')
                                        }}
                                    />
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">Contenu non disponible</p>
                                )}
                            </div>

                            {/* Status badge */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                                <span>Statut de l'email</span>
                                <span className={cn('px-2 py-0.5 rounded-full font-semibold text-[10px]',
                                    emailPreview.email_status === 'opened' ? 'bg-cyan-100 text-cyan-700' :
                                    emailPreview.email_status === 'replied' ? 'bg-emerald-100 text-emerald-700' :
                                    emailPreview.email_status === 'clicked' ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-blue-100 text-blue-700'
                                )}>
                                <span>{
                                    ({
                                        sent: 'Envoyé', delivered: 'Délivré', opened: 'Ouvert ✓',
                                        clicked: 'Cliqué ✓', replied: 'Répondu ✓'
                                    } as Record<string, string>)[emailPreview.email_status] || emailPreview.email_status
                                }</span>
                                </span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Timeline / Forecast - INFINITE SCROLL */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b border-slate-100 px-6 py-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarIcon className="w-5 h-5 text-indigo-500" />
                            Prévisions d'envoi & Historique
                        </CardTitle>
                        <CardDescription>
                            Fin estimée le <span className="font-bold text-gray-900">{format(endDate, "d MMMM yyyy", { locale: fr })}</span>
                        </CardDescription>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={canceling} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                {canceling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                Arrêter la programmation d'envoi automatique
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
                <CardContent className="p-0">
                    {/* SCROLLABLE CONTAINER */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <div className="flex gap-1.5 p-6 min-w-max">
                            {timelineData.map((day, i) => {
                                let statusText = ""
                                let statusClass = ""

                                if (day.isBlocked) {
                                    statusText = "Férié"
                                    statusClass = "bg-amber-50 border-amber-100 text-amber-600 opacity-70"
                                } else if (day.isBeforeStart) {
                                    statusText = "Attente"
                                    statusClass = "bg-slate-50 border-slate-100 text-slate-300"
                                } else if (day.isOffDay) {
                                    statusText = "Pause"
                                    statusClass = "bg-slate-50 border-slate-100 text-slate-300 opacity-50"
                                } else {
                                    statusClass = "bg-white border-slate-200"
                                }

                                if (day.isToday) {
                                    statusClass += " border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500 shadow-sm z-10 scale-105 origin-bottom"
                                }

                                return (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2 rounded-lg border text-xs h-20 w-16 shrink-0 transition-all",
                                            statusClass
                                        )}
                                    >
                                        <span className={cn("text-[10px] font-bold uppercase mb-1", day.isToday ? "text-indigo-600" : "text-slate-400")}>
                                            {format(day.date, "EEE", { locale: fr })}
                                        </span>
                                        <span className={cn("text-lg font-bold mb-1", day.isToday ? "text-indigo-900" : "text-slate-700")}>
                                            {format(day.date, "dd")}
                                        </span>

                                        {day.isActive ? (
                                            <Badge variant="secondary" className="px-1.5 h-4 text-[9px] bg-emerald-100 text-emerald-800 border-none">
                                                {day.sent}
                                            </Badge>
                                        ) : (
                                            <span className={cn("text-[9px] uppercase font-bold", day.isBlocked ? "text-amber-400" : "text-slate-300")}>
                                                {day.isBlocked ? "FERIÉ" : "-"}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                            {/* Spacer for end of scroll */}
                            <div className="w-10 shrink-0" />
                        </div>
                    </div>

                    <p className="text-[10px] text-center text-muted-foreground pb-2 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-100 block"></span> Envoi
                        <span className="w-2 h-2 rounded-full bg-slate-100 block ml-2"></span> Pause
                        <span className="w-2 h-2 rounded-full bg-amber-100 block ml-2"></span> Férié
                        <span className="ml-2">Faites défiler pour voir la suite →</span>
                    </p>

                </CardContent>
            </Card>
        </div>
    )
}
