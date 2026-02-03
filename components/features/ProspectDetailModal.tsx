"use client"

import { useState } from "react"
import {
    Building2, Mail, Phone, MapPin, Globe, User,
    Star, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, Users, Store,
    Briefcase, Copy, Facebook, Instagram, Linkedin, Twitter, ChevronDown, Info, X, FileDown
} from "lucide-react"
import { differenceInYears, isValid } from "date-fns"
import type { ScrapeProspect, CampaignProspectLink } from "@/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

// --- TYPES ---
interface ScrappedData {
    "Nom de catégorie"?: string
    "URL Google Maps"?: string
    "Titre"?: string
    "Rue"?: string
    "Ville"?: string
    "Code postal"?: string
    "Email"?: string | null
    "Site web"?: string
    "Téléphone"?: string
    "telephone"?: string
    "Phone"?: string
    "Score total"?: number
    "Nombre d'avis"?: number
    "Heures d'ouverture"?: Array<{ day: string; hours: string }>
    "Infos"?: Record<string, Array<Record<string, boolean>>>
}

interface DeepSearchData {
    "points_forts"?: string[]
    "actualites_recents"?: string[]
    "style_communication"?: string
    "offres_principales"?: string[]
    "clients_cibles"?: string
    "emails"?: string[]
    "socials"?: Record<string, string>
    "siret_siege"?: string
    "nom_complet"?: string
    "nom_raison_sociale"?: string
    "naf"?: string
    "date_creation"?: string
    "effectif"?: string
    "nombre_etablissements"?: number | string
    "nombre_etablissements_ouverts"?: number | string
    "dirigeants"?: Array<{
        nom?: string
        prenoms?: string
        qualite?: string
        type_dirigeant?: string
        date_de_naissance?: string
    }>
}

interface ProspectDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    prospect: ScrapeProspect | null
    campaignLink?: CampaignProspectLink
    onGenerateEmail?: () => void
    onSendEmail?: () => void
}

const calculateAge = (dateStr?: string) => {
    if (!dateStr) return null
    try {
        const date = new Date(dateStr)
        if (!isValid(date)) return null
        return differenceInYears(new Date(), date)
    } catch (e) { return null }
}

const formatHours = (hoursStr: string) => {
    return hoursStr.replace(/ to /g, ' - ').replace(/:/g, 'h')
}

const getSocialIcon = (network: string) => {
    const n = network.toLowerCase()
    if (n.includes('facebook')) return <Facebook className="w-4 h-4 text-blue-600" />
    if (n.includes('instagram')) return <Instagram className="w-4 h-4 text-pink-600" />
    if (n.includes('linkedin')) return <Linkedin className="w-4 h-4 text-blue-700" />
    if (n.includes('twitter') || n.includes('x.com')) return <Twitter className="w-4 h-4 text-sky-500" />
    return <Globe className="w-4 h-4 text-gray-500" />
}

