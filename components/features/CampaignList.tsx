"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Campaign } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, MoreHorizontal, Eye, Trash2, Edit2, Zap } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CampaignForm } from "./CampaignForm"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"

export function CampaignList() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const fetchCampaigns = async () => {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase
                .from('cold_email_campaigns')
                .select('*')
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

    const handleEdit = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingId(id)
        setIsFormOpen(true)
    }

    const handleCreate = () => {
        setEditingId(null)
        setIsFormOpen(true)
    }

    const toggleActive = async (id: string, currentState: boolean, e: React.MouseEvent) => {
        e.stopPropagation()
        const supabase = createClient()
        await supabase.from('cold_email_campaigns').update({ is_active: !currentState }).eq('id', id)
        fetchCampaigns() // Optimistic update would be better but simple reload works
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">Vos Campagnes</h2>
                    <p className="text-sm text-muted-foreground">Profils de prospection configurés</p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Créer une campagne
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : campaigns.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                        <Zap className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="font-semibold mb-1">Aucune campagne</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">
                            Créez votre premier profil de prospection pour générer des emails ultra-personnalisés.
                        </p>
                        <Button variant="outline" onClick={handleCreate}>Commencer</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {campaigns.map((camp) => (
                        <Card key={camp.id} className="group hover:border-primary/50 transition-colors cursor-pointer" onClick={(e) => handleEdit(camp.id, e)}>
                            <CardHeader className="pb-3 relative">
                                <div className="flex justify-between items-start">
                                    <Badge variant={camp.is_active ? "default" : "secondary"} className={camp.is_active ? "bg-green-600" : ""}>
                                        {camp.is_active ? "Active" : "Inacive"}
                                    </Badge>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
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
                                <CardTitle className="line-clamp-1 text-base mt-2">{camp.nom_campagne}</CardTitle>
                                <CardDescription className="line-clamp-1">
                                    {camp.service_a_vendre || "Service non spécifié"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground flex flex-col gap-1">
                                    <span>Target: {camp.type_de_prospect_vise || "Non défini"}</span>
                                    <span>Modifié le {format(new Date(camp.updated_at), "d MMM yyyy", { locale: fr })}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CampaignForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                campaignId={editingId}
                onSuccess={fetchCampaigns}
            />
        </div>
    )
}
