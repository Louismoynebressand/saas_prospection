"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Search, Filter, SlidersHorizontal, Calendar, X, ChevronDown,
    Mail, Phone, Globe, Instagram, Sparkles, Users, Target, Building2
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { ProspectFilters, ScrapJob, CampaignInfo } from "@/hooks/useProspectsData"

interface ProspectsFilterBarProps {
    filters: ProspectFilters
    onFilter: <K extends keyof ProspectFilters>(key: K, val: ProspectFilters[K]) => void
    onReset: () => void
    scrapeJobs: ScrapJob[]
    campaigns: CampaignInfo[]
    availableCategories: string[]
    availableCities: string[]
    totalCount: number
    filteredCount: number
}

const EMAIL_STATUSES = [
    { value: 'not_generated', label: 'Non généré', color: 'bg-gray-100 text-gray-600' },
    { value: 'pending', label: 'En attente', color: 'bg-orange-100 text-orange-700' },
    { value: 'generated', label: 'Généré', color: 'bg-violet-100 text-violet-700' },
    { value: 'sent', label: 'Envoyé', color: 'bg-blue-100 text-blue-700' },
    { value: 'delivered', label: 'Délivré', color: 'bg-teal-100 text-teal-700' },
    { value: 'opened', label: 'Ouvert', color: 'bg-cyan-100 text-cyan-700' },
    { value: 'clicked', label: 'Cliqué', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'bounced', label: 'Rebond', color: 'bg-red-100 text-red-700' },
    { value: 'replied', label: 'Répondu', color: 'bg-emerald-100 text-emerald-700' },
]

