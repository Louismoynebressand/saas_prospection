"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    ArrowLeft, Building2, Mail, Phone, MapPin, Globe, ExternalLink, User,
    Star, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, Tag, Users, Music, Info, Briefcase, Copy, Store
} from "lucide-react"
import { differenceInYears, parseISO, isValid } from "date-fns"
import { supabase } from "@/lib/supabase"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// --- TYPES ---
interface ScrappedData {
    "Nom de catégorie"?: string;
    "URL Google Maps"?: string;
    "Titre"?: string;
    "Rue"?: string;
    "Ville"?: string;
    "Code postal"?: string;
    "Email"?: string | null;
    "Site web"?: string;
    "Téléphone"?: string;
    "Score total"?: number;
    "Nombre d'avis"?: number;
    "Heures d'ouverture"?: Array<{ day: string; hours: string }>;
    "Infos"?: Record<string, Array<Record<string, boolean>>>;
}

interface DeepSearchData {
    "points_forts"?: string[];
    "actualites_recents"?: string[];
    "style_communication"?: string;
    "offres_principales"?: string[];
    "clients_cibles"?: string;
    "emails"?: string[];
    "socials"?: Record<string, string>;
    "siret_siege"?: string;
    "nom_complet"?: string;
    "nom_raison_sociale"?: string;
    "naf"?: string;
    "date_creation"?: string;
    // Stats
    "effectif"?: string;
    "nombre_etablissements"?: number | string;
    "nombre_etablissements_ouverts"?: number | string;
    "dirigeants"?: Array<{
        nom?: string;
        prenoms?: string;
        qualite?: string;
        type_dirigeant?: string;
        date_de_naissance?: string; // Format YYYY-MM
    }>;
}

