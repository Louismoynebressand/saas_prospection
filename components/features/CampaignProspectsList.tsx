"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, Mail, Send, Eye, RefreshCw } from "lucide-react"
import { AddProspectsToCampaignModal } from "./AddProspectsToCampaignModal"
import { ProspectViewModal } from "./ProspectViewModal"
import { ProspectDetailModal } from "./ProspectDetailModal"
import type { CampaignProspectLink, EmailStatus } from "@/types"

interface CampaignProspectsListProps {
    campaignId: string
}

export function CampaignProspectsList({ campaignId }: CampaignProspectsListProps) {
    const [prospects, setProspects] = useState<CampaignProspectLink[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set())
    const [showAddModal, setShowAddModal] = useState(false)
    const [viewingProspect, setViewingProspect] = useState<any>(null)
    const [detailProspect, setDetailProspect] = useState<any>(null)
    const [batchActionLoading, setBatchActionLoading] = useState(false)

    useEffect(() => {
        loadProspects()
    }, [campaignId])

    const loadProspects = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/campaigns/${campaignId}/prospects`)
            if (response.ok) {
                const data = await response.json()
                setProspects(data.prospects || [])
            }
        } catch (error) {
            console.error('Error loading prospects:', error)
            toast.error('Erreur lors du chargement des prospects')
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateEmail = async (prospectIds: string | string[]) => {
        try {
            setBatchActionLoading(true)
            const ids = Array.isArray(prospectIds) ? prospectIds : [prospectIds]

            const response = await fetch(`/api/campaigns/${campaignId}/generate-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds: ids })
            })

            if (!response.ok) throw new Error('Erreur génération')

            const result = await response.json()
            toast.success(`${result.generated} email(s) généré(s)`)
            loadProspects()
            setSelectedProspects(new Set())
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setBatchActionLoading(false)
        }
    }

    const handleSendEmail = async (prospectIds: string | string[]) => {
        try {
            setBatchActionLoading(true)
            const ids = Array.isArray(prospectIds) ? prospectIds : [prospectIds]

            const response = await fetch(`/api/campaigns/${campaignId}/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds: ids })
            })

            if (!response.ok) throw new Error('Erreur envoi')

            const result = await response.json()
            toast.success(`${result.sent} email(s) envoyé(s)`)
            loadProspects()
            setSelectedProspects(new Set())
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setBatchActionLoading(false)
        }
    }

    const handleUpdateStatus = async (prospectId: string, newStatus: EmailStatus) => {
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/update-status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectId, newStatus })
            })

            if (!response.ok) throw new Error('Erreur mise à jour')

            toast.success('Statut mis à jour')
            loadProspects()
        } catch (error: any) {
            toast.error(error.message)
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
            case 'sent': return 'bg-green-100 text-green-800'
            case 'opened': return 'bg-cyan-100 text-cyan-800'
            case 'clicked': return 'bg-indigo-100 text-indigo-800'
            case 'generated': return 'bg-blue-100 text-blue-800'
            case 'bounced': return 'bg-red-100 text-red-800'
            case 'replied': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusLabel = (status: EmailStatus) => {
        switch (status) {
            case 'sent': return 'Envoyé'
            case 'opened': return 'Ouvert'
            case 'clicked': return 'Cliqué'
            case 'generated': return 'Généré'
            case 'bounced': return 'Rebond'
            case 'replied': return 'Répondu'
            case 'not_generated': return 'Non généré'
            default: return 'Aucun'
        }
    }

    const stats = {
        total: prospects.length,
        generated: prospects.filter(p => p.email_status === 'generated' || p.email_status === 'sent').length,
        sent: prospects.filter(p => p.email_status === 'sent').length
    }

    const canGenerateSelected = Array.from(selectedProspects).some(id => {
        const p = prospects.find(pr => pr.prospect_id === id)
        return p?.email_status === 'not_generated'
    })

    const canSendSelected = Array.from(selectedProspects).every(id => {
        const p = prospects.find(pr => pr.prospect_id === id)
        return p?.email_status === 'generated' || p?.email_status === 'sent'
    })

    return (
        <div className="space-y-6">
            {/* Header with stats */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-2xl font-bold">Prospects de la campagne</CardTitle>
                    <Button onClick={() => setShowAddModal(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Ajouter des prospects
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-6 text-sm">
                        <div>
                            <span className="text-muted-foreground">Total : </span>
                            <span className="font-semibold">{stats.total}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Générés : </span>
                            <span className="font-semibold text-blue-600">{stats.generated}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Envoyés : </span>
                            <span className="font-semibold text-green-600">{stats.sent}</span>
                        </div>
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
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : prospects.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-4">Aucun prospect dans cette campagne</p>
                            <Button onClick={() => setShowAddModal(true)}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Ajouter des prospects
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
                                    {prospects.map((cp) => {
                                        const prospect = (cp as any).scrape_prospect as any
                                        const data = typeof prospect?.data_scrapping === 'string'
                                            ? JSON.parse(prospect.data_scrapping)
                                            : prospect?.data_scrapping || {}

                                        const name = data.title || data.name || 'Prospect'
                                        const company = data.company || data.companyName || prospect?.secteur || '-'
                                        const email = prospect?.email_adresse_verified || '-'

                                        return (
                                            <tr key={cp.id} className="border-b hover:bg-gray-50">
                                                <td className="p-4">
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
                                                <td className="p-4">
                                                    <Select
                                                        value={cp.email_status}
                                                        onValueChange={(value) => handleUpdateStatus(cp.prospect_id, value as EmailStatus)}
                                                    >
                                                        <SelectTrigger className="w-[140px]">
                                                            <SelectValue>
                                                                <Badge className={getStatusColor(cp.email_status)}>
                                                                    {getStatusLabel(cp.email_status)}
                                                                </Badge>
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="not_generated">Non généré</SelectItem>
                                                            <SelectItem value="generated">Généré</SelectItem>
                                                            <SelectItem value="sent">Envoyé</SelectItem>
                                                            <SelectItem value="opened">Ouvert</SelectItem>
                                                            <SelectItem value="clicked">Cliqué</SelectItem>
                                                            <SelectItem value="bounced">Rebond</SelectItem>
                                                            <SelectItem value="replied">Répondu</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-end gap-2">
                                                        {cp.email_status === 'not_generated' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleGenerateEmail(cp.prospect_id)}
                                                            >
                                                                <Mail className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        {cp.email_status === 'generated' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleSendEmail(cp.prospect_id)}
                                                            >
                                                                <Send className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setViewingProspect({ ...prospect, campaignLink: cp })}
                                                            title="Aperçu rapide"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setDetailProspect({ ...prospect, campaignLink: cp })}
                                                            title="Voir profil complet"
                                                        >
                                                            👁️ Profil
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
            <AddProspectsToCampaignModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                campaignId={campaignId}
                onSuccess={loadProspects}
            />

            <ProspectViewModal
                open={!!viewingProspect}
                onOpenChange={(open) => !open && setViewingProspect(null)}
                prospect={viewingProspect}
                campaignLink={viewingProspect?.campaignLink}
                onGenerateEmail={() => {
                    if (viewingProspect) {
                        handleGenerateEmail(viewingProspect.id_prospect)
                        setViewingProspect(null)
                    }
                }}
                onSendEmail={() => {
                    if (viewingProspect) {
                        handleSendEmail(viewingProspect.id_prospect)
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
                    if (detailProspect) {
                        handleGenerateEmail(detailProspect.id_prospect)
                        setDetailProspect(null)
                    }
                }}
                onSendEmail={() => {
                    if (detailProspect) {
                        handleSendEmail(detailProspect.id_prospect)
                        setDetailProspect(null)
                    }
                }}
            />
        </div>
    )
}
