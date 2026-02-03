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
import { ScrapeProspect, CampaignProspectLink, Campaign } from "@/types"
import { Button } from "@/components/ui/button"
import { AIButton } from "@/components/ui/ai-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
    "telephone"?: string;
    "Phone"?: string;
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
            if (prospectData.data_scrapping) {
                if (typeof prospectData.data_scrapping === 'string') {
                    try {
                        parsedScrapped = JSON.parse(prospectData.data_scrapping)
                    } catch (e) {
                        console.error("Failed to parse prospect data", e)
                    }
                } else if (typeof prospectData.data_scrapping === 'object') {
                    parsedScrapped = prospectData.data_scrapping as ScrappedData
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
        try {
            const supabase = createClient()

            // 1. Get links first (no complex join to avoid errors)
            const { data: links, error: linkError } = await supabase
                .from('campaign_prospects')
                .select('*')
                .eq('prospect_id', targetId)
                .order('created_at', { ascending: false })

            if (linkError) {
                console.error("Link error:", linkError)
                return
            }

            if (!links || links.length === 0) {
                setCampaignLinks([])
                return
            }

            // 2. Get campaigns details manually
            const campaignIds = Array.from(new Set((links as CampaignProspectLink[]).map((l: CampaignProspectLink) => l.campaign_id)))
            const { data: campaigns, error: campError } = await supabase
                .from('cold_email_campaigns')
                .select('*')
                .in('id', campaignIds)

            if (campError) console.error("Campaign error:", campError)

            // 3. Merge data
            const enriched = (links as CampaignProspectLink[]).map((link: CampaignProspectLink) => ({
                ...link,
                campaign: (campaigns as Campaign[])?.find((c: Campaign) => c.id === link.campaign_id)
            }))

            setCampaignLinks(enriched)
        } catch (e) {
            console.error("Error in fetchCampaignLinks", e)
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

    // --- DATA HELPERS ---
    const getPhoneNumber = () => {
        // 1. Direct checks (case insensitive for safety)
        if (scrapped["Téléphone"]) return scrapped["Téléphone"]
        if (scrapped["telephone"]) return scrapped["telephone"]
        if ((scrapped as any)["Phone"]) return (scrapped as any)["Phone"]
        if ((scrapped as any)["phone"]) return (scrapped as any)["phone"]
        if ((scrapped as any)["Tel"]) return (scrapped as any)["Tel"]

        // 2. Check in Infos array (recursive deep search)
        if (scrapped["Infos"]) {
            for (const key in scrapped["Infos"]) {
                const items = scrapped["Infos"][key]
                if (Array.isArray(items)) {
                    // Look for key containing "téléphone" or "phone" or "mobile"
                    const phoneItem = items.find(i => {
                        const k = Object.keys(i)[0]?.toLowerCase() || ""
                        return k.includes("téléphone") || k.includes("telephone") || k.includes("phone") || k.includes("mobile")
                    })
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
                            {/* Visual Feedback on Click */}
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
                            {/* Bouton Générer Email (Masqué si déjà généré) */}
                            {!campaignLinks.some(l => l.email_status === 'generated' || l.email_status === 'sent') && (
                                <Button
                                    variant="default"
                                    onClick={() => setIsEmailModalOpen(true)}
                                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20"
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Générer Email
                                </Button>
                            )}

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

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* LEFT COLUMN: CONTACT */}
                            <div className="space-y-6 lg:col-span-4 h-fit">
                                <Card className="border-l-4 border-l-primary/50 shadow-sm">
                                    <CardHeader className="pb-3">
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
                                                <div className="flex gap-3 justify-center flex-wrap">
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
                            <div className="lg:col-span-8 space-y-6">
                                {/* 1. Deep Search Info Grid */}
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
                            </div>
                        </div>

                        {/* GENERATED EMAILS / CAMPAIGNS SECTION (NEW) */}
                        {campaignLinks.length > 0 && (
                            <Card className="border-indigo-100 bg-indigo-50/30 lg:col-span-12">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2 text-indigo-900">
                                        <Mail className="w-4 h-4 text-indigo-600" /> Emails Générés & Campagnes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 flex flex-col gap-0 divide-y divide-indigo-100">
                                    {campaignLinks.map((link) => (
                                        <div key={link.id} className="bg-white">
                                            {/* Campaign Header & Actions */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-indigo-50/50 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200 shadow-sm">
                                                        Campagne: {link.campaign?.nom_campagne || "Inconnue"}
                                                    </Badge>
                                                    <Badge
                                                        variant={link.email_status === 'generated' ? 'default' : 'secondary'}
                                                        className={link.email_status === 'generated' ? 'bg-green-600 shadow-sm' : ''}
                                                    >
                                                        {link.email_status === 'generated' ? 'Généré' : link.email_status === 'sent' ? 'Envoyé' : 'En cours...'}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Generate / Regenerate Action */}
                                                    {(link.email_status === 'not_generated' || link.email_status === 'generated') && (
                                                        <Button
                                                            variant={link.email_status === 'generated' ? "ghost" : "default"}
                                                            size="sm"
                                                            onClick={() => setIsEmailModalOpen(true)}
                                                            className={link.email_status === 'not_generated' ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"}
                                                        >
                                                            <Sparkles className="w-3 h-3 mr-2" />
                                                            {link.email_status === 'generated' ? "Régénérer" : "Générer l'email"}
                                                        </Button>
                                                    )}

                                                    {/* SEND Action */}
                                                    {link.email_status === 'generated' && (
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={async () => {
                                                                try {
                                                                    const response = await fetch(`/api/campaigns/${link.campaign_id}/send-email`, {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ prospectIds: [id] })
                                                                    })
                                                                    if (!response.ok) throw new Error('Erreur envoi')
                                                                    const res = await response.json()
                                                                    toast.success("Email envoyé avec succès !")
                                                                    fetchCampaignLinks(id)
                                                                } catch (e) {
                                                                    toast.error("Erreur lors de l'envoi de l'email")
                                                                }
                                                            }}
                                                            className="bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all hover:scale-105"
                                                        >
                                                            <Zap className="w-3 h-3 mr-2 fill-current" /> Envoyer maintenant
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Content Body */}
                                            <div className="p-6">
                                                {link.email_status === 'generated' && link.generated_email_content ? (
                                                    <div className="max-w-4xl mx-auto border rounded-xl shadow-sm overflow-hidden bg-gray-50/50">
                                                        <div className="border-b bg-white p-4">
                                                            <p className="text-sm font-medium text-gray-500 mb-1">Objet</p>
                                                            <p className="font-semibold text-lg text-gray-900">{link.generated_email_subject}</p>
                                                        </div>
                                                        <div className="p-6 md:p-8 bg-white min-h-[300px]">
                                                            <div dangerouslySetInnerHTML={{ __html: link.generated_email_content }} className="prose prose-indigo max-w-none" />

                                                            {/* Signature Preview */}
                                                            <div className="mt-8 pt-6 border-t border-gray-100">
                                                                <p className="mb-4 text-gray-700">{link.campaign?.closing_phrase || "Cordialement,"}</p>
                                                                <div>
                                                                    <p className="font-bold text-gray-900">{link.campaign?.signature_name || "L'équipe"}</p>
                                                                    {link.campaign?.signature_title && <p className="text-gray-600 text-sm">{link.campaign.signature_title}</p>}
                                                                    {link.campaign?.signature_company && <p className="text-indigo-600 font-medium text-sm mt-0.5">{link.campaign.signature_company}</p>}

                                                                    <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                                                                        {link.campaign?.signature_email && <p>{link.campaign.signature_email}</p>}
                                                                        {link.campaign?.signature_phone && <p>{link.campaign.signature_phone}</p>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="py-12 text-center text-muted-foreground bg-gray-50/50 rounded-lg border border-dashed flex flex-col items-center justify-center gap-3">
                                                        {link.email_status === 'not_generated' ? (
                                                            <>
                                                                <Sparkles className="w-8 h-8 text-indigo-200" />
                                                                <p>Aucun email généré pour cette campagne.</p>
                                                                <Button variant="outline" onClick={() => setIsEmailModalOpen(true)}>Générer maintenant</Button>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <LoaderIcon className="w-4 h-4 animate-spin" /> Chargement...
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                    </div>
                    {/* Add Email Generation Modal */}
                    {prospect && (
                        <EmailGenerationModal
                            open={isEmailModalOpen}
                            onOpenChange={setIsEmailModalOpen}
                            prospect={prospect}
                            onSuccess={(jobId) => {
                                fetchCampaignLinks(id)
                                toast.success("Génération d'email lancée !")
                            }}
                        />
                    )}
                </main>
            </div>
        </div>
    )
}