export default function ProspectPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const [prospect, setProspect] = useState<ScrapeProspect | null>(null)
    const [scrapped, setScrapped] = useState<ScrappedData>({})
    const [deep, setDeep] = useState<DeepSearchData>({})
    const [loading, setLoading] = useState(true)

    const safeParse = (data: any) => {
        if (!data) return {}
        if (typeof data === 'string') {
            try { return JSON.parse(data) } catch (e) { console.error("Parse Error", e); return {} }
        }
        return data
    }

    useEffect(() => {
        const fetchProspect = async () => {
            const { data, error } = await supabase
                .from('scrape_prospect')
                .select('*')
                .eq('id_prospect', id)
                .single()

            if (data) {
                setProspect(data as ScrapeProspect)
                setScrapped(safeParse(data.data_scrapping))
                setDeep(safeParse(data.deep_search))
            }
            setLoading(false)
        }

        fetchProspect()
    }, [id])

    // Use TooltipProvider at root of component tree part
    const CopyButton = ({ text, label }: { text: string | undefined | null, label: string }) => {
        const [copied, setCopied] = useState(false)

        if (!text) return <span className="text-muted-foreground">-</span>

        const handleCopy = (e: React.MouseEvent) => {
            e.stopPropagation()
            navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }

        return (
            <TooltipProvider>
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <div
                            className="flex items-center gap-2 cursor-pointer group hover:bg-muted/50 p-1 -ml-1 rounded transition-colors"
                            onClick={handleCopy}
                        >
                            <span className="truncate">{text}</span>
                            <Copy className={`h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${copied ? 'text-green-500' : ''}`} />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{copied ? "Copié !" : "Cliquer pour copier"}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    if (loading) {
        return <div className="p-8 space-y-4 max-w-7xl mx-auto">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    }

    if (!prospect) {
        return (
            <div className="p-8 text-center h-[50vh] flex flex-col items-center justify-center">
                <h2 className="text-xl font-semibold mb-4">Prospect non trouvé</h2>
                <Button variant="outline" onClick={() => router.back()}>Retour à la liste</Button>
            </div>
        )
    }

    // --- LOGIC & DISPLAYS ---
    const companyName = scrapped.Titre || deep.nom_raison_sociale || "Société Inconnue";
    const category = scrapped["Nom de catégorie"] || "Secteur inconnu";
    const address = scrapped.Rue ? `${scrapped.Rue}, ${scrapped["Code postal"]} ${scrapped.Ville}` : (prospect.ville || "Adresse inconnue");
    const rating = scrapped["Score total"];
    const reviewCount = scrapped["Nombre d'avis"];
    const mapsUrl = scrapped["URL Google Maps"];
    const website = scrapped["Site web"] || (deep.socials?.instagram || deep.socials?.facebook);

    // Email Status Logic
    let emailStatus = 'inconnu'; // Default
    let emailStatusLabel = 'Inconnu';

    // Check specific "tentative" messages first if present
    if (prospect.check_email_tentative?.toLowerCase().includes("pas de domaine")) {
        emailStatus = 'pas_domaine';
        emailStatusLabel = 'Pas de domaine';
    } else if (prospect.succed_validation_smtp_email === true) {
        emailStatus = 'valide';
        emailStatusLabel = 'Check Email Réussi';
    } else if (prospect.succed_validation_smtp_email === false) {
        emailStatus = 'echec';
        emailStatusLabel = 'Check Email Échoué';
    } else if (prospect.check_email === false) {
        // Explicitly marked as not checked (or skipped)
        emailStatus = 'non_verifie';
        emailStatusLabel = 'Non Vérifié';
    }

    const displayEmail = (prospect.email_adresse_verified && prospect.email_adresse_verified.length > 0)
        ? (Array.isArray(prospect.email_adresse_verified) ? prospect.email_adresse_verified[0] : prospect.email_adresse_verified)
        : (scrapped.Email || (deep.emails && deep.emails[0]));

    const renderEmailBadge = () => {
        // If no email found at all
        if (!displayEmail) {
            if (emailStatus === 'pas_domaine') {
                return <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">Pas de domaine</Badge>
            }
            return <Badge variant="secondary" className="text-muted-foreground">Aucun email (Checké)</Badge>
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
        // Simple heuristic: if we have deep_search data (like siret or points_forts), deep scan ran.
        // Or check `prospect.deep_search` is not empty object.
        const hasDeepData = deep && (Object.keys(deep).length > 0);
        if (hasDeepData) {
            return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1"><Sparkles className="w-3 h-3" /> Deep Search</Badge>
        }
        return <Badge variant="outline" className="text-muted-foreground bg-muted/50">Sans Deep Search</Badge>
    }

    // Helper for hours
    const formatHours = (hoursStr: string) => {
        return hoursStr.replace(/ to /g, ' - ').replace(/:/g, 'h');
    }

    // Age Helper
    const calculateAge = (dateStr?: string) => {
        if (!dateStr) return null;
        // Handle YYYY-MM
        try {
            const date = new Date(dateStr);
            if (!isValid(date)) return null;
            return differenceInYears(new Date(), date);
        } catch (e) { return null }
    }

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-black/10">
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">

                {/* --- HEADER --- */}
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2 -ml-2">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">{companyName}</h1>
                            {renderDeepScanBadge()}
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground ml-11">
                            <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {category}</span>
                            {rating && (
                                <span className="flex items-center gap-1 text-amber-500 font-medium">
                                    <Star className="w-4 h-4 fill-current" /> {rating} <span className="text-muted-foreground font-normal">({reviewCount})</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 ml-11 md:ml-0">
                        {/* Actions would go here */}
                        {mapsUrl && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                                    <MapPin className="mr-2 h-4 w-4" /> Voir sur Maps
                                </a>
                            </Button>
                        )}
                        {website && (
                            <Button size="sm" asChild>
                                <a href={website} target="_blank" rel="noopener noreferrer">
                                    <Globe className="mr-2 h-4 w-4" /> Site Web
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                {/* --- MAIN GRID --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN: CONTACT & IDENTITY */}
                    <div className="space-y-6 lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Coordonnées</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Email Block */}
                                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</span>
                                        {renderEmailBadge()}
                                    </div>
                                    <div className="flex items-center gap-2 font-medium overflow-hidden">
                                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <CopyButton text={displayEmail} label="Email" />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Téléphone</span>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <CopyButton text={scrapped["Téléphone"]} label="Téléphone" />
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adresse</span>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                                        <CopyButton text={address} label="Adresse" />
                                    </div>
                                </div>

                                {/* Socials */}
                                {deep.socials && Object.keys(deep.socials).length > 0 && (
                                    <div className="pt-4 border-t">
                                        <div className="flex gap-3 justify-center">
                                            {Object.entries(deep.socials).map(([net, link]) => link && (
                                                <Button key={net} variant="outline" size="icon" asChild title={net}>
                                                    <a href={link} target="_blank" rel="noopener noreferrer" className="capitalize">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Opening Hours */}
                        {scrapped["Heures d'ouverture"] && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Horaires</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm">
                                    <ul className="space-y-1">
                                        {scrapped["Heures d'ouverture"].map((day, idx) => (
                                            <li key={idx} className="flex justify-between py-1 border-b last:border-0 border-dashed border-gray-100">
                                                <span className="font-medium capitalize">{day.day}</span>
                                                <span className="text-muted-foreground">{formatHours(day.hours)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* CENTER & RIGHT: DETAILS & AI INSIGHTS */}
                    <div className="lg:col-span-2 space-y-6">

                        <Tabs defaultValue="legal" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                                <TabsTrigger value="legal">Identité & Juridique</TabsTrigger>
                                <TabsTrigger value="infos">Détails & Services</TabsTrigger>
                            </TabsList>

                            <TabsContent value="legal" className="mt-4">
                                <Card>
                                    <CardContent className="pt-6 space-y-6">
                                        {/* Company Legal Info Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="p-4 bg-muted/20 rounded-lg col-span-1 md:col-span-2">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Raison Sociale</span>
                                                <CopyButton text={deep.nom_raison_sociale} label="Raison Sociale" />
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Siret</span>
                                                <CopyButton text={deep.siret_siege} label="Siret" />
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Code NAF</span>
                                                <p className="font-mono">{deep.naf || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Création</span>
                                                <p>{deep.date_creation || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase block mb-1">Effectif</span>
                                                <p className="font-medium flex items-center gap-1">
                                                    <Users className="w-3 h-3 text-muted-foreground" />
                                                    {deep.effectif || "Non renseigné"}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg md:col-span-2">
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

                                        {/* Dirigeants Section */}
                                        {deep.dirigeants && deep.dirigeants.length > 0 && (
                                            <div className="pt-2">
                                                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                                                    <Briefcase className="w-4 h-4 text-primary" /> Dirigeants
                                                </h4>
                                                <div className="space-y-2">
                                                    {deep.dirigeants.map((d, i) => {
                                                        const age = calculateAge(d.date_de_naissance);
                                                        return (
                                                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md bg-muted/10 hover:bg-muted/20 transition-colors">
                                                                <div className="font-medium flex items-center gap-2">
                                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                                    {d.prenoms} {d.nom}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground flex gap-2 items-center mt-2 sm:mt-0">
                                                                    <Badge variant="outline" className="bg-background">{d.qualite || "Dirigeant"}</Badge>
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
                                        {/* Deep Search Highlights */}
                                        {(deep.points_forts || deep.clients_cibles || deep.style_communication) && (
                                            <div className="mb-6 p-4 rounded-lg border-primary/20 bg-primary/5 space-y-4">
                                                <h4 className="flex items-center gap-2 text-primary font-semibold">
                                                    <Sparkles className="w-4 h-4" /> Analyse IA
                                                </h4>
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    {deep.points_forts && (
                                                        <div className="space-y-2">
                                                            <span className="text-xs font-semibold text-muted-foreground uppercase">Points Forts</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {deep.points_forts.map((pt, i) => (
                                                                    <Badge key={i} variant="secondary" className="bg-background/80">{pt}</Badge>
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

                                        {scrapped["Infos"] ? Object.entries(scrapped["Infos"]).map(([category, items], idx) => (
                                            <div key={idx} className="mb-6 last:mb-0">
                                                <h4 className="font-semibold mb-3 pb-2 border-b">{category}</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {items.map((item, i) => {
                                                        const key = Object.keys(item)[0];
                                                        const val = item[key];
                                                        if (!val) return null;
                                                        return (
                                                            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <CheckCircle2 className="w-4 h-4 text-green-500/70" /> {key}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 text-muted-foreground">Aucune information détaillée disponible.</div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* Raw Data */}
                        <div className="pt-8">
                            <Separator className="mb-4" />
                            <details className="group">
                                <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none">
                                    <div className="p-1 border rounded group-open:bg-muted">JSON Debug</div>
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
                </div>
            </div>
        </div>
    )
}