export function ProspectDetailModal({
    open,
    onOpenChange,
    prospect,
    campaignLink,
    onGenerateEmail,
    onSendEmail
}: ProspectDetailModalProps) {
    if (!prospect) return null

    const safeParse = (data: any) => {
        if (!data) return {}
        if (typeof data === 'string') {
            try { return JSON.parse(data) } catch (e) { return {} }
        }
        return data
    }

    const scrapped: ScrappedData = safeParse(prospect.data_scrapping)
    const deep: DeepSearchData = safeParse(prospect.deep_search)

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copié !")
    }

    // --- DISPLAY VARS ---
    const companyName = scrapped.Titre || deep.nom_raison_sociale || "Société Inconnue"
    const category = scrapped["Nom de catégorie"] || "Secteur inconnu"
    const address = scrapped.Rue
        ? `${scrapped.Rue}, ${scrapped["Code postal"]} ${scrapped.Ville}`
        : (prospect?.ville || "Adresse inconnue")
    const rating = scrapped["Score total"]
    const reviewCount = scrapped["Nombre d'avis"]
    const mapsUrl = scrapped["URL Google Maps"]
    const website = scrapped["Site web"] || (deep.socials?.instagram || deep.socials?.facebook)

    // Email Status Logic
    let emailStatus = 'inconnu'
    let emailStatusLabel = 'Inconnu'

    if (prospect?.check_email_tentative?.toLowerCase().includes("pas de domaine")) {
        emailStatus = 'pas_domaine'
        emailStatusLabel = 'Pas de domaine'
    } else if (prospect?.succed_validation_smtp_email === true) {
        emailStatus = 'valide'
        emailStatusLabel = 'Vérifié ✓'
    } else if (prospect?.succed_validation_smtp_email === false) {
        emailStatus = 'echec'
        emailStatusLabel = 'Échec'
    } else if (prospect?.check_email === false) {
        emailStatus = 'non_verifie'
        emailStatusLabel = 'Non vérifié'
    }

    const displayEmail = (prospect?.email_adresse_verified && prospect?.email_adresse_verified.length > 0)
        ? (Array.isArray(prospect.email_adresse_verified) ? prospect.email_adresse_verified[0] : prospect.email_adresse_verified)
        : (scrapped.Email || (deep.emails && deep.emails[0]))

    const renderEmailBadge = () => {
        if (!displayEmail) {
            if (emailStatus === 'pas_domaine') {
                return <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">Pas de domaine</Badge>
            }
            return <Badge variant="secondary" className="text-muted-foreground">Aucun email</Badge>
        }

        switch (emailStatus) {
            case 'valide':
                return <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1"><CheckCircle2 className="w-3 h-3" /> {emailStatusLabel}</Badge>
            case 'echec':
                return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> {emailStatusLabel}</Badge>
            case 'pas_domaine':
                return <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">{emailStatusLabel}</Badge>
            case 'non_verifie':
                return <Badge variant="secondary" className="gap-1 text-muted-foreground"><AlertCircle className="w-3 h-3" /> {emailStatusLabel}</Badge>
            default:
                return <Badge variant="outline" className="gap-1 text-muted-foreground"><Info className="w-3 h-3" /> {emailStatusLabel}</Badge>
        }
    }

    const renderDeepScanBadge = () => {
        const hasDeepData = deep && (Object.keys(deep).length > 0)
        if (hasDeepData) {
            return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1"><Sparkles className="w-3 h-3" /> Deep Search</Badge>
        }
        return <Badge variant="outline" className="text-muted-foreground bg-muted/50">Sans Deep Search</Badge>
    }

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'sent': return 'bg-green-100 text-green-800'
            case 'generated': return 'bg-blue-100 text-blue-800'
            case 'bounced': return 'bg-red-100 text-red-800'
            case 'replied': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'sent': return 'Envoyé'
            case 'generated': return 'Généré'
            case 'bounced': return 'Rebond'
            case 'replied': return 'Répondu'
            case 'not_generated': return 'Non généré'
            default: return 'Aucun'
        }
    }

    // --- DATA HELPERS ---
    const getPhoneNumber = () => {
        // Priority check for phone numbers
        if (scrapped["Téléphone"]) return scrapped["Téléphone"]
        if (scrapped["telephone"]) return scrapped["telephone"]
        if ((scrapped as any)["Phone"]) return (scrapped as any)["Phone"]

        // Check in Infos array
        if (scrapped["Infos"]) {
            for (const key in scrapped["Infos"]) {
                const items = scrapped["Infos"][key]
                if (Array.isArray(items)) {
                    const phoneItem = items.find(i => Object.keys(i).some(k => k.toLowerCase().includes("téléphone") || k.toLowerCase().includes("telephone")))
                    if (phoneItem) return Object.values(phoneItem)[0]
                }
            }
        }
        return null
    }

    const phoneNumber = getPhoneNumber()

    // --- COMPONENTS ---
    const CopyButton = ({ text, label }: { text: string | undefined | null, label: string }) => {
        const [copied, setCopied] = useState(false)

        if (!text) return <span className="text-muted-foreground">-</span>

        return (
            <TooltipProvider>
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <div
                            className="flex items-center gap-2 cursor-pointer group hover:bg-muted/50 p-1 -ml-1 rounded transition-colors"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleCopy(text)
                                setCopied(true)
                                setTimeout(() => setCopied(false), 2000)
                            }}
                        >
                            <span className="truncate break-words whitespace-normal">{text}</span>
                            {copied ? (
                                <span className="text-xs text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded animate-in fade-in zoom-in shrink-0">
                                    ✅
                                </span>
                            ) : (
                                <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>{copied ? "Copié !" : "Cliquer pour copier"}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] lg:max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                <style jsx global>{`
                    @keyframes ai-pulse-border {
                        0%, 100% { border-color: rgba(99, 102, 241, 0.3); box-shadow: 0 0 10px rgba(99, 102, 241, 0.1); }
                        50% { border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 20px rgba(168, 85, 247, 0.2); }
                    }
                    .ai-analysis-card {
                        animation: ai-pulse-border 3s ease-in-out infinite;
                        background: linear-gradient(135deg, rgba(255,255,255,0.8), rgba(245,243,255,0.5));
                    }
                    .dark .ai-analysis-card {
                        background: linear-gradient(135deg, rgba(30,27,75,0.4), rgba(46,16,101,0.2));
                    }
                `}</style>
                <DialogHeader className="p-6 border-b shrink-0 bg-white dark:bg-slate-950 z-10">
                    <DialogTitle className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xl md:text-2xl font-bold truncate">{companyName}</span>
                                {renderDeepScanBadge()}
                                {campaignLink && (
                                    <Badge className={getStatusColor(campaignLink.email_status)}>
                                        {getStatusLabel(campaignLink.email_status)}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1 min-w-0 truncate"><Building2 className="w-4 h-4 shrink-0" /> {category}</span>
                                {rating && (
                                    <>
                                        <span className="hidden sm:inline text-gray-300">|</span>
                                        <span className="flex items-center gap-1 text-amber-500 font-medium whitespace-nowrap">
                                            <Star className="w-4 h-4 fill-current" /> {rating} <span className="text-muted-foreground font-normal">({reviewCount})</span>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="md:hidden self-end absolute top-4 right-4">
                            <X className="w-5 h-5" />
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950/50">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* LEFT COLUMN: CONTACT (Mobile: full, Desktop: 4/12) */}
                        <div className="space-y-4 lg:col-span-4 h-fit">
                            <Card className="border-l-4 border-l-primary/50 shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Coordonnées</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Email */}
                                    <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</span>
                                            {renderEmailBadge()}
                                        </div>
                                        <div className="flex items-center gap-2 font-medium overflow-hidden">
                                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <CopyButton text={displayEmail} label="Email" />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Phone */}
                                    <div className="space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Téléphone</span>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-muted-foreground" />
                                            <CopyButton text={phoneNumber} label="Téléphone" />
                                        </div>
                                    </div>
                                    {/* Address */}
                                    <div className="space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adresse</span>
                                        <div className="flex items-start gap-2">
                                            <MapPin className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                                            <div className="break-words">
                                                <CopyButton text={address} label="Adresse" />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Socials */}
                                    {deep.socials && Object.keys(deep.socials).length > 0 && (
                                        <div className="pt-4 border-t">
                                            <div className="flex gap-2 flex-wrap text-muted-foreground">
                                                {Object.entries(deep.socials).map(([net, link]) => link && (
                                                    <Button key={net} variant="outline" size="icon" asChild title={net} className="h-8 w-8 rounded-full">
                                                        <a href={link} target="_blank" rel="noopener noreferrer">
                                                            {getSocialIcon(net)}
                                                        </a>
                                                    </Button>
                                                ))}
                                                {website && (
                                                    <Button variant="outline" size="icon" asChild title="Site Web" className="h-8 w-8 rounded-full">
                                                        <a href={website} target="_blank" rel="noopener noreferrer">
                                                            <Globe className="w-4 h-4 text-gray-700" />
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {scrapped["Heures d'ouverture"] && (
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Horaires</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm p-4 pt-0">
                                        <ul className="space-y-1">
                                            {scrapped["Heures d'ouverture"].map((day, idx) => (
                                                <li key={idx} className="flex justify-between py-1 border-b last:border-0 border-dashed text-xs">
                                                    <span className="font-medium capitalize">{day.day}</span>
                                                    <span className="text-muted-foreground">{formatHours(day.hours)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* RIGHT COLUMN: DEEP SEARCH & DETAILS (Mobile: full, Desktop: 8/12) */}
                        <div className="lg:col-span-8 space-y-6 min-w-0">
                            {/* 1. Deep Search Info Grid (Merged from Tab) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg sm:col-span-2 shadow-sm">
                                    <span className="text-[10px] items-center flex gap-1 font-bold text-muted-foreground uppercase mb-1"><Briefcase className="w-3 h-3" /> Raison Sociale</span>
                                    <div className="font-medium text-sm truncate"><CopyButton text={deep.nom_raison_sociale} label="Raison Sociale" /></div>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
                                    <span className="text-[10px] items-center flex gap-1 font-bold text-muted-foreground uppercase mb-1"><FileDown className="w-3 h-3" /> Siret</span>
                                    <div className="font-mono text-sm break-all"><CopyButton text={deep.siret_siege} label="Siret" /></div>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
                                    <span className="text-[10px] items-center flex gap-1 font-bold text-muted-foreground uppercase mb-1">Code NAF</span>
                                    <p className="font-mono text-sm break-normal"><CopyButton text={deep.naf || "-"} label="NAF" /></p>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
                                    <span className="text-[10px] items-center flex gap-1 font-bold text-muted-foreground uppercase mb-1">Création</span>
                                    <p className="text-sm"><CopyButton text={deep.date_creation || "-"} label="Date création" /></p>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
                                    <span className="text-[10px] items-center flex gap-1 font-bold text-muted-foreground uppercase mb-1">Effectif</span>
                                    <p className="font-medium flex items-center gap-1 text-sm text-foreground">
                                        <Users className="w-3 h-3 text-muted-foreground" />
                                        {deep.effectif || "Non renseigné"}
                                    </p>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg sm:col-span-2 shadow-sm">
                                    <span className="text-[10px] items-center flex gap-1 font-bold text-muted-foreground uppercase mb-1">Établissements</span>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-1 text-sm font-medium">
                                            <Store className="w-3 h-3 text-muted-foreground" /> Total: {deep.nombre_etablissements || 1}
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                            Ouverts: {deep.nombre_etablissements_ouverts || 1}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. AI Analysis (Revamped) */}
                            {(deep.points_forts || deep.clients_cibles || deep.style_communication) && (
                                <div className="p-5 rounded-xl border ai-analysis-card space-y-4 shadow-lg backdrop-blur-sm">
                                    <h4 className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-sm tracking-wide">
                                        <Sparkles className="w-4 h-4 fill-indigo-200 animate-pulse" /> ANALYSE IA
                                    </h4>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        {deep.points_forts && deep.points_forts.length > 0 && (
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Points Forts</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {deep.points_forts.map((pt, i) => (
                                                        <Badge key={i} variant="secondary" className="bg-white/80 dark:bg-slate-900/80 hover:bg-white text-xs border border-indigo-100 shadow-sm px-2 py-1 cursor-pointer" onClick={() => handleCopy(pt)}>
                                                            {pt}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            {deep.style_communication && (
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ton & Style</span>
                                                    <p className="text-sm italic text-foreground/80 bg-white/60 dark:bg-slate-900/60 p-2 rounded border border-indigo-100/50 dark:border-indigo-800/50 border-dashed">
                                                        <CopyButton text={deep.style_communication} label="Style" />
                                                    </p>
                                                </div>
                                            )}
                                            {deep.clients_cibles && (
                                                <div className="space-y-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cible</span>
                                                    <p className="text-sm text-foreground/90 bg-white/60 dark:bg-slate-900/60 p-2 rounded">
                                                        <CopyButton text={deep.clients_cibles} label="Cible" />
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. Dirigeants (Enhanced) */}
                            {deep.dirigeants && deep.dirigeants.length > 0 && (
                                <div className="pt-2">
                                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-foreground">
                                        <Briefcase className="w-4 h-4 text-primary" /> Dirigeants
                                    </h4>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {deep.dirigeants.map((d, i) => {
                                            const age = calculateAge(d.date_de_naissance)
                                            const fullName = `${d.prenoms || ""} ${d.nom || ""}`.trim()
                                            return (
                                                <div key={i} className="flex flex-col p-3 border rounded-lg bg-white dark:bg-slate-900 shadow-sm hover:border-primary/50 transition-colors">
                                                    <div className="font-bold flex items-center gap-2 text-sm text-foreground">
                                                        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                            {(d.prenoms?.[0] || "") + (d.nom?.[0] || "")}
                                                        </div>
                                                        <CopyButton text={fullName} label="Nom dirigeant" />
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-2 ml-10">
                                                        <Badge variant="outline" className="bg-muted/50 font-normal w-fit"><CopyButton text={d.qualite || "Dirigeant"} label="Qualité" /></Badge>
                                                        {d.date_de_naissance && (
                                                            <span className="text-[11px] text-muted-foreground">
                                                                <CopyButton text={`Né(e) en ${d.date_de_naissance}`} label="Date naissance" />
                                                                {age ? ` (${age} ans)` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 4. Infos Details (Merged from Tab) */}
                            {scrapped["Infos"] && Object.keys(scrapped["Infos"]).length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-foreground pt-4 border-t">
                                        <Info className="w-4 h-4 text-primary" /> Détails & Services
                                    </h4>
                                    {Object.entries(scrapped["Infos"]).map(([category, items], idx) => (
                                        <div key={idx} className="mb-4 last:mb-0 bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
                                            <h5 className="font-bold mb-3 pb-2 border-b text-xs text-muted-foreground uppercase tracking-wider">
                                                {category}
                                            </h5>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                {items.map((item, i) => {
                                                    const key = Object.keys(item)[0]
                                                    const val = item[key]
                                                    if (!val) return null
                                                    return (
                                                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground group">
                                                            <CheckCircle2 className="w-4 h-4 text-green-500/70 mt-0.5 shrink-0 group-hover:text-green-600 transition-colors" />
                                                            <span className="group-hover:text-foreground transition-colors cursor-pointer" onClick={() => handleCopy(key)}>{key}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* JSON Debug */}
                            <div className="pt-4 border-t mt-4">
                                <details className="group">
                                    <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none w-fit">
                                        <div className="px-3 py-1.5 border rounded-full group-open:bg-muted font-medium transition-colors">🛠️ Debug JSON</div>
                                    </summary>
                                    <div className="grid md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Data Scrapping</span>
                                            <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-[300px] text-[10px] border border-slate-800 shadow-inner">{JSON.stringify(scrapped, null, 2)}</pre>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Deep Search</span>
                                            <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-[300px] text-[10px] border border-slate-800 shadow-inner">{JSON.stringify(deep, null, 2)}</pre>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>

                        {/* BOTTOM ROW: Campaign Email Actions (Full Width) */}
                        <div className="lg:col-span-12">
                            {campaignLink && (
                                <Card className="border-indigo-100 bg-indigo-50/50 shadow-sm overflow-hidden">
                                    <CardHeader className="pb-3 border-b border-indigo-100/50 bg-indigo-50/80">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-indigo-600" /> Actions Campagne & Email
                                            </CardTitle>
                                            <div className="flex gap-2">
                                                {onGenerateEmail && campaignLink.email_status === 'not_generated' && (
                                                    <Button onClick={onGenerateEmail} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">
                                                        <Sparkles className="w-3 h-3 mr-2" /> Générer l'email
                                                    </Button>
                                                )}
                                                {onSendEmail && displayEmail && (
                                                    <Button onClick={onSendEmail} variant="default" className="h-8 text-xs bg-green-600 hover:bg-green-700">
                                                        ✉️ Envoyer l'email
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {campaignLink.generated_email_content ? (
                                            <div className="flex flex-col md:flex-row h-[500px]">
                                                <div className="flex-1 p-6 bg-white overflow-y-auto">
                                                    <div className="max-w-3xl mx-auto space-y-4">
                                                        <div className="border-b pb-4">
                                                            <p className="text-sm text-gray-500 mb-1">Objet</p>
                                                            <p className="font-semibold text-lg text-gray-900">{campaignLink.generated_email_subject}</p>
                                                        </div>
                                                        <div
                                                            dangerouslySetInnerHTML={{ __html: campaignLink.generated_email_content }}
                                                            className="prose prose-sm max-w-none text-gray-700"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-12 text-center text-muted-foreground bg-white/50">
                                                <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>Aucun email généré pour le moment.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                </div> {/* End Scrollable Content */}
            </DialogContent>
        </Dialog>
    )
}
