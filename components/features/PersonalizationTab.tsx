"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Campaign, ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Sparkles, Wand2, Save, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface PersonalizationTabProps {
    campaign: Campaign
    onUpdate: (campaign: Campaign) => void
}

export function PersonalizationTab({ campaign, onUpdate }: PersonalizationTabProps) {
    const [instructions, setInstructions] = useState(campaign.agent_instructions || "")
    const [saving, setSaving] = useState(false)

    // Playground State
    const [prospects, setProspects] = useState<ScrapeProspect[]>([])
    const [selectedProspectId, setSelectedProspectId] = useState<string>("")
    const [generating, setGenerating] = useState(false)
    const [generatedEmail, setGeneratedEmail] = useState<{ subject: string, body: string } | null>(null)

    // Load prospects for dropdown
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
                .limit(50) // Limit to 50 for dropdown to avoid overload

            if (data) {
                const mapped = data.map((item: any) => ({
                    id_prospect: item.prospect.id_prospect,
                    // Parse data_scrapping if needed, or assume it's object
                    data: typeof item.prospect.data_scrapping === 'string'
                        ? JSON.parse(item.prospect.data_scrapping)
                        : item.prospect.data_scrapping
                }))
                // Normalize to simplified list for dropdown
                setProspects(mapped.map((p: any) => ({
                    id_prospect: p.id_prospect,
                    resume: p.data?.name || p.data?.title || "Prospect sans nom",
                    ville: p.data?.company_name || p.data?.company || "Entreprise inconnue"
                } as any)))
            }
        }
        fetchProspects()
    }, [campaign.id])

    const handleSaveInstructions = async () => {
        setSaving(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('cold_email_campaigns')
                .update({ agent_instructions: instructions })
                .eq('id', campaign.id)

            if (error) throw error

            toast.success("Instructions sauvegardées")
            onUpdate({ ...campaign, agent_instructions: instructions })
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors de la sauvegarde")
        } finally {
            setSaving(false)
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
                    agent_instructions: instructions // Pass current instructions (even unsaved)
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Erreur de génération")

            toast.success("Génération lancée ! (Simulation)")

            // NOTE: The API triggers a background job (webhook). 
            // Real-time result isn't immediate in the current architecture unless we poll or wait.
            // For now, allow the user to know it's queued.
            // Ideally playground should return the result directly, but our architecture uses async Webhook -> N8N -> DB Update.
            // We can poll for the result here.

            pollForResult(data.jobId, selectedProspectId)

        } catch (error: any) {
            toast.error("Erreur: " + error.message)
            setGenerating(false)
        }
    }

    const pollForResult = async (jobId: string, prospectId: string) => {
        const supabase = createClient()
        let attempts = 0
        const maxAttempts = 20 // 40 seconds

        const interval = setInterval(async () => {
            attempts++

            // Check campaign_prospects for status
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)]">
            {/* Left: Editor */}
            <Card className="flex flex-col h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-700">
                        <Sparkles className="w-5 h-5" />
                        Studio de Personnalisation
                    </CardTitle>
                    <CardDescription>
                        Définissez le contexte, le ton et les règles que l'IA doit suivre pour rédiger vos emails.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600">
                        <strong>Conseils :</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                            <li>Soyez précis sur la structure (ex: Problème {'->'} Solution).</li>
                            <li>Donnez des exemples de phrases ou de mots interdits.</li>
                            <li>Indiquez si vous voulez utiliser des variables spécifiques du prospect.</li>
                        </ul>
                    </div>

                    <div className="flex-1">
                        <Label className="sr-only">Instructions</Label>
                        <Textarea
                            placeholder="Ex: Analyse le site web du prospect pour trouver son point de douleur principal. Commence l'email par une question rhétorique sur ce problème..."
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            className="h-full min-h-[300px] resize-none font-mono text-sm leading-relaxed p-4 bg-white"
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveInstructions} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Enregistrer les instructions
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Right: Playground */}
            <Card className="flex flex-col h-full bg-slate-50/50">
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

                    <div className="flex-1 bg-white border rounded-lg p-6 overflow-y-auto shadow-sm">
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
                                    ></div>
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
    )
}
