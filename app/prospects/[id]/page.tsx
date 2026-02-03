"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    ArrowLeft, Building2, Mail, Phone, MapPin, Globe, User,
    Star, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, Users, Store,
    Briefcase, Copy, ChevronLeft, ChevronRight, Share2, Trash2, FileDown, Printer,
    Facebook, Instagram, Linkedin, Twitter, ChevronDown, Info, Zap, Loader2 as LoaderIcon
} from "lucide-react"
import { motion } from "framer-motion"
import { differenceInYears, isValid } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { AIButton } from "@/components/ui/ai-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmailGenerationModal } from "@/components/features/EmailGenerationModal"
import { toast } from "sonner"

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
    "effectif"?: string;
    "nombre_etablissements"?: number | string;
    "nombre_etablissements_ouverts"?: number | string;
    "dirigeants"?: Array<{
        nom?: string;
        prenoms?: string;
        qualite?: string;
        type_dirigeant?: string;
        date_de_naissance?: string;
    }>;
}

// Simple export CSV helper
const exportSingleToCSV = (data: any, filename: string) => {
    const rows = [
        ["Field", "Value"],
        ...Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v || "")])
    ];
    const csvContent = rows.map(e => e.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const calculateAge = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        if (!isValid(date)) return null;
        return differenceInYears(new Date(), date);
    } catch (e) { return null }
}

const formatHours = (hoursStr: string) => {
    return hoursStr.replace(/ to /g, ' - ').replace(/:/g, 'h');
}

// Social Icon Mapper
const getSocialIcon = (network: string) => {
    const n = network.toLowerCase()
    if (n.includes('facebook')) return <Facebook className="w-4 h-4 text-blue-600" />
    if (n.includes('instagram')) return <Instagram className="w-4 h-4 text-pink-600" />
    if (n.includes('linkedin')) return <Linkedin className="w-4 h-4 text-blue-700" />
    if (n.includes('twitter') || n.includes('x.com')) return <Twitter className="w-4 h-4 text-sky-500" />
    return <Globe className="w-4 h-4 text-gray-500" />
}

