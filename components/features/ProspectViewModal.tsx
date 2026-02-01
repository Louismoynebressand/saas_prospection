"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { ScrapeProspect, CampaignProspectLink } from "@/types"
import { Mail, Building2, MapPin, Phone, ExternalLink, X } from "lucide-react"

interface ProspectViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    prospect: ScrapeProspect | null
    campaignLink?: CampaignProspectLink
    onGenerateEmail?: () => void
    onSendEmail?: () => void
}

export function ProspectViewModal({
    open,
    onOpenChange,
    prospect,
    campaignLink,
    onGenerateEmail,
    onSendEmail
}: ProspectViewModalProps) {
    if (!prospect) return null

    // Parse data_scrapping
    const prospectData = typeof prospect.data_scrapping === 'string'
        ? JSON.parse(prospect.data_scrapping)
        : prospect.data_scrapping || {}

    const prospectName = prospectData.title || prospectData.name || 'Prospect'
    const prospectCompany = prospectData.company || prospectData.companyName || prospect.secteur
    const prospectTitle = prospectData.jobTitle || prospectData.position
    const prospectPhone = prospectData.phone || prospectData.telephone
    const prospectWebsite = prospectData.website || prospectData.url

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'sent': return 'bg-green-100 text-green-800'
            case 'generated': return 'bg-blue-100 text-blue-800'
            case 'bounced': return 'bg-red-100 text-red-800'
            case 'replied': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'sent': return 'Envoyé'
            case 'generated': return 'Généré'
            case 'bounced': return 'Rebond'
            case 'replied': return 'Répondu'
            case 'not_generated': return 'Non généré'
            default: return 'Aucun'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <span>{prospectName}</span>
                            {campaignLink && (
                                <Badge className={getStatusColor(campaignLink.email_status)}>
                                    {getStatusLabel(campaignLink.email_status)}
                                </Badge>
                            )}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Basic Info */}
                    <div className="space-y-3">
                        {prospectTitle && (
                            <div className="flex items-center gap-2 text-sm">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{prospectTitle}</span>
                            </div>
                        )}

                        {prospectCompany && (
                            <div className="flex items-center gap-2 text-sm">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span>{prospectCompany}</span>
                            </div>
                        )}

                        {prospect.ville && (
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span>{prospect.ville}</span>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Contact Info */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Contact</h4>

                        {prospect.email_adresse_verified && (
                            <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span className="break-all">{prospect.email_adresse_verified}</span>
                                {prospect.succed_validation_smtp_email && (
                                    <Badge variant="outline" className="text-xs">✓ Vérifié</Badge>
                                )}
                            </div>
                        )}

                        {prospectPhone && (
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span>{prospectPhone}</span>
                            </div>
                        )}

                        {prospectWebsite && (
                            <div className="flex items-center gap-2 text-sm">
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                <a
                                    href={prospectWebsite}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    {prospectWebsite}
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Generated Email Preview */}
                    {campaignLink?.generated_email_content && (
                        <>
                            <Separator />
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Email généré</h4>
                                {campaignLink.generated_email_subject && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Sujet</p>
                                        <p className="font-medium text-sm">{campaignLink.generated_email_subject}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Contenu</p>
                                    <div className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap">
                                        {campaignLink.generated_email_content}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-4">
                        {onGenerateEmail && campaignLink?.email_status === 'not_generated' && (
                            <Button onClick={onGenerateEmail} className="flex-1">
                                📧 Générer l'email
                            </Button>
                        )}
                        {onSendEmail && campaignLink?.email_status === 'generated' && (
                            <Button onClick={onSendEmail} variant="default" className="flex-1">
                                ✉️ Envoyer
                            </Button>
                        )}
                        <Button onClick={() => onOpenChange(false)} variant="outline">
                            Fermer
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
