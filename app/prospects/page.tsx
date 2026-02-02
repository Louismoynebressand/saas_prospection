"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    Search, Filter, Columns, Download, Upload, Building2, Mail, Phone, MapPin, Calendar, Loader2, Zap, CheckSquare, Sparkles, Square
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"

export default function ProspectsPage() {
    const router = useRouter()
    const [prospects, setProspects] = useState<ScrapeProspect[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterCategory, setFilterCategory] = useState<string | null>(null)
    const [filterHasEmail, setFilterHasEmail] = useState(false)
    const [filterHasPhone, setFilterHasPhone] = useState(false)
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')

    const [visibleColumns, setVisibleColumns] = useState({
        company: true,
        category: true,
        contact: true,
        phone: true,
        city: true,
        deep: true,
        date: true,
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
            if (p.email_adresse_verified && p.email_adresse_verified.length > 0) {
                email = Array.isArray(p.email_adresse_verified) ? p.email_adresse_verified[0] : p.email_adresse_verified;
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
                jobId: p.id_jobs
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

        // Category filter
        if (filterCategory) {
            data = data.filter(item => item.category === filterCategory);
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
        }

        return data;
    }, [prospects, searchQuery, filterCategory, filterHasEmail, filterHasPhone, dateFilter]);

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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {dateFilter === 'all' ? 'Toutes dates' :
                                        dateFilter === 'today' ? "Aujourd'hui" :
                                            dateFilter === 'week' ? 'Cette semaine' : 'Ce mois'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuCheckboxItem checked={dateFilter === 'all'} onCheckedChange={() => setDateFilter('all')}>
                                    Toutes dates
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={dateFilter === 'today'} onCheckedChange={() => setDateFilter('today')}>
                                    Aujourd'hui
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={dateFilter === 'week'} onCheckedChange={() => setDateFilter('week')}>
                                    Cette semaine
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={dateFilter === 'month'} onCheckedChange={() => setDateFilter('month')}>
                                    Ce mois
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Category Filter */}
                        {categories.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="gap-2">
                                        <Filter className="h-4 w-4" />
                                        {filterCategory || 'Toutes catégories'}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
                                    <DropdownMenuCheckboxItem
                                        checked={!filterCategory}
                                        onCheckedChange={() => setFilterCategory(null)}
                                    >
                                        Toutes catégories
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuSeparator />
                                    {categories.map(cat => (
                                        <DropdownMenuCheckboxItem
                                            key={cat}
                                            checked={filterCategory === cat}
                                            onCheckedChange={() => setFilterCategory(cat)}
                                        >
                                            {cat}
                                        </DropdownMenuCheckboxItem>
                                    ))}
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
                                <DropdownMenuLabel>Colonnes</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked={visibleColumns.company} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, company: !!b }))}>Société</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.category} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, category: !!b }))}>Catégorie</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.contact} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, contact: !!b }))}>Email</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.phone} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, phone: !!b }))}>Téléphone</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.city} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, city: !!b }))}>Ville</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.deep} onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, deep: checked }))}>Deep Search</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={visibleColumns.date} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, date: !!b }))}>Date</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            {/* Results Count */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {processedData.length} prospect{processedData.length > 1 ? 's' : ''} trouvé{processedData.length > 1 ? 's' : ''}
                    {selectedProspects.size > 0 && (
                        <span className="ml-2 text-primary font-medium">
                            • {selectedProspects.size} sélectionné{selectedProspects.size > 1 ? 's' : ''}
                        </span>
                    )}
                </p>

                {selectedProspects.size > 0 && (
                    <AIButton
                        onClick={handleBatchDeepSearch}
                        disabled={isLaunchingBatch}
                        loading={isLaunchingBatch}
                        variant="primary"
                        className="gap-2"
                    >
                        {isLaunchingBatch ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Lancement en cours...
                            </>
                        ) : (
                            <motion.div
                                className="flex items-center gap-2"
                                whileHover={{ scale: 1.05 }}
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>Lancer Deep Search ({selectedProspects.size})</span>
                            </motion.div>
                        )}
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
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={selectedProspects.size === processedData.length && processedData.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    {visibleColumns.company && <TableHead>Société</TableHead>}
                                    {visibleColumns.category && <TableHead>Catégorie</TableHead>}
                                    {visibleColumns.contact && <TableHead>Email</TableHead>}
                                    {visibleColumns.phone && <TableHead>Téléphone</TableHead>}
                                    {visibleColumns.city && <TableHead>Ville</TableHead>}
                                    {visibleColumns.deep && <TableHead>Deep Search</TableHead>}
                                    {visibleColumns.date && <TableHead>Date</TableHead>}
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
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedProspects.has(row.id)}
                                                    onCheckedChange={() => toggleProspect(row.id)}
                                                />
                                            </TableCell>
                                            {visibleColumns.company && (
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <span className="truncate">{row.company}</span>
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
