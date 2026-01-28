"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScrapeProspect, Campaign } from "@/types"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"
import { Button } from "@/components/ui/button"
import { AIButton } from "@/components/ui/ai-button"
import { AIBadge } from "@/components/ui/ai-badge"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Sparkles, AlertCircle, Plus } from "lucide-react"
import { toast } from "sonner"
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

            const response = await fetch('/api/cold-email/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    campaignId: selectedCampaignId,
                    prospectIds: [prospect.id_prospect]
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || "Erreur lors de la génération")
            }

            // Success confetti! 🎉
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#667eea', '#764ba2', '#f093fb', '#4facfe']
            })

            toast.success("🎉 Email généré ! L'IA a créé votre contenu personnalisé.")
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
            <DialogContent className="sm:max-w-[500px] overflow-hidden">
                <AnimatePresence>
                    {loading && (
                        <LoadingOverlay
                            message="IA en action"
                            subMessage="L'intelligence artificielle rédige votre email ultra-personnalisé..."
                        />
                    )}
                </AnimatePresence>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-2xl">Générer un Cold Email</DialogTitle>
                            <AIBadge />
                        </div>
                        <DialogDescription className="text-base">
                            Utilisez l'IA pour rédiger un email ultra-personnalisé basé sur le Deep Search.
                        </DialogDescription>
                    </DialogHeader>

                    {isDeepSearchMissing ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="py-6 text-center text-sm text-red-600 bg-red-50 rounded-xl border-2 border-red-200 p-6 my-4"
                        >
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="font-semibold mb-2">Deep Search manquant</p>
                            <p className="text-xs text-red-500">
                                Veuillez d'abord lancer une analyse Deep Search pour ce prospect.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="grid gap-4 py-6"
                        >
                            <div className="space-y-3">
                                <label className="text-sm font-semibold leading-none flex items-center gap-2">
                                    Choisir une campagne (Profil)
                                    <span className="text-xs text-muted-foreground font-normal">(stratégie marketing)</span>
                                </label>

                                {loadingCampaigns ? (
                                    <div className="text-xs text-muted-foreground flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des campagnes...
                                    </div>
                                ) : campaigns.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-sm border-2 border-dashed rounded-xl p-6 bg-gradient-to-br from-slate-50 to-indigo-50 text-center flex flex-col items-center gap-3"
                                    >
                                        <Sparkles className="w-8 h-8 text-indigo-500" />
                                        <p className="font-medium text-slate-700">Aucune campagne active</p>
                                        <p className="text-xs text-muted-foreground">Créez votre première campagne pour utiliser l'IA</p>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => setShowWizard(true)}
                                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 mt-2"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Créer ma première campagne
                                        </Button>
                                    </motion.div>
                                ) : (
                                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                                        <SelectTrigger className="h-12 border-2 hover:border-primary transition-all">
                                            <SelectValue placeholder="Sélectionner..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {campaigns.map((camp) => (
                                                <SelectItem
                                                    key={camp.id}
                                                    value={camp.id}
                                                    className="cursor-pointer hover:bg-indigo-50"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3 text-indigo-500" />
                                                        {camp.campaign_name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Info card */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 text-xs"
                            >
                                <p className="text-blue-900 font-medium mb-1">✨ Comment ça marche ?</p>
                                <p className="text-blue-700">
                                    L'IA combine les données du <strong>Deep Search</strong> avec votre <strong>stratégie de campagne</strong>
                                    pour rédiger un email 100% personnalisé et ultra-pertinent.
                                </p>
                            </motion.div>
                        </motion.div>
                    )}

                    <CreateCampaignWizard
                        open={showWizard}
                        onOpenChange={setShowWizard}
                        onSuccess={(newId) => {
                            fetchCampaigns()
                            setSelectedCampaignId(newId)
                        }}
                    />

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-2"
                        >
                            Annuler
                        </Button>

                        <AIButton
                            onClick={handleGenerate}
                            disabled={campaigns.length === 0 || isDeepSearchMissing}
                            loading={loading}
                            variant="primary"
                        >
                            {loading ? "Génération..." : "Générer avec IA"}
                        </AIButton>
                    </DialogFooter>
                </motion.div>
            </DialogContent>
        </Dialog>
    )
}
