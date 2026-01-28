"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScrapeProspect, Campaign } from "@/types"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { CreateCampaignWizard } from "@/components/features/CreateCampaignWizard"

interface EmailGenerationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    prospect: ScrapeProspect
    onSuccess: (jobId: string) => void
}

export function EmailGenerationModal({ open, onOpenChange, prospect, onSuccess }: EmailGenerationModalProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [loadingCampaigns, setLoadingCampaigns] = useState(false)
    const [showWizard, setShowWizard] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (open) {
            fetchCampaigns()
        }
    }, [open])

    const fetchCampaigns = async () => {
        setLoadingCampaigns(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase
                .from('cold_email_campaigns')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (data) {
                setCampaigns(data as Campaign[])
                // Auto-select default or first found
                const defaultCamp = data.find((c: any) => c.is_default) || data[0]
                if (defaultCamp) setSelectedCampaignId(defaultCamp.id)
            }
        }
        setLoadingCampaigns(false)
    }

    const handleGenerate = async () => {
        if (!selectedCampaignId) {
            toast.error("Veuillez sélectionner une campagne")
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) throw new Error("Non connecté")

            // Call API to Trigger Generation
            const response = await fetch('/api/cold-email/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    campaignId: selectedCampaignId,
                    prospectIds: [prospect.id_prospect] // Send array, even for single
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || "Erreur lors de la génération")
            }

            toast.success("Génération lancée ! L'IA travaille...")
            onSuccess(result.jobId)
            onOpenChange(false)

        } catch (error: any) {
            console.error(error)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const isDeepSearchMissing = !prospect.deep_search || Object.keys(typeof prospect.deep_search === 'string' ? JSON.parse(prospect.deep_search) : prospect.deep_search || {}).length === 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Générer un Cold Email</DialogTitle>
                    <DialogDescription>
                        Utilisez l'IA pour rédiger un email ultra-personnalisé basé sur le Deep Search.
                    </DialogDescription>
                </DialogHeader>

                {isDeepSearchMissing ? (
                    <div className="py-6 text-center text-sm text-red-500 bg-red-50 rounded-lg border border-red-200 p-4">
                        Impossible de générer un email : <strong>Deep Search manquant</strong>.
                        Veuillez d'abord lancer une analyse Deep Search pour ce prospect.
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Choisir une campagne (Profil)
                            </label>
                            {loadingCampaigns ? (
                                <div className="text-xs text-muted-foreground flex items-center">
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin cancel-drag" /> Chargement...
                                </div>
                            ) : campaigns.length === 0 ? (
                                <div className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/50 text-center flex flex-col items-center gap-2">
                                    <p>Vous n'avez pas encore de campagne active.</p>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setShowWizard(true)}
                                    >
                                        Créer ma première campagne
                                    </Button>
                                </div>
                            ) : (
                                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {campaigns.map((camp) => (
                                            <SelectItem key={camp.id} value={camp.id}>
                                                {camp.campaign_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                )}

                <CreateCampaignWizard
                    open={showWizard}
                    onOpenChange={setShowWizard}
                    onSuccess={(newId) => {
                        fetchCampaigns()
                        setSelectedCampaignId(newId)
                    }}
                />

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={loading || campaigns.length === 0 || isDeepSearchMissing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Lancement...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Générer avec IA
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
