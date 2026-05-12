"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    Building2, Mail, Phone, MapPin, Sparkles, ExternalLink, Bell,
    Star, UserPlus, Upload, Columns, ArrowUpDown, ArrowUp, ArrowDown,
    Globe, Instagram, Trash2, Clock
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { AIButton } from "@/components/ui/ai-button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useProspectsData, ProspectRow, ProspectFilters } from "@/hooks/useProspectsData"
import { ProspectsFilterBar } from "@/components/features/ProspectsFilterBar"
import { ProspectsSavedViews, SavedView } from "@/components/features/ProspectsSavedViews"

// ── Column definitions ────────────────────────────────────────────────────────
const ALL_COLUMNS: { key: string; label: string; sortKey?: keyof ProspectRow; defaultVisible: boolean; alwaysVisible?: boolean }[] = [
    { key: 'company',      label: 'Société',        sortKey: 'company',    defaultVisible: true, alwaysVisible: true },
    { key: 'category',     label: 'Catégorie',      sortKey: 'category',   defaultVisible: true },
    { key: 'email',        label: 'Email',          sortKey: 'email',      defaultVisible: true },
    { key: 'phone',        label: 'Téléphone',      defaultVisible: true },
    { key: 'city',         label: 'Ville',          sortKey: 'city',       defaultVisible: true },
    { key: 'deep',         label: 'Deep Search',    sortKey: 'hasDeepSearch', defaultVisible: true },
    { key: 'date',         label: 'Date',           sortKey: 'createdAt',  defaultVisible: true },
    { key: 'website',      label: 'Site web',       defaultVisible: false },
    { key: 'instagram',    label: 'Instagram',      defaultVisible: false },
    { key: 'linkedin',     label: 'LinkedIn',       defaultVisible: false },
    { key: 'address',      label: 'Adresse',        defaultVisible: false },
    { key: 'rating',       label: 'Score/Avis',     sortKey: 'rating',     defaultVisible: false },
    { key: 'openingHours', label: "Horaires",       defaultVisible: false },
    { key: 'siret',        label: 'SIRET',          defaultVisible: false },
    { key: 'sector',       label: 'Secteur',        sortKey: 'sector',     defaultVisible: false },
    { key: 'emailStatus',  label: 'Statut email',   defaultVisible: false },
    { key: 'jobName',      label: 'Recherche',      sortKey: 'jobName',    defaultVisible: false },
    { key: 'campaign',     label: 'Campagne(s)',     defaultVisible: false },
]

const EMAIL_STATUS_STYLES: Record<string, string> = {
    pending: 'bg-orange-100 text-orange-700',
    generated: 'bg-violet-100 text-violet-700',
    sent: 'bg-blue-100 text-blue-700',
    delivered: 'bg-teal-100 text-teal-700',
    opened: 'bg-cyan-100 text-cyan-700',
    clicked: 'bg-indigo-100 text-indigo-700',
    bounced: 'bg-red-100 text-red-700',
    replied: 'bg-emerald-100 text-emerald-700',
}

