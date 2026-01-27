"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, ArrowRight, CheckCircle2, Globe, Building2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface CreateCampaignWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: (campaignId: string) => void
}

type WizardStep = 'identity' | 'strategy' | 'review'

export function CreateCampaignWizard({ open, onOpenChange, onSuccess }: CreateCampaignWizardProps) {
    const [step, setStep] = useState<WizardStep>('identity')
    const [loading, setLoading] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const router = useRouter()

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        my_company_name: "",
        my_website: "",
        pitch: "",
        main_offer: "",
        pain_points: "" // stored as string in textarea, converted to array on save
    })

    // --- ACTIONS ---

    const handleAiAnalyze = async () => {
        if (!formData.my_website) {
            toast.error("Veuillez entrer un site web pour l'analyse")
            return
        }

        setAiLoading(true)
        try {
            // TODO: Replace with real n8n webhook call later
            // Simulating AI delay
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Mock Response from AI
            setFormData(prev => ({
                ...prev,
                pitch: "Leader en solutions de prospection automatisée pour les agences digitales.",
                main_offer: "Notre plateforme permet de scraper Google Maps, enrichir les emails et générer des messages ultra-personnalisés en 1 clic.",
                pain_points: "- Perte de temps sur la recherche de leads\n- Données de contact obsolètes\n- Taux de réponse faible aux emails génériques"
            }))

            toast.success("Analyse terminée ! Données pré-remplies.")
            setStep('strategy')

        } catch (error) {
            toast.error("Erreur lors de l'analyse IA")
        } finally {
            setAiLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!formData.name) {
            toast.error("Le nom de la campagne est requis")
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) throw new Error("Non connecté")

            // Convert pain_points string to array
            const painPointsArray = formData.pain_points.split('\n').filter(line => line.trim() !== '').map(l => l.replace(/^- /, ''))

            const { data, error } = await supabase
                .from('cold_email_campaigns')
                .insert({
                    user_id: user.id,
                    name: formData.name,
                    my_company_name: formData.my_company_name,
                    my_website: formData.my_website,
                    pitch: formData.pitch,
                    main_offer: formData.main_offer,
                    pain_points: painPointsArray,
                    status: 'active', // Default to active for now
                    tone: 'professional',
                    language: 'fr'
                })
                .select()
                .single()

            if (error) throw error

            toast.success("Campagne créée avec succès !")
            if (onSuccess) onSuccess(data.id)
            onOpenChange(false)

            // Reset form
            setStep('identity')
            setFormData({
                name: "",
                my_company_name: "",
                my_website: "",
                pitch: "",
                main_offer: "",
                pain_points: ""
            })

        } catch (error: any) {
            console.error(error)
            toast.error("Erreur à la création: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    // --- STEPS RENDER ---

    const renderIdentityStep = () => (
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="camp_name">Nom de la Campagne *</Label>
                <Input
                    id="camp_name"
                    placeholder="ex: Prospection Agences Immo - Q1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="company">Votre Entreprise</Label>
                    <div className="relative">
                        <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="company"
                            className="pl-9"
                            placeholder="ex: Super Agency"
                            value={formData.my_company_name}
                            onChange={(e) => setFormData({ ...formData, my_company_name: e.target.value })}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="website">Votre Site Web</Label>
                    <div className="relative">
                        <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="website"
                            className="pl-9"
                            placeholder="https://..."
                            value={formData.my_website}
                            onChange={(e) => setFormData({ ...formData, my_website: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col gap-3 mt-4">
                <div className="flex items-center gap-2 text-blue-800 font-medium">
                    <Sparkles className="w-4 h-4" />
                    Assistant IA
                </div>
                <p className="text-sm text-blue-600">
                    Laissez l'IA analyser votre site web pour extraire votre proposition de valeur et remplir la stratégie automatiquement.
                </p>
                <Button
                    variant="default"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleAiAnalyze}
                    disabled={aiLoading}
                >
                    {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Analyser & Pré-remplir
                </Button>
            </div>

            <div className="flex justify-end pt-2">
                <Button variant="ghost" className="text-muted-foreground" onClick={() => setStep('strategy')}>
                    Passer cette étape <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
            </div>
        </div>
    )

    const renderStrategyStep = () => (
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="pitch">Pitch (Phrase de positionnement)</Label>
                <Textarea
                    id="pitch"
                    placeholder="Nous aidons les [cible] à [bénéfice] grâce à [méthode]."
                    value={formData.pitch}
                    onChange={(e) => setFormData({ ...formData, pitch: e.target.value })}
                    rows={2}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="offer">Offre Principale</Label>
                <Textarea
                    id="offer"
                    placeholder="Décrivez votre offre phare..."
                    value={formData.main_offer}
                    onChange={(e) => setFormData({ ...formData, main_offer: e.target.value })}
                    rows={3}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="pains">Douleurs (Pain Points)</Label>
                <Textarea
                    id="pains"
                    placeholder="- Manque de temps..."
                    value={formData.pain_points}
                    onChange={(e) => setFormData({ ...formData, pain_points: e.target.value })}
                    rows={3}
                    className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Un point par ligne.</p>
            </div>
        </div>
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Nouvelle Campagne</DialogTitle>
                    <DialogDescription>
                        Configurez votre profil de prospection.
                    </DialogDescription>
                    {/* Stepper Indicator */}
                    <div className="flex items-center gap-2 mt-4 text-sm font-medium text-muted-foreground">
                        <span className={step === 'identity' ? "text-primary" : ""}>1. Identité</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className={step === 'strategy' ? "text-primary" : ""}>2. Stratégie</span>
                    </div>
                </DialogHeader>

                {step === 'identity' && renderIdentityStep()}
                {step === 'strategy' && renderStrategyStep()}

                <DialogFooter>
                    {step === 'strategy' && (
                        <Button variant="outline" onClick={() => setStep('identity')} className="mr-auto">
                            Retour
                        </Button>
                    )}

                    {step === 'identity' ? (
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Créer la campange
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