export default function ProspectPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const [prospect, setProspect] = useState<ScrapeProspect | null>(null)
    const [scrapped, setScrapped] = useState<ScrappedData>({})
    const [deep, setDeep] = useState<DeepSearchData>({})
    const [loading, setLoading] = useState(true)

    // Navigation State
    const [prevId, setPrevId] = useState<string | null>(null)
    const [nextId, setNextId] = useState<string | null>(null)

    // Modal State
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)

    // Deep Search State
    const [isLaunchingDeepSearch, setIsLaunchingDeepSearch] = useState(false)

    // --- NEW: Campaign Links State ---
    const [campaignLinks, setCampaignLinks] = useState<any[]>([])

    // --- DATA FETCHING ---
    const fetchProspectData = async (targetId: string) => {
        try {
            setLoading(true)
            const supabase = createClient()

            // 1. Fetch Prospect Core Data
            const { data: prospectData, error } = await supabase
                .from('scrape_prospect')
                .select('*')
                .eq('id_prospect', targetId)
                .single()

            if (error) throw error
            setProspect(prospectData)

            // 2. Parse Scrapped Data JSON
            let parsedScrapped: ScrappedData = {}
            if (prospectData.data) {
                if (typeof prospectData.data === 'string') {
                    try {
                        parsedScrapped = JSON.parse(prospectData.data)
                    } catch (e) {
                        console.error("Failed to parse prospect data", e)
                    }
                } else if (typeof prospectData.data === 'object') {
                    parsedScrapped = prospectData.data as ScrappedData
                }
            }
            setScrapped(parsedScrapped)

            // 3. Fetch Deep Search Data
            // Try fetch from dedicated table first
            const { data: deepRow } = await supabase
                .from('prospect_deep_search_data')
                .select('data')
                .eq('id_prospect', targetId)
                .single()

            let parsedDeep: DeepSearchData = {}

            // Priority 1: dedicated table
            if (deepRow && deepRow.data) {
                if (typeof deepRow.data === 'string') {
                    try {
                        parsedDeep = JSON.parse(deepRow.data)
                    } catch (e) { console.error("Failed to parse deep row", e) }
                } else {
                    parsedDeep = deepRow.data
                }
            }
            // Priority 2: column in scrape_prospect (fallback)
            else if (prospectData.deep_search) {
                if (typeof prospectData.deep_search === 'string') {
                    try {
                        parsedDeep = JSON.parse(prospectData.deep_search)
                    } catch (e) { console.error("Failed to parse deep column", e) }
                } else {
                    parsedDeep = prospectData.deep_search
                }
            }
            setDeep(parsedDeep)

            // 4. Navigation (previous/next)
            const { data: allIds } = await supabase
                .from('scrape_prospect')
                .select('id_prospect')
                .eq('campagne_id', prospectData.campagne_id) // Assuming context of same import campaign
                .order('created_at', { ascending: false })

            if (allIds) {
                const currentIndex = allIds.findIndex((x: { id_prospect: string }) => x.id_prospect === targetId)
                if (currentIndex !== -1) {
                    setPrevId(currentIndex < allIds.length - 1 ? allIds[currentIndex + 1].id_prospect : null)
                    setNextId(currentIndex > 0 ? allIds[currentIndex - 1].id_prospect : null)
                }
            }

        } catch (error) {
            console.error('Error fetching prospect:', error)
            toast.error("Impossible de charger le prospect")
        } finally {
            setLoading(false)
        }
    }

    // Fetch campaign links
    const fetchCampaignLinks = async (targetId: string) => {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('campaign_prospects')
            .select(`
                *,
                campaign:cold_email_campaigns (
                    id,
                    nom_campagne,
                    closing_phrase,
                    signature_name,
                    signature_title,
                    signature_company,
                    signature_phone,
                    signature_email,
                    signature_website_text,
                    signature_custom_link_text,
                    signature_ps
                )
            `)
            .eq('prospect_id', targetId)
            .order('created_at', { ascending: false })

        if (data) {
            setCampaignLinks(data)
        }
    }

    // Polling for updates if recently generated
    useEffect(() => {
        let interval: NodeJS.Timeout

        // Active polling if any link is pending or if we just launched a generation
        const needsPolling = campaignLinks.some(link => link.email_status === 'pending' || link.email_status === 'processing')

        if (needsPolling) {
            interval = setInterval(() => {
                fetchCampaignLinks(id)
            }, 5000)
        }

        return () => clearInterval(interval)
    }, [campaignLinks, id])

    useEffect(() => {
        fetchProspectData(id)
        fetchCampaignLinks(id)
    }, [id])

    // --- ACTIONS ---
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copié !")
    }

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer ce prospect ?")) return
        const supabase = createClient()
        const { error } = await supabase.from('scrape_prospect').delete().eq('id_prospect', id)
        if (!error) {
            toast.success("Prospect supprimé")
            router.back()
        } else {
            toast.error("Erreur lors de la suppression")
        }
    }

    const handleShare = () => {
        const url = window.location.href
        navigator.clipboard.writeText(url)
        toast.success("Lien copié !")
    }

    const handleExportCSV = () => {
        if (!prospect) return
        const flatData = {
            ...prospect,
            ...scrapped,
            ...deep
        }
        const safeName = (scrapped.Titre || deep.nom_raison_sociale || "prospect").replace(/\s/g, '_')
        exportSingleToCSV(flatData, `prospect_${safeName}.csv`)
    }

    const handlePrint = () => {
        window.print()
    }

    const handleLaunchDeepSearch = async () => {
        if (!prospect || isLaunchingDeepSearch) return

        try {
            setIsLaunchingDeepSearch(true)

            const response = await fetch('/api/prospects/deep-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds: [prospect.id_prospect] })
            })

            if (!response.ok) {
                const error = await response.json()
                if (response.status === 402) {
                    toast.error(`Crédits insuffisants : ${error.required} requis, ${error.available} disponibles`)
                } else {
                    toast.error(error.error || 'Erreur lors du lancement du Deep Search')
                }
                return
            }

            const result = await response.json()
            toast.success(
                `Deep Search lancé ! Le profil sera enrichi dans quelques instants.`,
                { duration: 5000 }
            )

            // Recharger le prospect après 10 secondes pour voir les résultats
            setTimeout(() => {
                fetchProspectData(id)
            }, 10000)

        } catch (error: any) {
            console.error('Error launching deep search:', error)
            toast.error('Erreur lors du lancement du Deep Search')
        } finally {
            setIsLaunchingDeepSearch(false)
        }
    }

    // --- DISPLAY VARS ---
    const companyName = scrapped.Titre || deep.nom_raison_sociale || "Société Inconnue";
    const category = scrapped["Nom de catégorie"] || "Secteur inconnu";
    const address = scrapped.Rue ? `${scrapped.Rue}, ${scrapped["Code postal"]} ${scrapped.Ville}` : (prospect?.ville || "Adresse inconnue");
    const rating = scrapped["Score total"];
    const reviewCount = scrapped["Nombre d'avis"];
    const mapsUrl = scrapped["URL Google Maps"];
    const website = scrapped["Site web"] || (deep.socials?.instagram || deep.socials?.facebook);

    // Email Status Logic
    let emailStatus = 'inconnu';
    let emailStatusLabel = 'Inconnu';

    if (prospect?.check_email_tentative?.toLowerCase().includes("pas de domaine")) {
        emailStatus = 'pas_domaine';
        emailStatusLabel = 'Pas de domaine';
    } else if (prospect?.succed_validation_smtp_email === true) {
        emailStatus = 'valide';
        emailStatusLabel = 'Check Email Réussi';
    } else if (prospect?.succed_validation_smtp_email === false) {
        emailStatus = 'echec';
        emailStatusLabel = 'Check Email Échoué';
    } else if (prospect?.check_email === false) {
        emailStatus = 'non_verifie';
        emailStatusLabel = 'Non Vérifié';
    }

    const displayEmail = (prospect?.email_adresse_verified && prospect?.email_adresse_verified.length > 0)
        ? (Array.isArray(prospect.email_adresse_verified) ? prospect.email_adresse_verified[0] : prospect.email_adresse_verified)
        : (scrapped.Email || (deep.emails && deep.emails[0]));

    const renderEmailBadge = () => {
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
        const hasDeepData = deep && (Object.keys(deep).length > 0);
        if (hasDeepData) {
            return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1"><Sparkles className="w-3 h-3" /> Deep Search</Badge>
        }
        return <Badge variant="outline" className="text-muted-foreground bg-muted/50">Sans Deep Search</Badge>
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
                            {/* Visual Feedback on Click */}
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

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                    <div className="flex items-center justify-between px-6 py-3">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => router.back()} title="Retour Liste">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <Separator orientation="vertical" className="h-6" />
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline" size="icon" className="h-8 w-8"
                                    disabled={!prevId}
                                    onClick={() => prevId && router.push(`/prospects/${prevId}`)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline" size="icon" className="h-8 w-8"
                                    disabled={!nextId}
                                    onClick={() => nextId && router.push(`/prospects/${nextId}`)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Bouton Deep Search si pas encore fait */}
                            {!deep || Object.keys(deep).length === 0 ? (
                                <AIButton
                                    onClick={handleLaunchDeepSearch}
                                    disabled={isLaunchingDeepSearch}
                                    loading={isLaunchingDeepSearch}
                                    variant="primary"
                                    className="gap-2"
                                >
                                    {isLaunchingDeepSearch ? (
                                        "Lancement en cours..."
                                    ) : (
                                        <span>Lancer Deep Search</span>
                                    )}
                                </AIButton>
                            ) : null}

                            <Button
                                variant="default"
                                onClick={() => setIsEmailModalOpen(true)}
                                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20"
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                Générer Email
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">Actions <ChevronDown className="ml-2 h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleShare}>
                                        <Share2 className="mr-2 h-4 w-4" /> Partager lien
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportCSV}>
                                        <FileDown className="mr-2 h-4 w-4" /> Exporter CSV
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handlePrint}>
                                        <Printer className="mr-2 h-4 w-4" /> Imprimer
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center no-print">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{companyName}</h1>
                                    {renderDeepScanBadge()}
                                </div>
                                <div className="flex items-center gap-4 text-muted-foreground ml-1">
                                    <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {category}</span>
                                    {rating && (
                                        <span className="flex items-center gap-1 text-amber-500 font-medium">
                                            <Star className="w-4 h-4 fill-current" /> {rating} <span className="text-muted-foreground font-normal">({reviewCount})</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {mapsUrl && (
                                    <Button variant="outline" size="sm" asChild className="hidden md:flex">
                                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                                            <MapPin className="mr-2 h-4 w-4" /> Voir sur Maps
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* GENERATED EMAILS / CAMPAIGNS SECTION (NEW) */}
                        {campaignLinks.length > 0 && (
                            <Card className="border-indigo-100 bg-indigo-50/30">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2 text-indigo-900">
                                        <Mail className="w-4 h-4 text-indigo-600" /> Emails Générés & Campagnes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {campaignLinks.map((link) => (
                                        <div key={link.id} className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                                    Campagne: {link.campaign?.nom_campagne || "Inconnue"}
                                                </Badge>
                                                <Badge
                                                    variant={link.email_status === 'generated' ? 'default' : 'secondary'}
                                                    className={link.email_status === 'generated' ? 'bg-green-600' : ''}
                                                >
                                                    {link.email_status === 'generated' ? 'Généré' : link.email_status === 'sent' ? 'Envoyé' : 'En cours...'}
                                                </Badge>
                                            </div>

                                            {link.email_status === 'generated' && link.generated_email_content ? (
                                                <div className="space-y-4">
                                                    <p className="text-xs font-semibold border-b pb-2">{link.generated_email_subject}</p>

                                                    {/* Email Content Body */}
                                                    <div
                                                        className="text-xs text-muted-foreground bg-gray-50 p-3 rounded border space-y-4"
                                                    >
                                                        {/* Main Content (HTML rendered) */}
                                                        <div dangerouslySetInnerHTML={{ __html: link.generated_email_content }} />

                                                        {/* Signature Block */}
                                                        <div className="pt-4 border-t border-gray-200 mt-4">
                                                            <p className="mb-2">{link.campaign?.closing_phrase || "Cordialement,"}</p>

                                                            <div className="font-medium text-gray-900">
                                                                {link.campaign?.signature_name || "L'équipe"}
                                                            </div>
                                                            {link.campaign?.signature_title && (
                                                                <div className="text-gray-600">{link.campaign.signature_title}</div>
                                                            )}
                                                            {link.campaign?.signature_company && (
                                                                <div className="font-semibold text-indigo-700">{link.campaign.signature_company}</div>
                                                            )}

                                                            <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                                                                {link.campaign?.signature_email && (
                                                                    <div>{link.campaign.signature_email}</div>
                                                                )}
                                                                {link.campaign?.signature_phone && (
                                                                    <div>{link.campaign.signature_phone}</div>
                                                                )}
                                                                {link.campaign?.signature_website_text && (
                                                                    <div>{link.campaign.signature_website_text}</div>
                                                                )}
                                                            </div>

                                                            {link.campaign?.signature_ps && (
                                                                <div className="mt-3 text-xs italic text-gray-500">
                                                                    PS: {link.campaign.signature_ps}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => {
                                                        // Fallback alert for raw content if needed, or better: open a modal
                                                        alert("Contenu brut pour vérification:\n" + link.generated_email_content)
                                                    }}>
                                                        Voir brut (Debug)
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                                    <LoaderIcon className="w-3 h-3 animate-spin" /> Génération en cours...
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* LEFT COLUMN: CONTACT */}
                            <div className="space-y-6 lg:col-span-1">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Coordonnées</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {/* Email */}
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
                                                        <Button key={net} variant="outline" size="icon" asChild title={net} className="h-10 w-10">
                                                            <a href={link} target="_blank" rel="noopener noreferrer" className="capitalize">
                                                                {getSocialIcon(net)}
                                                            </a>
                                                        </Button>
                                                    ))}
                                                    {website && (
                                                        <Button variant="outline" size="icon" asChild title="Site Web" className="h-10 w-10">
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

                            {/* RIGHT COLUMN: DEEP SEARCH ETC */}
                            <div className="lg:col-span-2 space-y-6">
                                <Tabs defaultValue="legal" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 lg:w-[400px] no-print">
                                        <TabsTrigger value="legal">Identité & Juridique</TabsTrigger>
                                        <TabsTrigger value="infos">Détails & Services</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="legal" className="mt-4">
                                        <Card>
                                            <CardContent className="pt-6 space-y-6">
                                                {/* Deep Search Info Grid */}
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

                                                {/* AI Analysis */}
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

                                                {/* Dirigeants */}
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

                                {/* JSON Debug */}
                                <div className="pt-8 no-print">
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
                </main>
            </div>

            {prospect && (
                <EmailGenerationModal
                    open={isEmailModalOpen}
                    onOpenChange={setIsEmailModalOpen}
                    prospect={prospect}
                    onSuccess={(jobId) => {
                        toast.success("Job de génération email lancé : " + jobId)
                        // Trigger immediate refresh then let polling handle it
                        setTimeout(() => fetchCampaignLinks(prospect.id_prospect), 1000)
                    }}
                />
            )}
        </div>
    )
}
