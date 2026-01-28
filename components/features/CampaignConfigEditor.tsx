"use client"

import { useState } from "react"
import { Campaign } from "@/types"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

interface CampaignConfigEditorProps {
    campaign: Campaign
    onUpdate: (updated: Campaign) => void
}

export function CampaignConfigEditor({ campaign, onUpdate }: CampaignConfigEditorProps) {
    const [formData, setFormData] = useState<Partial<Campaign>>(campaign)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const supabase = createClient()

            const { data, error } = await supabase
                .from('cold_email_campaigns')
                .update(formData)
                .eq('id', campaign.id)
                .select()
                .single()

            if (error) throw error

            onUpdate(data as Campaign)
            toast.success("✅ Configuration mise à jour avec succès !")
        } catch (error: any) {
            console.error(error)
            toast.error("Erreur lors de la sauvegarde")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Section 1: Identité */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CardTitle>Identité</CardTitle>
                            <Badge variant="outline">Étape 1</Badge>
                        </div>
                        <CardDescription>
                            Informations de base sur votre campagne
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="campaign_name">Nom de la Campagne</Label>
                                <Input
                                    id="campaign_name"
                                    value={formData.campaign_name || ""}
                                    onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="my_company_name">Nom de Votre Entreprise</Label>
                                <Input
                                    id="my_company_name"
                                    value={formData.my_company_name || ""}
                                    onChange={(e) => setFormData({ ...formData, my_company_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="my_website">Site Web</Label>
                            <Input
                                id="my_website"
                                type="url"
                                value={formData.my_website || ""}
                                onChange={(e) => setFormData({ ...formData, my_website: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="pitch">Pitch</Label>
                                <Textarea
                                    id="pitch"
                                    value={formData.pitch || ""}
                                    onChange={(e) => setFormData({ ...formData, pitch: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="main_offer">Offre Principale</Label>
                                <Textarea
                                    id="main_offer"
                                    value={formData.main_offer || ""}
                                    onChange={(e) => setFormData({ ...formData, main_offer: e.target.value })}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="main_promise">Promesse Principale</Label>
                            <Textarea
                                id="main_promise"
                                value={formData.main_promise || ""}
                                onChange={(e) => setFormData({ ...formData, main_promise: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Section 2: Ciblage */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CardTitle>Ciblage</CardTitle>
                            <Badge variant="outline">Étape 2</Badge>
                        </div>
                        <CardDescription>
                            Définissez votre audience cible
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="target_audience">Audience Cible (ICP)</Label>
                            <Textarea
                                id="target_audience"
                                value={formData.target_audience || ""}
                                onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="target_company_size">Taille Entreprise</Label>
                                <Input
                                    id="target_company_size"
                                    value={formData.target_company_size || ""}
                                    onChange={(e) => setFormData({ ...formData, target_company_size: e.target.value })}
                                    placeholder="ex: 1-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="objective">Objectif</Label>
                                <Select
                                    value={formData.objective || "BOOK_MEETING"}
                                    onValueChange={(value) => setFormData({ ...formData, objective: value as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BOOK_MEETING">📅 Réserver un RDV</SelectItem>
                                        <SelectItem value="DEMO">🎥 Démonstration</SelectItem>
                                        <SelectItem value="FREE_TRIAL">🆓 Essai Gratuit</SelectItem>
                                        <SelectItem value="QUOTE">💰 Devis</SelectItem>
                                        <SelectItem value="DISCOUNT">🎁 Réduction</SelectItem>
                                        <SelectItem value="CALLBACK">📞 Être Rappelé</SelectItem>
                                        <SelectItem value="DOWNLOAD">📥 Téléchargement</SelectItem>
                                        <SelectItem value="WEBINAR">🎓 Webinaire</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Section 3: Signature */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CardTitle>Signature</CardTitle>
                            <Badge variant="outline">Étape 3</Badge>
                        </div>
                        <CardDescription>
                            Vos coordonnées et signature d'email
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="signature_name">Nom</Label>
                                <Input
                                    id="signature_name"
                                    value={formData.signature_name || ""}
                                    onChange={(e) => setFormData({ ...formData, signature_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signature_title">Titre</Label>
                                <Input
                                    id="signature_title"
                                    value={formData.signature_title || ""}
                                    onChange={(e) => setFormData({ ...formData, signature_title: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="signature_email">Email</Label>
                                <Input
                                    id="signature_email"
                                    type="email"
                                    value={formData.signature_email || ""}
                                    onChange={(e) => setFormData({ ...formData, signature_email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signature_phone">Téléphone</Label>
                                <Input
                                    id="signature_phone"
                                    type="tel"
                                    value={formData.signature_phone || ""}
                                    onChange={(e) => setFormData({ ...formData, signature_phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="signature_ps">PS  (Post-Scriptum)</Label>
                            <Textarea
                                id="signature_ps"
                                value={formData.signature_ps || ""}
                                onChange={(e) => setFormData({ ...formData, signature_ps: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Section 4: Paramètres Email */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CardTitle>Paramètres Email</CardTitle>
                            <Badge variant="outline">Étape 4</Badge>
                        </div>
                        <CardDescription>
                            Ton, langue et longueur des emails
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="desired_tone">Tonalité</Label>
                                <Input
                                    id="desired_tone"
                                    value={formData.desired_tone || ""}
                                    onChange={(e) => setFormData({ ...formData, desired_tone: e.target.value })}
                                    placeholder="ex: Professionnel"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email_length">Longueur</Label>
                                <Select
                                    value={formData.email_length || "STANDARD"}
                                    onValueChange={(value) => setFormData({ ...formData, email_length: value as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CONCISE">Court</SelectItem>
                                        <SelectItem value="STANDARD">Standard</SelectItem>
                                        <SelectItem value="DETAILED">Détaillé</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="language">Langue</Label>
                                <Select
                                    value={formData.language || "fr"}
                                    onValueChange={(value) => setFormData({ ...formData, language: value as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fr">🇫🇷 Français</SelectItem>
                                        <SelectItem value="en">🇬🇧 English</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    size="lg"
                    className="gap-2"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sauvegarde...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Enregistrer les Modifications
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
