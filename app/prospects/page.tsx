"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    Search, Filter, Columns, Download, Upload, Building2, Mail, Phone, MapPin, Calendar, Loader2, Zap, CheckSquare, Sparkles, Square, ExternalLink, Star, UserPlus, Bell
} from "lucide-react"
import { motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/client"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { AIButton } from "@/components/ui/ai-button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"

export default function ProspectsPage() {
    const router = useRouter()
    const [prospects, setProspects] = useState<ScrapeProspect[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    // Multi-category filter (changed from single to multiple)
    const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set())
    const [filterHasEmail, setFilterHasEmail] = useState(false)
    const [filterHasPhone, setFilterHasPhone] = useState(false)
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
    const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({ from: undefined, to: undefined })

    // Selection mode toggle
    const [selectionMode, setSelectionMode] = useState(false)

    const [visibleColumns, setVisibleColumns] = useState({
        company: true,
        category: true,
        contact: true,
        phone: true,
        city: true,
        deep: true,
        date: true,
        website: false,
        linkedin: false,
        address: false,
        rating: false,
        siret: false,
        sector: false,
        emailStatus: false,
    })

    // Batch Deep Search
    const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set())
    const [isLaunchingBatch, setIsLaunchingBatch] = useState(false)

    const fetchAllProspects = async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                console.error('No authenticated user found')
                setLoading(false)
                return
            }

            // Try full query with rappel columns first
            const { data, error } = await supabase
                .from('scrape_prospect')
                .select(`
                    id_prospect, id_jobs, id_user, created_at,
                    data_scrapping, deep_search, email_adresse_verified,
                    ville, secteur, rappel_date, rappel_notes, crm_status
                `)
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })

            if (!error && data) {
                setProspects(data as ScrapeProspect[])
                return
            }

            // Fallback: rappel columns probably don't exist yet — retry without them
            console.warn('Full query failed, retrying without rappel columns:', error?.message)
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('scrape_prospect')
                .select(`
                    id_prospect, id_jobs, id_user, created_at,
                    data_scrapping, deep_search, email_adresse_verified,
                    ville, secteur
                `)
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })

            if (fallbackError) throw fallbackError
            if (fallbackData) setProspects(fallbackData as ScrapeProspect[])
        } catch (error) {
            console.error('Error fetching prospects:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAllProspects()
    }, [])

    const safeParse = (data: any) => {
        if (!data) return {}
        if (typeof data === 'string') {
            try { return JSON.parse(data) } catch (e) { return {} }
        }
        return data
    }

    const toggleProspect = (id: string) => {
        const newSet = new Set(selectedProspects)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedProspects(newSet)
    }

    const toggleSelectAll = () => {
        if (selectedProspects.size === processedData.length) {
            setSelectedProspects(new Set())
        } else {
            setSelectedProspects(new Set(processedData.map(p => p.id)))
        }
    }

    const handleBatchDeepSearch = async () => {
        if (selectedProspects.size === 0 || isLaunchingBatch) return

        try {
            setIsLaunchingBatch(true)
            const prospectIds = Array.from(selectedProspects).map(id => parseInt(id))

            const response = await fetch('/api/prospects/deep-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds })
            })

            if (!response.ok) {
                const error = await response.json()
                if (response.status === 402) {
                    toast.error(`Crédits insuffisants : ${error.required} requis, ${error.available} disponibles`)
                } else {
                    toast.error(error.error || 'Erreur')
                }
                return
            }

            toast.success(
                `Deep Search lancé pour ${selectedProspects.size} prospect(s) !`,
                { duration: 5000 }
            )
            setSelectedProspects(new Set())

            // Reload après 15s
            setTimeout(() => {
                fetchAllProspects()
            }, 15000)

        } catch (error: any) {
            console.error('Error:', error)
            toast.error('Erreur lors du lancement')
        } finally {
            setIsLaunchingBatch(false)
        }
    }

    const processedData = useMemo(() => {
        let data = prospects.map(p => {
            const raw = safeParse(p.data_scrapping);
            const deep = safeParse(p.deep_search);
            const company = deep.nom_complet || raw.Titre || raw.title || deep.nom_raison_sociale || "Société Inconnue";

            let email = null;
            let emailStatus = 'inconnu';
            if (p.email_adresse_verified && p.email_adresse_verified.length > 0) {
                let rawEmail = p.email_adresse_verified
                // Handle case where it was stored as JSON array string e.g. '["a@b.com"]'
                if (typeof rawEmail === 'string' && rawEmail.startsWith('[')) {
                    try { rawEmail = JSON.parse(rawEmail)[0] } catch { /* keep as is */ }
                }
                email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail
                emailStatus = 'verifié'
            } else if (raw.Email) {
                email = raw.Email;
            } else if (deep.emails && deep.emails.length > 0) {
                email = deep.emails[0];
            }

            return {
                id: p.id_prospect,
                company: company,
                category: raw["Nom de catégorie"] || p.secteur || "N/A",
                email: email,
                phone: raw["Téléphone"] || raw.phone,
                city: p.ville || raw.Ville || raw.address,
                createdAt: new Date(p.created_at),
                jobId: p.id_jobs,
                // New fields for additional columns
                website: raw["Site web"] || deep.socials?.website,
                linkedin: deep.socials?.linkedin,
                address: raw.address || raw.Rue,
                rating: raw["Score total"],
                siret: deep.siret_siege,
                sector: p.secteur,
                emailStatus,
                reviews: raw["Nombre d'avis"],
                rappelDate: (p as any).rappel_date || null,
                rappelNotes: (p as any).rappel_notes || null,
                crmStatus: (p as any).crm_status || null,
            }
        });

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.company.toLowerCase().includes(q) ||
                item.category.toLowerCase().includes(q) ||
                item.city?.toLowerCase().includes(q)
            );
        }

        // Multi-Category filter (OR operator)
        if (filterCategories.size > 0) {
            data = data.filter(item => filterCategories.has(item.category));
        }

        // Email/Phone filters
        if (filterHasEmail) data = data.filter(item => !!item.email);
        if (filterHasPhone) data = data.filter(item => !!item.phone);

        // Date filter
        const now = new Date();
        if (dateFilter === 'today') {
            data = data.filter(item => {
                const diff = now.getTime() - item.createdAt.getTime();
                return diff < 24 * 60 * 60 * 1000;
            });
        } else if (dateFilter === 'week') {
            data = data.filter(item => {
                const diff = now.getTime() - item.createdAt.getTime();
                return diff < 7 * 24 * 60 * 60 * 1000;
            });
        } else if (dateFilter === 'month') {
            data = data.filter(item => {
                const diff = now.getTime() - item.createdAt.getTime();
                return diff < 30 * 24 * 60 * 60 * 1000;
            });
        } else if (dateFilter === 'custom' && (customDateRange.from || customDateRange.to)) {
            data = data.filter(item => {
                const itemDate = item.createdAt;
                if (customDateRange.from && itemDate < customDateRange.from) return false;
                if (customDateRange.to) {
                    const endOfDay = new Date(customDateRange.to);
                    endOfDay.setHours(23, 59, 59, 999);
                    if (itemDate > endOfDay) return false;
                }
                return true;
            });
        }

        return data;
    }, [prospects, searchQuery, filterCategories, filterHasEmail, filterHasPhone, dateFilter, customDateRange]);

    const categories = useMemo(() => {
        const cats = new Set(prospects.map(p => {
            const raw = safeParse(p.data_scrapping);
            return raw["Nom de catégorie"] || p.secteur || "N/A";
        }));
        return Array.from(cats).filter(c => c !== "N/A");
    }, [prospects]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4 md:space-y-6 relative max-w-[1400px] mx-auto">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-3xl opacity-50 animate-pulse" />
                <div className="absolute top-[40%] left-[-10%] w-[30%] h-[30%] bg-fuchsia-500/10 rounded-full blur-3xl opacity-40 delay-700 animate-pulse" />
            </div>

            {/* Header — responsive */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate bg-gradient-to-r from-violet-900 to-fuchsia-900 dark:from-violet-200 dark:to-fuchsia-300 bg-clip-text text-transparent pb-1">
                        Tous les Prospects
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                        Liste complète de vos prospects scrappés
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/prospects/import?tab=manual')}
                        className="gap-1.5"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Ajouter</span>
                        <span className="sm:hidden">+</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => router.push('/prospects/import')}
                        className="gap-1.5"
                    >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Importer</span>
                        <span className="sm:hidden">Import</span>
                    </Button>
                </div>
            </div>

            {/* Filters Bar */}
            <Card className="border-border/50 shadow-sm">
                <CardContent className="pt-3 pb-3">
                    {/* Ligne 1 : barre de recherche pleine largeur */}
                    <div className="relative w-full mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher par société, catégorie, ville..."
                            className="pl-9 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Ligne 2 : filtres */}
                    <div className="flex flex-wrap gap-1.5">
                        {/* Date Filter */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {dateFilter === 'all' ? 'Dates' :
                                        dateFilter === 'today' ? "Auj." :
                                            dateFilter === 'week' ? 'Semaine' :
                                                dateFilter === 'month' ? 'Mois' : 'Perso'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <div className="p-3 space-y-1">
                                    {(['all','today','week','month'] as const).map(f => (
                                        <Button key={f} variant={dateFilter === f ? 'default' : 'ghost'} size="sm" className="w-full justify-start text-xs" onClick={() => setDateFilter(f)}>
                                            {f === 'all' ? 'Toutes dates' : f === 'today' ? "Aujourd'hui" : f === 'week' ? 'Cette semaine' : 'Ce mois'}
                                        </Button>
                                    ))}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={dateFilter === 'custom' ? 'default' : 'ghost'} size="sm" className="w-full justify-start text-xs">
                                                📅 Date personnalisée
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-4" align="center" sideOffset={4}>
                                            <div className="space-y-3">
                                                <p className="text-sm font-semibold">Sélection de période</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-xs text-muted-foreground mb-1 block">Début</label>
                                                        <Input type="date" value={customDateRange.from ? format(customDateRange.from, "yyyy-MM-dd") : ''} onChange={(e) => { setCustomDateRange({ ...customDateRange, from: e.target.value ? new Date(e.target.value) : undefined }); setDateFilter('custom') }} className="h-8 text-xs" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-muted-foreground mb-1 block">Fin</label>
                                                        <Input type="date" value={customDateRange.to ? format(customDateRange.to, "yyyy-MM-dd") : ''} onChange={(e) => { setCustomDateRange({ ...customDateRange, to: e.target.value ? new Date(e.target.value) : undefined }); setDateFilter('custom') }} className="h-8 text-xs" />
                                                    </div>
                                                </div>
                                                <CalendarComponent mode="range" selected={{ from: customDateRange.from, to: customDateRange.to }} onSelect={(range: any) => { setCustomDateRange({ from: range?.from, to: range?.to }); setDateFilter('custom') }} numberOfMonths={1} />
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Category Filter */}
                        {categories.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                                        <Filter className="h-3.5 w-3.5" />
                                        {filterCategories.size === 0 ? 'Catégories' : filterCategories.size === 1 ? Array.from(filterCategories)[0].slice(0,12) : `${filterCategories.size} cat.`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto">
                                    <DropdownMenuLabel>Sélection multiple</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {filterCategories.size > 0 && (<><div className="px-2 py-1"><Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setFilterCategories(new Set())}>Effacer</Button></div><DropdownMenuSeparator /></>)}
                                    {categories.map(cat => (
                                        <DropdownMenuCheckboxItem key={cat} checked={filterCategories.has(cat)} onCheckedChange={(checked) => { const s = new Set(filterCategories); checked ? s.add(cat) : s.delete(cat); setFilterCategories(s) }}>{cat}</DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Quick Filters */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                                    <Filter className="h-3.5 w-3.5" />
                                    Filtres
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel>Filtres rapides</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked={filterHasEmail} onCheckedChange={setFilterHasEmail}>Avec Email</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={filterHasPhone} onCheckedChange={setFilterHasPhone}>Avec Téléphone</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Column Visibility */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                    <Columns className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Colonnes</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked={visibleColumns.company} onCheckedChange={(b) => setVisibleColumns(p => ({ ...p, company: !!b }))}>Société</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.category} onCheckedChange={(b) => setVisibleColumns(p => ({ ...p, category: !!b }))}>Catégorie</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.contact} onCheckedChange={(b) => setVisibleColumns(p => ({ ...p, contact: !!b }))}>Email</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.phone} onCheckedChange={(b) => setVisibleColumns(p => ({ ...p, phone: !!b }))}>Téléphone</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.city} onCheckedChange={(b) => setVisibleColumns(p => ({ ...p, city: !!b }))}>Ville</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.deep} onCheckedChange={(b) => setVisibleColumns(p => ({ ...p, deep: !!b }))}>Deep Search</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.date} onCheckedChange={(b) => setVisibleColumns(p => ({ ...p, date: !!b }))}>Date</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>


            {/* Results Count and Selection Mode */}
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{processedData.length}</span> prospect{processedData.length > 1 ? 's' : ''}
                    {selectedProspects.size > 0 && (
                        <span className="ml-2 text-indigo-600 font-medium">
                            • {selectedProspects.size} sélectionné{selectedProspects.size > 1 ? 's' : ''}
                        </span>
                    )}
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant={selectionMode || selectedProspects.size > 0 ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            setSelectionMode(prev => !prev)
                        }}
                        className="gap-1.5 h-8 text-xs"
                    >
                        {selectionMode || selectedProspects.size > 0 ? (
                            <CheckSquare className="h-3.5 w-3.5" />
                        ) : (
                            <Square className="h-3.5 w-3.5" />
                        )}
                        Sélection
                    </Button>
                    {selectedProspects.size > 0 && (
                        <AIButton onClick={handleBatchDeepSearch} disabled={isLaunchingBatch} loading={isLaunchingBatch} variant="primary" className="gap-1.5 h-8 text-xs">
                            Deep Search ({selectedProspects.size})
                        </AIButton>
                    )}
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border-0 overflow-x-auto">
                        <Table className="min-w-[600px] md:min-w-0">
                            <TableHeader>
                                <TableRow>
                                    {(selectionMode || selectedProspects.size > 0) && (
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selectedProspects.size === processedData.length && processedData.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                    )}
                                    {visibleColumns.company && <TableHead>Société</TableHead>}
                                    {visibleColumns.category && <TableHead>Catégorie</TableHead>}
                                    {visibleColumns.contact && <TableHead>Email</TableHead>}
                                    {visibleColumns.phone && <TableHead>Téléphone</TableHead>}
                                    {visibleColumns.city && <TableHead>Ville</TableHead>}
                                    {visibleColumns.deep && <TableHead>Deep Search</TableHead>}
                                    {visibleColumns.date && <TableHead>Date</TableHead>}
                                    {visibleColumns.website && <TableHead>Site Web</TableHead>}
                                    {visibleColumns.linkedin && <TableHead>LinkedIn</TableHead>}
                                    {visibleColumns.address && <TableHead>Adresse</TableHead>}
                                    {visibleColumns.rating && <TableHead>Score/Avis</TableHead>}
                                    {visibleColumns.siret && <TableHead>SIRET</TableHead>}
                                    {visibleColumns.sector && <TableHead>Secteur</TableHead>}
                                    {visibleColumns.emailStatus && <TableHead>Statut Email</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Aucun prospect trouvé
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    processedData.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => router.push(`/prospects/${row.id}`)}
                                        >
                                            {(selectionMode || selectedProspects.size > 0) && (
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedProspects.has(row.id)}
                                                        onCheckedChange={() => toggleProspect(row.id)}
                                                    />
                                                </TableCell>
                                            )}
                                            {visibleColumns.company && (
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="line-clamp-2 text-sm">{row.company}</span>
                                                            {row.rappelDate && (() => {
                                                                const rd = new Date(row.rappelDate)
                                                                const now = new Date()
                                                                const isPast = rd <= now
                                                                const isToday = rd.toDateString() === now.toDateString()
                                                                const color = isPast ? "text-red-600 bg-red-50 border-red-200" : isToday ? "text-orange-600 bg-orange-50 border-orange-200" : "text-amber-700 bg-amber-50 border-amber-200"
                                                                return (
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border w-fit ${color}`}>
                                                                        <Bell className="w-2.5 h-2.5" />
                                                                        {isPast ? "Rappel passé" : `Rappel ${rd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                                                                    </span>
                                                                )
                                                            })()}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            )}
                                            {visibleColumns.category && (
                                                <TableCell>
                                                    <Badge variant="outline">{row.category}</Badge>
                                                </TableCell>
                                            )}
                                            {visibleColumns.contact && (
                                                <TableCell>
                                                    {row.email ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <Mail className="h-3 w-3 text-primary" />
                                                            <span className="truncate max-w-[200px]">{row.email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.phone && (
                                                <TableCell>
                                                    {row.phone ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <Phone className="h-3 w-3" />
                                                            <span className="whitespace-nowrap">{row.phone}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.city && (
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <MapPin className="h-3 w-3 text-muted-foreground" />
                                                        {row.city || "-"}
                                                    </div>
                                                </TableCell>
                                            )}
                                            {visibleColumns.deep && (
                                                <TableCell>
                                                    {/* Check if prospect has deep_search data */}
                                                    {prospects.find(p => p.id_prospect === row.id)?.deep_search &&
                                                        Object.keys(prospects.find(p => p.id_prospect === row.id)?.deep_search || {}).length > 0 ? (
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles className="w-4 h-4 text-purple-600 fill-purple-100" />
                                                            <span className="text-xs font-medium text-purple-700">Enrichi</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground font-normal">
                                                            Non enrichi
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.date && (
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {format(row.createdAt, "d MMM yyyy", { locale: fr })}
                                                </TableCell>
                                            )}
                                            {visibleColumns.website && (
                                                <TableCell>
                                                    {row.website ? (
                                                        <a
                                                            href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            Site
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.linkedin && (
                                                <TableCell>
                                                    {row.linkedin ? (
                                                        <a
                                                            href={row.linkedin}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            Voir
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.address && (
                                                <TableCell className="max-w-[200px]">
                                                    <span className="text-sm line-clamp-2">{row.address || "-"}</span>
                                                </TableCell>
                                            )}
                                            {visibleColumns.rating && (
                                                <TableCell>
                                                    {row.rating ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                            <span>{row.rating}</span>
                                                            {row.reviews && <span className="text-muted-foreground">({row.reviews})</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.siret && (
                                                <TableCell>
                                                    <span className="text-sm font-mono">{row.siret || "-"}</span>
                                                </TableCell>
                                            )}
                                            {visibleColumns.sector && (
                                                <TableCell>
                                                    {row.sector ? (
                                                        <Badge variant="secondary">{row.sector}</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.emailStatus && (
                                                <TableCell>
                                                    {row.emailStatus === 'verifié' ? (
                                                        <Badge variant="default" className="bg-green-600">Vérifié</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Non vérifié</Badge>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
