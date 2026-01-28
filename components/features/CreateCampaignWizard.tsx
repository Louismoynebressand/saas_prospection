"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Globe, Building2, Target, Award, Pen } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface CreateCampaignWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: (campaignId: string) => void
}

type WizardStep = 'identity' | 'positioning' | 'targeting' | 'signature'

export function CreateCampaignWizard({ open, onOpenChange, onSuccess }: CreateCampaignWizardProps) {
    const [step, setStep] = useState<WizardStep>('identity')
    const [loading, setLoading] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const [campaignId, setCampaignId] = useState<string | null>(null)
    const router = useRouter()

    // Form State (mapped to NEW schema)
    const [formData, setFormData] = useState({
        // Step 1: Identity
        campaign_name: "",
        my_company_name: "",
        my_website: "",

        // Step 2: Positioning & Offer
        pitch: "",
        main_offer: "",
        pain_points: "", // stored as string in textarea, converted to array on save
        main_promise: "",
        secondary_benefits: [] as string[],

        // Step 3: Targeting & Proof
        objective: "BOOK_MEETING" as "BOOK_MEETING" | "DEMO" | "FREE_TRIAL" | "QUOTE" | "DISCOUNT" | "CALLBACK" | "DOWNLOAD" | "WEBINAR",
        target_audience: "",
        target_sectors: [] as string[],
        target_company_size: "",

        // Step 4: Signature & Constraints
        signature_name: "",
        signature_title: "",
        signature_company: "",
        signature_phone: "",
        signature_email: "",
        signature_ps: "",
        desired_tone: "professional",
        formal: true,
        email_length: "STANDARD" as "CONCISE" | "STANDARD" | "DETAILED",
        language: "fr" as "fr" | "en",
    })

    // --- ACTIONS ---

    const handleAiAnalyze = async () => {
        if (!formData.my_website) {
            toast.error("Veuillez entrer un site web pour l'analyse")
            return
        }

        setAiLoading(true)
        try {
            // Call our internal API proxy which calls n8n
            const response = await fetch('/api/campaigns/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    website: formData.my_website,
                    company: formData.my_company_name
                })
            })

            if (!response.ok) throw new Error("Erreur lors de l'analyse")

            const data = await response.json()

            // Map n8n response fields to our form
            let formattedPainPoints = ""
            if (Array.isArray(data.pain_points)) {
                formattedPainPoints = data.pain_points.map((p: string) => `- ${p}`).join('\n')
            } else if (typeof data.pain_points === 'string') {
                formattedPainPoints = data.pain_points
            }

            setFormData(prev => ({
                ...prev,
                pitch: data.pitch || "",
                main_offer: data.main_offer || "",
                pain_points: formattedPainPoints,
                main_promise: data.main_promise || ""
            }))

            toast.success("Analyse terminée ! Données pré-remplies.")
            setStep('positioning')

        } catch (error) {
            console.error(error)
            toast.error("Erreur lors de l'analyse IA. Vérifiez le site web.")
        } finally {
            setAiLoading(false)
        }
    }

    const saveCampaign = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Non connecté")

        // Convert pain_points string to array
        const painPointsArray = formData.pain_points
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(l => l.replace(/^- /, ''))

        const campaignData = {
            user_id: user.id,
            campaign_name: formData.campaign_name,
            my_company_name: formData.my_company_name,
            my_website: formData.my_website,
            pitch: formData.pitch,
            main_offer: formData.main_offer,
            pain_points: painPointsArray,
            main_promise: formData.main_promise,
            secondary_benefits: formData.secondary_benefits,
            objective: formData.objective,
            target_audience: formData.target_audience,
            target_sectors: formData.target_sectors,
            target_company_size: formData.target_company_size,
            signature_name: formData.signature_name,
            signature_title: formData.signature_title,
            signature_company: formData.signature_company,
            signature_phone: formData.signature_phone,
            signature_email: formData.signature_email,
            signature_ps: formData.signature_ps,
            desired_tone: formData.desired_tone,
            formal: formData.formal,
            email_length: formData.email_length,
            language: formData.language,
            status: 'DRAFT',
            is_active: true,
        }

        if (campaignId) {
            // UPDATE existing campaign
            const { error } = await supabase
                .from('cold_email_campaigns')
                .update(campaignData)
                .eq('id', campaignId)

            if (error) throw error
        } else {
            // INSERT new campaign
            const { data, error } = await supabase
                .from('cold_email_campaigns')
                .insert(campaignData)
                .select()
                .single()

            if (error) throw error
            setCampaignId(data.id)
        }
    }

    const handleNext = async () => {
        try {
            setLoading(true)

            // Step 1: Create campaign immediately
            if (step === 'identity') {
                if (!formData.campaign_name) {
                    toast.error("Le nom de la campagne est requis")
                    return
                }
                await saveCampaign()
                toast.success("Campagne créée !")
                setStep('positioning')
            }
            else if (step === 'positioning') {
                await saveCampaign()
                setStep('targeting')
            }
            else if (step === 'targeting') {
                await saveCampaign()
                setStep('signature')
            }
        } catch (error: any) {
            console.error(error)
            toast.error("Erreur: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleFinish = async () => {
        try {
            setLoading(true)
            await saveCampaign()

            // Mark as ACTIVE
            const supabase = createClient()
            await supabase
                .from('cold_email_campaigns')
                .update({ status: 'ACTIVE' })
                .eq('id', campaignId)

            toast.success("Campagne créée avec succès !")
            if (onSuccess && campaignId) onSuccess(campaignId)
            onOpenChange(false)

            // Reset form
            setStep('identity')
            setCampaignId(null)
            setFormData({
                campaign_name: "",
                my_company_name: "",
                my_website: "",
                pitch: "",
                main_offer: "",
                pain_points: "",
                main_promise: "",
                secondary_benefits: [],
                objective: "BOOK_MEETING",
                target_audience: "",
                target_sectors: [],
                target_company_size: "",
                signature_name: "",
                signature_title: "",
                signature_company: "",
                signature_phone: "",
                signature_email: "",
                signature_ps: "",
                desired_tone: "professional",
                formal: true,
                email_length: "STANDARD",
                language: "fr",
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
                    placeholder="ex: Prospection Agences Immo - Q1 2024"
                    value={formData.campaign_name}
                    onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="company">Votre Entreprise *</Label>
                    <div className="relative">
                        <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="company"
                            className="pl-9"
                            placeholder="ex: SuperProspect"
                            value={formData.my_company_name}
                            onChange={(e) => setFormData({ ...formData, my_company_name: e.target.value })}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="website">Votre Site Web *</Label>
                    <div className="relative">
                        <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="website"
                            className="pl-9"
                            placeholder="https://superprospect.io"
                            value={formData.my_website}
                            onChange={(e) => setFormData({ ...formData, my_website: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 flex flex-col gap-3 mt-6">
                <div className="flex items-center gap-2 text-blue-800 font-semibold">
                    <Sparkles className="w-5 h-5" />
                    ✨ Assistant IA - Gain de temps 20s
                </div>
                <p className="text-sm text-blue-700">
                    L'IA analyse votre site web et pré-remplit automatiquement votre stratégie marketing, offre, et points de douleur.
                </p>
                <Button
                    variant="default"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                    onClick={handleAiAnalyze}
                    disabled={aiLoading || !formData.my_website}
                >
                    {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Analyser & Pré-remplir
                </Button>
                <Button
                    variant="ghost"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={handleNext}
                >
                    → Continuer sans pré-remplissage IA
                </Button>
            </div>
        </div>
    )

    const renderPositioningStep = () => (
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="pitch">Pitch (Positionnement) *</Label>
                <Textarea
                    id="pitch"
                    placeholder="Nous aidons les [cible] à [bénéfice] grâce à [méthode]."
                    value={formData.pitch}
                    onChange={(e) => setFormData({ ...formData, pitch: e.target.value })}
                    rows={2}
                />
                <p className="text-xs text-muted-foreground">Décrivez votre positionnement en une phrase.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="offer">Offre Principale *</Label>
                <Textarea
                    id="offer"
                    placeholder="Outil d'automatisation de prospection B2B avec email finder intégré..."
                    value={formData.main_offer}
                    onChange={(e) => setFormData({ ...formData, main_offer: e.target.value })}
                    rows={3}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="pains">Pain Points (Douleurs)</Label>
                <Textarea
                    id="pains"
                    placeholder="- Trop de temps perdu en prospection manuelle&#10;- Taux de réponse faible&#10;- Manque de données de contact"
                    value={formData.pain_points}
                    onChange={(e) => setFormData({ ...formData, pain_points: e.target.value })}
                    rows={4}
                    className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Un point par ligne (optionnel mais recommandé).</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="promise">Promesse Principale</Label>
                <Input
                    id="promise"
                    placeholder="ex: +40% de RDV qualifiés en 30j"
                    value={formData.main_promise}
                    onChange={(e) => setFormData({ ...formData, main_promise: e.target.value })}
                />
            </div>
        </div>
    )

    const renderTargetingStep = () => (
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="objective">Objectif de Campagne *</Label>
                <Select value={formData.objective} onValueChange={(value: any) => setFormData({ ...formData, objective: value })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="BOOK_MEETING">📅 Réserver un RDV</SelectItem>
                        <SelectItem value="DEMO">🎥 Demander une démo</SelectItem>
                        <SelectItem value="FREE_TRIAL">🆓 Essai gratuit</SelectItem>
                        <SelectItem value="QUOTE">💰 Demander un devis</SelectItem>
                        <SelectItem value="CALLBACK">📞 Être rappelé</SelectItem>
                        <SelectItem value="DOWNLOAD">📥 Télécharger une ressource</SelectItem>
                        <SelectItem value="WEBINAR">🎓 S'inscrire à un webinar</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="target">Audience Cible (ICP)</Label>
                <Textarea
                    id="target"
                    placeholder="ex: CEO de PME SaaS B2B entre 10 et 50 employés"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    rows={2}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="sectors">Secteurs Visés</Label>
                    <Input
                        id="sectors"
                        placeholder="SaaS, E-commerce, Agences..."
                        value={formData.target_sectors.join(', ')}
                        onChange={(e) => setFormData({
                            ...formData,
                            target_sectors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="size">Taille Entreprise</Label>
                    <Select value={formData.target_company_size} onValueChange={(value) => setFormData({ ...formData, target_company_size: value })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1-10">1-10 employés</SelectItem>
                            <SelectItem value="11-50">11-50 employés</SelectItem>
                            <SelectItem value="51-200">51-200 employés</SelectItem>
                            <SelectItem value="201-500">201-500 employés</SelectItem>
                            <SelectItem value="500+">500+ employés</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )

    const renderSignatureStep = () => (
        <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                    <Pen className="w-4 h-4" />
                    Signature de l'email
                </h4>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="sig_name">Nom *</Label>
                        <Input
                            id="sig_name"
                            placeholder="Jean Dupont"
                            value={formData.signature_name}
                            onChange={(e) => setFormData({ ...formData, signature_name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sig_title">Titre</Label>
                        <Input
                            id="sig_title"
                            placeholder="CEO & Founder"
                            value={formData.signature_title}
                            onChange={(e) => setFormData({ ...formData, signature_title: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="sig_company">Société</Label>
                    <Input
                        id="sig_company"
                        placeholder="SuperProspect"
                        value={formData.signature_company}
                        onChange={(e) => setFormData({ ...formData, signature_company: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="sig_phone">Téléphone</Label>
                        <Input
                            id="sig_phone"
                            placeholder="+33 6 12 34 56 78"
                            value={formData.signature_phone}
                            onChange={(e) => setFormData({ ...formData, signature_phone: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sig_email">Email</Label>
                        <Input
                            id="sig_email"
                            placeholder="jean@superprospect.io"
                            value={formData.signature_email}
                            onChange={(e) => setFormData({ ...formData, signature_email: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="sig_ps">PS (Post-Scriptum optionnel)</Label>
                    <Textarea
                        id="sig_ps"
                        placeholder="Ex: PS: Je serais ravi d'échanger sur vos projets..."
                        value={formData.signature_ps}
                        onChange={(e) => setFormData({ ...formData, signature_ps: e.target.value })}
                        rows={2}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Tonalité de l'email</Label>
                <Select value={formData.desired_tone} onValueChange={(value) => setFormData({ ...formData, desired_tone: value })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="professional">Professionnel</SelectItem>
                        <SelectItem value="friendly">Amical</SelectItem>
                        <SelectItem value="direct">Direct</SelectItem>
                        <SelectItem value="consultative">Consultatif</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Longueur de l'email</Label>
                    <Select value={formData.email_length} onValueChange={(value: any) => setFormData({ ...formData, email_length: value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CONCISE">Concis (100-150 mots)</SelectItem>
                            <SelectItem value="STANDARD">Standard (150-220 mots)</SelectItem>
                            <SelectItem value="DETAILED">Détaillé (220-300 mots)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Langue</Label>
                    <Select value={formData.language} onValueChange={(value: any) => setFormData({ ...formData, language: value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fr">🇫🇷 Français</SelectItem>
                            <SelectItem value="en">🇬🇧 Anglais</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center space-x-2 py-2">
                <Checkbox
                    id="formal"
                    checked={formData.formal}
                    onCheckedChange={(checked) => setFormData({ ...formData, formal: checked as boolean })}
                />
                <label htmlFor="formal" className="text-sm cursor-pointer">
                    Utiliser le vouvoiement
                </label>
            </div>
        </div>
    )

    const stepConfig = {
        identity: { title: "1. Identité", icon: Building2 },
        positioning: { title: "2. Positionnement", icon: Target },
        targeting: { title: "3. Ciblage", icon: Award },
        signature: { title: "4. Signature", icon: Pen },
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nouvelle Campagne Cold Email</DialogTitle>
                    <DialogDescription>
                        Configurez votre campagne en 4 étapes simples.
                    </DialogDescription>

                    {/* Stepper Indicator */}
                    <div className="flex items-center gap-2 mt-4 text-xs font-medium text-muted-foreground flex-wrap">
                        {Object.entries(stepConfig).map(([key, config], index) => (
                            <div key={key} className="flex items-center gap-2">
                                <span className={step === key ? "text-primary font-semibold" : ""}>
                                    {config.title}
                                </span>
                                {index < Object.keys(stepConfig).length - 1 && (
                                    <ArrowRight className="w-3 h-3" />
                                )}
                            </div>
                        ))}
                    </div>
                </DialogHeader>

                {step === 'identity' && renderIdentityStep()}
                {step === 'positioning' && renderPositioningStep()}
                {step === 'targeting' && renderTargetingStep()}
                {step === 'signature' && renderSignatureStep()}

                <DialogFooter className="flex justify-between items-center">
                    {step !== 'identity' && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                const steps: WizardStep[] = ['identity', 'positioning', 'targeting', 'signature']
                                const currentIndex = steps.indexOf(step)
                                if (currentIndex > 0) setStep(steps[currentIndex - 1])
                            }}
                            className="mr-auto"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Retour
                        </Button>
                    )}

                    {step === 'identity' && (
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                    )}

                    {step !== 'signature' ? (
                        <Button onClick={handleNext} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Suivant
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleFinish} disabled={loading} className="bg-green-600 hover:bg-green-700">
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Créer la campagne
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
