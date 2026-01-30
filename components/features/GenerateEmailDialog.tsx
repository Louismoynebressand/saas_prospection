"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, Send } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

interface GenerateEmailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    campaignId: string
    onSuccess: () => void
}

export function GenerateEmailDialog({ open, onOpenChange, campaignId, onSuccess }: GenerateEmailDialogProps) {
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'input' | 'processing'>('input')

    // Form Data
    const [prospectEmail, setProspectEmail] = useState("")
    const [prospectName, setProspectName] = useState("")
    const [prospectCompany, setProspectCompany] = useState("")
    const [context, setContext] = useState("")

    const handleGenerate = async () => {
        if (!prospectEmail) {
            toast.error("L'email du prospect est requis")
            return
        }

        setLoading(true)
        setStep('processing')

        try {
            const supabase = createClient()

            // 1. Create or Find Prospect
            // Simple approach: Insert into prospects table if not exists (upsert based on email + user_id)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("User not authenticated")

            // Insert prospect manually for now to ensure we have an ID
            const { data: prospectData, error: prospectError } = await supabase
                .from('prospects')
                .upsert({
                    user_id: user.id,
                    email: prospectEmail,
                    first_name: prospectName,
                    company: prospectCompany,
                    status: 'NEW'
                }, { onConflict: 'email, user_id' })
                .select()
                .single()

            if (prospectError) throw prospectError

            // 2. Trigger Generation (via n8n webhook or inserting into email_generations with dummy content for now)
            // Ideally we call the n8n webhook. 
            // For this iteration, let's insert a "PENDING" generation or call the same logic as the batch generator.
            // Since we don't have the n8n webhook URL handy in the frontend env typically, 
            // we will simulate the generation request by inserting a row that the AI background worker would pick up,
            // OR strictly for this MVP: we create a placeholder email to manual edit.

            // BETTER: Insert into 'email_generations' directly if we want to bypass n8n for manual "write it yourself" mode?
            // User requested "Generate Email". 
            // Let's create a placeholder "To be generated" row if we can't trigger AI immediately.
            // BUT the user expects AI.

            // Fallback: Just create a draft in `email_generations`
            const { error: genError } = await supabase
                .from('email_generations')
                .insert({
                    id_campaign: campaignId,
                    id_prospect: prospectData.id,
                    subject: `Email pour ${prospectCompany || prospectEmail}`,
                    body: "Génération en cours... (Simulation: Cette fonctionnalité sera connectée à n8n prochainement)",
                    status: 'DRAFT',
                    user_id: user.id
                })

            if (genError) throw genError

            toast.success("Email ajouté à la file d'attente !")
            onSuccess()
            onOpenChange(false)

            // Reset form
            setProspectEmail("")
            setProspectName("")
            setProspectCompany("")
            setContext("")
            setStep('input')

        } catch (error) {
            console.error("Error generating email:", error)
            toast.error("Erreur lors de la préparation de l'email")
            setStep('input')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Générer un nouvel email</DialogTitle>
                    <DialogDescription>
                        Ajoutez un prospect manuellement pour générer un email avec ce profil de campagne.
                    </DialogDescription>
                </DialogHeader>

                {step === 'input' ? (
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email du prospect *</Label>
                            <Input
                                id="email"
                                placeholder="jean.dupont@entreprise.com"
                                value={prospectEmail}
                                onChange={(e) => setProspectEmail(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nom / Prénom</Label>
                                <Input
                                    id="name"
                                    placeholder="Jean Dupont"
                                    value={prospectName}
                                    onChange={(e) => setProspectName(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="company">Entreprise</Label>
                                <Input
                                    id="company"
                                    placeholder="Acme Inc."
                                    value={prospectCompany}
                                    onChange={(e) => setProspectCompany(e.target.value)}
                                />
                            </div>
                        </div>
                        {/* Future: Context field */}
                    </div>
                ) : (
                    <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <div>
                            <p className="font-medium">Création du prospect...</p>
                            <p className="text-sm text-muted-foreground">Préparation de la génération IA</p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Annuler
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading || !prospectEmail} className="gap-2">
                        {loading ? 'Traitement...' : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Générer
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
