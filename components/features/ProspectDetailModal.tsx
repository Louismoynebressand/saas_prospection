"use client"

import { useState } from "react"
import {
    Building2, Mail, Phone, MapPin, Globe, User,
    Star, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, Users, Store,
    Briefcase, Copy, Facebook, Instagram, Linkedin, Twitter, ChevronDown, Info, X
} from "lucide-react"
import { differenceInYears, isValid } from "date-fns"
import type { ScrapeProspect, CampaignProspectLink } from "@/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
                            <span className="truncate">{text}</span>
                            {copied ? (
                                <span className="text-xs text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded animate-in fade-in zoom-in">
                                    ✅ Copié
                                </span>
                            ) : (
                                <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold">{companyName}</span>
                            {renderDeepScanBadge()}
                            {campaignLink && (
                                <Badge className={getStatusColor(campaignLink.email_status)}>
                                    {getStatusLabel(campaignLink.email_status)}
                                </Badge>
                            )}
                        </div>
                    </DialogTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {category}</span>
                        {rating && (
                            <span className="flex items-center gap-1 text-amber-500 font-medium">
                                <Star className="w-4 h-4 fill-current" /> {rating} <span className="text-muted-foreground font-normal">({reviewCount})</span>
                            </span>
                        )}
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
                    {/* LEFT COLUMN: CONTACT */}
                    <div className="space-y-4 lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Coordonnées</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Email */}
                                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Email</span>
                                        {renderEmailBadge()}
                                    </div>
                                    <div className="flex items-center gap-2 font-medium overflow-hidden">
                                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <CopyButton text={displayEmail} label="Email" />
                                    </div>
                                </div>
                                {/* Phone */}
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Téléphone</span>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <CopyButton text={scrapped["Téléphone"]} label="Téléphone" />
                                    </div>
                                </div>
                                {/* Address */}
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Adresse</span>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                                        <CopyButton text={address} label="Adresse" />
                                    </div>
                                </div>
                                {/* Socials */}
                                {deep.socials && Object.keys(deep.socials).length > 0 && (
                                    <div className="pt-4 border-t">
                                        <div className="flex gap-2 flex-wrap justify-center">
                                            {Object.entries(deep.socials).map(([net, link]) => link && (
                                                <Button key={net} variant="outline" size="icon" asChild title={net} className="h-9 w-9">
                                                    <a href={link} target="_blank" rel="noopener noreferrer">
                                                        {getSocialIcon(net)}
                                                    </a>
                                                </Button>
                                            ))}
                                            {website && (
                                                <Button variant="outline" size="icon" asChild title="Site Web" className="h-9 w-9">
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
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Horaires</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm">
                                    <ul className="space-y-1">
                                        {scrapped["Heures d'ouverture"].map((day, idx) => (
                                            <li key={idx} className="flex justify-between py-1 border-b last:border-0 border-dashed">
                                                <span className="font-medium capitalize">{day.day}</span>
                                                <span className="text-muted-foreground text-xs">{formatHours(day.hours)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}

                        {/* Campaign Email Actions */}
                        {campaignLink && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Actions Campagne</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {onGenerateEmail && campaignLink.email_status === 'not_generated' && (
                                        <Button onClick={onGenerateEmail} className="w-full" size="sm">
                                            📧 Générer l'email
                                        </Button>
                                    )}
                                    {onSendEmail && campaignLink.email_status === 'generated' && (
                                        <Button onClick={onSendEmail} variant="default" className="w-full" size="sm">
                                            ✉️ Envoyer
                                        </Button>
                                    )}
                                    {campaignLink.generated_email_content && (
                                        <div className="pt-2 border-t">
                                            <p className="text-xs text-muted-foreground mb-2">Aperçu email</p>
                                            <div className="bg-gray-50 p-3 rounded text-xs max-h-80 overflow-y-auto">
                                                <p className="font-semibold mb-1">{campaignLink.generated_email_subject}</p>
                                                <p className="whitespace-pre-wrap text-muted-foreground">{campaignLink.generated_email_content}</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* RIGHT COLUMN: DEEP SEARCH & DETAILS */}
                    <div className="lg:col-span-2 space-y-4">
                        <Tabs defaultValue="legal" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="legal">Identité & Juridique</TabsTrigger>
                                <TabsTrigger value="infos">Détails & Services</TabsTrigger>
                            </TabsList>

                            <TabsContent value="legal" className="mt-4">
                                <Card>
                                    <CardContent className="pt-6 space-y-6">
                                        {/* Deep Search Info Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="p-3 bg-muted/20 rounded-lg col-span-1 md:col-span-2">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Raison Sociale</span>
                                                <CopyButton text={deep.nom_raison_sociale} label="Raison Sociale" />
                                            </div>
                                            <div className="p-3 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Siret</span>
                                                <CopyButton text={deep.siret_siege} label="Siret" />
                                            </div>
                                            <div className="p-3 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Code NAF</span>
                                                <p className="font-mono text-sm">{deep.naf || "-"}</p>
                                            </div>
                                            <div className="p-3 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Création</span>
                                                <p className="text-sm">{deep.date_creation || "-"}</p>
                                            </div>
                                            <div className="p-3 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Effectif</span>
                                                <p className="font-medium flex items-center gap-1 text-sm">
                                                    <Users className="w-3 h-3 text-muted-foreground" />
                                                    {deep.effectif || "Non renseigné"}
                                                </p>
                                            </div>
                                            <div className="p-3 bg-muted/20 rounded-lg md:col-span-2">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Établissements</span>
                                                <div className="flex gap-4">
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Store className="w-3 h-3 text-muted-foreground" /> Total: {deep.nombre_etablissements || 1}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-sm text-green-600">
                                                        Ouverts: {deep.nombre_etablissements_ouverts || 1}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* AI Analysis */}
                                        {(deep.points_forts || deep.clients_cibles || deep.style_communication) && (
                                            <div className="p-4 rounded-lg border-primary/20 bg-primary/5 space-y-3">
                                                <h4 className="flex items-center gap-2 text-primary font-semibold text-sm">
                                                    <Sparkles className="w-4 h-4" /> Analyse IA
                                                </h4>
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    {deep.points_forts && (
                                                        <div className="space-y-2">
                                                            <span className="text-xs font-semibold text-muted-foreground uppercase">Points Forts</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {deep.points_forts.map((pt, i) => (
                                                                    <Badge key={i} variant="secondary" className="bg-background/80 text-xs">{pt}</Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="space-y-2">
                                                        {deep.style_communication && (
                                                            <div className="mb-2">
                                                                <span className="text-xs font-semibold text-muted-foreground uppercase">Ton</span>
                                                                <p className="text-sm italic">"{deep.style_communication}"</p>
                                                            </div>
                                                        )}
                                                        {deep.clients_cibles && (
                                                            <div>
                                                                <span className="text-xs font-semibold text-muted-foreground uppercase">Cible</span>
                                                                <p className="text-sm">{deep.clients_cibles}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Dirigeants */}
                                        {deep.dirigeants && deep.dirigeants.length > 0 && (
                                            <div className="pt-2">
                                                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                                                    <Briefcase className="w-4 h-4 text-primary" /> Dirigeants
                                                </h4>
                                                <div className="space-y-2">
                                                    {deep.dirigeants.map((d, i) => {
                                                        const age = calculateAge(d.date_de_naissance)
                                                        return (
                                                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md bg-muted/10 hover:bg-muted/20 transition-colors">
                                                                <div className="font-medium flex items-center gap-2 text-sm">
                                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                                    {d.prenoms} {d.nom}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground flex gap-2 items-center mt-2 sm:mt-0">
                                                                    <Badge variant="outline" className="bg-background text-xs">{d.qualite || "Dirigeant"}</Badge>
                                                                    {age && (
                                                                        <span className="text-xs border px-2 py-0.5 rounded-full bg-background">{age} ans</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="infos" className="mt-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        {scrapped["Infos"] ? Object.entries(scrapped["Infos"]).map(([category, items], idx) => (
                                            <div key={idx} className="mb-6 last:mb-0">
                                                <h4 className="font-semibold mb-3 pb-2 border-b text-sm">{category}</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {items.map((item, i) => {
                                                        const key = Object.keys(item)[0]
                                                        const val = item[key]
                                                        if (!val) return null
                                                        return (
                                                            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <CheckCircle2 className="w-4 h-4 text-green-500/70" /> {key}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 text-muted-foreground text-sm">Aucune information détaillée disponible.</div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* JSON Debug */}
                        <details className="group pt-4">
                            <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none">
                                <div className="p-2 border rounded group-open:bg-muted">🔍 Voir JSON complet</div>
                            </summary>
                            <div className="grid md:grid-cols-2 gap-4 mt-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-mono">Data Scrapping</span>
                                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-[300px] text-[10px]">{JSON.stringify(scrapped, null, 2)}</pre>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-mono">Deep Search</span>
                                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-[300px] text-[10px]">{JSON.stringify(deep, null, 2)}</pre>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
