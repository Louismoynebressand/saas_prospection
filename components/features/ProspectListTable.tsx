"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    MoreHorizontal, Mail, Phone, Building2, User, Loader2, ArrowUpDown,
    Filter, Columns, Download, ChevronDown, Trash2, Share2, FileDown
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
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

// Simple export to CSV function
const exportToCSV = (data: any[], filename: string) => {
    const headers = [
        "ID", "Société", "Catégorie", "Contact Name", "Email", "Phone", "Ville", "Adresse",
        "Site Web", "LinkedIn", "Instagram", "Facebook",
        "Score", "Avis", "Status Email", "Secteur", "SIRET"
    ]

    const csvContent = [
        headers.join(","),
        ...data.map(row => {
            const e = (val: any) => `"${String(val || "").replace(/"/g, '""')}"`
            return [
                e(row.id), e(row.company), e(row.category), e(row.name), e(row.email), e(row.phone), e(row.city), e(row.address),
                e(row.website), e(row.linkedin), e(row.instagram), e(row.facebook),
                e(row.rating), e(row.reviews), e(row.emailStatus), e(row.sector), e(row.siret)
            ].join(",")
        })
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

export function ProspectListTable({ searchId, autoRefresh }: { searchId: string, autoRefresh?: boolean }) {
    const router = useRouter()
    const [prospects, setProspects] = useState<ScrapeProspect[]>([])
    const [loading, setLoading] = useState(true)
    const pollInterval = useRef<NodeJS.Timeout | null>(null)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const ITEMS_PER_PAGE = 50

    // Filters & Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
    const [filterHasEmail, setFilterHasEmail] = useState(false)
    const [filterHasPhone, setFilterHasPhone] = useState(false)

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState({
        company: true,
        category: true,
        contact: true,
        phone: true,
        city: true,
    })

    const fetchProspects = async (page: number = currentPage) => {
        try {
            const { data, error, count } = await supabase
                .from('scrape_prospect')
                .select(`
                    id_prospect,
                    id_jobs,
                    id_user,
                    ville,
                    secteur,
                    created_at,
                    email_adresse_verified,
                    data_scrapping,
                    deep_search
                `, { count: 'exact' })
                .eq('id_jobs', searchId)
                .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)
                .order('created_at', { ascending: false })

            if (error) throw error
            if (data) setProspects(data as ScrapeProspect[])
            if (count !== null) setTotalCount(count)
        } catch (error) {
            console.error('Error fetching prospects:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation() // Prevent row click
        if (!confirm("Voulez-vous vraiment supprimer ce prospect ?")) return

        try {
            const { error } = await supabase
                .from('scrape_prospect')
                .delete()
                .eq('id_prospect', id)

            if (error) throw error

            // Optimistic update
            setProspects(prev => prev.filter(p => p.id_prospect !== id))
        } catch (err) {
            console.error("Error deleting prospect:", err)
            alert("Erreur lors de la suppression")
        }
    }

    const handleShare = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const url = `${window.location.origin}/prospects/${id}`
        navigator.clipboard.writeText(url)
        alert("Lien copié dans le presse-papier !")
    }

    useEffect(() => {
        fetchProspects()

        const subscription = supabase
            .channel(`scrape_prospects_list_${searchId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'scrape_prospect',
                filter: `id_jobs=eq.${searchId}`
            }, (payload) => {
                setProspects(prev => [payload.new as ScrapeProspect, ...prev])
            })
            .subscribe()

        if (autoRefresh) {
            pollInterval.current = setInterval(fetchProspects, 10000)
        }

        return () => {
            subscription.unsubscribe()
            if (pollInterval.current) clearInterval(pollInterval.current)
        }
    }, [searchId, autoRefresh])

    // --- Process Data for Display ---
    const safeParse = (data: any) => {
        if (!data) return {}
        if (typeof data === 'string') {
            try { return JSON.parse(data) } catch (e) { return {} }
        }
        return data
    }

    const processedData = useMemo(() => {
        let data = prospects.map(p => {
            const raw = safeParse(p.data_scrapping);
            const deep = safeParse(p.deep_search);

            // Priority: deep.nom_complet > raw.Titre > fallbacks
            const company = deep.nom_complet || raw.Titre || raw.title || deep.nom_raison_sociale || "Société Inconnue";

            let email = null;
            let emailStatus = 'inconnu';
            if (p.email_adresse_verified && p.email_adresse_verified.length > 0) {
                email = Array.isArray(p.email_adresse_verified) ? p.email_adresse_verified[0] : p.email_adresse_verified;
                emailStatus = 'verifie';
            } else if (raw.Email) {
                email = raw.Email;
            } else if (deep.emails && deep.emails.length > 0) {
                email = deep.emails[0];
            }

            return {
                original: p,
                id: p.id_prospect,
                company: company,
                category: raw["Nom de catégorie"] || p.secteur || "N/A",
                name: raw.name || "N/A",
                email: email,
                phone: raw["Téléphone"] || raw.phone || (raw.phones && raw.phones[0]),
                city: p.ville || raw.address,
                emailStatus,
                // Extra fields for export
                address: raw.address || raw.Rue,
                website: raw["Site web"] || (deep.socials?.website),
                linkedin: deep.socials?.linkedin,
                instagram: deep.socials?.instagram,
                facebook: deep.socials?.facebook,
                rating: raw["Score total"],
                reviews: raw["Nombre d'avis"],
                sector: p.secteur,
                siret: deep.siret_siege
            }
        });

        if (filterHasEmail) data = data.filter(item => !!item.email);
        if (filterHasPhone) data = data.filter(item => !!item.phone);

        if (sortConfig) {
            data.sort((a, b) => {
                // @ts-ignore
                const aValue = a[sortConfig.key] || "";
                // @ts-ignore
                const bValue = b[sortConfig.key] || "";
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [prospects, sortConfig, filterHasEmail, filterHasPhone]);

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    }

    const handleExport = () => {
        exportToCSV(processedData, `prospects_export_${searchId}.csv`)
    }

    const handleSingleExport = (row: any, e: React.MouseEvent) => {
        e.stopPropagation()
        exportToCSV([row], `prospect_${row.company.replace(/\s+/g, '_')}.csv`)
    }

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (prospects.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border rounded-md border-dashed">
                Aucun prospect trouvé pour le moment.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-2 items-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1">
                                <Filter className="h-3.5 w-3.5" />
                                Filtrer
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Filtres rapides</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={filterHasEmail} onCheckedChange={setFilterHasEmail}>
                                Avec Email uniquement
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={filterHasPhone} onCheckedChange={setFilterHasPhone}>
                                Avec Téléphone uniquement
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1">
                                <Columns className="h-3.5 w-3.5" />
                                Colonnes
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuCheckboxItem checked={visibleColumns.company} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, company: !!b }))}>Société</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.category} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, category: !!b }))}>Catégorie</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.contact} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, contact: !!b }))}>Contact (Email)</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.phone} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, phone: !!b }))}>Téléphone</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.city} onCheckedChange={(b) => setVisibleColumns(prev => ({ ...prev, city: !!b }))}>Ville</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <Button size="sm" variant="secondary" onClick={handleExport} className="h-8">
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Exporter CSV
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {visibleColumns.company && (
                                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('company')}>
                                    <div className="flex items-center gap-1">Société <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                            )}
                            {visibleColumns.category && (
                                <TableHead>Catégorie</TableHead>
                            )}
                            {visibleColumns.contact && (
                                <TableHead>Contact (Email)</TableHead>
                            )}
                            {visibleColumns.phone && (
                                <TableHead>Téléphone</TableHead>
                            )}
                            {visibleColumns.city && (
                                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('city')}>
                                    <div className="flex items-center gap-1">Ville <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                            )}
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedData.map((row) => (
                            <TableRow
                                key={String(row.id)}
                                className="cursor-pointer hover:bg-muted/50 transition-colors pointer-events-auto"
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    router.push(`/prospects/${row.id}`)
                                }}
                            >
                                {visibleColumns.company && (
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            {row.company}
                                        </div>
                                    </TableCell>
                                )}
                                {visibleColumns.category && (
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                            {row.category}
                                        </div>
                                    </TableCell>
                                )}
                                {visibleColumns.contact && (
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {row.email ? (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Mail className="h-3 w-3 text-primary" />
                                                    <span className="truncate max-w-[150px]">{row.email}</span>
                                                </div>
                                            ) : <span className="text-xs text-muted-foreground">-</span>}
                                        </div>
                                    </TableCell>
                                )}
                                {visibleColumns.phone && (
                                    <TableCell>
                                        {row.phone ? (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" />
                                                <span className="whitespace-nowrap">{row.phone}</span>
                                            </div>
                                        ) : <span className="text-xs text-muted-foreground">-</span>}
                                    </TableCell>
                                )}
                                {visibleColumns.city && (
                                    <TableCell className="max-w-[120px] truncate">{row.city}</TableCell>
                                )}
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={(e) => handleSingleExport(row, e)}>
                                                <FileDown className="mr-2 h-4 w-4" /> Exporter CSV
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => handleShare(row.id, e)}>
                                                <Share2 className="mr-2 h-4 w-4" /> Partager
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={(e) => handleDelete(row.id, e)} className="text-red-600 focus:text-red-600">
                                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-2 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                    Affichage {currentPage * ITEMS_PER_PAGE + 1}-{Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount)} sur {totalCount} résultats
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const newPage = currentPage - 1
                            setCurrentPage(newPage)
                            fetchProspects(newPage)
                        }}
                        disabled={currentPage === 0 || loading}
                    >
                        Précédent
                    </Button>
                    <div className="text-sm">
                        Page {currentPage + 1} sur {Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const newPage = currentPage + 1
                            setCurrentPage(newPage)
                            fetchProspects(newPage)
                        }}
                        disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE) - 1 || loading}
                    >
                        Suivant
                    </Button>
                </div>
            </div>
        </div>
    )
}
