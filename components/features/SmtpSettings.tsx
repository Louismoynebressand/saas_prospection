"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, CheckCircle2, Server, Mail, Shield, RefreshCw, Info, Building2, Globe, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface SmtpConfig {
    id: string
    name: string
    provider: string
    smtp_host: string
    smtp_port: number
    smtp_user: string
    from_email: string
    from_name?: string
    is_active: boolean
}

interface SmtpPreset {
    name: string
    host: string
    port: number
    category: "public" | "pro" | "relay" | "custom"
    note?: string
    icon?: string
}

// Comprehensive SMTP Provider Presets
const SMTP_PRESETS: Record<string, SmtpPreset> = {
    // Grand Public
    gmail: { name: "Gmail", host: "smtp.gmail.com", port: 465, category: "public", icon: "G", note: "Nécessite un mot de passe d'application si 2FA activé" },
    outlook: { name: "Microsoft 365", host: "smtp.office365.com", port: 587, category: "public", icon: "O", note: "Utilisez votre compte professionnel ou personnel" },
    zoho: { name: "Zoho Mail", host: "smtp.zoho.com", port: 465, category: "public", icon: "Z" },

    // Hébergeurs Français Pro
    ovh_mx: { name: "MX Plan", host: "ssl0.ovh.net", port: 587, category: "pro", icon: "MX", note: "Serveur : ssl0.ovh.net ou smtp.mail.ovh.net" },
    ovh_pro: { name: "Email Pro", host: "pro1.mail.ovh.net", port: 587, category: "pro", icon: "EP", note: "Le chiffre peut varier (pro1, pro2...)" },
    ovh_exchange: { name: "Exchange", host: "ex3.mail.ovh.net", port: 587, category: "pro", icon: "EX", note: "Le chiffre peut varier (ex1, ex2, ex3...)" },
    ionos: { name: "IONOS", host: "smtp.ionos.com", port: 587, category: "pro", icon: "IO" },
    o2switch: { name: "o2switch", host: "", port: 465, category: "pro", icon: "O2", note: "Utilisez le serveur du provider : mail.VOTRE-COMPTE.o2switch.net (trouvez VOTRE-COMPTE dans l'email de bienvenue o2switch). N'utilisez PAS votre nom de domaine." },

    // Services SMTP Pro
    brevo: { name: "Brevo", host: "smtp-relay.brevo.com", port: 587, category: "relay", icon: "BR", note: "Utilisez vos identifiants SMTP Brevo (pas votre mot de passe compte)" },
    sendgrid: { name: "SendGrid", host: "smtp.sendgrid.net", port: 587, category: "relay", icon: "SG", note: "User: 'apikey', Password: votre clé API" },
    mailgun_us: { name: "Mailgun US", host: "smtp.mailgun.org", port: 587, category: "relay", icon: "MG" },
    mailgun_eu: { name: "Mailgun EU", host: "smtp.eu.mailgun.org", port: 587, category: "relay", icon: "MG" },

    // Autres
    custom: { name: "Autre", host: "", port: 587, category: "custom", icon: "?" }
}

