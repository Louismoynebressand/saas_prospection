"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    Search, Filter, Columns, Download, Upload, Building2, Mail, Phone, MapPin, Calendar, Loader2, Zap, CheckSquare, Sparkles, Square, ExternalLink, Star
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
            // Get authenticated user
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                console.error('No authenticated user found')
                setLoading(false)
                return
            }

            // OPTIMIZED: Fetch all prospects for user directly (Single safe query)
            // Instead of fetching jobs then using .in() which can be slow or overflow
            const { data, error } = await supabase
                .from('scrape_prospect')
                .select(`
                    id_prospect, 
                    id_jobs, 
                    id_user, 
                    created_at,
                    data_scrapping, 
                    deep_search, 
                    email_adresse_verified, 
                    ville, 
                    secteur
                `)
                .eq('id_user', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            if (data) setProspects(data as ScrapeProspect[])
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
                email = Array.isArray(p.email_adresse_verified) ? p.email_adresse_verified[0] : p.email_adresse_verified;
                emailStatus = 'verifié';
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
                reviews: raw["Nombre d'avis"]
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tous les Prospects</h1>
                    <p className="text-muted-foreground mt-1">
                        Liste complète de tous vos prospects scrappés
                    </p>
                </div>
                <Button
                    onClick={() => router.push('/prospects/import')}
                    className="gap-2"
                >
                    <Upload className="h-4 w-4" />
                    Importer des prospects
                </Button>
            </div>

            {/* Filters Bar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher par société, catégorie, ville..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Date Filter */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {dateFilter === 'all' ? 'Toutes dates' :
                                        dateFilter === 'today' ? "Aujourd'hui" :
                                            dateFilter === 'week' ? 'Cette semaine' :
                                                dateFilter === 'month' ? 'Ce mois' :
                                                    (customDateRange.from || customDateRange.to) ?
                                                        `${customDateRange.from ? format(customDateRange.from, "d MMM", { locale: fr }) : '...'} - ${customDateRange.to ? format(customDateRange.to, "d MMM", { locale: fr }) : '...'}` :
                                                        'Personnalisé'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <div className="p-3 space-y-2">
                                    <div className="space-y-1">
                                        <Button
                                            variant={dateFilter === 'all' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => setDateFilter('all')}
                                        >
                                            Toutes dates
                                        </Button>
                                        <Button
                                            variant={dateFilter === 'today' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => setDateFilter('today')}
                                        >
                                            Aujourd'hui
                                        </Button>
                                        <Button
                                            variant={dateFilter === 'week' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => setDateFilter('week')}
                                        >
                                            Cette semaine
                                        </Button>
                                        <Button
                                            variant={dateFilter === 'month' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => setDateFilter('month')}
                                        >
                                            Ce mois
                                        </Button>

                                        {/* Custom Date Button */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={dateFilter === 'custom' ? 'default' : 'ghost'}
                                                    size="sm"
                                                    className="w-full justify-start"
                                                >
                                                    📅 Date personnalisée
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-4" align="start" side="right">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="text-sm font-semibold">Sélection de période</p>
                                                    </div>

                                                    {/* Text Inputs for Date Selection */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Date de début</label>
                                                            <Input
                                                                type="date"
                                                                value={customDateRange.from ? format(customDateRange.from, "yyyy-MM-dd") : ''}
                                                                onChange={(e) => {
                                                                    const newDate = e.target.value ? new Date(e.target.value) : undefined
                                                                    setCustomDateRange({ ...customDateRange, from: newDate })
                                                                    setDateFilter('custom')
                                                                }}
                                                                className="h-9 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Date de fin</label>
                                                            <Input
                                                                type="date"
                                                                value={customDateRange.to ? format(customDateRange.to, "yyyy-MM-dd") : ''}
                                                                onChange={(e) => {
                                                                    const newDate = e.target.value ? new Date(e.target.value) : undefined
                                                                    setCustomDateRange({ ...customDateRange, to: newDate })
                                                                    setDateFilter('custom')
                                                                }}
                                                                className="h-9 text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Calendar Component */}
                                                    <div className="border-t pt-3">
                                                        <CalendarComponent
                                                            mode="range"
                                                            selected={{ from: customDateRange.from, to: customDateRange.to }}
                                                            onSelect={(range: any) => {
                                                                setCustomDateRange({ from: range?.from, to: range?.to })
                                                                setDateFilter('custom')
                                                            }}
                                                            numberOfMonths={2}
                                                        />
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Category Filter - Multi-selection */}
                        {categories.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="gap-2">
                                        <Filter className="h-4 w-4" />
                                        {filterCategories.size === 0 ? 'Toutes catégories' :
                                            filterCategories.size === 1 ? Array.from(filterCategories)[0] :
                                                `${filterCategories.size} catégories`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
                                    <DropdownMenuLabel>Sélection multiple</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {filterCategories.size > 0 && (
                                        <>
                                            <div className="px-2 py-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full text-xs"
                                                    onClick={() => setFilterCategories(new Set())}
                                                >
                                                    Effacer la sélection
                                                </Button>
                                            </div>
                                            <DropdownMenuSeparator />
                                        </>
                                    )}
                                    {categories.map(cat => {
                                        const isSelected = filterCategories.has(cat);
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={cat}
                                                checked={isSelected}
                                                onCheckedChange={(checked) => {
                                                    const newSet = new Set(filterCategories);
                                                    if (checked) {
                                                        newSet.add(cat);
                                                    } else {
                                                        newSet.delete(cat);
                                                    }
                                                    setFilterCategories(newSet);
                                                }}
                                            >
                                                {cat}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Quick Filters */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Filter className="h-4 w-4" />
                                    Filtres
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Filtres rapides</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked={filterHasEmail} onCheckedChange={setFilterHasEmail}>
                                    Avec Email
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={filterHasPhone} onCheckedChange={setFilterHasPhone}>
                                    Avec Téléphone
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Column Visibility */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Columns className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked={visibleColumns.company} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, company: !!b }))}>Société</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.category} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, category: !!b }))}>Catégorie</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.contact} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, contact: !!b }))}>Email</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.phone} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, phone: !!b }))}>Téléphone</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.city} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, city: !!b }))}>Ville</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.deep} onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, deep: checked }))}>Deep Search</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.date} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, date: !!b }))}>Date</DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Colonnes supplémentaires</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem checked={visibleColumns.website} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, website: !!b }))}>Site Web</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.linkedin} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, linkedin: !!b }))}>LinkedIn</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.address} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, address: !!b }))}>Adresse</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.rating} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, rating: !!b }))}>Score/Avis</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.siret} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, siret: !!b }))}>SIRET</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.sector} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, sector: !!b }))}>Secteur</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.emailStatus} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, emailStatus: !!b }))}>Statut Email</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            {/* Results Count and Selection Mode */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        {processedData.length} prospect{processedData.length > 1 ? 's' : ''} trouvé{processedData.length > 1 ? 's' : ''}
                        {selectedProspects.size > 0 && (
                            <span className="ml-2 text-primary font-medium">
                                • {selectedProspects.size} sélectionné{selectedProspects.size > 1 ? 's' : ''}
                            </span>
                        )}
                    </p>

                    {/* Selection Mode Toggle */}
                    <Button
                        variant={selectionMode || selectedProspects.size > 0 ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                            setSelectionMode(!selectionMode);
                            if (selectionMode && selectedProspects.size === 0) {
                                // If turning off and no selections, just toggle
                            }
                        }}
                        className="gap-2"
                    >
                        {selectionMode || selectedProspects.size > 0 ? (
                            <CheckSquare className="h-4 w-4" />
                        ) : (
                            <Square className="h-4 w-4" />
                        )}
                        Mode Sélection
                    </Button>
                </div>

                {selectedProspects.size > 0 && (
                    <AIButton
                        onClick={handleBatchDeepSearch}
                        disabled={isLaunchingBatch}
                        loading={isLaunchingBatch}
                        variant="primary"
                        className="gap-2"
                    >
                        Lancer Deep Search ({selectedProspects.size})
                    </AIButton>
                )}
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border-0">
                        <Table>
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
                                                        <span className="line-clamp-2 text-sm">{row.company}</span>
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
