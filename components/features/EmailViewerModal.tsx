"use client"

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

interface EmailViewerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    email: {
        subject: string | null
        content: string | null
    } | null
}

export function EmailViewerModal({ open, onOpenChange, email }: EmailViewerModalProps) {
    if (!email) return null

    const copyToClipboard = () => {
        if (email.subject && email.content) {
            const text = `Objet: ${email.subject}\n\n${email.content}`
            navigator.clipboard.writeText(text)
            toast.success("Email copié !")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                        <div className="p-4 bg-muted/30 rounded-md text-sm whitespace-pre-wrap leading-relaxed select-text border">
                            {email.content || '(Contenu vide)'}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={copyToClipboard} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copier tout
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Fermer</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