export function SmtpSettings() {
    const [configs, setConfigs] = useState<SmtpConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [testingConnection, setTestingConnection] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<"public" | "pro" | "relay" | "custom">("public")

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        provider: "gmail",
        smtp_host: "smtp.gmail.com",
        smtp_port: 465,
        email: "",
        password: "",
        from_name: ""
    })

    useEffect(() => {
        fetchConfigs()
    }, [])

    const fetchConfigs = async () => {
        try {
            const res = await fetch("/api/settings/smtp")
            if (res.ok) {
                const data = await res.json()
                setConfigs(data.configs || [])
            }
        } catch (error) {
            console.error("Failed to fetch configs", error)
            toast.error("Impossible de charger les configurations")
        } finally {
            setLoading(false)
        }
    }

    const handleProviderChange = (value: string) => {
        const preset = SMTP_PRESETS[value]
        if (preset) {
            setFormData(prev => ({
                ...prev,
                provider: value,
                smtp_host: preset.host,
                smtp_port: preset.port
            }))
        }
    }

    const handleTestConnection = async () => {
        if (!formData.email || !formData.password || !formData.smtp_host) {
            toast.error("Veuillez remplir email, mot de passe et hôte")
            return
        }

        setTestingConnection(true)

        try {
            const res = await fetch("/api/settings/smtp/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    host: formData.smtp_host,
                    port: formData.smtp_port,
                    user: formData.email,
                    pass: formData.password,
                    from_email: formData.email,
                    from_name: formData.from_name || "",
                    provider: formData.provider
                })
            })

            const data = await res.json()

            if (res.ok && data.success) {
                toast.success("✅ Connexion réussie !", {
                    description: data.message || "Vos identifiants sont valides."
                })
            } else {
                toast.error("❌ Echec connexion", {
                    description: data.error || "Vérifiez vos identifiants.",
                    duration: 6000
                })
            }
        } catch (error) {
            console.error("Test Error:", error)
            toast.error("Erreur technique lors du test")
        } finally {
            setTestingConnection(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.smtp_host || !formData.email || !formData.password) {
            toast.error("Champs obligatoires manquants", {
                description: "Merci de remplir Nom, Email, Mot de passe et Serveur."
            })
            return
        }

        setSaving(true)
        try {
            const payload = {
                name: formData.name,
                provider: formData.provider,
                smtp_host: formData.smtp_host,
                smtp_port: formData.smtp_port,
                smtp_user: formData.email,
                smtp_password: formData.password,
                from_email: formData.email,
                from_name: formData.from_name
            }

            const res = await fetch("/api/settings/smtp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (res.ok) {
                toast.success("Configuration enregistrée !")
                setIsDialogOpen(false)
                fetchConfigs()
                setFormData({
                    name: "",
                    provider: "gmail",
                    smtp_host: "smtp.gmail.com",
                    smtp_port: 465,
                    email: "",
                    password: "",
                    from_name: ""
                })
            } else {
                toast.error("Erreur sauvegarde", {
                    description: data.error || "Impossible d'enregistrer.",
                    duration: 6000
                })
            }
        } catch (error) {
            console.error("Save Exception:", error)
            toast.error("Erreur serveur lors de la sauvegarde")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer cette configuration ?")) return
        try {
            const res = await fetch(`/api/settings/smtp?id=${id}`, { method: "DELETE" })
            if (res.ok) {
                toast.success("Supprimé")
                fetchConfigs()
            }
        } catch (error) {
            toast.error("Erreur suppression")
        }
    }

    const currentPreset = SMTP_PRESETS[formData.provider]
    const publicProviders = Object.entries(SMTP_PRESETS).filter(([_, p]) => p.category === "public")
    const proProviders = Object.entries(SMTP_PRESETS).filter(([_, p]) => p.category === "pro")
    const relayProviders = Object.entries(SMTP_PRESETS).filter(([_, p]) => p.category === "relay")

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="w-5 h-5 text-indigo-600" />
                        Comptes d'envoi Email
                    </h3>
                    <p className="text-sm text-muted-foreground">Gérez vos connexions SMTP pour l'envoi de campagnes.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
                            <Plus className="w-4 h-4 mr-2" /> Connecter un Email
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-2xl">Configurer un compte d'envoi</DialogTitle>
                            <DialogDescription className="text-base">
                                Sélectionnez votre fournisseur email et connectez votre compte SMTP.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            {/* Provider Selection with Tabs */}
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">1. Quel est votre fournisseur email ?</Label>

                                <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)} className="w-full">
                                    <TabsList className="grid w-full grid-cols-4">
                                        <TabsTrigger value="public" className="flex items-center gap-1.5">
                                            <Globe className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Grand Public</span>
                                            <span className="sm:hidden">Public</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="pro" className="flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Hébergeurs Pro</span>
                                            <span className="sm:hidden">Pro</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="relay" className="flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Services SMTP</span>
                                            <span className="sm:hidden">SMTP</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="custom" className="flex items-center gap-1.5">
                                            <Server className="w-3.5 h-3.5" />
                                            Autre
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="public" className="mt-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            {publicProviders.map(([key, preset]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => handleProviderChange(key)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-[1.02]",
                                                        formData.provider === key
                                                            ? "border-indigo-600 bg-indigo-50 shadow-md"
                                                            : "border-gray-200 bg-white hover:border-indigo-300"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black",
                                                        formData.provider === key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                                                    )}>
                                                        {preset.icon}
                                                    </div>
                                                    <span className="text-xs font-semibold text-center">{preset.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="pro" className="mt-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            {proProviders.map(([key, preset]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => handleProviderChange(key)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-[1.02]",
                                                        formData.provider === key
                                                            ? "border-indigo-600 bg-indigo-50 shadow-md"
                                                            : "border-gray-200 bg-white hover:border-indigo-300"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-black",
                                                        formData.provider === key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                                                    )}>
                                                        {preset.icon}
                                                    </div>
                                                    <span className="text-xs font-semibold text-center">{preset.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="relay" className="mt-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            {relayProviders.map(([key, preset]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => handleProviderChange(key)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-[1.02]",
                                                        formData.provider === key
                                                            ? "border-indigo-600 bg-indigo-50 shadow-md"
                                                            : "border-gray-200 bg-white hover:border-indigo-300"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-black",
                                                        formData.provider === key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                                                    )}>
                                                        {preset.icon}
                                                    </div>
                                                    <span className="text-xs font-semibold text-center">{preset.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="custom" className="mt-4">
                                        <div className="p-6 bg-slate-50 rounded-xl border-2 border-dashed text-center">
                                            <Server className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                            <p className="text-sm text-slate-600">Configuration manuelle sélectionnée</p>
                                            <p className="text-xs text-slate-500 mt-1">Remplissez les champs serveur SMTP ci-dessous</p>
                                        </div>
                                    </TabsContent>
                                </Tabs>

                                {currentPreset?.note && (
                                    <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-blue-900">{currentPreset.note}</p>
                                    </div>
                                )}
                            </div>

                            {/* Credentials */}
                            <div className="space-y-4">
                                <Label className="text-base font-semibold">2. Identifiants de connexion</Label>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-600 uppercase">Email d'envoi</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <Input
                                                className="pl-9 bg-gray-50/50 border-gray-200"
                                                placeholder="vous@entreprise.com"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-600 uppercase">Mot de passe</Label>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                                            <Input
                                                className="pl-9 bg-emerald-50/30 border-emerald-100"
                                                type="password"
                                                placeholder="Mot de passe d'application"
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-600 uppercase">Nom de la config</Label>
                                        <Input
                                            className="bg-gray-50/50 border-gray-200"
                                            placeholder="ex: Mon Email Pro"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-600 uppercase">Expéditeur (Optionnel)</Label>
                                        <Input
                                            className="bg-gray-50/50 border-gray-200"
                                            placeholder="ex: Jean Dupont"
                                            value={formData.from_name}
                                            onChange={e => setFormData({ ...formData, from_name: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Advanced Settings */}
                            <div className="space-y-3 pt-2 border-t border-dashed">
                                <Label className="text-base font-semibold">3. Configuration serveur</Label>
                                <div className="p-4 bg-slate-50 border rounded-xl grid grid-cols-12 gap-3">
                                    <div className="col-span-8 space-y-1">
                                        <Label className="text-xs font-semibold text-muted-foreground">Serveur SMTP</Label>
                                        <Input
                                            className="h-9 text-sm bg-white"
                                            placeholder="smtp.example.com"
                                            value={formData.smtp_host}
                                            onChange={e => setFormData({ ...formData, smtp_host: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-4 space-y-1">
                                        <Label className="text-xs font-semibold text-muted-foreground">Port</Label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm bg-white"
                                            placeholder="587"
                                            value={formData.smtp_port}
                                            onChange={e => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 587 })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span><strong>Port 465</strong> = SSL/TLS • <strong>Port 587</strong> = STARTTLS</span>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="mt-6 flex justify-between items-center">
                            <Button
                                variant="ghost"
                                onClick={handleTestConnection}
                                disabled={testingConnection}
                                className="text-xs"
                            >
                                {testingConnection ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                                Tester la connexion
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px]"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.map(config => (
                    <Card key={config.id} className="group hover:border-indigo-300 transition-all hover:shadow-md">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-bold flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-sm font-black">
                                        {SMTP_PRESETS[config.provider]?.icon || "?"}
                                    </div>
                                    <span className="truncate">{config.name}</span>
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(config.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <CardDescription className="text-xs break-all font-mono bg-slate-50 p-1.5 rounded border mt-2">
                                {config.from_email}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3">
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Server className="w-3 h-3" />
                                {config.smtp_host}:{config.smtp_port}
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-green-700 bg-green-50 px-2 py-1 rounded w-full justify-center font-bold border border-green-100">
                                <CheckCircle2 className="w-3 h-3" /> Connecté
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {configs.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 bg-gradient-to-b from-white to-slate-50 rounded-xl border-2 border-dashed border-indigo-100 text-center">
                        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4 shadow-sm">
                            <Mail className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Aucun compte configuré</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-8">
                            Connectez une adresse email pour commencer à envoyer vos campagnes de prospection automatiquement.
                        </p>
                        <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                            <Plus className="w-4 h-4 mr-2" /> Connecter un email
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
