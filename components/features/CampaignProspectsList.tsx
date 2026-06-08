"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, UserPlus, Mail, Send, Eye, Zap, Server, Star, Settings, Trash2, Search, X, Filter, Link2, RefreshCw } from "lucide-react"
import { AddProspectsToCampaignModal } from "./AddProspectsToCampaignModal"
import { ProspectViewModal } from "./ProspectViewModal"
import { ProspectDetailModal } from "./ProspectDetailModal"
import { EmailViewerModal } from "./EmailViewerModal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { EmailLinkStats } from "./EmailLinkStats"
import { AlertCircle, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { CampaignProspectLink, EmailStatus, Campaign } from "@/types"

interface CampaignProspectsListProps {
    campaignId: string
    campaign?: Campaign
    onAddProspects?: () => void
    refreshTrigger?: number
}

export function CampaignProspectsList({ campaignId, campaign, onAddProspects, refreshTrigger = 0 }: CampaignProspectsListProps) {
    const [prospects, setProspects] = useState<CampaignProspectLink[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set())
    const [viewingProspect, setViewingProspect] = useState<any>(null)
    const [viewingEmail, setViewingEmail] = useState<{ subject: string | null, content: string | null } | null>(null)
    const [detailProspect, setDetailProspect] = useState<any>(null)
    const [batchActionLoading, setBatchActionLoading] = useState(false)

    // SMTP Selection State
    const [smtpConfigs, setSmtpConfigs] = useState<any[]>([])
    const [showSendDialog, setShowSendDialog] = useState(false)
    const [selectedSmtpId, setSelectedSmtpId] = useState<string>("")
    const [pendingSendIds, setPendingSendIds] = useState<string[]>([])
    const [loadingSmtp, setLoadingSmtp] = useState(false)

    // Per-row loading state for generate action
    const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())

    // Batch generation guard
    const [inProgressCount, setInProgressCount] = useState(0)
    const [checkingJob, setCheckingJob] = useState(false)
    const [showCap50Dialog, setShowCap50Dialog] = useState(false)
    const [pendingGenerateIds, setPendingGenerateIds] = useState<string[]>([])

    // Search & filter state
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')

    // Link tracking regeneration
    const [regeneratingLinks, setRegeneratingLinks] = useState(false)
    const [trackingStats, setTrackingStats] = useState<{ total: number; withClicks: number } | null>(null)

    // Supabase Realtime: subscribe to campaign_prospects changes
    useEffect(() => {
        const supabase = createClient()

        const channel = supabase
            .channel(`campaign-prospects-${campaignId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'campaign_prospects',
                    filter: `campaign_id=eq.${campaignId}`
                },
                (payload: any) => {
                    const newRecord = payload.new
                    const changedProspectId = newRecord?.prospect_id?.toString()
                    const newStatus = newRecord?.email_status

                    // Always reload to refresh the list
                    void loadProspects(false)

                    // Clear the generating spinner only when the prospect has a terminal status
                    // (generated, sent, bounced, etc.) — keep spinner while still 'pending'
                    const doneStatuses = ['generated', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'replied', 'not_generated']
                    if (changedProspectId && newStatus && doneStatuses.includes(newStatus)) {
                        setGeneratingIds(prev => {
                            const next = new Set(prev)
                            next.delete(changedProspectId)
                            return next
                        })
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [campaignId])

    // Count total prospects currently in pending/running jobs for this campaign
    const checkInProgressCount = useCallback(async (): Promise<number> => {
        setCheckingJob(true)
        try {
            const supabase = createClient()
            const { data } = await supabase
                .from('cold_email_jobs')
                .select('prospect_ids')
                .eq('campaign_id', campaignId)
                .in('status', ['pending', 'running'])
                .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

            const total = (data || []).reduce((sum: number, job: any) => {
                return sum + (Array.isArray(job.prospect_ids) ? job.prospect_ids.length : 0)
            }, 0)
            setInProgressCount(total)
            return total
        } catch {
            return 0
        } finally {
            setCheckingJob(false)
        }
    }, [campaignId])

    useEffect(() => { checkInProgressCount() }, [checkInProgressCount])

    useEffect(() => {
        loadProspects()
    }, [campaignId, refreshTrigger])

    const loadSmtpConfigs = async () => {
        setLoadingSmtp(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('smtp_configurations')
                .select('id, name, from_email, provider, is_default, mailgun_domain')
                .eq('is_active', true)
                .order('is_default', { ascending: false }) // défaut en premier
                .order('created_at', { ascending: false })

            if (!error && data) {
                setSmtpConfigs(data)
                // Présélectionner le compte par défaut, sinon le premier
                const defaultAccount = data.find((c: any) => c.is_default) || data[0]
                if (defaultAccount) setSelectedSmtpId(defaultAccount.id)
            }
        } catch (error) {
            console.error('Error loading sending configs:', error)
        } finally {
            setLoadingSmtp(false)
        }
    }

    // Load SMTPs on mount
    useEffect(() => {
        loadSmtpConfigs()
    }, [])

    const loadProspects = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true)
            const response = await fetch(`/api/campaigns/${campaignId}/prospects`)
            if (response.ok) {
                const data = await response.json()
                const prospectsList = data.prospects || []
                setProspects(prospectsList)

                // Refresh open modals with fresh data
                setDetailProspect((prev: any) => {
                    if (!prev) return null;
                    const updatedCp = prospectsList.find((p: any) => p.prospect_id === prev.campaignLink?.prospect_id)
                    if (updatedCp) return { ...updatedCp.prospect, campaignLink: updatedCp }
                    return prev
                })

                setViewingProspect((prev: any) => {
                    if (!prev) return null;
                    const updatedCp = prospectsList.find((p: any) => p.prospect_id === prev.campaignLink?.prospect_id)
                    if (updatedCp) return { ...updatedCp.prospect, campaignLink: updatedCp }
                    return prev
                })

                // Auto-mark 'pending' prospects as generating so spinner shows on reload
                const pendingIds = prospectsList
                    .filter((p: any) => p.email_status === 'pending')
                    .map((p: any) => p.prospect_id?.toString())
                if (pendingIds.length > 0) {
                    setGeneratingIds((prev: Set<string>) => new Set([...prev, ...pendingIds]))
                }
            }
        } catch (error) {
            console.error('Error loading prospects:', error)
            if (showLoading) toast.error('Erreur lors du chargement des prospects')
        } finally {
            if (showLoading) setLoading(false)
        }
    }

    const handleRemoveProspects = async (prospectIds: string | string[]) => {
        const ids = Array.isArray(prospectIds) ? prospectIds : [prospectIds]
        if (!window.confirm(`Retirer ${ids.length} prospect(s) de cette campagne ?`)) return
        try {
            setBatchActionLoading(true)
            const response = await fetch(`/api/campaigns/${campaignId}/prospects`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds: ids })
            })
            if (!response.ok) throw new Error('Erreur lors de la suppression')
            toast.success(`${ids.length} prospect(s) retiré(s) de la campagne`)
            setSelectedProspects(new Set())
            loadProspects(false)
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setBatchActionLoading(false)
        }
    }

    const handleRegenerateTracking = async () => {
        try {
            setRegeneratingLinks(true)
            const response = await fetch(`/api/campaigns/${campaignId}/regenerate-tracking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            const data = await response.json()
            if (!response.ok) {
                toast.error(data.error || 'Erreur lors de la régénération des liens')
                return
            }
            if (data.total_links_created === 0) {
                toast.warning('Aucun lien créé — vérifiez que la signature a bien un téléphone, email, site web ou lien personnalisé configuré.')
            } else {
                toast.success(`${data.total_links_created} lien(s) de tracking régénéré(s) pour ${data.regenerated} prospect(s) ✅`, { duration: 5000 })
                setTrackingStats({ total: data.total_links_created, withClicks: 0 })
            }
        } catch (error: any) {
            toast.error('Erreur : ' + error.message)
        } finally {
            setRegeneratingLinks(false)
        }
    }

    const handleGenerateEmail = async (prospectIds: string | string[]) => {
        const rawIds = (Array.isArray(prospectIds) ? prospectIds : [prospectIds]).map(id => String(id))

        // Count currently in-progress prospects
        const currentInProgress = await checkInProgressCount()
        const remaining = 50 - currentInProgress

        if (remaining <= 0) {
            toast.error(`Limite atteinte — ${currentInProgress} génération(s) en cours`, {
                description: "Attendez que les emails en cours soient terminés avant d'en lancer d'autres.",
                duration: 6000
            })
            return
        }

        // If selection + in-progress > 50, cap to remaining slots
        if (rawIds.length > remaining) {
            setPendingGenerateIds(rawIds.slice(0, remaining))
            setShowCap50Dialog(true)
            return
        }

        await _doGenerate(rawIds)
    }

    const _doGenerate = async (ids: string[]) => {
        const capped = ids.slice(0, 50)

        // Mark rows as generating
        setGeneratingIds(prev => new Set([...prev, ...capped]))
        toast.info(`Génération en cours pour ${capped.length} prospect(s)... ⚡`, { duration: 4000 })

        try {
            setBatchActionLoading(true)

            const response = await fetch(`/api/campaigns/${campaignId}/generate-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds: capped })
            })

            if (!response.ok) throw new Error('Erreur génération')

            // Webhook triggered — N8N will update the DB, Realtime will pick it up
            toast.success(`Demande de génération envoyée ✅ — Le mail apparaîtra automatiquement dès qu'il est prêt.`, { duration: 6000 })
            setSelectedProspects(new Set())
            setShowCap50Dialog(false)
            setPendingGenerateIds([])
            checkInProgressCount()
        } catch (error: any) {
            toast.error(error.message)
            // Remove from generating on error
            setGeneratingIds(prev => {
                const next = new Set(prev)
                capped.forEach(id => next.delete(String(id)))
                return next
            })
        } finally {
            setBatchActionLoading(false)
            // Keep generatingIds — they'll be cleared when Realtime updates the status
        }
    }

    const handleSendEmail = (prospectIds: string | string[]) => {
        const ids = Array.isArray(prospectIds) ? prospectIds : [prospectIds]
        setPendingSendIds(ids)
        setShowSendDialog(true)
        // Ensure fetching if empty (though should be fetched on mount)
        if (smtpConfigs.length === 0) loadSmtpConfigs()
    }

    const confirmSendEmail = async () => {
        if (!selectedSmtpId) {
            toast.error("Veuillez sélectionner un compte d'envoi")
            return
        }

        try {
            setBatchActionLoading(true)
            const ids = pendingSendIds

            const response = await fetch(`/api/campaigns/${campaignId}/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospectIds: ids,
                    smtpConfigurationId: selectedSmtpId
                })
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Erreur envoi')
            }
            const result = await response.json()
            
            if (result.sent === 0 && result.results && result.results.length > 0) {
                const errorMsg = result.results[0].error || 'Erreur inconnue'
                toast.error(`Échec de l'envoi : ${errorMsg}`)
            } else {
                toast.success(`${result.sent} email(s) en cours d'envoi ⏳`)
            }
            
            loadProspects()
            setSelectedProspects(new Set())
            setShowSendDialog(false)
            setPendingSendIds([])
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setBatchActionLoading(false)
        }
    }

    const handleUpdateStatus = async (prospectId: string, newStatus: EmailStatus, force = false) => {
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/update-status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectId, newStatus, force })
            })

            const data = await response.json()

            // 409 = retour arrière depuis un statut irréversible → demander confirmation
            if (response.status === 409 && data.canForce) {
                const confirmed = window.confirm(data.error)
                if (confirmed) {
                    // Relancer avec force=true
                    await handleUpdateStatus(prospectId, newStatus, true)
                }
                return
            }

            if (!response.ok) {
                toast.error(data.error || 'Erreur mise à jour du statut')
                return
            }

            toast.success('Statut mis à jour')
            loadProspects(false)
        } catch (error: any) {
            toast.error('Erreur réseau lors de la mise à jour')
        }
    }

    const toggleProspect = (prospectId: string) => {
        const newSet = new Set(selectedProspects)
        if (newSet.has(prospectId)) {
            newSet.delete(prospectId)
        } else {
            newSet.add(prospectId)
        }
        setSelectedProspects(newSet)
    }

    const toggleSelectAll = () => {
        if (selectedProspects.size === prospects.length) {
            setSelectedProspects(new Set())
        } else {
            setSelectedProspects(new Set(prospects.map(p => p.prospect_id)))
        }
    }

    const getStatusColor = (status: EmailStatus) => {
        switch (status) {
            case 'sending': return 'bg-amber-100 text-amber-800'
            case 'sent': return 'bg-green-100 text-green-800 border-transparent'
            case 'delivered': return 'bg-emerald-100 text-emerald-800 border-transparent'
            case 'opened': return 'bg-cyan-100 text-cyan-800 border-transparent'
            case 'clicked': return 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-sm shadow-indigo-100 animate-in zoom-in'
            case 'generated': return 'bg-violet-100 text-violet-800'
            case 'bounced': return 'bg-red-100 text-red-800 border-transparent'
            case 'replied': return 'bg-purple-100 text-purple-800 border-transparent'
            case 'pending': return 'bg-orange-100 text-orange-800'
            default: return 'bg-gray-100 text-gray-800 border-transparent'
        }
    }

    const getStatusLabel = (status: EmailStatus) => {
        switch (status) {
            case 'pending': return '⏳ En attente'
            case 'sending': return '📤 En cours d\'envoi'
            case 'sent': return '✉️ Envoyé'
            case 'delivered': return '✅ Délivré'
            case 'opened': return '👁 Ouvert'
            case 'clicked': return '🖱 Cliqué'
            case 'generated': return '📝 Généré'
            case 'bounced': return '❌ Rebond'
            case 'replied': return '💬 Répondu'
            case 'not_generated': return 'Non généré'
            default: return 'Inconnu'
        }
    }

    const stats = {
        total: prospects.length,
        generated: prospects.filter(p => p.email_status === 'generated' || p.email_status === 'sent').length,
        sent: prospects.filter(p => p.email_status === 'sent').length
    }

    // Filtered prospects based on search and status
    const filteredProspects = prospects.filter(cp => {
        const prospect = (cp as any).scrape_prospect as any
        let data: any = {}
        try {
            data = typeof prospect?.data_scrapping === 'string'
                ? JSON.parse(prospect.data_scrapping)
                : prospect?.data_scrapping || {}
        } catch (e) { /* ignore */ }

        const name = data.title || data.nom_complet || data.name || data.Titre || (data.nom ? `${data.prenom || ''} ${data.nom}`.trim() : null) || ''
        const company = data.company || data.companyName || data.societe || prospect?.secteur || ''
        const rawEmail = prospect?.email_adresse_verified
        let email = ''
        if (Array.isArray(rawEmail) && rawEmail.length > 0) email = rawEmail[0]
        else if (typeof rawEmail === 'string' && rawEmail.trim().startsWith('[')) {
            try { const p = JSON.parse(rawEmail); email = Array.isArray(p) && p.length > 0 ? p[0] : rawEmail } catch { email = rawEmail }
        } else if (typeof rawEmail === 'string') email = rawEmail

        const q = searchQuery.toLowerCase()
        const matchesSearch = !searchQuery ||
            name.toLowerCase().includes(q) ||
            company.toLowerCase().includes(q) ||
            email.toLowerCase().includes(q)

        const matchesStatus = filterStatus === 'all' || cp.email_status === filterStatus

        return matchesSearch && matchesStatus
    })

    const canGenerateSelected = Array.from(selectedProspects).some(id => {
        const p = prospects.find(pr => pr.prospect_id === id)
        return p?.email_status === 'not_generated'
    })

    const canSendSelected = Array.from(selectedProspects).every(id => {
        const p = prospects.find(pr => pr.prospect_id === id)
        return p?.email_status === 'generated' || p?.email_status === 'sent'
    })

    return (
        <div className="space-y-4">
            {/* Header with stats */}
            <Card className="border-border/50">
                <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base md:text-xl font-bold">Prospects</CardTitle>
                        <div className="flex items-center gap-2">
                            {/* Regenerate tracking links button */}
                            {prospects.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenerateTracking}
                                    disabled={regeneratingLinks}
                                    title="Régénérer les liens de tracking pour tous les prospects (à faire après modification de la signature)"
                                    className="gap-1.5 text-xs text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
                                >
                                    {regeneratingLinks ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Link2 className="w-3.5 h-3.5" />
                                    )}
                                    <span className="hidden sm:inline">Liens tracking</span>
                                    <RefreshCw className="w-3 h-3" />
                                </Button>
                            )}
                            {onAddProspects && (
                                <Button onClick={onAddProspects} size="sm" className="gap-1.5 shrink-0">
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Ajouter des prospects</span>
                                    <span className="sm:hidden">Ajouter</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            <span className="font-bold">{stats.total}</span> total
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            <span className="font-bold">{stats.generated}</span> générés
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <span className="font-bold">{stats.sent}</span> envoyés
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Batch actions */}
            {selectedProspects.size > 0 && (
                <Card className="border-indigo-200 bg-indigo-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">
                                {selectedProspects.size} prospect(s) sélectionné(s)
                            </div>
                            <div className="flex gap-2">
                                {canGenerateSelected && (
                                    <Button
                                        onClick={() => handleGenerateEmail(Array.from(selectedProspects))}
                                        disabled={batchActionLoading}
                                        size="sm"
                                    >
                                        {batchActionLoading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Mail className="w-4 h-4 mr-2" />
                                        )}
                                        Générer
                                    </Button>
                                )}
                                {canSendSelected && (
                                    <Button
                                        onClick={() => handleSendEmail(Array.from(selectedProspects))}
                                        disabled={batchActionLoading}
                                        variant="default"
                                        size="sm"
                                    >
                                        {batchActionLoading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4 mr-2" />
                                        )}
                                        Envoyer
                                    </Button>
                                )}
                                <Button
                                    onClick={() => handleRemoveProspects(Array.from(selectedProspects))}
                                    disabled={batchActionLoading}
                                    variant="outline"
                                    size="sm"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Retirer
                                </Button>
                                <Button
                                    onClick={() => setSelectedProspects(new Set())}
                                    variant="ghost"
                                    size="sm"
                                >
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Prospects table */}
            <Card>
                <CardContent className="p-0">
                    {/* Search and filter bar */}
                    {!loading && prospects.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2 px-4 py-3 border-b bg-slate-50/50">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Rechercher par nom, société, email..."
                                    className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="not_generated">Non généré</option>
                                <option value="pending">En attente</option>
                                <option value="generated">Généré</option>
                                <option value="sending">En cours d'envoi</option>
                                <option value="sent">Envoyé</option>
                                <option value="delivered">Délivré</option>
                                <option value="opened">Ouvert</option>
                                <option value="clicked">Cliqué</option>
                                <option value="bounced">Rebond</option>
                                <option value="replied">Répondu</option>
                            </select>
                            {(searchQuery || filterStatus !== 'all') && (
                                <span className="text-xs text-muted-foreground self-center whitespace-nowrap">
                                    {filteredProspects.length} / {prospects.length}
                                </span>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : prospects.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-4">Aucun prospect dans cette campagne</p>
                            {onAddProspects && (
                                <Button onClick={onAddProspects}>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Ajouter des prospects
                                </Button>
                            )}
                        </div>
                    ) : filteredProspects.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-2">Aucun prospect correspondant</p>
                            <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setFilterStatus('all') }}>
                                <X className="w-3.5 h-3.5 mr-1" /> Réinitialiser les filtres
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 text-left">
                                            <Checkbox
                                                checked={selectedProspects.size === prospects.length}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="p-4 text-left font-semibold">Prospect</th>
                                        <th className="p-4 text-left font-semibold">Entreprise</th>
                                        <th className="p-4 text-left font-semibold">Email</th>
                                        <th className="p-4 text-left font-semibold">Statut</th>
                                        <th className="p-4 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProspects.map((cp) => {
                                        const prospect = (cp as any).scrape_prospect as any
                                        let data: any = {}
                                        try {
                                            data = typeof prospect?.data_scrapping === 'string'
                                                ? JSON.parse(prospect.data_scrapping)
                                                : prospect?.data_scrapping || {}
                                        } catch (e) {
                                            console.error("Error parsing scrape data", e)
                                        }

                                        // Robust name extraction
                                        const name = data.title || data.nom_complet || data.name || data.Titre || (data.nom ? `${data.prenom || ''} ${data.nom}`.trim() : null) || 'Prospect'

                                        // Robust company extraction
                                        const company = data.company || data.companyName || data.societe || prospect?.secteur || '-'

                                        // Email extraction — gère array JS, string JSON ["..."], ou string simple
                                        let email = '-'
                                        const rawEmail = prospect?.email_adresse_verified
                                        if (Array.isArray(rawEmail) && rawEmail.length > 0) {
                                            email = rawEmail[0]
                                        } else if (typeof rawEmail === 'string' && rawEmail.trim().startsWith('[')) {
                                            // C'est une string JSON de tableau ex: ["email@example.com"]
                                            try {
                                                const parsed = JSON.parse(rawEmail)
                                                email = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : rawEmail
                                            } catch {
                                                email = rawEmail
                                            }
                                        } else if (typeof rawEmail === 'string' && rawEmail.length > 0) {
                                            email = rawEmail
                                        }

                                        return (
                                            <tr
                                                key={cp.id}
                                                className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => setDetailProspect({ ...prospect, campaignLink: cp })}
                                            >
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedProspects.has(cp.prospect_id)}
                                                        onCheckedChange={() => toggleProspect(cp.prospect_id)}
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium">{name}</div>
                                                    {data.jobTitle && (
                                                        <div className="text-sm text-muted-foreground">{data.jobTitle}</div>
                                                    )}
                                                </td>
                                                <td className="p-4">{company}</td>
                                                <td className="p-4 text-sm">{email}</td>
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex flex-col gap-2 items-start">
                                                        <Select
                                                            value={cp.email_status}
                                                            onValueChange={(value) => handleUpdateStatus(cp.prospect_id, value as EmailStatus)}
                                                        >
                                                            <SelectTrigger className="w-[140px]">
                                                                <SelectValue>
                                                                    <Badge variant="outline" className={cn("text-xs font-bold py-1", getStatusColor(cp.email_status))}>
                                                                        {getStatusLabel(cp.email_status)}
                                                                    </Badge>
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="not_generated">Non généré</SelectItem>
                                                                <SelectItem value="pending">⏳ En attente</SelectItem>
                                                                <SelectItem value="generated">📝 Généré</SelectItem>
                                                                <SelectItem value="sending">📤 En cours d'envoi</SelectItem>
                                                                <SelectItem value="sent">✉️ Envoyé</SelectItem>
                                                                <SelectItem value="delivered">✅ Délivré</SelectItem>
                                                                <SelectItem value="opened">👁 Ouvert</SelectItem>
                                                                <SelectItem value="clicked">🎯 Cliqué</SelectItem>
                                                                <SelectItem value="bounced">❌ Rebond</SelectItem>
                                                                <SelectItem value="replied">💬 Répondu</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {(cp as any).links_click_count > 0 && (
                                                            <div className="w-[140px]">
                                                                <EmailLinkStats 
                                                                    prospectId={cp.prospect_id} 
                                                                    campaignId={campaignId} 
                                                                    compact={true} 
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-2">
                                                        {/* Action button: spinner if pending or generating, generate if not_generated, view if generated */}
                                                        {(cp.email_status === 'pending' || generatingIds.has(String(cp.prospect_id))) ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled
                                                                className="text-amber-600 border-amber-200 bg-amber-50 cursor-not-allowed"
                                                            >
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                Génération en cours...
                                                            </Button>
                                                        ) : cp.email_status === 'not_generated' ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleGenerateEmail(cp.prospect_id)}
                                                                className="hover:border-violet-300 hover:bg-violet-50 text-violet-700 bg-white shadow-sm transition-all"
                                                            >
                                                                <Mail className="w-4 h-4 mr-2" />Générer le mail
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setViewingEmail({
                                                                        subject: cp.generated_email_subject || null,
                                                                        content: cp.generated_email_content || null,
                                                                        // @ts-ignore - passing extra data for actions
                                                                        prospectId: cp.prospect_id
                                                                    })
                                                                }}
                                                                className="bg-white/60 hover:bg-white border border-violet-100 text-violet-700 shadow-[0_2px_10px_rgba(139,92,246,0.1)] hover:shadow-[0_2px_15px_rgba(139,92,246,0.2)] backdrop-blur-sm transition-all duration-300"
                                                            >
                                                                <Eye className="w-4 h-4 mr-2" />
                                                                Voir le mail
                                                            </Button>
                                                        )}

                                                        {cp.email_status === 'generated' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleSendEmail(cp.prospect_id)}
                                                                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0 shadow-[0_2px_10px_rgba(168,85,247,0.3)] hover:shadow-[0_4px_15px_rgba(168,85,247,0.4)] transition-all duration-300"
                                                            >
                                                                <Send className="w-4 h-4 mr-2" />
                                                                Envoyer
                                                            </Button>
                                                        )}

                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setDetailProspect({ ...prospect, campaignLink: cp })}
                                                            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                                        >
                                                            Profil
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleRemoveProspects(cp.prospect_id)}
                                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2"
                                                            title="Retirer de la campagne"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modals */}
            <EmailViewerModal
                open={!!viewingEmail}
                onOpenChange={(open) => !open && setViewingEmail(null)}
                email={viewingEmail}
                campaign={campaign}
                onSendEmail={viewingEmail ? () => {
                    // @ts-ignore
                    if (viewingEmail.prospectId) handleSendEmail(viewingEmail.prospectId)
                    setViewingEmail(null)
                } : undefined}
                onGenerateEmail={viewingEmail ? () => {
                    // @ts-ignore
                    if (viewingEmail.prospectId) handleGenerateEmail(viewingEmail.prospectId)
                    setViewingEmail(null)
                } : undefined}
            />

            <ProspectViewModal
                open={!!viewingProspect}
                onOpenChange={(open) => !open && setViewingProspect(null)}
                prospect={viewingProspect}
                campaignLink={viewingProspect?.campaignLink}
                onGenerateEmail={() => {
                    if (viewingProspect && viewingProspect.campaignLink) {
                        handleGenerateEmail(viewingProspect.campaignLink.prospect_id)
                        setViewingProspect(null)
                    }
                }}
                onSendEmail={() => {
                    if (viewingProspect && viewingProspect.campaignLink) {
                        handleSendEmail(viewingProspect.campaignLink.prospect_id)
                        setViewingProspect(null)
                    }
                }}
            />

            <ProspectDetailModal
                open={!!detailProspect}
                onOpenChange={(open) => !open && setDetailProspect(null)}
                prospect={detailProspect}
                campaignLink={detailProspect?.campaignLink}
                onGenerateEmail={() => {
                    if (detailProspect && detailProspect.campaignLink) {
                        handleGenerateEmail(detailProspect.campaignLink.prospect_id)
                        setDetailProspect(null)
                    }
                }}
                onSendEmail={() => {
                    if (detailProspect && detailProspect.campaignLink) {
                        handleSendEmail(detailProspect.campaignLink.prospect_id)
                        setDetailProspect(null)
                    }
                }}
            />

            {/* Send Confirmation Dialog */}
            <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmer l'envoi</DialogTitle>
                        <DialogDescription>
                            Vous allez envoyer cet email à {pendingSendIds.length} destinataire(s).
                        </DialogDescription>
                    </DialogHeader>

                    {loadingSmtp ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : smtpConfigs.length === 0 ? (
                        <div className="flex flex-col items-center gap-4 py-4 text-center">
                            <div className="p-3 bg-amber-100 rounded-full">
                                <AlertCircle className="w-6 h-6 text-amber-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-amber-900">Aucun compte d'envoi configuré</p>
                                <p className="text-sm text-amber-700">Configurez un compte SMTP ou Mailgun pour envoyer des campagnes.</p>
                            </div>
                            <Button asChild variant="outline" className="mt-2">
                                <Link href="/emails">Configurer un compte d'envoi</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4">
                            {/* Compte par défaut affiché en haut */}
                            {smtpConfigs.find(c => c.is_default) && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                                    <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span className="text-amber-800">
                                        Compte par défaut : <strong>{smtpConfigs.find(c => c.is_default)?.from_email}</strong>
                                    </span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Compte d'envoi</Label>
                                <Select value={selectedSmtpId} onValueChange={setSelectedSmtpId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner un compte..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {smtpConfigs.map(config => {
                                            const isMailgun = config.provider === 'mailgun_api'
                                            return (
                                                <SelectItem key={config.id} value={config.id}>
                                                    <div className="flex items-center gap-2">
                                                        {isMailgun
                                                            ? <Zap className="w-3 h-3 text-indigo-500 shrink-0" />
                                                            : <Server className="w-3 h-3 text-blue-500 shrink-0" />
                                                        }
                                                        <span className="truncate">{config.from_email}</span>
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-1 ${
                                                            isMailgun
                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {isMailgun ? 'Mailgun' : 'SMTP'}
                                                        </span>
                                                        {config.is_default && (
                                                            <Star className="w-3 h-3 text-amber-400 shrink-0" />
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>

                                {selectedSmtpId && (() => {
                                    const selected = smtpConfigs.find(c => c.id === selectedSmtpId)
                                    if (!selected) return null
                                    const isMailgun = selected.provider === 'mailgun_api'
                                    return (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                            {isMailgun
                                                ? <><Zap className="w-3 h-3 text-indigo-500" />Envoi via <strong>Mailgun API</strong> — tracking ouvertures/clics disponible</>   
                                                : <><Server className="w-3 h-3 text-blue-500" />Envoi via <strong>SMTP</strong> — {selected.from_email}</>
                                            }
                                        </p>
                                    )
                                })()}
                            </div>

                            {/* Lien pour changer le compte par défaut */}
                            <div className="flex items-center justify-between pt-1 border-t">
                                <p className="text-xs text-muted-foreground">Pour changer le compte par défaut :</p>
                                <Button asChild variant="ghost" size="sm" className="text-xs h-7 gap-1">
                                    <Link href="/emails">
                                        <Settings className="w-3 h-3" />
                                        Paramètres d'envoi
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSendDialog(false)}>Annuler</Button>
                        <Button
                            onClick={confirmSendEmail}
                            disabled={batchActionLoading || smtpConfigs.length === 0 || !selectedSmtpId}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                        >
                            {batchActionLoading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4 mr-2" />
                            )}
                            Envoyer maintenant
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cap-50 confirmation dialog */}
            <Dialog open={showCap50Dialog} onOpenChange={setShowCap50Dialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Limite de 50 prospects par lot
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed">
                            Vous avez sélectionné <strong>{pendingGenerateIds.length + inProgressCount} prospects</strong> au total ({inProgressCount} déjà en cours).
                            La limite est de <strong>50 par lot</strong>. Les <strong>{pendingGenerateIds.length} prochains</strong> seront envoyés dans les emplacements restants.
                            <br /><br />
                            Une fois terminés, vous pourrez relancer pour les suivants.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setShowCap50Dialog(false); setPendingGenerateIds([]) }}>
                            Annuler
                        </Button>
                        <Button
                            onClick={() => _doGenerate(pendingGenerateIds)}
                            disabled={batchActionLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {batchActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                            Générer les 50 premiers
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
