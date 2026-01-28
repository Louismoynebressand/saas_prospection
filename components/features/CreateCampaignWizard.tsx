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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Globe, Building2, Target, Award, Pen, Info, Zap } from "lucide-react"
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
        siren: "", // NEW: SIREN pour aide IA (non stocké en base)

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
                    company: formData.my_company_name,
                    siren: formData.siren // Include SIREN for better analysis
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

            toast.success("✨ Analyse terminée ! Données pré-remplies.")

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
            // NOTE: siren is NOT saved in database (just for AI analysis)
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

            // Step 1: Create campaign + lance l'IA automatiquement si site web rempli
            if (step === 'identity') {
                if (!formData.campaign_name) {
                    toast.error("Le nom de la campagne est requis")
                    return
                }

                await saveCampaign()
                toast.success("✅ Campagne créée !")

                // Auto-trigger AI analysis if website is filled
                if (formData.my_website) {
                    await handleAiAnalyze()
                }

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

            toast.success("🎉 Campagne créée avec succès !")
            if (onSuccess && campaignId) onSuccess(campaignId)
            onOpenChange(false)

            // Reset form
            setStep('identity')
            setCampaignId(null)
            setFormData({
                campaign_name: "",
                my_company_name: "",
                my_website: "",
                siren: "",
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

    // --- HELPER COMPONENT: Field with Tooltip ---
    const FieldWithTooltip = ({ label, tooltip, required = false, children }: { label: string, tooltip: string, required?: boolean, children: React.ReactNode }) => (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">{label} {required && <span className="text-red-500">*</span>}</Label>
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px] bg-popover text-sm">
                            <p>{tooltip}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            {children}
        </div>
    )

    // --- STEPS RENDER ---

    const renderIdentityStep = () => (
        <div className="space-y-5 py-6">
            <FieldWithTooltip
                label="Nom de la Campagne"
                tooltip="Donnez un nom unique à cette campagne pour la retrouver facilement (ex: 'Prospection Q1 2024')"
                required
            >
                <Input
                    placeholder="ex: Prospection Agences Immo - Q1 2024"
                    value={formData.campaign_name}
                    onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                    className="h-11 border-2 focus:border-primary transition-all"
                />
            </FieldWithTooltip>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldWithTooltip
                    label="Votre Entreprise"
                    tooltip="Le nom officiel de votre société (tel qu'il apparaît sur vos documents légaux)"
                    required
                >
                    <div className="relative">
                        <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                        <Input
                            className="pl-10 h-11 border-2 focus:border-primary transition-all"
                            placeholder="ex: SuperProspect"
                            value={formData.my_company_name}
                            onChange={(e) => setFormData({ ...formData, my_company_name: e.target.value })}
                        />
                    </div>
                </FieldWithTooltip>

                <FieldWithTooltip
                    label="Numéro SIREN (optionnel)"
                    tooltip="Votre SIREN aide l'IA à trouver des infos précises sur votre entreprise (non stocké, uniquement pour l'analyse)"
                >
                    <Input
                        placeholder="ex: 123 456 789"
                        value={formData.siren}
                        onChange={(e) => setFormData({ ...formData, siren: e.target.value })}
                        className="h-11 border-2 focus:border-primary transition-all font-mono"
                        maxLength={9}
                    />
                </FieldWithTooltip>
            </div>

            <FieldWithTooltip
                label="Votre  Site Web"
                tooltip="L'URL de votre site web officiel - l'IA l'analysera pour extraire votre proposition de valeur"
                required
            >
                <div className="relative">
                    <Globe className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input
                        className="pl-10 h-11 border-2 focus:border-primary transition-all"
                        placeholder="https://superprospect.io"
                        value={formData.my_website}
                        onChange={(e) => setFormData({ ...formData, my_website: e.target.value })}
                    />
                </div>
            </FieldWithTooltip>

            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 flex flex-col gap-4 mt-6 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-900">✨ Super-pouvoir IA</h4>
                        <p className="text-xs text-blue-700">Génération automatique en 20 secondes</p>
                    </div>
                </div>
                <p className="text-sm text-blue-800 leading-relaxed">
                    Notre IA analyse votre site web et votre SIREN pour <strong>pré-remplir automatiquement</strong> votre stratégie marketing, votre offre, et vos points de douleur.
                </p>
                <div className="flex items-center gap-2 pt-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-medium text-blue-900">Clique sur "Suivant" pour lancer l'analyse automatiquement !</span>
                </div>
            </div>
        </div>
    )

    const renderPositioningStep = () => (
        <div className="space-y-5 py-6">
            <FieldWithTooltip
                label="Pitch (Positionnement)"
                tooltip="Résumez votre proposition de valeur en 1-2 phrases claires (idéalement format: 'Nous aidons [cible] à [bénéfice] grâce à [méthode]')"
                required
            >
                <Textarea
                    placeholder="Nous aidons les [cible] à [bénéfice] grâce à [méthode]."
                    value={formData.pitch}
                    onChange={(e) => setFormData({ ...formData, pitch: e.target.value })}
                    rows={3}
                    className="border-2 focus:border-primary transition-all resize-none"
                />
            </FieldWithTooltip>

            <FieldWithTooltip
                label="Offre Principale"
                tooltip="Décrivez votre offre phare en détail : qu'est-ce que vous vendez exactement ? Quels sont les bénéfices concrets ?"
                required
            >
                <Textarea
                    placeholder="Outil d'automatisation de prospection B2B avec email finder intégré, enrichissement automatique et séquences personnalisées..."
                    value={formData.main_offer}
                    onChange={(e) => setFormData({ ...formData, main_offer: e.target.value })}
                    rows={4}
                    className="border-2 focus:border-primary transition-all resize-none"
                />
            </FieldWithTooltip>

            <FieldWithTooltip
                label="Pain Points (Douleurs)"
                tooltip="Listez les problèmes que vos prospects rencontrent (que votre offre résout). Un point par ligne, commencez par un tiret."
            >
                <Textarea
                    placeholder="- Trop de temps perdu en prospection manuelle&#10;- Taux de réponse email faible (moins de 2%)&#10;- Manque de données de contact qualifiées&#10;- Difficile de personnaliser les emails à grande échelle"
                    value={formData.pain_points}
                    onChange={(e) => setFormData({ ...formData, pain_points: e.target.value })}
                    rows={5}
                    className="font-mono text-sm border-2 focus:border-primary transition-all resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">💡 Un point par ligne (optionnel mais fortement recommandé pour de meilleurs emails).</p>
            </FieldWithTooltip>

            <FieldWithTooltip
                label="Promesse Principale"
                tooltip="Quelle est votre promesse chiffrée ou résultat garanti ? (ex: '+40% de RDV', 'ROI x3 en 90j', 'Setup en 5min')"
            >
                <Input
                    placeholder="ex: +40% de RDV qualifiés en 30 jours"
                    value={formData.main_promise}
                    onChange={(e) => setFormData({ ...formData, main_promise: e.target.value })}
                    className="h-11 border-2 focus:border-primary transition-all"
                />
            </FieldWithTooltip>
        </div>
    )

    const renderTargetingStep = () => (
        <div className="space-y-5 py-6">
            <FieldWithTooltip
                label="Objectif de Campagne"
                tooltip="Quelle action souhaitez-vous que vos prospects effectuent après avoir lu l'email ?"
                required
            >
                <Select value={formData.objective} onValueChange={(value: any) => setFormData({ ...formData, objective: value })}>
                    <SelectTrigger className="h-11 border-2">
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
            </FieldWithTooltip>

            <FieldWithTooltip
                label="Audience Cible (ICP)"
                tooltip="Décrivez votre client idéal : rôle, secteur, taille d'entreprise, problématiques (ex: 'CEO de PME SaaS B2B entre 10 et 50 employés')"
            >
                <Textarea
                    placeholder="ex: CEO de PME SaaS B2B entre 10 et 50 employés cherchant à scaler leurs ventes"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    rows={3}
                    className="border-2 focus:border-primary transition-all resize-none"
                />
            </FieldWithTooltip>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldWithTooltip
                    label="Secteurs Visés"
                    tooltip="Industries ou secteurs que vous ciblez (séparez par des virgules)"
                >
                    <Input
                        placeholder="SaaS, E-commerce, Agences, Conseil..."
                        value={formData.target_sectors.join(', ')}
                        onChange={(e) => setFormData({
                            ...formData,
                            target_sectors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                        className="h-11 border-2 focus:border-primary transition-all"
                    />
                </FieldWithTooltip>

                <FieldWithTooltip
                    label="Taille Entreprise"
                    tooltip="Nombre d'employés de vos prospects cibles"
                >
                    <Select value={formData.target_company_size} onValueChange={(value) => setFormData({ ...formData, target_company_size: value })}>
                        <SelectTrigger className="h-11 border-2">
                            <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1-10">1-10 employés (TPE)</SelectItem>
                            <SelectItem value="11-50">11-50 employés (PME)</SelectItem>
                            <SelectItem value="51-200">51-200 employés (ETI)</SelectItem>
                            <SelectItem value="201-500">201-500 employés</SelectItem>
                            <SelectItem value="500+">500+ employés (Grande entreprise)</SelectItem>
                        </SelectContent>
                    </Select>
                </FieldWithTooltip>
            </div>
        </div>
    )

    const renderSignatureStep = () => (
        <div className="space-y-5 py-6">
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 p-6 rounded-xl border-2 border-slate-200 space-y-4 shadow-sm">
                <h4 className="font-bold flex items-center gap-2 text-slate-900">
                    <Pen className="w-5 h-5 text-indigo-600" />
                    Signature de l'email
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWithTooltip
                        label="Nom"
                        tooltip="Prénom et nom de la personne qui signe l'email"
                        required
                    >
                        <Input
                            placeholder="Jean Dupont"
                            value={formData.signature_name}
                            onChange={(e) => setFormData({ ...formData, signature_name: e.target.value })}
                            className="h-10 border-2"
                        />
                    </FieldWithTooltip>

                    <FieldWithTooltip
                        label="Titre / Fonction"
                        tooltip="Votre rôle dans l'entreprise (ex: CEO, Sales Director...)"
                    >
                        <Input
                            placeholder="CEO & Founder"
                            value={formData.signature_title}
                            onChange={(e) => setFormData({ ...formData, signature_title: e.target.value })}
                            className="h-10 border-2"
                        />
                    </FieldWithTooltip>
                </div>

                <FieldWithTooltip
                    label="Société"
                    tooltip="Nom de votre entreprise dans la signature"
                >
                    <Input
                        placeholder="SuperProspect"
                        value={formData.signature_company}
                        onChange={(e) => setFormData({ ...formData, signature_company: e.target.value })}
                        className="h-10 border-2"
                    />
                </FieldWithTooltip>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWithTooltip
                        label="Téléphone"
                        tooltip="Numéro de téléphone professionnel"
                    >
                        <Input
                            placeholder="+33 6 12 34 56 78"
                            value={formData.signature_phone}
                            onChange={(e) => setFormData({ ...formData, signature_phone: e.target.value })}
                            className="h-10 border-2"
                        />
                    </FieldWithTooltip>

                    <FieldWithTooltip
                        label="Email"
                        tooltip="Adresse email professionnelle"
                    >
                        <Input
                            placeholder="jean@superprospect.io"
                            value={formData.signature_email}
                            onChange={(e) => setFormData({ ...formData, signature_email: e.target.value })}
                            className="h-10 border-2"
                        />
                    </FieldWithTooltip>
                </div>

                <FieldWithTooltip
                    label="PS (Post-Scriptum)"
                    tooltip="Message bonus à la fin (optionnel mais très efficace pour attirer l'attention)"
                >
                    <Textarea
                        placeholder="Ex: PS : On offre 50% de réduction aux 10 premiers inscrits ce mois-ci."
                        value={formData.signature_ps}
                        onChange={(e) => setFormData({ ...formData, signature_ps: e.target.value })}
                        rows={2}
                        className="border-2 resize-none"
                    />
                </FieldWithTooltip>
            </div>

            <FieldWithTooltip
                label="Tonalité de l'email"
                tooltip="Le style d'écriture général de vos emails"
            >
                <Select value={formData.desired_tone} onValueChange={(value) => setFormData({ ...formData, desired_tone: value })}>
                    <SelectTrigger className="h-11 border-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="professional">👔 Professionnel</SelectItem>
                        <SelectItem value="friendly">😊 Amical</SelectItem>
                        <SelectItem value="direct">⚡ Direct</SelectItem>
                        <SelectItem value="consultative">🤝 Consultatif</SelectItem>
                    </SelectContent>
                </Select>
            </FieldWithTooltip>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldWithTooltip
                    label="Longueur de l'email"
                    tooltip="Emails courts = plus de lecture. Emails longs = plus de détails."
                >
                    <Select value={formData.email_length} onValueChange={(value: any) => setFormData({ ...formData, email_length: value })}>
                        <SelectTrigger className="h-11 border-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CONCISE">📝 Concis (100-150 mots)</SelectItem>
                            <SelectItem value="STANDARD">📄 Standard (150-220 mots)</SelectItem>
                            <SelectItem value="DETAILED">📚 Détaillé (220-300 mots)</SelectItem>
                        </SelectContent>
                    </Select>
                </FieldWithTooltip>

                <FieldWithTooltip
                    label="Langue"
                    tooltip="Langue de rédaction des emails générés"
                >
                    <Select value={formData.language} onValueChange={(value: any) => setFormData({ ...formData, language: value })}>
                        <SelectTrigger className="h-11 border-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fr">🇫🇷 Français</SelectItem>
                            <SelectItem value="en">🇬🇧 Anglais</SelectItem>
                        </SelectContent>
                    </Select>
                </FieldWithTooltip>
            </div>

            <div className="flex items-center space-x-3 py-3 px-4 bg-slate-50 rounded-lg border-2 border-slate-200">
                <Checkbox
                    id="formal"
                    checked={formData.formal}
                    onCheckedChange={(checked) => setFormData({ ...formData, formal: checked as boolean })}
                    className="border-2"
                />
                <div className="flex items-center gap-2">
                    <label htmlFor="formal" className="text-sm font-medium cursor-pointer">
                        Utiliser le vouvoiement
                    </label>
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[250px]">
                                <p>Utiliser "vous" au lieu de "tu" pour un ton plus formel et professionnel</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
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
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                        Nouvelle Campagne Cold Email
                    </DialogTitle>
                    <DialogDescription className="text-base">
                        Configurez votre campagne en 4 étapes simples et générez des emails ultra-personnalisés.
                    </DialogDescription>

                    {/* Stepper Indicator */}
                    <div className="flex items-center gap-2 mt-6 text-xs font-medium text-muted-foreground flex-wrap bg-gradient-to-r from-slate-50 to-gray-50 p-3 rounded-lg border">
                        {Object.entries(stepConfig).map(([key, config], index) => (
                            <div key={key} className="flex items-center gap-2">
                                <span className={`px-3 py-1.5 rounded-full transition-all ${step === key
                                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg"
                                        : "bg-white text-muted-foreground border"
                                    }`}>
                                    {config.title}
                                </span>
                                {index < Object.keys(stepConfig).length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                )}
                            </div>
                        ))}
                    </div>
                </DialogHeader>

                {step === 'identity' && renderIdentityStep()}
                {step === 'positioning' && renderPositioningStep()}
                {step === 'targeting' && renderTargetingStep()}
                {step === 'signature' && renderSignatureStep()}

                <DialogFooter className="flex justify-between items-center gap-2 pt-4 border-t">
                    {step !== 'identity' && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                const steps: WizardStep[] = ['identity', 'positioning', 'targeting', 'signature']
                                const currentIndex = steps.indexOf(step)
                                if (currentIndex > 0) setStep(steps[currentIndex - 1])
                            }}
                            className="mr-auto border-2"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Retour
                        </Button>
                    )}

                    {step === 'identity' && (
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2">
                            Annuler
                        </Button>
                    )}

                    {step !== 'signature' ? (
                        <Button
                            onClick={handleNext}
                            disabled={loading || aiLoading}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
                        >
                            {(loading || aiLoading) ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {aiLoading ? "Analyse IA..." : "Enregistrement..."}
                                </>
                            ) : (
                                <>
                                    Suivant
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleFinish}
                            disabled={loading}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Finalisation...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Créer la campagne
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
