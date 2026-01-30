"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/fetch-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Globe, Building2, Target, Award, Pen, Info, Zap, Brain } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

// --- HELPER COMPONENTS (DEFINED OUTSIDE TO PREVENT RE-RENDERS) ---

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

const AILoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 rounded-lg">
        <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-spin" style={{
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                animationDuration: '2s'
            }}></div>
            <Brain className="w-10 h-10 text-indigo-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <h3 className="mt-6 text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            ✨ IA en action
        </h3>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
            L'intelligence artificielle analyse les données de votre site web et créée une stratégie marketing personnalisée...
        </p>
        <div className="mt-4 flex gap-1">
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
    </div>
)

interface CreateCampaignWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: (campaignId: string) => void
}

type WizardStep = 'identity' | 'positioning' | 'targeting' | 'signature'

// --- HELPERS ---
const mapTone = (aiValue: string): string => {
    if (!aiValue) return "professional"
    const v = aiValue.toLowerCase()
    if (v.includes("friendly") || v.includes("sympa") || v.includes("cool") || v.includes("créatif") || v.includes("audacieux")) return "friendly"
    if (v.includes("direct")) return "direct"
    if (v.includes("consult") || v.includes("conseil")) return "consultative"
    return "professional"
}

const mapLength = (aiValue: string): string => {
    if (!aiValue) return "STANDARD"
    const v = aiValue.toLowerCase()
    if (v.includes("court") || v.includes("short") || v.includes("concis")) return "CONCISE"
    if (v.includes("long") || v.includes("détaillé") || v.includes("detail")) return "DETAILED"
    return "STANDARD"
}

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
        service_to_sell: "", // NEW: Added field
        pain_points: "",
        main_promise: "",
        secondary_benefits: [] as string[],

        // Step 3: Targeting & Proof
        objective: "BOOK_MEETING" as "BOOK_MEETING" | "DEMO" | "FREE_TRIAL" | "QUOTE" | "DISCOUNT" | "CALLBACK" | "DOWNLOAD" | "WEBINAR",
        target_audience: "",
        target_sectors: [] as string[],
        target_company_size: "",
        target_job_titles: [] as string[],

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

    // FIX: Use callback to update form data properly
    const updateFormData = useCallback((field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }, [])

    // --- ACTIONS ---

    const handleAiAnalyze = async () => {
        if (!formData.my_website) {
            toast.error("Veuillez entrer un site web pour l'analyse")
            return
        }

        // 60s Soft Timeout (Client Side)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000)

        setAiLoading(true)
        try {
            // 1. Normalize Website URL (n8n expects protocol)
            let websiteUrl = formData.my_website
            if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
                websiteUrl = 'https://' + websiteUrl
            }

            // 2. Safely get User ID (with timeout to avoid lock)
            const supabase = createClient()
            const getSessionPromise = supabase.auth.getSession()
            const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null } }), 2000)
            )
            const { data: { session } } = await Promise.race([getSessionPromise, timeoutPromise])

            if (!session?.user?.id) {
                console.warn("⚠️ [AI] User ID missing or timeout - sending without ID")
            }

            // BYPASS: Use standard fetch to avoid ANY authentication lock issues
            const response = await fetch('/api/campaigns/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    website: websiteUrl,
                    company: formData.my_company_name,
                    siren: formData.siren,
                    userId: session?.user?.id
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`❌ [AI] API Error (${response.status}): ${errorText}`)
                throw new Error(`Erreur API (${response.status}): ${response.statusText}`)
            }

            const rawData = await response.json()
            console.log("🤖 [AI] Raw Data received:", rawData)

            // Handle n8n returning an array
            const item = Array.isArray(rawData) ? rawData[0] : rawData

            // Handle "output" stringified JSON (New n8n format)
            let data = item
            if (item.output && typeof item.output === 'string') {
                try {
                    const parsedOutput = JSON.parse(item.output)
                    // The useful data is in the 'prefill' sub-object
                    data = parsedOutput.prefill || parsedOutput
                    console.log("🤖 [AI] Parsed 'output' JSON:", data)
                } catch (e) {
                    console.error("⚠️ [AI] Failed to parse 'output' string:", e)
                }
            }

            console.log("🤖 [AI] Final Processed Data:", data)

            // Format arrays (pain_points comes as string in prefill usually, but let's be safe)
            let formattedPainPoints = ""
            if (Array.isArray(data.pain_points)) {
                formattedPainPoints = data.pain_points.map((p: string) => `- ${p}`).join('\n')
            } else if (typeof data.pain_points === 'string') {
                formattedPainPoints = data.pain_points
            }

            // Format target_job_titles
            let formattedJobTitles = [] as string[]
            if (Array.isArray(data.target_job_titles)) {
                formattedJobTitles = data.target_job_titles
            } else if (typeof data.target_job_titles === 'string') {
                formattedJobTitles = data.target_job_titles.split(',').map((s: string) => s.trim()).filter(Boolean)
            }

            // Format secondary_benefits
            let formattedSecondaryBenefits = [] as string[]
            if (Array.isArray(data.secondary_benefits)) {
                formattedSecondaryBenefits = data.secondary_benefits
            } else if (typeof data.secondary_benefits === 'string') {
                formattedSecondaryBenefits = data.secondary_benefits.split(',').map((s: string) => s.trim()).filter(Boolean)
            }

            // Format target_sectors
            let formattedTargetSectors = [] as string[]
            if (Array.isArray(data.target_sectors)) {
                formattedTargetSectors = data.target_sectors
            } else if (typeof data.target_sectors === 'string') {
                formattedTargetSectors = data.target_sectors.split(',').map((s: string) => s.trim()).filter(Boolean)
            }

            // Map ALL fields from webhook response
            setFormData(prev => ({
                ...prev,
                // Update website if normalized
                my_website: websiteUrl || prev.my_website,

                // Step 1: Identité
                pitch: data.pitch || prev.pitch,
                main_offer: data.main_offer || prev.main_offer,
                pain_points: formattedPainPoints || prev.pain_points,
                main_promise: data.main_promise || prev.main_promise,


                // --- HELPERS ---
                const mapTone = (aiValue: string): string => {
                    if (!aiValue) return "professional"
                    const v = aiValue.toLowerCase()
                    if (v.includes("friendly") || v.includes("sympa") || v.includes("cool") || v.includes("créatif") || v.includes("audacieux")) return "friendly"
                    if (v.includes("direct")) return "direct"
                    if (v.includes("consult") || v.includes("conseil")) return "consultative"
                    return "professional"
                }

    const mapLength = (aiValue: string): string => {
                    if (!aiValue) return "STANDARD"
                    const v = aiValue.toLowerCase()
                    if (v.includes("court") || v.includes("short") || v.includes("concis")) return "CONCISE"
                    if (v.includes("long") || v.includes("détaillé") || v.includes("detail")) return "DETAILED"
                    return "STANDARD"
                }

    // ... (inside handleAiAnalyze) ...

            // Map ALL fields from webhook response
            setFormData(prev => ({
        ...prev,
        // Update website if normalized
        my_website: websiteUrl || prev.my_website,

        // Step 1: Identité
        pitch: data.pitch || prev.pitch,
        main_offer: data.main_offer || prev.main_offer,
        pain_points: formattedPainPoints || prev.pain_points,
        main_promise: data.main_promise || prev.main_promise,

        // Step 2: Positionnement  
        service_to_sell: data.service_to_sell || prev.service_to_sell, // NEW
        secondary_benefits: formattedSecondaryBenefits.length > 0 ? formattedSecondaryBenefits : prev.secondary_benefits,

        // Step 3: Ciblage
        objective: prev.objective,
        target_audience: data.target_audience || prev.target_audience,
        target_sectors: formattedTargetSectors.length > 0 ? formattedTargetSectors : prev.target_sectors,
        target_company_size: prev.target_company_size,
        target_job_titles: formattedJobTitles.length > 0 ? formattedJobTitles : prev.target_job_titles,

        // Step 4: Signature & Params
        signature_name: data.signature_name || prev.signature_name,
        signature_title: data.signature_title || prev.signature_title,
        signature_company: data.signature_company || prev.signature_company,
        signature_phone: data.signature_phone || prev.signature_phone,
        signature_email: data.signature_email || prev.signature_email,
        signature_ps: data.signature_ps || prev.signature_ps,

        // Smart Mapping for Enums
        desired_tone: data.desired_tone ? mapTone(data.desired_tone) : prev.desired_tone,
        formal: data.formal !== undefined ? data.formal : prev.formal,
        email_length: data.email_length ? mapLength(data.email_length) : prev.email_length,
        language: data.language || prev.language,
    }))

    // ...

    const saveCampaign = async () => {
        // ...
        const campaignData = {
            // ...
            main_offer: formData.main_offer,
            service_to_sell: formData.service_to_sell, // NEW
            pain_points: painPointsArray,
            // ...
        }
        // ...
    }

    // ... 

    const renderPositioningStep = () => (
        <div className="space-y-5 py-6">
            <FieldWithTooltip
                label="Accroche (Pitch)"
                tooltip="Résumez votre proposition de valeur en 1-2 phrases"
                required
            >
                <Textarea
                    placeholder="Nous aidons les [cible] à [bénéfice] grâce à [méthode]."
                    value={formData.pitch}
                    onChange={(e) => updateFormData('pitch', e.target.value)}
                    rows={3}
                    className="border-2 focus:border-primary transition-all resize-none"
                    maxLength={500}
                />
            </FieldWithTooltip>

            <FieldWithTooltip
                label="Service / Produit à vendre"
                tooltip="Qu'est-ce qu'on vend exactement ? (ex: Audit SEO, Logiciel RH...)"
                required
            >
                <Input
                    placeholder="ex: Logiciel de Gestion de Paie"
                    value={formData.service_to_sell}
                    onChange={(e) => updateFormData('service_to_sell', e.target.value)}
                    className="h-11 border-2 focus:border-primary transition-all"
                />
            </FieldWithTooltip>

            <FieldWithTooltip
                label="Offre Principale"
                tooltip="Décrivez votre offre phare en détail"
                required
            >
                <Textarea
                    placeholder="Outil d'automatisation de prospection B2B..."
                    value={formData.main_offer}
                    onChange={(e) => updateFormData('main_offer', e.target.value)}
                    rows={4}
                    className="border-2 focus:border-primary transition-all resize-none"
                    maxLength={500}
                />
            </FieldWithTooltip>

            // ... (rest of renderPositioningStep)


            toast.success("✨ Analyse terminée ! Données pré-remplies.")

        } catch (error: any) {
                console.error("🔥 [AI] Exception:", error)

            if (error.name === 'AbortError') {
                toast.error("L'IA prend trop de temps à répondre (Timeout > 60s).")
            } else {
                toast.error(`Erreur IA: ${error.message || "Vérifiez le site web."}`)
            }
        } finally {
                setAiLoading(false)
            }
    }

    const saveCampaign = async () => {
        const supabase = createClient()
            const {data: {user} } = await supabase.auth.getUser()
            if (!user) throw new Error("Non connecté")

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
            target_job_titles: formData.target_job_titles,
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
            const {error} = await supabase
            .from('cold_email_campaigns')
            .update(campaignData)
            .eq('id', campaignId)

            if (error) throw error
        } else {
            const {data, error} = await supabase
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

            if (step === 'identity') {
                if (!formData.campaign_name) {
                toast.error("Le nom de la campagne est requis")
                    return
                }

            await saveCampaign()
            toast.success("✅ Campagne créée !")

            // Auto-trigger AI if website filled
            if (formData.my_website) {
                setLoading(false)
                    await handleAiAnalyze()
            setLoading(true)
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

    const handleSkipAI = async () => {
        try {
                setLoading(true)

            if (!formData.campaign_name) {
                toast.error("Le nom de la campagne est requis")
                return
            }

            await saveCampaign()
            toast.success("✅ Campagne créée !")
            setStep('positioning')
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

            const supabase = createClient()
            await supabase
            .from('cold_email_campaigns')
            .update({status: 'ACTIVE' })
            .eq('id', campaignId)

            toast.success("🎉 Campagne créée avec succès !")
            if (onSuccess && campaignId) onSuccess(campaignId)
            onOpenChange(false)

            // Reset
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
            target_job_titles: [],
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
            <div className="space-y-5 py-6 relative">
                {aiLoading && <AILoadingOverlay />}

                <FieldWithTooltip
                    label="Nom de la Campagne"
                    tooltip="Donnez un nom unique à cette campagne pour la retrouver facilement (ex: 'Prospection Q1 2024')"
                    required
                >
                    <Input
                        placeholder="ex: Prospection Agences Immo - Q1 2024"
                        value={formData.campaign_name}
                        onChange={(e) => updateFormData('campaign_name', e.target.value)}
                        className="h-11 border-2 focus:border-primary transition-all"
                    />
                </FieldWithTooltip>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWithTooltip
                        label="Votre Entreprise"
                        tooltip="Le nom officiel de votre société"
                        required
                    >
                        <div className="relative">
                            <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                            <Input
                                className="pl-10 h-11 border-2 focus:border-primary transition-all"
                                placeholder="ex: SuperProspect"
                                value={formData.my_company_name}
                                onChange={(e) => updateFormData('my_company_name', e.target.value)}
                            />
                        </div>
                    </FieldWithTooltip>

                    <FieldWithTooltip
                        label="Numéro SIREN (recommandé)"
                        tooltip="Fortement recommandé : permet à l'IA d'identifier précisément votre entreprise pour des résultats bien supérieurs (non stocké)."
                    >
                        <Input
                            placeholder="ex: 123 456 789"
                            value={formData.siren}
                            onChange={(e) => updateFormData('siren', e.target.value)}
                            className="h-11 border-2 focus:border-primary transition-all font-mono"
                            maxLength={9}
                        />
                    </FieldWithTooltip>
                </div>

                <FieldWithTooltip
                    label="Votre Site Web"
                    tooltip="L'URL de votre site web - l'IA l'analysera"
                    required
                >
                    <div className="relative">
                        <Globe className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                        <Input
                            className="pl-10 h-11 border-2 focus:border-primary transition-all"
                            placeholder="https://superprospect.io"
                            value={formData.my_website}
                            onChange={(e) => updateFormData('my_website', e.target.value)}
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
                        Notre IA analyse votre site web et votre SIREN pour <strong>pré-remplir automatiquement</strong> votre stratégie marketing.
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
                    label="Accroche (Pitch)"
                    tooltip="Résumez votre proposition de valeur en 1-2 phrases"
                    required
                >
                    <Textarea
                        placeholder="Nous aidons les [cible] à [bénéfice] grâce à [méthode]."
                        value={formData.pitch}
                        onChange={(e) => updateFormData('pitch', e.target.value)}
                        rows={3}
                        className="border-2 focus:border-primary transition-all resize-none"
                        maxLength={500}
                    />
                </FieldWithTooltip>

                <FieldWithTooltip
                    label="Offre Principale"
                    tooltip="Décrivez votre offre phare en détail"
                    required
                >
                    <Textarea
                        placeholder="Outil d'automatisation de prospection B2B..."
                        value={formData.main_offer}
                        onChange={(e) => updateFormData('main_offer', e.target.value)}
                        rows={4}
                        className="border-2 focus:border-primary transition-all resize-none"
                        maxLength={500}
                    />
                </FieldWithTooltip>

                <FieldWithTooltip
                    label="Problèmes Clients (Pain Points)"
                    tooltip="Listez les problèmes que vos prospects rencontrent"
                >
                    <Textarea
                        placeholder="- Trop de temps perdu en prospection manuelle&#10;- Taux de réponse email faible"
                        value={formData.pain_points}
                        onChange={(e) => updateFormData('pain_points', e.target.value)}
                        rows={5}
                        className="font-mono text-sm border-2 focus:border-primary transition-all resize-none"
                    />
                </FieldWithTooltip>

                <FieldWithTooltip
                    label="Promesse de Valeur"
                    tooltip="Votre promesse chiffrée (ex: '+40% de RDV')"
                >
                    <Input
                        placeholder="ex: +40% de RDV qualifiés en 30 jours"
                        value={formData.main_promise}
                        onChange={(e) => updateFormData('main_promise', e.target.value)}
                        className="h-11 border-2 focus:border-primary transition-all"
                        maxLength={100}
                    />
                </FieldWithTooltip>
            </div>
            )

    const renderTargetingStep = () => (
            <div className="space-y-5 py-6">
                <FieldWithTooltip
                    label="Objectif de Campagne"
                    tooltip="Quelle action souhaitez-vous que vos prospects effectuent ?"
                    required
                >
                    <Select value={formData.objective} onValueChange={(value: any) => updateFormData('objective', value)}>
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
                    tooltip="Décrivez votre client idéal"
                >
                    <Textarea
                        placeholder="ex: CEO de PME SaaS B2B entre 10 et 50 employés"
                        value={formData.target_audience}
                        onChange={(e) => updateFormData('target_audience', e.target.value)}
                        rows={3}
                        className="border-2 focus:border-primary transition-all resize-none"
                    />
                </FieldWithTooltip>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWithTooltip
                        label="Secteurs Visés"
                        tooltip="Industries que vous ciblez (séparez par virgules)"
                    >
                        <Input
                            placeholder="SaaS, E-commerce, Agences..."
                            value={formData.target_sectors.join(', ')}
                            onChange={(e) => updateFormData('target_sectors', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            className="h-11 border-2 focus:border-primary transition-all"
                        />
                    </FieldWithTooltip>

                    <FieldWithTooltip
                        label="Taille Entreprise"
                        tooltip="Nombre d'employés de vos prospects cibles"
                    >
                        <Select value={formData.target_company_size} onValueChange={(value) => updateFormData('target_company_size', value)}>
                            <SelectTrigger className="h-11 border-2">
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
                        <FieldWithTooltip label="Nom" tooltip="Prénom et nom" required>
                            <Input
                                placeholder="Jean Dupont"
                                value={formData.signature_name}
                                onChange={(e) => updateFormData('signature_name', e.target.value)}
                                className="h-10 border-2"
                            />
                        </FieldWithTooltip>

                        <FieldWithTooltip label="Titre" tooltip="Votre rôle">
                            <Input
                                placeholder="CEO & Founder"
                                value={formData.signature_title}
                                onChange={(e) => updateFormData('signature_title', e.target.value)}
                                className="h-10 border-2"
                            />
                        </FieldWithTooltip>
                    </div>

                    <FieldWithTooltip label="Société" tooltip="Nom de votre entreprise">
                        <Input
                            placeholder="SuperProspect"
                            value={formData.signature_company}
                            onChange={(e) => updateFormData('signature_company', e.target.value)}
                            className="h-10 border-2"
                        />
                    </FieldWithTooltip>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldWithTooltip label="Téléphone" tooltip="Numéro professionnel">
                            <Input
                                placeholder="+33 6 12 34 56 78"
                                value={formData.signature_phone}
                                onChange={(e) => updateFormData('signature_phone', e.target.value)}
                                className="h-10 border-2"
                            />
                        </FieldWithTooltip>

                        <FieldWithTooltip label="Email" tooltip="Email professionnel">
                            <Input
                                placeholder="jean@superprospect.io"
                                value={formData.signature_email}
                                onChange={(e) => updateFormData('signature_email', e.target.value)}
                                className="h-10 border-2"
                            />
                        </FieldWithTooltip>
                    </div>

                    <FieldWithTooltip label="PS" tooltip="Message bonus (optionnel mais efficace)">
                        <Textarea
                            placeholder="PS : On offre 50% de réduction..."
                            value={formData.signature_ps}
                            onChange={(e) => updateFormData('signature_ps', e.target.value)}
                            rows={2}
                            className="border-2 resize-none"
                        />
                    </FieldWithTooltip>
                </div>

                <FieldWithTooltip label="Tonalité" tooltip="Style d'écriture">
                    <Select value={formData.desired_tone} onValueChange={(value) => updateFormData('desired_tone', value)}>
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
                    <FieldWithTooltip label="Longueur" tooltip="Courts = plus de lecture">
                        <Select value={formData.email_length} onValueChange={(value: any) => updateFormData('email_length', value)}>
                            <SelectTrigger className="h-11 border-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CONCISE">📝 Concis</SelectItem>
                                <SelectItem value="STANDARD">📄 Standard</SelectItem>
                                <SelectItem value="DETAILED">📚 Détaillé</SelectItem>
                            </SelectContent>
                        </Select>
                    </FieldWithTooltip>

                    <FieldWithTooltip label="Langue" tooltip="Langue de rédaction">
                        <Select value={formData.language} onValueChange={(value: any) => updateFormData('language', value)}>
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

                <div className="flex items-center space-x-3 py-3 px-4 bg-slate-50 rounded-lg border-2">
                    <Checkbox
                        id="formal"
                        checked={formData.formal}
                        onCheckedChange={(checked) => updateFormData('formal', checked)}
                        className="border-2"
                    />
                    <label htmlFor="formal" className="text-sm font-medium cursor-pointer">
                        Utiliser le vouvoiement
                    </label>
                </div>
            </div>
            )

            const stepConfig = {
                identity: {title: "1. Identité", icon: Building2 },
            positioning: {title: "2. Positionnement", icon: Target },
            targeting: {title: "3. Ciblage", icon: Award },
            signature: {title: "4. Signature", icon: Pen },
    }

            return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                            Nouvelle Campagne Cold Email
                        </DialogTitle>
                        <DialogDescription className="text-base">
                            Configurez votre campagne en 4 étapes simples.
                        </DialogDescription>

                        <div className="flex items-center gap-2 mt-6 text-xs font-medium flex-wrap bg-gradient-to-r from-slate-50 to-gray-50 p-3 rounded-lg border">
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
                            <>
                                <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2">
                                    Annuler
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleSkipAI}
                                    disabled={loading || aiLoading}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    Passer sans IA
                                </Button>
                            </>
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
