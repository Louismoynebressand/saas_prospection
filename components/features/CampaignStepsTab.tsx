"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Save, ArrowDown } from "lucide-react"
import { toast } from "sonner"

interface CampaignStep {
    id?: string
    step_order: number
    delay_days: number
    agent_instructions: string
}

export function CampaignStepsTab({ campaignId }: { campaignId: string }) {
    const [steps, setSteps] = useState<CampaignStep[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchSteps()
    }, [campaignId])

    const fetchSteps = async () => {
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/steps`)
            const data = await res.json()
            if (data.steps && data.steps.length > 0) {
                setSteps(data.steps)
            } else {
                // Default first step
                setSteps([{ step_order: 1, delay_days: 0, agent_instructions: "" }])
            }
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors du chargement des étapes")
        } finally {
            setLoading(false)
        }
    }

    const handleAddStep = () => {
        setSteps(prev => [
            ...prev,
            { step_order: prev.length + 1, delay_days: 3, agent_instructions: "" }
        ])
    }

    const handleRemoveStep = (index: number) => {
        setSteps(prev => {
            const newSteps = [...prev]
            newSteps.splice(index, 1)
            // Re-order
            return newSteps.map((step, i) => ({ ...step, step_order: i + 1 }))
        })
    }

    const handleChange = (index: number, field: keyof CampaignStep, value: any) => {
        setSteps(prev => {
            const newSteps = [...prev]
            newSteps[index] = { ...newSteps[index], [field]: value }
            return newSteps
        })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/steps`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steps })
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Séquence enregistrée avec succès")
                setSteps(data.steps)
            } else {
                toast.error(data.error || "Erreur lors de l'enregistrement")
            }
        } catch (error) {
            toast.error("Erreur lors de l'enregistrement")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="text-center p-8">Chargement de la séquence...</div>
    }

    return (
        <Card className="border-indigo-100 shadow-sm">
            <CardHeader>
                <CardTitle>Séquence d'Emails</CardTitle>
                <CardDescription>
                    Configurez les différentes étapes de relance automatique. Le cron déclenchera ces relances.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {steps.map((step, index) => (
                    <div key={index} className="relative">
                        {index > 0 && (
                            <div className="absolute -top-6 left-6 text-slate-300">
                                <ArrowDown className="w-5 h-5" />
                            </div>
                        )}
                        <Card className="border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between py-3 bg-slate-50 border-b border-slate-100">
                                <div className="font-semibold text-sm flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700">
                                        {step.step_order}
                                    </span>
                                    {index === 0 ? "Email Initial" : `Relance ${index}`}
                                </div>
                                {index > 0 && (
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveStep(index)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                {index > 0 && (
                                    <div className="space-y-1.5">
                                        <Label>Délai avant envoi (en jours après le précédent)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={step.delay_days}
                                            onChange={(e) => handleChange(index, 'delay_days', parseInt(e.target.value) || 0)}
                                            className="w-32"
                                        />
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label>Instructions pour l'IA (Prompt)</Label>
                                    <Textarea
                                        value={step.agent_instructions}
                                        onChange={(e) => handleChange(index, 'agent_instructions', e.target.value)}
                                        placeholder={index === 0 ? "Ex: Rédige un email d'approche..." : "Ex: Relance ce prospect de manière courtoise..."}
                                        className="min-h-[100px] resize-y"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Laissez vide pour utiliser les instructions globales de la campagne.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}

                <Button variant="outline" onClick={handleAddStep} className="w-full border-dashed">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une étape de relance
                </Button>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t py-3 flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Enregistrement..." : "Enregistrer la séquence"}
                </Button>
            </CardFooter>
        </Card>
    )
}
