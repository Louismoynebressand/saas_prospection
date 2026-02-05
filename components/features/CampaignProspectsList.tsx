"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, UserPlus, Mail, Send, Eye } from "lucide-react"
import { AddProspectsToCampaignModal } from "./AddProspectsToCampaignModal"
import { ProspectViewModal } from "./ProspectViewModal"
import { ProspectDetailModal } from "./ProspectDetailModal"
import { EmailViewerModal } from "./EmailViewerModal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
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

    // Polling only when not doing actions
    useEffect(() => {
        let intervalId: NodeJS.Timeout

        const poll = () => {
            if (!batchActionLoading) {
                loadProspects(false)
            }
        }

        intervalId = setInterval(poll, 5000)
        return () => clearInterval(intervalId)
    }, [campaignId, batchActionLoading])

    useEffect(() => {
        loadProspects()
    }, [campaignId, refreshTrigger])

    const loadSmtpConfigs = async () => {
        setLoadingSmtp(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('smtp_configurations')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (!error && data) {
                setSmtpConfigs(data)
                if (data.length > 0) {
                    setSelectedSmtpId(data[0].id)
                }
            }
        } catch (error) {
            console.error('Error loading SMTP configs:', error)
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
                setProspects(data.prospects || [])
            }
        } catch (error) {
            console.error('Error loading prospects:', error)
            if (showLoading) toast.error('Erreur lors du chargement des prospects')
        } finally {
            if (showLoading) setLoading(false)
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

            if (!response.ok) throw new Error('Erreur envoi')

            const result = await response.json()
            toast.success(`${result.sent} email(s) envoyé(s)`)
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

    const handleUpdateStatus = async (prospectId: string, newStatus: EmailStatus) => {
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/update-status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectId, newStatus })
            })

            if (!response.ok) throw new Error('Erreur mise à jour')

            toast.success('Statut mis à jour')
            loadProspects(false)
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
                    {onAddProspects && (
                        <Button onClick={onAddProspects}>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Ajouter des prospects
                        </Button>
                    )}
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
                            {onAddProspects && (
                                <Button onClick={onAddProspects}>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Ajouter des prospects
                                </Button>
                            )}
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

                                        // Email extraction
                                        const email = (Array.isArray(prospect?.email_adresse_verified) && prospect.email_adresse_verified.length > 0)
                                            ? prospect.email_adresse_verified[0]
                                            : (typeof prospect?.email_adresse_verified === 'string' ? prospect.email_adresse_verified : '-')

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
                                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-2">
                                                        {cp.email_status === 'not_generated' ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleGenerateEmail(cp.prospect_id)}
                                                                className="hover:border-violet-300 hover:bg-violet-50 text-violet-700 bg-white shadow-sm transition-all"
                                                            >
                                                                <Mail className="w-4 h-4 mr-2" />
                                                                Générer le mail
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
                                <p className="font-semibold text-amber-900">Aucun compte SMTP configuré</p>
                                <p className="text-sm text-amber-700">Vous devez connecter une adresse email pour envoyer des campagnes.</p>
                            </div>
                            <Button asChild variant="outline" className="mt-2">
                                <Link href="/emails">Configurer un email</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Compte d'envoi</Label>
                                <Select value={selectedSmtpId} onValueChange={setSelectedSmtpId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner un email..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {smtpConfigs.map(config => (
                                            <SelectItem key={config.id} value={config.id}>
                                                {config.from_email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {smtpConfigs.length > 0 && selectedSmtpId && (
                                    <p className="text-xs text-muted-foreground">
                                        L'email sera envoyé via <strong>{smtpConfigs.find(c => c.id === selectedSmtpId)?.from_email}</strong>.
                                    </p>
                                )}
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
        </div>
    )
}
