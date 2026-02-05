"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

const campaignSchema = z.object({
    campaign_name: z.string().min(2, "Le nom est trop court"),
    nom_entreprise_client: z.string(),
    site_web_client: z.string(),
    phrase_positionnement_client: z.string(),
    offre_principale_client: z.string(),
    promesse_principale: z.string(),
    service_a_vendre: z.string(),
    type_de_prospect_vise: z.string(),
    ton_souhaite: z.string(),
    vouvoiement: z.boolean(),
    benefices_secondaires: z.string(),
    themes_de_douleurs_autorises: z.string(),
    mots_interdits: z.string(),
    chiffres_autorises: z.string(),
})

type CampaignFormValues = z.infer<typeof campaignSchema>

interface CampaignFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    campaignId?: string | null
    onSuccess: () => void
}

export function CampaignForm({ open, onOpenChange, campaignId, onSuccess }: CampaignFormProps) {
    const [loading, setLoading] = useState(false)
    const [fetchingSchema, setFetchingSchema] = useState(false)
    const supabase = createClient()

    const form = useForm<CampaignFormValues>({
        resolver: zodResolver(campaignSchema),
        defaultValues: {
            campaign_name: "",
            nom_entreprise_client: "",
            site_web_client: "",
            phrase_positionnement_client: "",
            offre_principale_client: "",
            promesse_principale: "",
            service_a_vendre: "",
            type_de_prospect_vise: "",
            ton_souhaite: "professionnel",
            vouvoiement: true,
            benefices_secondaires: "",
            themes_de_douleurs_autorises: "",
            mots_interdits: "",
            chiffres_autorises: "",
        }
    })

    // Load campaign data if editing
    useEffect(() => {
        if (campaignId && open) {
            const loadCampaign = async () => {
                setFetchingSchema(true)
                const { data, error } = await supabase
                    .from('cold_email_campaigns')
                    .select('*')
                    .eq('id', campaignId)
                    .single()

                if (data) {
                    form.reset({
                        campaign_name: data.campaign_name,
                        nom_entreprise_client: data.nom_entreprise_client || "",
                        site_web_client: data.site_web_client || "",
                        phrase_positionnement_client: data.phrase_positionnement_client || "",
                        offre_principale_client: data.offre_principale_client || "",
                        promesse_principale: data.promesse_principale || "",
                        service_a_vendre: data.service_a_vendre || "",
                        type_de_prospect_vise: data.type_de_prospect_vise || "",
                        ton_souhaite: data.ton_souhaite || "",
                        vouvoiement: data.vouvoiement,
                        benefices_secondaires: Array.isArray(data.benefices_secondaires) ? data.benefices_secondaires.join('\n') : "",
                        themes_de_douleurs_autorises: Array.isArray(data.themes_de_douleurs_autorises) ? data.themes_de_douleurs_autorises.join('\n') : "",
                        mots_interdits: Array.isArray(data.mots_interdits) ? data.mots_interdits.join('\n') : "",
                        chiffres_autorises: Array.isArray(data.chiffres_autorises) ? data.chiffres_autorises.join('\n') : "",
                    })
                }
                setFetchingSchema(false)
            }
            loadCampaign()
        } else if (open) {
            form.reset({
                campaign_name: "",
                vouvoiement: true
            })
        }
    }, [campaignId, open])

    const onSubmit = async (values: CampaignFormValues) => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Non connecté")

            // Convert textarea strings back to arrays
            const formatArray = (str?: string) => str ? str.split('\n').filter(s => s.trim().length > 0) : []

            const payload = {
                user_id: user.id,
                campaign_name: values.campaign_name,
                nom_entreprise_client: values.nom_entreprise_client,
                site_web_client: values.site_web_client,
                phrase_positionnement_client: values.phrase_positionnement_client,
                offre_principale_client: values.offre_principale_client,
                promesse_principale: values.promesse_principale,
                service_a_vendre: values.service_a_vendre,
                type_de_prospect_vise: values.type_de_prospect_vise,
                ton_souhaite: values.ton_souhaite,
                vouvoiement: values.vouvoiement,
                benefices_secondaires: formatArray(values.benefices_secondaires),
                themes_de_douleurs_autorises: formatArray(values.themes_de_douleurs_autorises),
                mots_interdits: formatArray(values.mots_interdits),
                chiffres_autorises: formatArray(values.chiffres_autorises),
                updated_at: new Date().toISOString()
            }

            if (campaignId) {
                const { error } = await supabase
                    .from('cold_email_campaigns')
                    .update(payload)
                    .eq('id', campaignId)
                if (error) throw error
                toast.success("Campagne mise à jour")
            } else {
                const { error } = await supabase
                    .from('cold_email_campaigns')
                    .insert(payload)
                if (error) throw error
                toast.success("Campagne créée")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error("Erreur: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Auto-save logic could go here (debounce onSubmit), but let's stick to explicit save for safety first,
    // as "saving on click elsewhere" (blur) can be annoying if validation fails. 
    // However, I will add a "Sauvegarder" button that is always visible.

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle>{campaignId ? "Modifier la campagne" : "Nouvelle campagne"}</DialogTitle>
                    <DialogDescription>
                        Configurez les paramètres pour la génération de vos emails.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6">
                    {fetchingSchema ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <form id="campaign-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                            {/* Section 1: Identité */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Identité & Offre</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Nom de la campagne *</Label>
                                        <Input {...form.register("campaign_name")} placeholder="ex: Campagne Agents Immo Janvier" />
                                        {form.formState.errors.campaign_name && <span className="text-red-500 text-xs">{form.formState.errors.campaign_name.message}</span>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nom de votre entreprise</Label>
                                        <Input {...form.register("nom_entreprise_client")} placeholder="ex: Agence Digitale 360" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Site Web</Label>
                                        <Input {...form.register("site_web_client")} placeholder="https://..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Service à vendre</Label>
                                        <Input {...form.register("service_a_vendre")} placeholder="ex: Création de site web, Audit SEO..." />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Phrase de positionnement (Pitch)</Label>
                                    <Textarea {...form.register("phrase_positionnement_client")} placeholder="Nous aidons les [cible] à [bénéfice] grâce à [méthode]." />
                                </div>
                            </div>

                            <Separator />

                            {/* Section 2: Stratégie */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Stratégie & Arguments</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Offre Principale</Label>
                                        <Textarea {...form.register("offre_principale_client")} placeholder="Décrivez votre offre phare..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Promesse Principale</Label>
                                        <Textarea {...form.register("promesse_principale")} placeholder="Quel est le résultat concret pour le client ?" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bénéfices Secondaires (1 par ligne)</Label>
                                        <Textarea {...form.register("benefices_secondaires")} className="min-h-[100px]" placeholder="- Gain de temps&#10;- Visibilité accrue&#10;- Support 24/7" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Thèmes de "Douleurs" (Pain points)</Label>
                                        <Textarea {...form.register("themes_de_douleurs_autorises")} className="min-h-[100px]" placeholder="- Manque de leads&#10;- Site lent&#10;- Design obsolète" />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Section 3: Ton & Contraintes */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Style & Ton</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Cible visée</Label>
                                        <Input {...form.register("type_de_prospect_vise")} placeholder="ex: PME, Artisan, Startup..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ton souhaité</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            {...form.register("ton_souhaite")}
                                        >
                                            <option value="professionnel">Professionnel & Rassurant</option>
                                            <option value="direct">Direct & Concis</option>
                                            <option value="jovial">Sympathique & Décontracté</option>
                                            <option value="luxe">Premium & Élégant</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="vouvoiement"
                                        checked={form.watch("vouvoiement")}
                                        onCheckedChange={(c) => form.setValue("vouvoiement", c)}
                                    />
                                    <Label htmlFor="vouvoiement">Utiliser le vouvoiement (Vous) ?</Label>
                                </div>

                                <div className="space-y-2">
                                    <Label>Mots Interdits</Label>
                                    <Input {...form.register("mots_interdits")} placeholder="gratuit, pas cher, urgent..." />
                                    <p className="text-xs text-muted-foreground">Séparez par des virgules ou retours à la ligne.</p>
                                </div>
                            </div>

                        </form>
                    )}
                </ScrollArea>

                <DialogFooter className="p-6 pt-4 border-t bg-slate-50 dark:bg-slate-900/50">
                    <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Annuler</Button>
                    <Button type="submit" form="campaign-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enregistrer la campagne
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
