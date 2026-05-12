"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Bookmark, Plus, X, Eye, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProspectFilters } from "@/hooks/useProspectsData"

export interface SavedView {
    id: string
    name: string
    filters: Partial<ProspectFilters>
    visibleColumns: Record<string, boolean>
}

const STORAGE_KEY = 'prospects_saved_views'

const DEFAULT_VIEWS: SavedView[] = [
    {
        id: 'all',
        name: 'Tous',
        filters: {},
        visibleColumns: {},
    },
    {
        id: 'with_email',
        name: 'Avec email',
        filters: { hasEmail: true },
        visibleColumns: { contact: true },
    },
    {
        id: 'deep_search',
        name: 'Deep Search',
        filters: { hasDeepSearch: true },
        visibleColumns: { deep: true, website: true, linkedin: true },
    },
]

function loadViews(): SavedView[] {
    if (typeof window === 'undefined') return DEFAULT_VIEWS
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed: SavedView[] = JSON.parse(stored)
            // Restore Set objects (JSON doesn't serialize Sets)
            return parsed.map(v => ({
                ...v,
                filters: {
                    ...v.filters,
                    jobIds: new Set((v.filters as any).jobIds || []),
                    categories: new Set((v.filters as any).categories || []),
                    cities: new Set((v.filters as any).cities || []),
                    emailStatuses: new Set((v.filters as any).emailStatuses || []),
                }
            }))
        }
    } catch { /* ignore */ }
    return []
}

function saveViews(views: SavedView[]) {
    if (typeof window === 'undefined') return
    try {
        // Convert Sets to arrays for JSON serialization
        const serializable = views.map(v => ({
            ...v,
            filters: {
                ...v.filters,
                jobIds: Array.from((v.filters as any).jobIds || []),
                categories: Array.from((v.filters as any).categories || []),
                cities: Array.from((v.filters as any).cities || []),
                emailStatuses: Array.from((v.filters as any).emailStatuses || []),
            }
        }))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
    } catch { /* ignore */ }
}

interface ProspectsSavedViewsProps {
    currentFilters: ProspectFilters
    currentColumns: Record<string, boolean>
    onLoadView: (view: SavedView) => void
    activeViewId: string | null
    onActiveViewChange: (id: string | null) => void
}

export function ProspectsSavedViews({
    currentFilters,
    currentColumns,
    onLoadView,
    activeViewId,
    onActiveViewChange,
}: ProspectsSavedViewsProps) {
    const [userViews, setUserViews] = useState<SavedView[]>(() => loadViews())
    const [saveModalOpen, setSaveModalOpen] = useState(false)
    const [newViewName, setNewViewName] = useState('')

    const allViews = [...DEFAULT_VIEWS, ...userViews]

    const handleSave = () => {
        if (!newViewName.trim()) return
        const view: SavedView = {
            id: `view_${Date.now()}`,
            name: newViewName.trim(),
            filters: { ...currentFilters },
            visibleColumns: { ...currentColumns },
        }
        const next = [...userViews, view]
        setUserViews(next)
        saveViews(next)
        setSaveModalOpen(false)
        setNewViewName('')
        onLoadView(view)
        onActiveViewChange(view.id)
    }

    const handleDelete = (id: string) => {
        const next = userViews.filter(v => v.id !== id)
        setUserViews(next)
        saveViews(next)
        if (activeViewId === id) onActiveViewChange(null)
    }

    const handleLoad = (view: SavedView) => {
        onLoadView(view)
        onActiveViewChange(view.id)
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">Vues :</span>

            {allViews.map(view => (
                <div key={view.id} className="flex items-center group">
                    <button
                        onClick={() => handleLoad(view)}
                        className={cn(
                            "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
                            activeViewId === view.id
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
                        )}
                    >
                        {view.name}
                    </button>
                    {/* Only user views can be deleted */}
                    {!DEFAULT_VIEWS.find(d => d.id === view.id) && (
                        <button
                            onClick={() => handleDelete(view.id)}
                            className="ml-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
            ))}

            {/* Save current view */}
            <Button
                variant="outline"
                size="sm"
                onClick={() => setSaveModalOpen(true)}
                className="h-7 text-xs gap-1 border-dashed"
            >
                <Plus className="h-3 w-3" />
                Enregistrer vue
            </Button>

            {/* Save modal */}
            <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bookmark className="h-4 w-4 text-indigo-600" />
                            Enregistrer cette vue
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Les filtres actifs et les colonnes visibles seront sauvegardés.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        placeholder="Ex: Prospects Paris avec email"
                        value={newViewName}
                        onChange={e => setNewViewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveModalOpen(false)}>Annuler</Button>
                        <Button onClick={handleSave} disabled={!newViewName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
