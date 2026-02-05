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
    onSendEmail?: () => void
    onGenerateEmail?: () => void
}

export function EmailViewerModal({ open, onOpenChange, email, campaign, onSendEmail, onGenerateEmail }: EmailViewerModalProps) {
    if (!email) return null

    const copyToClipboard = () => {
        if (email.subject && email.content) {
            // Strip HTML tags for clean text copy
            const tempDiv = document.createElement("div")
            tempDiv.innerHTML = email.content
            const cleanContent = tempDiv.innerText || tempDiv.textContent || ""

            const text = `Objet: ${email.subject}\n\n${cleanContent}`

            // Add signature if available and not already part of content (usually it is part of content in this app, but just in case)
            // Actually, the content stored usually includes the signature if generated properly. 
            // If not, we rely on what's displayed. The displayed HTML includes signature logic only if campaign provided.
            // But `email.content` passed here comes from the DB which *should* have the full HTML.
            // If we want to strictly copy what is visually presented including the dynamic signature if it's NOT in the DB content:
            // But usually generated emails are stored WITH signature.
            // Let's assume email.content is the source of truth.

            navigator.clipboard.writeText(text)
            toast.success("Email copié !")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
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
                                className="prose prose-sm max-w-none mb-6 text-slate-800"
                                dangerouslySetInnerHTML={{ __html: email.content || '(Contenu vide)' }}
                            />

                            {/* Fallback Signature Block if not in content (though usually it is) */}
                            {/* ... (existing signature logic is fine to keep visual if needed, but usually generated email has it) ... */}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 mr-auto">
                        {onGenerateEmail && (
                            <Button variant="outline" onClick={onGenerateEmail} className="border-dashed">
                                ⚡ Régénérer
                            </Button>
                        )}
                        {onSendEmail && (
                            <Button onClick={onSendEmail} className="bg-green-600 hover:bg-green-700">
                                ✉️ Envoyer
                            </Button>
                        )}
                    </div>

                    <Button variant="outline" onClick={copyToClipboard} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copier
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Fermer</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