export function ProspectsFilterBar({
    filters, onFilter, onReset,
    scrapeJobs, campaigns, availableCategories, availableCities,
    totalCount, filteredCount
}: ProspectsFilterBarProps) {

    const activeFiltersCount = [
        filters.jobIds.size > 0,
        filters.categories.size > 0,
        filters.cities.size > 0,
        filters.hasEmail,
        filters.hasPhone,
        filters.hasWebsite,
        filters.hasInstagram,
        filters.hasDeepSearch,
        filters.inCampaign,
        filters.emailStatuses.size > 0,
        filters.dateFilter !== 'all',
    ].filter(Boolean).length

    const toggleSet = (set: Set<string>, val: string): Set<string> => {
        const next = new Set(set)
        next.has(val) ? next.delete(val) : next.add(val)
        return next
    }

    const getJobLabel = (job: ScrapJob) => {
        let name = job.request_search || ''
        try { name = JSON.parse(name) } catch { name = name.replace(/"/g, '') }
        return job.resuest_ville ? `${name} • ${job.resuest_ville}` : name
    }

    return (
        <div className="space-y-2">
            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Rechercher par société, catégorie, ville, email..."
                    className="pl-9 h-9"
                    value={filters.searchQuery}
                    onChange={e => onFilter('searchQuery', e.target.value)}
                />
                {filters.searchQuery && (
                    <button
                        onClick={() => onFilter('searchQuery', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Filter chips row */}
            <div className="flex flex-wrap gap-1.5 items-center">

                {/* Filter by Search/Job */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("gap-1.5 h-8 text-xs", filters.jobIds.size > 0 && "border-indigo-400 bg-indigo-50 text-indigo-700")}>
                            <Building2 className="h-3.5 w-3.5" />
                            {filters.jobIds.size === 0 ? 'Recherches' : `${filters.jobIds.size} recherche(s)`}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto w-72">
                        <DropdownMenuLabel>Filtrer par recherche scraping</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {filters.jobIds.size > 0 && (
                            <div className="px-2 py-1">
                                <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => onFilter('jobIds', new Set())}>
                                    Effacer ({filters.jobIds.size})
                                </Button>
                            </div>
                        )}
                        {scrapeJobs.map(job => (
                            <DropdownMenuCheckboxItem
                                key={job.id_jobs}
                                checked={filters.jobIds.has(job.id_jobs)}
                                onCheckedChange={() => onFilter('jobIds', toggleSet(filters.jobIds, job.id_jobs))}
                            >
                                <span className="truncate text-xs">{getJobLabel(job)}</span>
                            </DropdownMenuCheckboxItem>
                        ))}
                        {scrapeJobs.length === 0 && <div className="p-3 text-xs text-center text-muted-foreground">Aucune recherche</div>}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Category */}
                {availableCategories.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("gap-1.5 h-8 text-xs", filters.categories.size > 0 && "border-violet-400 bg-violet-50 text-violet-700")}>
                                <Filter className="h-3.5 w-3.5" />
                                {filters.categories.size === 0 ? 'Catégories' : `${filters.categories.size} cat.`}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto">
                            <DropdownMenuLabel>Catégories</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {filters.categories.size > 0 && (
                                <div className="px-2 py-1"><Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => onFilter('categories', new Set())}>Effacer</Button></div>
                            )}
                            {availableCategories.map(cat => (
                                <DropdownMenuCheckboxItem key={cat} checked={filters.categories.has(cat)} onCheckedChange={() => onFilter('categories', toggleSet(filters.categories, cat))}>
                                    {cat}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* City */}
                {availableCities.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("gap-1.5 h-8 text-xs", filters.cities.size > 0 && "border-teal-400 bg-teal-50 text-teal-700")}>
                                {filters.cities.size === 0 ? 'Villes' : `${filters.cities.size} ville(s)`}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto">
                            <DropdownMenuLabel>Villes</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {filters.cities.size > 0 && (
                                <div className="px-2 py-1"><Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => onFilter('cities', new Set())}>Effacer</Button></div>
                            )}
                            {availableCities.map(city => (
                                <DropdownMenuCheckboxItem key={city} checked={filters.cities.has(city)} onCheckedChange={() => onFilter('cities', toggleSet(filters.cities, city))}>
                                    {city}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Quick toggle filters */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("gap-1.5 h-8 text-xs", (filters.hasEmail || filters.hasPhone || filters.hasWebsite || filters.hasInstagram || filters.hasDeepSearch) && "border-emerald-400 bg-emerald-50 text-emerald-700")}>
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Données
                            {(filters.hasEmail || filters.hasPhone || filters.hasWebsite || filters.hasInstagram || filters.hasDeepSearch) && (
                                <Badge className="ml-1 h-4 px-1 text-[10px] bg-emerald-600">
                                    {[filters.hasEmail, filters.hasPhone, filters.hasWebsite, filters.hasInstagram, filters.hasDeepSearch].filter(Boolean).length}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-2">
                        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Filtrer par données présentes</p>
                        {[
                            { key: 'hasEmail' as const, icon: <Mail className="h-3.5 w-3.5 text-emerald-600" />, label: 'Avec email vérifié' },
                            { key: 'hasPhone' as const, icon: <Phone className="h-3.5 w-3.5 text-blue-600" />, label: 'Avec téléphone' },
                            { key: 'hasWebsite' as const, icon: <Globe className="h-3.5 w-3.5 text-indigo-600" />, label: 'Avec site web' },
                            { key: 'hasInstagram' as const, icon: <Instagram className="h-3.5 w-3.5 text-pink-600" />, label: 'Avec Instagram' },
                            { key: 'hasDeepSearch' as const, icon: <Sparkles className="h-3.5 w-3.5 text-purple-600" />, label: 'Deep Search effectué' },
                        ].map(({ key, icon, label }) => (
                            <button
                                key={key}
                                onClick={() => onFilter(key, !filters[key])}
                                className={cn(
                                    "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                                    filters[key] && "bg-emerald-50 text-emerald-800 font-medium"
                                )}
                            >
                                {icon}
                                {label}
                                {filters[key] && <X className="h-3 w-3 ml-auto" />}
                            </button>
                        ))}
                    </PopoverContent>
                </Popover>

                {/* Campaign filters */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("gap-1.5 h-8 text-xs", (filters.inCampaign || filters.emailStatuses.size > 0) && "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700")}>
                            <Target className="h-3.5 w-3.5" />
                            Campagne
                            {(filters.inCampaign || filters.emailStatuses.size > 0) && (
                                <Badge className="ml-1 h-4 px-1 text-[10px] bg-fuchsia-600">
                                    {[filters.inCampaign, filters.emailStatuses.size > 0].filter(Boolean).length}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-2 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground px-1">Filtres campagne</p>

                        {/* In campaign toggle */}
                        <button
                            onClick={() => { onFilter('inCampaign', !filters.inCampaign); if (filters.inCampaign) onFilter('campaignId', '') }}
                            className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted", filters.inCampaign && "bg-fuchsia-50 text-fuchsia-800 font-medium")}
                        >
                            <Users className="h-3.5 w-3.5" />
                            Dans une campagne
                            {filters.inCampaign && <X className="h-3 w-3 ml-auto" />}
                        </button>

                        {/* Which campaign */}
                        {filters.inCampaign && campaigns.length > 0 && (
                            <select
                                value={filters.campaignId}
                                onChange={e => onFilter('campaignId', e.target.value)}
                                className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                            >
                                <option value="">Toutes les campagnes</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}

                        <div className="border-t pt-2">
                            <p className="text-[10px] font-semibold text-muted-foreground px-1 mb-1">Statut email dans campagne</p>
                            <div className="flex flex-wrap gap-1">
                                {EMAIL_STATUSES.map(s => (
                                    <button
                                        key={s.value}
                                        onClick={() => onFilter('emailStatuses', toggleSet(filters.emailStatuses, s.value))}
                                        className={cn(
                                            "text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all",
                                            filters.emailStatuses.has(s.value)
                                                ? s.color + ' border-current'
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Date filter */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("gap-1.5 h-8 text-xs", filters.dateFilter !== 'all' && "border-amber-400 bg-amber-50 text-amber-700")}>
                            <Calendar className="h-3.5 w-3.5" />
                            {filters.dateFilter === 'all' ? 'Date' :
                                filters.dateFilter === 'today' ? "Auj." :
                                    filters.dateFilter === 'week' ? 'Semaine' :
                                        filters.dateFilter === 'month' ? 'Mois' : 'Perso'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-52 p-2">
                        <div className="space-y-1">
                            {(['all', 'today', 'week', 'month'] as const).map(f => (
                                <Button key={f} variant={filters.dateFilter === f ? 'default' : 'ghost'} size="sm" className="w-full justify-start text-xs h-8" onClick={() => onFilter('dateFilter', f)}>
                                    {f === 'all' ? 'Toutes dates' : f === 'today' ? "Aujourd'hui" : f === 'week' ? 'Cette semaine' : 'Ce mois'}
                                </Button>
                            ))}
                            <div className="border-t pt-1 space-y-1">
                                <p className="text-[10px] text-muted-foreground px-2">Période personnalisée</p>
                                <Input type="date" className="h-7 text-xs" value={filters.customDateFrom ? format(filters.customDateFrom, 'yyyy-MM-dd') : ''} onChange={e => { onFilter('customDateFrom', e.target.value ? new Date(e.target.value) : undefined); onFilter('dateFilter', 'custom') }} />
                                <Input type="date" className="h-7 text-xs" value={filters.customDateTo ? format(filters.customDateTo, 'yyyy-MM-dd') : ''} onChange={e => { onFilter('customDateTo', e.target.value ? new Date(e.target.value) : undefined); onFilter('dateFilter', 'custom') }} />
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Reset */}
                {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1">
                        <X className="h-3.5 w-3.5" />
                        Réinitialiser ({activeFiltersCount})
                    </Button>
                )}

                {/* Count */}
                <span className="ml-auto text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{filteredCount}</span>
                    {filteredCount !== totalCount && <span> / {totalCount}</span>}
                    {' '}prospect{filteredCount > 1 ? 's' : ''}
                </span>
            </div>
        </div>
    )
}
