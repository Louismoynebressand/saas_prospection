"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Campaign, ScrapeProspect } from "@/types"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, Sparkles, Wand2, Mail, CheckCircle2, Zap, Cloud, CloudOff } from "lucide-react"
import { safeJsonParse } from "@/lib/safe-parse"

interface PersonalizationTabProps {
    campaign: Campaign
    onUpdate: (campaign: Campaign) => void
}

type EmailMode = "BALANCED" | "SHORT_DIRECT"
type SaveStatus = "idle" | "saving" | "saved" | "error"

const EMAIL_MODES: {
    value: EmailMode; label: string; icon: string; desc: string
    tags: string[]; color: string; border: string; bg: string; tagBg: string; tagText: string
}[] = [
    {
        value: "BALANCED",
        label: "Mode 1 — Équilibré / Professionnel",
        icon: "⚖️",
        desc: "Email complet, structuré, plusieurs paragraphes. Présente votre société, identifie un problème, propose une solution avec preuve sociale. Idéal pour des prospects qualifiés.",
        tags: ["Multi-paragraphes", "Preuve sociale", "CTA clair"],
        color: "text-indigo-600", border: "border-indigo-500", bg: "bg-indigo-50",
        tagBg: "bg-indigo-100", tagText: "text-indigo-700",
    },
    {
        value: "SHORT_DIRECT",
        label: "Mode 2 — Court & Direct",
        icon: "⚡",
        desc: "Email ultra-court (3-5 lignes max). Une seule question directe et percutante. Parfait pour une 1ère approche ou une relance après silence.",
        tags: ["3-5 lignes", "Question directe", "1ère approche"],
        color: "text-emerald-600", border: "border-emerald-500", bg: "bg-emerald-50",
        tagBg: "bg-emerald-100", tagText: "text-emerald-700",
    },
]

