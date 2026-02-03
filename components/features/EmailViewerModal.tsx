import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Campaign } from "@/types"

interface EmailViewerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    email: {
        subject: string | null
        content: string | null
    } | null
    campaign?: Campaign
}

export function EmailViewerModal({ open, onOpenChange, email, campaign }: EmailViewerModalProps) {
    if (!email) return null

    const copyToClipboard = () => {
        if (email.subject && email.content) {
            // Primitive text copy - ideally we'd copy the rendered text or HTML
            const text = `Objet: ${email.subject}\n\n${email.content}`
            navigator.clipboard.writeText(text)
            toast.success("Email copié !")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Email Généré</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Objet</h3>
                        <div className="p-3 bg-muted/50 rounded-md text-sm font-medium select-text">
                            {email.subject || '(Sans objet)'}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Contenu</h3>
                        <div className="p-6 bg-white border rounded-md text-sm leading-relaxed shadow-sm">
                            {/* Main Content (HTML rendered) */}
                            <div
                                className="prose prose-sm max-w-none mb-6"
                                dangerouslySetInnerHTML={{ __html: email.content || '(Contenu vide)' }}
                            />

                            {/* Signature Block (Only if campaign provided) */}
                            {campaign && (
                                <div className="pt-4 border-t border-gray-100 mt-4 text-slate-700">
                                    <p className="mb-3">{campaign.closing_phrase || "Cordialement,"}</p>

                                    <div className="font-semibold text-gray-900">
                                        {campaign.signature_name || "L'équipe"}
                                    </div>
                                    {campaign.signature_title && (
                                        <div className="text-gray-600">{campaign.signature_title}</div>
                                    )}
                                    {campaign.signature_company && (
                                        <div className="font-medium text-indigo-700 mt-0.5">{campaign.signature_company}</div>
                                    )}

                                    <div className="mt-3 space-y-0.5 text-xs text-gray-500">
                                        {campaign.signature_email && (
                                            <div>{campaign.signature_email}</div>
                                        )}
                                        {campaign.signature_phone && (
                                            <div>{campaign.signature_phone}</div>
                                        )}
                                        {campaign.signature_website_text && (
                                            <div>{campaign.signature_website_text}</div>
                                        )}
                                    </div>

                                    {campaign.signature_ps && (
                                        <div className="mt-4 text-xs italic text-gray-500 border-l-2 border-gray-200 pl-3">
                                            PS: {campaign.signature_ps}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={copyToClipboard} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copier texte brut
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Fermer</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
