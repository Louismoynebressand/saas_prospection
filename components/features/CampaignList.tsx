"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Campaign } from "@/types"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { AIBadge } from "@/components/ui/ai-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, MoreHorizontal, Eye, Trash2, Edit2, Zap, Sparkles } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CreateCampaignWizard } from "./CreateCampaignWizard"
import { CampaignForm } from "./CampaignForm"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"

export function CampaignList() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isWizardOpen, setIsWizardOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const fetchCampaigns = async () => {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase
                .from('cold_email_campaigns')
                .select(`
                    id,
                    user_id,
                    name,
                    campaign_name,
                    is_active,
                    created_at,
                    updated_at,
                    status,
                    main_offer,
                    service_to_sell,
                    target_audience
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (data) setCampaigns(data as Campaign[])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchCampaigns()
    }, [])

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm("Supprimer cette campagne ?")) return

        const supabase = createClient()
        const { error } = await supabase.from('cold_email_campaigns').delete().eq('id', id)

        if (error) toast.error("Erreur suppression")
        else {
            toast.success("Campagne supprimée")
            fetchCampaigns()
        }
    }

    const router = useRouter()

    const handleEdit = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        router.push(`/campaigns/${id}?tab=configuration`)
    }

    const handleViewCampaign = (id: string) => {
        router.push(`/campaigns/${id}`)
    }

    const handleCreate = () => {
        setEditingId(null)
        setIsWizardOpen(true)
    }

    const toggleActive = async (id: string, currentState: boolean, e: React.MouseEvent) => {
        e.stopPropagation()
        const supabase = createClient()
        await supabase.from('cold_email_campaigns').update({ is_active: !currentState }).eq('id', id)
        fetchCampaigns()
    }

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-indigo-600" />
                        Vos Campagnes
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Profils de prospection IA configurés</p>
                </div>
                <Button onClick={handleCreate} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Créer une campagne
                </Button>
            </motion.div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : campaigns.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Card className="border-2 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
                                <Zap className="h-8 w-8 text-indigo-600" />
                            </div>
                            <h3 className="font-semibold text-lg mb-2">Aucune campagne</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mb-4">
                                Créez votre premier profil de prospection pour générer des emails ultra-personnalisés avec l'IA.
                            </p>
                            <Button variant="default" onClick={handleCreate} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                                <Plus className="mr-2 h-4 w-4" />
                                Commencer
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {campaigns.map((camp, index) => (
                            <motion.div
                                key={camp.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card
                                    className="group relative overflow-hidden cursor-pointer
                                               border-2 hover:border-indigo-400 
                                               transition-all duration-300
                                               hover:shadow-xl hover:shadow-indigo-200/50
                                               hover:-translate-y-1"
                                    onClick={() => handleViewCampaign(camp.id)}
                                >
                                    <CardHeader className="pb-3 relative z-10">
                                        <div className="flex justify-between items-start">
                                            <motion.div
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <Badge
                                                    variant={camp.is_active ? "default" : "secondary"}
                                                    className={`${camp.is_active
                                                        ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                                        : "bg-gray-400"
                                                        } transition-all`}
                                                >
                                                    {camp.is_active ? "✓ Active" : "⏸ Inactive"}
                                                </Badge>
                                            </motion.div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 -mt-1 -mr-2 hover:bg-indigo-100 transition-colors"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => handleEdit(camp.id, e)}>
                                                        <Edit2 className="mr-2 h-4 w-4" /> Modifier
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => toggleActive(camp.id, camp.is_active, e)}>
                                                        <Zap className="mr-2 h-4 w-4" /> {camp.is_active ? "Désactiver" : "Activer"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={(e) => handleDelete(camp.id, e)}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <CardTitle className="line-clamp-1 text-lg mt-3 group-hover:text-indigo-600 transition-colors">
                                            {camp.campaign_name}
                                        </CardTitle>
                                        <CardDescription className="line-clamp-2 text-sm">
                                            {camp.main_offer || camp.service_to_sell || "Service non spécifié"}
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="relative z-10">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                                                <span className="font-medium">Target:</span>
                                                <span className="line-clamp-1">{camp.target_audience || "Non défini"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <div className="w-2 h-2 bg-purple-400 rounded-full" />
                                                <span>Modifié le {format(new Date(camp.updated_at), "d MMM yyyy", { locale: fr })}</span>
                                            </div>
                                        </div>

                                        {/* AI Badge at bottom if applicable */}
                                        <div className="mt-4 pt-3 border-t border-gray-200">
                                            <AIBadge animated={false}>AI-Powered</AIBadge>
                                        </div>
                                    </CardContent>

                                    {/* Bottom gradient line */}
                                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 
                                                    opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            <CampaignForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                campaignId={editingId}
                onSuccess={fetchCampaigns}
            />

            <CreateCampaignWizard
                open={isWizardOpen}
                onOpenChange={setIsWizardOpen}
                onSuccess={() => {
                    fetchCampaigns()
                }}
            />
        </div>
    )
}