const EMAIL_STATUS_LABELS: Record<string, string> = {
    pending: 'En attente', generated: 'Généré', sent: 'Envoyé',
    delivered: 'Délivré', opened: 'Ouvert', clicked: 'Cliqué',
    bounced: 'Rebond', replied: 'Répondu',
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProspectsPage() {
    const router = useRouter()

    const {
        loading, allRows, processedData, filters, setFilter, setFilters, resetFilters,
        scrapeJobs, campaigns, availableCategories, availableCities, fetchData
    } = useProspectsData()

    // Column visibility
    const defaultCols = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.defaultVisible]))
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultCols)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isLaunchingBatch, setIsLaunchingBatch] = useState(false)

    // Saved views
    const [activeViewId, setActiveViewId] = useState<string | null>('all')

    const toggleCol = (key: string) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))

    const toggleSort = (col: typeof ALL_COLUMNS[0]) => {
        if (!col.sortKey) return
        if (filters.sortBy === col.sortKey) {
            setFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setFilter('sortBy', col.sortKey)
            setFilter('sortDir', 'asc')
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        setSelectedIds(prev =>
            prev.size === processedData.length
                ? new Set()
                : new Set(processedData.map(r => r.id))
        )
    }

    const handleLoadView = useCallback((view: SavedView) => {
        if (view.filters) {
            setFilters(prev => ({
                ...prev,
                ...view.filters,
                jobIds: view.filters.jobIds instanceof Set ? view.filters.jobIds : new Set((view.filters as any).jobIds || []),
                categories: view.filters.categories instanceof Set ? view.filters.categories : new Set((view.filters as any).categories || []),
                cities: view.filters.cities instanceof Set ? view.filters.cities : new Set((view.filters as any).cities || []),
                emailStatuses: view.filters.emailStatuses instanceof Set ? view.filters.emailStatuses : new Set((view.filters as any).emailStatuses || []),
            }))
        }
        if (view.visibleColumns && Object.keys(view.visibleColumns).length > 0) {
            setVisibleColumns({ ...defaultCols, ...view.visibleColumns })
        }
    }, [setFilters, defaultCols])

    const handleBatchDeepSearch = async () => {
        if (selectedIds.size === 0 || isLaunchingBatch) return
        try {
            setIsLaunchingBatch(true)
            const prospectIds = Array.from(selectedIds).map(id => parseInt(id))
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
            toast.success(`Deep Search lancé pour ${selectedIds.size} prospect(s) !`, { duration: 5000 })
            setSelectedIds(new Set())
            setTimeout(() => fetchData(), 15000)
        } catch {
            toast.error('Erreur lors du lancement')
        } finally {
            setIsLaunchingBatch(false)
        }
    }

    // Sort indicator
    const SortIcon = ({ col }: { col: typeof ALL_COLUMNS[0] }) => {
        if (!col.sortKey) return null
        if (filters.sortBy !== col.sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-1" />
        return filters.sortDir === 'asc'
            ? <ArrowUp className="h-3 w-3 ml-1 text-indigo-600" />
            : <ArrowDown className="h-3 w-3 ml-1 text-indigo-600" />
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            </div>
        )
    }

    const visibleCols = ALL_COLUMNS.filter(c => visibleColumns[c.key])
    const allSelected = processedData.length > 0 && selectedIds.size === processedData.length
    const someSelected = selectedIds.size > 0 && selectedIds.size < processedData.length

    return (
        <div className="space-y-4 max-w-[1600px] mx-auto">
            {/* Background glows */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-3xl opacity-40 animate-pulse" />
                <div className="absolute top-[40%] left-[-10%] w-[30%] h-[30%] bg-fuchsia-500/10 rounded-full blur-3xl opacity-30 delay-700 animate-pulse" />
            </div>

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-900 to-fuchsia-900 dark:from-violet-200 dark:to-fuchsia-300 bg-clip-text text-transparent pb-1">
                        Tous les Prospects
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        <span className="font-semibold text-foreground">{allRows.length}</span> prospects scrappés au total
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => router.push('/prospects/import?tab=manual')} className="gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Ajouter</span>
                    </Button>
                    <Button size="sm" onClick={() => router.push('/prospects/import')} className="gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Importer</span>
                    </Button>
                </div>
            </div>

            {/* Filter bar */}
            <Card className="border-border/50 shadow-sm">
                <CardContent className="pt-3 pb-3 space-y-3">
                    <ProspectsFilterBar
                        filters={filters}
                        onFilter={setFilter}
                        onReset={resetFilters}
                        scrapeJobs={scrapeJobs}
                        campaigns={campaigns}
                        availableCategories={availableCategories}
                        availableCities={availableCities}
                        totalCount={allRows.length}
                        filteredCount={processedData.length}
                    />
                    {/* Saved views */}
                    <div className="border-t pt-2">
                        <ProspectsSavedViews
                            currentFilters={filters}
                            currentColumns={visibleColumns}
                            onLoadView={handleLoadView}
                            activeViewId={activeViewId}
                            onActiveViewChange={setActiveViewId}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Batch actions bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="text-sm font-medium text-indigo-800">
                        {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                            Désélectionner
                        </Button>
                        <AIButton
                            onClick={handleBatchDeepSearch}
                            disabled={isLaunchingBatch}
                            loading={isLaunchingBatch}
                            variant="primary"
                            className="h-7 text-xs gap-1"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            Deep Search ({selectedIds.size})
                        </AIButton>
                    </div>
                </div>
            )}

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <span className="text-xs text-muted-foreground">
                            {processedData.length} résultat{processedData.length > 1 ? 's' : ''}
                        </span>
                        {/* Column picker */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                                    <Columns className="h-3.5 w-3.5" />
                                    Colonnes
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-[360px] overflow-y-auto">
                                <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {ALL_COLUMNS.map(col => (
                                    <DropdownMenuCheckboxItem
                                        key={col.key}
                                        disabled={col.alwaysVisible}
                                        checked={!!visibleColumns[col.key]}
                                        onCheckedChange={() => toggleCol(col.key)}
                                    >
                                        {col.label}
                                        {col.alwaysVisible && <span className="ml-2 text-[10px] text-muted-foreground">(toujours)</span>}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="rounded-md overflow-x-auto">
                        <Table className="min-w-[600px]">
                            <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                    {/* Always-visible select-all checkbox */}
                                    <TableHead className="w-10 pl-3">
                                        <Checkbox
                                            checked={allSelected}
                                            ref={(el: any) => { if (el) el.indeterminate = someSelected }}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Tout sélectionner"
                                        />
                                    </TableHead>
                                    {visibleCols.map(col => (
                                        <TableHead
                                            key={col.key}
                                            onClick={() => toggleSort(col)}
                                            className={cn(
                                                "text-xs font-semibold text-slate-600 whitespace-nowrap",
                                                col.sortKey && "cursor-pointer select-none hover:text-indigo-700"
                                            )}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                <SortIcon col={col} />
                                            </span>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={visibleCols.length + 1} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Building2 className="h-8 w-8 opacity-20" />
                                                Aucun prospect correspondant aux filtres
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : processedData.map(row => (
                                    <TableRow
                                        key={row.id}
                                        className={cn("cursor-pointer hover:bg-muted/40 transition-colors", selectedIds.has(row.id) && "bg-indigo-50/50")}
                                        onClick={() => router.push(`/prospects/${row.id}`)}
                                    >
                                        {/* Checkbox */}
                                        <TableCell className="pl-3" onClick={e => { e.stopPropagation(); toggleSelect(row.id) }}>
                                            <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} />
                                        </TableCell>

                                        {/* company */}
                                        {visibleColumns.company && (
                                            <TableCell className="font-medium max-w-[220px]">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="line-clamp-1 text-sm">{row.company}</span>
                                                        {row.rappelDate && (() => {
                                                            const rd = new Date(row.rappelDate)
                                                            const now = new Date()
                                                            const isPast = rd <= now
                                                            const isToday = rd.toDateString() === now.toDateString()
                                                            return (
                                                                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border w-fit mt-0.5",
                                                                    isPast ? "text-red-600 bg-red-50 border-red-200" : isToday ? "text-orange-600 bg-orange-50 border-orange-200" : "text-amber-700 bg-amber-50 border-amber-200"
                                                                )}>
                                                                    <Bell className="w-2.5 h-2.5" />
                                                                    {isPast ? 'Rappel passé' : `Rappel ${rd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                                                                </span>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        )}

                                        {/* category */}
                                        {visibleColumns.category && (
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-normal max-w-[140px] truncate">{row.category}</Badge>
                                            </TableCell>
                                        )}

                                        {/* email */}
                                        {visibleColumns.email && (
                                            <TableCell>
                                                {row.email ? (
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Mail className="h-3 w-3 text-emerald-600 shrink-0" />
                                                        <span className="truncate max-w-[180px]">{row.email}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* phone */}
                                        {visibleColumns.phone && (
                                            <TableCell>
                                                {row.phone ? (
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Phone className="h-3 w-3 shrink-0" />
                                                        <span className="whitespace-nowrap">{row.phone}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* city */}
                                        {visibleColumns.city && (
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-sm">
                                                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    {row.city || '—'}
                                                </div>
                                            </TableCell>
                                        )}

                                        {/* deep search */}
                                        {visibleColumns.deep && (
                                            <TableCell>
                                                {row.hasDeepSearch ? (
                                                    <div className="flex items-center gap-1">
                                                        <Sparkles className="w-3.5 h-3.5 text-purple-600 fill-purple-100" />
                                                        <span className="text-xs font-medium text-purple-700">Enrichi</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                        )}

                                        {/* date */}
                                        {visibleColumns.date && (
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {format(row.createdAt, 'd MMM yyyy', { locale: fr })}
                                            </TableCell>
                                        )}

                                        {/* website */}
                                        {visibleColumns.website && (
                                            <TableCell>
                                                {row.website ? (
                                                    <a href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                        onClick={e => e.stopPropagation()}>
                                                        <Globe className="h-3 w-3" /> Site
                                                    </a>
                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* instagram */}
                                        {visibleColumns.instagram && (
                                            <TableCell>
                                                {row.instagram ? (
                                                    <a href={row.instagram.startsWith('http') ? row.instagram : `https://instagram.com/${row.instagram}`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs text-pink-600 hover:underline"
                                                        onClick={e => e.stopPropagation()}>
                                                        <Instagram className="h-3 w-3" /> Voir
                                                    </a>
                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* linkedin */}
                                        {visibleColumns.linkedin && (
                                            <TableCell>
                                                {row.linkedin ? (
                                                    <a href={row.linkedin} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs text-blue-700 hover:underline"
                                                        onClick={e => e.stopPropagation()}>
                                                        <ExternalLink className="h-3 w-3" /> LinkedIn
                                                    </a>
                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* address */}
                                        {visibleColumns.address && (
                                            <TableCell className="max-w-[180px]">
                                                <span className="text-xs line-clamp-2">{row.address || '—'}</span>
                                            </TableCell>
                                        )}

                                        {/* rating */}
                                        {visibleColumns.rating && (
                                            <TableCell>
                                                {row.rating ? (
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                        <span>{row.rating}</span>
                                                        {row.reviews && <span className="text-muted-foreground">({row.reviews})</span>}
                                                    </div>
                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* opening hours */}
                                        {visibleColumns.openingHours && (
                                            <TableCell className="max-w-[160px]">
                                                {row.openingHours ? (
                                                    <div className="flex items-center gap-1 text-xs text-slate-600">
                                                        <Clock className="h-3 w-3 shrink-0" />
                                                        <span className="line-clamp-1">{row.openingHours}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* siret */}
                                        {visibleColumns.siret && (
                                            <TableCell>
                                                <span className="text-xs font-mono">{row.siret || '—'}</span>
                                            </TableCell>
                                        )}

                                        {/* sector */}
                                        {visibleColumns.sector && (
                                            <TableCell>
                                                {row.sector ? <Badge variant="secondary" className="text-xs">{row.sector}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                                            </TableCell>
                                        )}

                                        {/* email status in campaign */}
                                        {visibleColumns.emailStatus && (
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {row.campaignEmailStatuses.length > 0
                                                        ? row.campaignEmailStatuses.map((s, i) => (
                                                            <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", EMAIL_STATUS_STYLES[s] || 'bg-slate-100 text-slate-600')}>
                                                                {EMAIL_STATUS_LABELS[s] || s}
                                                            </span>
                                                        ))
                                                        : <span className="text-muted-foreground text-xs">—</span>}
                                                </div>
                                            </TableCell>
                                        )}

                                        {/* source job */}
                                        {visibleColumns.jobName && (
                                            <TableCell className="max-w-[160px]">
                                                <span className="text-xs truncate line-clamp-1 text-slate-500">{row.jobName || '—'}</span>
                                            </TableCell>
                                        )}

                                        {/* campaigns */}
                                        {visibleColumns.campaign && (
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {row.campaignNames.length > 0
                                                        ? row.campaignNames.map((n, i) => (
                                                            <Badge key={i} variant="outline" className="text-[10px] px-1.5">{n}</Badge>
                                                        ))
                                                        : <span className="text-muted-foreground text-xs">—</span>}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
