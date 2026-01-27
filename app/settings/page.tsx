"use client"

import { useState, useEffect } from "react"
import { User, Building2, Lock, Mail, Globe, FileText, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function SettingsPage() {
    const [profileData, setProfileData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        company_name: "",
        website: "",
        description: "" // Note: 'description' and 'website' might not be in profiles table yet, relying on task requirements. Assuming they are or will be added.
        // Wait, the SQL didn't add website/description. I should check if I missed them or if I should just use what I have.
        // The previous file had them. I'll include them in state but only save what's in DB if columns missing.
        // Actually, user asked for "Configuration all linked", so I should probably stick to what's in DB: first_name, last_name, company_name, email.
        // I will stick to columns I know exist: id, first_name, last_name, company_name, email. Use metadata for others if needed?
        // Let's assume only first_name, last_name, company_name are editable for now to avoid SQL errors.
    })

    // Extended state for UI, but will only save existing columns unless I alter table.
    // User asked "info qui ne sont pas les bonne il faut afficher celle de la table".
    // I will use first_name, last_name, company_name. 

    const [accountData, setAccountData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    })

    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(null)

    const supabase = createClient()

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (data) {
                    setProfileData({
                        first_name: data.first_name || "",
                        last_name: data.last_name || "",
                        email: data.email || user.email || "", // Fallback to auth email
                        company_name: data.company_name || "",
                        website: "", // Not in DB yet
                        description: "" // Not in DB yet
                    })
                }
            }
            setLoading(false)
        }
        fetchProfile()
    }, [])

    const handleAutoSave = async (field: string, value: string) => {
        if (!userId) return

        // Only save fields that exist in DB
        const dbFields = ['first_name', 'last_name', 'company_name']
        if (!dbFields.includes(field)) return

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ [field]: value })
                .eq('id', userId)

            if (error) throw error

            const fieldNameMap: any = {
                first_name: "Prénom",
                last_name: "Nom",
                company_name: "Entreprise"
            }

            toast.success(`${fieldNameMap[field]} enregistré`)
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors de la sauvegarde")
        }
    }

    const handleChangePassword = async () => {
        if (accountData.newPassword !== accountData.confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas")
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: accountData.newPassword
            })

            if (error) throw error

            toast.success("Mot de passe mis à jour avec succès")
            setAccountData({ currentPassword: "", newPassword: "", confirmPassword: "" })
        } catch (error: any) {
            toast.error(error.message || "Erreur lors de la mise à jour")
        }
    }

    if (loading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
                <p className="text-muted-foreground mt-1">
                    Gérez vos informations personnelles et paramètres de compte
                </p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="profile">Profil</TabsTrigger>
                    <TabsTrigger value="account">Compte</TabsTrigger>
                    <TabsTrigger value="security">Sécurité</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Informations Personnelles
                            </CardTitle>
                            <CardDescription>
                                Mettez à jour vos informations de profil et d'entreprise (Sauvegarde automatique)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Prénom</label>
                                    <Input
                                        value={profileData.first_name}
                                        onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                                        onBlur={(e) => handleAutoSave('first_name', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nom</label>
                                    <Input
                                        value={profileData.last_name}
                                        onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                                        onBlur={(e) => handleAutoSave('last_name', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    Email
                                </label>
                                <Input
                                    type="email"
                                    value={profileData.email}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié ici.</p>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Entreprise
                                </label>
                                <Input
                                    value={profileData.company_name}
                                    onChange={(e) => setProfileData({ ...profileData, company_name: e.target.value })}
                                    onBlur={(e) => handleAutoSave('company_name', e.target.value)}
                                />
                            </div>

                            {/* Removed Website and Description as they are not in DB schema yet */}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="account" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5 text-primary" />
                                Paramètres du Compte
                            </CardTitle>
                            <CardDescription>
                                Gérez vos paramètres de connexion
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <p className="font-medium">Email de connexion</p>
                                        <p className="text-sm text-muted-foreground">{profileData.email}</p>
                                    </div>
                                    <Badge variant="outline">Vérifié</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5 text-primary" />
                                Changer le Mot de Passe
                            </CardTitle>
                            <CardDescription>
                                Assurez-vous d'utiliser un mot de passe fort et unique
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nouveau mot de passe</label>
                                <Input
                                    type="password"
                                    value={accountData.newPassword}
                                    onChange={(e) => setAccountData({ ...accountData, newPassword: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Confirmer le nouveau mot de passe</label>
                                <Input
                                    type="password"
                                    value={accountData.confirmPassword}
                                    onChange={(e) => setAccountData({ ...accountData, confirmPassword: e.target.value })}
                                />
                            </div>

                            <Button onClick={handleChangePassword} className="w-full md:w-auto">
                                <Lock className="mr-2 h-4 w-4" />
                                Modifier le mot de passe
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
