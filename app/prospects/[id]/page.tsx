"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    ArrowLeft, Building2, Mail, Phone, MapPin, Globe, ExternalLink, User,
    Star, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, Tag, Users, Music
} from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    "Infos"?: Record<string, Array<Record<string, boolean>>>; // e.g., "Services": [{"Terrasse": true}]
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
    "dirigeants"?: any;
}

export default function ProspectPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const [prospect, setProspect] = useState<ScrapeProspect | null>(null)
    const [scrapped, setScrapped] = useState<ScrappedData>({})
    const [deep, setDeep] = useState<DeepSearchData>({})
    const [loading, setLoading] = useState(true)

    // Helper to safely parse JSON or return object if already parsed
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
    const website = scrapped["Site web"] || (deep.socials?.instagram || deep.socials?.facebook); // Fallback to social if no site

    // Email Status Logic
    const emailStatus = prospect.succed_validation_smtp_email === true ? 'valide' :
        prospect.succed_validation_smtp_email === false ? 'invalide' : 'inconnu';

    // Determine which email to show (verified takes precedence)
    const displayEmail = (prospect.email_adresse_verified && prospect.email_adresse_verified.length > 0)
        ? prospect.email_adresse_verified[0] // Assuming text or array, take first if array
        : (scrapped.Email || (deep.emails && deep.emails[0]));

    const renderEmailBadge = () => {
        if (!displayEmail) return <span className="text-sm text-muted-foreground italic">Aucun email</span>;

        switch (emailStatus) {
            case 'valide':
                return <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1"><CheckCircle2 className="w-3 h-3" /> Vérifié</Badge>
            case 'invalide':
                return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Invalide</Badge>
            default:
                return <Badge variant="secondary" className="gap-1"><AlertCircle className="w-3 h-3" /> Non testé</Badge>
        }
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
                    <div className="space-y-8 lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Coordonnées</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Email Block */}
                                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</span>
                                        {renderEmailBadge()}
                                    </div>
                                    <div className="flex items-center gap-2 font-medium truncate">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        {displayEmail || "-"}
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Téléphone</span>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        {scrapped["Téléphone"] || "-"}
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adresse</span>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                                        <span className="text-sm">{address}</span>
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
                                                <span className="text-muted-foreground">{day.hours}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* CENTER & RIGHT: DETAILS & AI INSIGHTS */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Deep Search Highlights */}
                        {(deep.points_forts || deep.clients_cibles || deep.style_communication) && (
                            <Card className="border-primary/20 bg-primary/5">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-primary">
                                        <Sparkles className="w-5 h-5" /> Analyse IA & Highlights
                                    </CardTitle>
                                    <CardDescription>Informations extraites par analyse approfondie (Deep Search)</CardDescription>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-6">
                                    {deep.points_forts && (
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-sm flex items-center gap-1"><Tag className="w-3 h-3" /> Points Forts</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {deep.points_forts.map((pt, i) => (
                                                    <Badge key={i} variant="outline" className="bg-background">{pt}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {deep.clients_cibles && (
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-sm flex items-center gap-1"><Users className="w-3 h-3" /> Cible</h4>
                                                <p className="text-sm text-muted-foreground">{deep.clients_cibles}</p>
                                            </div>
                                        )}
                                        {deep.style_communication && (
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-sm">Communication</h4>
                                                <p className="text-sm text-muted-foreground italic">"{deep.style_communication}"</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Tabs defaultValue="infos" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                                <TabsTrigger value="infos">Détails & Services</TabsTrigger>
                                <TabsTrigger value="legal">Juridique</TabsTrigger>
                            </TabsList>

                            <TabsContent value="infos" className="mt-4">
                                <Card>
                                    <CardContent className="pt-6">
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

                            <TabsContent value="legal" className="mt-4">
                                <Card>
                                    <CardContent className="pt-6 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase">Raison Sociale</span>
                                                <p className="font-medium">{deep.nom_raison_sociale || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase">Siret</span>
                                                <p className="font-mono">{deep.siret_siege || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase">Code NAF</span>
                                                <p className="font-mono">{deep.naf || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-muted/20 rounded-lg">
                                                <span className="text-xs text-muted-foreground uppercase">Date de création</span>
                                                <p>{deep.date_creation || "-"}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* Raw Data Accordion (Kept for debug but collapsed/discreet) */}
                        <div className="pt-8">
                            <Separator className="mb-4" />
                            <details className="text-xs text-muted-foreground cursor-pointer">
                                <summary className="hover:text-primary transition-colors">Voir les données JSON brutes (Debug)</summary>
                                <div className="grid md:grid-cols-2 gap-4 mt-4">
                                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-[300px]">{JSON.stringify(scrapped, null, 2)}</pre>
                                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-[300px]">{JSON.stringify(deep, null, 2)}</pre>
                                </div>
                            </details>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
