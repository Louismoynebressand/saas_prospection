"use client"

import { useState, useEffect } from "react"
import { User, Building2, Lock, Mail, Phone, Save, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { motion } from "framer-motion"

export default function SettingsPage() {
    const [profileData, setProfileData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company_name: "",
    })

    const [accountData, setAccountData] = useState({
        newPassword: "",
        confirmPassword: ""
    })

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
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
                        email: data.email || user.email || "",
                        phone: data.phone || "",
                        company_name: data.company_name || "",
                    })
                }
            }
            setLoading(false)
        }
        fetchProfile()
    }, [])

    const handleAutoSave = async (field: string, value: string) => {
        if (!userId) return

        const dbFields = ['first_name', 'last_name', 'company_name', 'phone']
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
                company_name: "Entreprise",
                phone: "Téléphone"
            }

            toast.success(`✅ ${fieldNameMap[field]} enregistré`)
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

        if (accountData.newPassword.length < 6) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères")
            return
        }

        setSaving(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: accountData.newPassword
            })

            if (error) throw error

            toast.success("🔒 Mot de passe mis à jour avec succès")
            setAccountData({ newPassword: "", confirmPassword: "" })
        } catch (error: any) {
            toast.error(error.message || "Erreur lors de la mise à jour")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-indigo-600" />
                    <p className="text-muted-foreground">Chargement de vos paramètres...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header with gradient */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-3xl -z-10 rounded-full" />
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Configuration
                </h1>
                <p className="text-muted-foreground mt-2">
                    Gérez vos informations personnelles et paramètres de compte
                </p>
            </motion.div>

            {/* Tabs with modern styling */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2 h-12 bg-gradient-to-r from-indigo-50 to-purple-50 p-1">
                        <TabsTrigger
                            value="profile"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600"
                        >
                            <User className="w-4 h-4 mr-2" />
                            Profil
                        </TabsTrigger>
                        <TabsTrigger
                            value="security"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600"
                        >
                            <Lock className="w-4 h-4 mr-2" />
                            Sécurité
                        </TabsTrigger>
                    </TabsList>

                    {/* Profile Tab */}
                    <TabsContent value="profile" className="mt-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-2 border-transparent hover:border-indigo-200 transition-all duration-300 shadow-lg">
                                <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                                    <CardTitle className="flex items-center gap-2 text-xl">
                                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                                            <User className="h-5 w-5 text-white" />
                                        </div>
                                        Informations Personnelles
                                    </CardTitle>
                                    <CardDescription>
                                        Vos informations sont sauvegardées automatiquement ✨
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    {/* Name Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="first_name" className="text-sm font-medium flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-indigo-600" />
                                                Prénom
                                            </Label>
                                            <Input
                                                id="first_name"
                                                value={profileData.first_name}
                                                onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                                                onBlur={(e) => handleAutoSave('first_name', e.target.value)}
                                                className="border-indigo-200 focus:border-indigo-400 transition-colors"
                                                placeholder="Votre prénom"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="last_name" className="text-sm font-medium flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-indigo-600" />
                                                Nom
                                            </Label>
                                            <Input
                                                id="last_name"
                                                value={profileData.last_name}
                                                onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                                                onBlur={(e) => handleAutoSave('last_name', e.target.value)}
                                                className="border-indigo-200 focus:border-indigo-400 transition-colors"
                                                placeholder="Votre nom"
                                            />
                                        </div>
                                    </div>

                                    {/* Email Field (Read-only) */}
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                                            <Mail className="h-3.5 w-3.5 text-indigo-600" />
                                            Email
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="email"
                                                type="email"
                                                value={profileData.email}
                                                disabled
                                                className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                                            />
                                            <Badge className="absolute right-3 top-2.5 bg-green-500">
                                                Vérifié
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            L'email ne peut pas être modifié ici.
                                        </p>
                                    </div>

                                    {/* Phone Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                                            <Phone className="h-3.5 w-3.5 text-indigo-600" />
                                            Téléphone
                                        </Label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            value={profileData.phone}
                                            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                            onBlur={(e) => handleAutoSave('phone', e.target.value)}
                                            className="border-indigo-200 focus:border-indigo-400 transition-colors"
                                            placeholder="+33 6 12 34 56 78"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Utilisé pour vos signatures d'emails
                                        </p>
                                    </div>

                                    <Separator className="bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />

                                    {/* Company Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="company_name" className="text-sm font-medium flex items-center gap-2">
                                            <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                                            Entreprise
                                        </Label>
                                        <Input
                                            id="company_name"
                                            value={profileData.company_name}
                                            onChange={(e) => setProfileData({ ...profileData, company_name: e.target.value })}
                                            onBlur={(e) => handleAutoSave('company_name', e.target.value)}
                                            className="border-indigo-200 focus:border-indigo-400 transition-colors"
                                            placeholder="Nom de votre entreprise"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </TabsContent>

                    {/* Security Tab */}
                    <TabsContent value="security" className="mt-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-2 border-transparent hover:border-purple-200 transition-all duration-300 shadow-lg">
                                <CardHeader className="bg-gradient-to-r from-purple-50/50 to-pink-50/50">
                                    <CardTitle className="flex items-center gap-2 text-xl">
                                        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                                            <Lock className="h-5 w-5 text-white" />
                                        </div>
                                        Changer le Mot de Passe
                                    </CardTitle>
                                    <CardDescription>
                                        Assurez-vous d'utiliser un mot de passe fort et unique 🔐
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword" className="text-sm font-medium">
                                            Nouveau mot de passe
                                        </Label>
                                        <Input
                                            id="newPassword"
                                            type="password"
                                            value={accountData.newPassword}
                                            onChange={(e) => setAccountData({ ...accountData, newPassword: e.target.value })}
                                            className="border-purple-200 focus:border-purple-400 transition-colors"
                                            placeholder="••••••••"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword" className="text-sm font-medium">
                                            Confirmer le nouveau mot de passe
                                        </Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            value={accountData.confirmPassword}
                                            onChange={(e) => setAccountData({ ...accountData, confirmPassword: e.target.value })}
                                            className="border-purple-200 focus:border-purple-400 transition-colors"
                                            placeholder="••••••••"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleChangePassword}
                                        disabled={saving || !accountData.newPassword || !accountData.confirmPassword}
                                        className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all"
                                        size="lg"
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Mise à jour...
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="mr-2 h-4 w-4" />
                                                Modifier le mot de passe
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    )
}
