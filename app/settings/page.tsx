"use client"

import { useState } from "react"
import { User, Building2, Lock, Mail, Globe, FileText, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
    const [profileData, setProfileData] = useState({
        firstName: "Louis",
        lastName: "Moyne-Bressand",
        email: "louis@neuraflow.com",
        company: "Neuraflow",
        website: "https://neuraflow.com",
        description: "Intelligence artificielle pour la prospection B2B"
    })

    const [accountData, setAccountData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    })

    const handleSaveProfile = () => {
        alert("Profil sauvegardé ! (Fonctionnalité à venir)")
    }

    const handleChangePassword = () => {
        alert("Mot de passe modifié ! (Fonctionnalité à venir)")
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
                                Mettez à jour vos informations de profil et d'entreprise
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Prénom</label>
                                    <Input
                                        value={profileData.firstName}
                                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nom</label>
                                    <Input
                                        value={profileData.lastName}
                                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
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
                                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                />
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Entreprise
                                </label>
                                <Input
                                    value={profileData.company}
                                    onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    Site Web
                                </label>
                                <Input
                                    type="url"
                                    placeholder="https://..."
                                    value={profileData.website}
                                    onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Description de l'entreprise
                                </label>
                                <textarea
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Décrivez votre entreprise et son activité..."
                                    value={profileData.description}
                                    onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                                />
                            </div>

                            <Button onClick={handleSaveProfile} className="w-full md:w-auto">
                                <Save className="mr-2 h-4 w-4" />
                                Enregistrer les modifications
                            </Button>
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
                                Gérez vos paramètres de connexion et de sécurité
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

                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <p className="font-medium">Authentification à deux facteurs</p>
                                        <p className="text-sm text-muted-foreground">Non activée</p>
                                    </div>
                                    <Button variant="outline" size="sm" disabled>
                                        Activer (Bientôt)
                                    </Button>
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
                                <label className="text-sm font-medium">Mot de passe actuel</label>
                                <Input
                                    type="password"
                                    value={accountData.currentPassword}
                                    onChange={(e) => setAccountData({ ...accountData, currentPassword: e.target.value })}
                                />
                            </div>

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