export function PersonalizationTab({ campaign, onUpdate }: PersonalizationTabProps) {
    const [instructions, setInstructions] = useState(campaign.agent_instructions || "")
    const [emailMode, setEmailMode] = useState<EmailMode>(((campaign as any).email_mode as EmailMode) || "BALANCED")
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
    const [savingMode, setSavingMode] = useState(false)

    // Playground State
    const [prospects, setProspects] = useState<ScrapeProspect[]>([])
    const [selectedProspectId, setSelectedProspectId] = useState<string>("")
    const [generating, setGenerating] = useState(false)
    const [generatedEmail, setGeneratedEmail] = useState<{ subject: string, body: string } | null>(null)

    // Debounce ref
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const savedTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Auto-save instructions with 1.2s debounce
    const triggerAutoSave = useCallback((newInstructions: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        setSaveStatus("saving")

        debounceRef.current = setTimeout(async () => {
            try {
                const supabase = createClient()
                const { error } = await supabase
                    .from('cold_email_campaigns')
                    .update({ agent_instructions: newInstructions })
                    .eq('id', campaign.id)

                if (error) throw error

                onUpdate({ ...campaign, agent_instructions: newInstructions })
                setSaveStatus("saved")

                // Fade back to idle after 3s
                savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000)
            } catch (err) {
                console.error(err)
                setSaveStatus("error")
                toast.error("Erreur lors de la sauvegarde automatique")
            }
        }, 1200)
    }, [campaign, onUpdate])

    const handleInstructionsChange = (val: string) => {
        setInstructions(val)
        triggerAutoSave(val)
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        }
    }, [])

    // Load prospects for playground
    useEffect(() => {
        const fetchProspects = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('campaign_prospects')
                .select(`
                    prospect_id,
                    prospect:scrape_prospect(
                        id_prospect,
                        data_scrapping
                    )
                `)
                .eq('campaign_id', campaign.id)
                .limit(50)

            if (data) {
                const mapped = data.map((item: any) => ({
                    id_prospect: item.prospect.id_prospect,
                    data: safeJsonParse(item.prospect.data_scrapping)
                }))
                setProspects(mapped.map((p: any) => {
                    const d = p.data || {}
                    const name = d.title || d.nom_complet || d.name || d.Titre || (d.nom ? `${d.prenom || ''} ${d.nom}`.trim() : null) || "Prospect sans nom"
                    const company = d.company || d.companyName || d.societe || "Entreprise inconnue"
                    return { id_prospect: p.id_prospect, resume: name, ville: company }
                }))
            }
        }
        fetchProspects()
    }, [campaign.id])

    const handleSaveMode = async (mode: EmailMode) => {
        setSavingMode(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('cold_email_campaigns')
                .update({ email_mode: mode })
                .eq('id', campaign.id)
            if (error) throw error
            setEmailMode(mode)
            onUpdate({ ...campaign, email_mode: mode } as any)
            toast.success(`Mode "${mode === 'BALANCED' ? 'Équilibré' : 'Court & Direct'}" activé`)
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors de la sauvegarde du mode")
        } finally {
            setSavingMode(false)
        }
    }

    const handleGenerateTest = async () => {
        if (!selectedProspectId) {
            toast.error("Veuillez sélectionner un prospect pour tester")
            return
        }
        setGenerating(true)
        setGeneratedEmail(null)
        try {
            const response = await fetch('/api/cold-email/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId: campaign.id,
                    prospectIds: [selectedProspectId],
                    agent_instructions: instructions
                })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Erreur de génération")
            toast.success("Génération lancée !")
            pollForResult(data.jobId, selectedProspectId)
        } catch (error: any) {
            toast.error("Erreur: " + error.message)
            setGenerating(false)
        }
    }

    const pollForResult = async (jobId: string, prospectId: string) => {
        const supabase = createClient()
        let attempts = 0
        const maxAttempts = 20
        const interval = setInterval(async () => {
            attempts++
            const { data } = await supabase
                .from('campaign_prospects')
                .select('email_status, generated_email_subject, generated_email_content')
                .eq('campaign_id', campaign.id)
                .eq('prospect_id', prospectId)
                .single()
            if (data && (data.email_status === 'generated' || data.generated_email_content)) {
                clearInterval(interval)
                setGeneratedEmail({
                    subject: data.generated_email_subject || "(Sans objet)",
                    body: data.generated_email_content || "(Contenu vide)"
                })
                setGenerating(false)
                toast.success("Email généré et récupéré !")
            } else if (attempts >= maxAttempts) {
                clearInterval(interval)
                setGenerating(false)
                toast.error("Délai d'attente dépassé. Vérifiez l'onglet Prospects.")
            }
        }, 2000)
    }

    // Save status indicator
    const SaveIndicator = () => {
        if (saveStatus === "idle") return null
        return (
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${
                saveStatus === "saving" ? "text-amber-600" :
                saveStatus === "saved"  ? "text-emerald-600" : "text-red-500"
            }`}>
                {saveStatus === "saving" && (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement...</>
                )}
                {saveStatus === "saved" && (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Enregistré</>
                )}
                {saveStatus === "error" && (
                    <><CloudOff className="w-3.5 h-3.5" /> Erreur de sauvegarde</>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Global auto-save status bar */}
            {saveStatus !== "idle" && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-500 ${
                    saveStatus === "saving" ? "bg-amber-50 border border-amber-200 text-amber-700" :
                    saveStatus === "saved"  ? "bg-emerald-50 border border-emerald-200 text-emerald-700" :
                    "bg-red-50 border border-red-200 text-red-600"
                }`}>
                    {saveStatus === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                    {saveStatus === "saved"  && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    {saveStatus === "error"  && <CloudOff className="w-3.5 h-3.5 shrink-0" />}
                    <span>
                        {saveStatus === "saving" && "Enregistrement en cours..."}
                        {saveStatus === "saved"  && "Modifications enregistrées automatiquement"}
                        {saveStatus === "error"  && "Erreur de sauvegarde — réessayez"}
                    </span>
                </div>
            )}

            {/* EMAIL MODE SELECTOR */}
            <Card className="border-slate-200">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Zap className="w-4 h-4 text-indigo-500" />
                        Mode d'email
                        {savingMode && <Loader2 className="w-3 h-3 animate-spin ml-2 text-muted-foreground" />}
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Ce réglage influence radicalement la structure et la longueur des emails générés par l'IA.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {EMAIL_MODES.map((mode) => {
                            const isActive = emailMode === mode.value
                            return (
                                <button
                                    key={mode.value}
                                    type="button"
                                    disabled={savingMode}
                                    onClick={() => handleSaveMode(mode.value)}
                                    className={`text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60 ${
                                        isActive
                                            ? `${mode.border} ${mode.bg} shadow-md`
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">{mode.icon}</span>
                                        <span className="font-bold text-sm text-slate-800">{mode.label}</span>
                                        {isActive && (
                                            <CheckCircle2 className={`w-4 h-4 ${mode.color} ml-auto shrink-0`} />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">{mode.desc}</p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {mode.tags.map(tag => (
                                            <span key={tag} className={`text-[10px] px-2 py-0.5 ${mode.tagBg} ${mode.tagText} rounded-full font-medium`}>{tag}</span>
                                        ))}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3 text-center">
                        Cliquez sur un mode pour l'activer — sauvegarde automatique
                    </p>
                </CardContent>
            </Card>

            {/* INSTRUCTIONS + PLAYGROUND */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: 'calc(100vh - 500px)' }}>
                {/* Left: Editor */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-indigo-700">
                                <Sparkles className="w-5 h-5" />
                                Instructions personnalisées
                            </CardTitle>
                            <SaveIndicator />
                        </div>
                        <CardDescription>
                            Donnez des directives spécifiques à l'IA en plus du mode sélectionné ci-dessus.
                            <span className="ml-1 text-indigo-500 font-medium">Les modifications sont sauvegardées automatiquement.</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600">
                            <strong>Conseils :</strong>
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                <li>Soyez précis sur la structure (ex: Problème {'->'}  Solution).</li>
                                <li>Donnez des exemples de phrases ou de mots interdits.</li>
                                <li>Indiquez si vous voulez utiliser des variables spécifiques du prospect.</li>
                            </ul>
                        </div>

                        <div className="flex-1">
                            <Label className="sr-only">Instructions</Label>
                            <Textarea
                                placeholder="Ex: Analyse le site web du prospect pour trouver son point de douleur principal. Commence l'email par une question rhétorique sur ce problème..."
                                value={instructions}
                                onChange={(e) => handleInstructionsChange(e.target.value)}
                                className="h-full min-h-[250px] resize-none font-mono text-sm leading-relaxed p-4 bg-white"
                            />
                        </div>

                        {/* No more save button — auto-save active */}
                        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
                            <Cloud className="w-3 h-3" />
                            Sauvegarde automatique après chaque modification
                        </p>
                    </CardContent>
                </Card>

                {/* Right: Playground */}
                <Card className="flex flex-col bg-slate-50/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-700">
                            <Wand2 className="w-5 h-5" />
                            Playground & Test
                        </CardTitle>
                        <CardDescription>
                            Testez vos instructions en générant un email fictif pour un de vos prospects.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Select value={selectedProspectId} onValueChange={setSelectedProspectId}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Choisir un prospect pour tester..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {prospects.map((p: any) => (
                                            <SelectItem key={p.id_prospect} value={String(p.id_prospect)}>
                                                {p.resume} <span className="text-muted-foreground ml-2">({p.ville})</span>
                                            </SelectItem>
                                        ))}
                                        {prospects.length === 0 && <div className="p-2 text-xs text-center text-muted-foreground">Aucun prospect disponible</div>}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={handleGenerateTest}
                                disabled={generating || !selectedProspectId}
                            >
                                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Générer un exemple"}
                            </Button>
                        </div>

                        <div className="flex-1 bg-white border rounded-lg p-6 overflow-y-auto shadow-sm min-h-[200px]">
                            {!generatedEmail && !generating && (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                    <Mail className="w-12 h-12 mb-2 stroke-1" />
                                    <p>L'aperçu de l'email généré s'affichera ici.</p>
                                </div>
                            )}
                            {generating && (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                                    <p className="text-sm font-medium text-indigo-600 animate-pulse">L'IA rédige votre email...</p>
                                    <p className="text-xs text-muted-foreground mt-2">Cela peut prendre jusqu'à 20 secondes.</p>
                                </div>
                            )}
                            {generatedEmail && (
                                <div className="space-y-4 animate-in fade-in duration-500">
                                    <div className="border-b pb-4">
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Objet</div>
                                        <div className="font-medium text-lg">{generatedEmail.subject}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Corps du message</div>
                                        <div
                                            className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap"
                                            dangerouslySetInnerHTML={{ __html: generatedEmail.body.replace(/\n/g, '<br/>') }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-[10px] text-center text-muted-foreground">
                            NOTE: Cette génération consomme 1 crédit email de votre quota journalier/mensuel.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
