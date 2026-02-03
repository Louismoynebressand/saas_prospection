"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle, Server, Mail, Shield, BookOpen, ExternalLink, RefreshCw } from "lucide-react"
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

export function SmtpSettings() {
    const [configs, setConfigs] = useState<SmtpConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [testingConnection, setTestingConnection] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        provider: "gmail",
        smtp_host: "smtp.gmail.com",
        smtp_port: 465,
        email: "", // Merged User & From Email
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
        let updates: any = { provider: value }

        // Auto-fill common providers
        if (value === 'gmail') {
            updates = { ...updates, smtp_host: 'smtp.gmail.com', smtp_port: 465 }
        } else if (value === 'outlook') {
            updates = { ...updates, smtp_host: 'smtp.office365.com', smtp_port: 587 }
        } else if (value === 'ionos') {
            updates = { ...updates, smtp_host: 'smtp.ionos.com', smtp_port: 465 }
        } else {
            updates = { ...updates, smtp_host: '', smtp_port: 587 }
        }

        setFormData(prev => ({ ...prev, ...updates }))
    }

    const handleTestConnection = async () => {
        if (!formData.email || !formData.password || !formData.smtp_host) {
            toast.error("Veuillez remplir email, mot de passe et hôte")
            return
        }

        setTestingConnection(true)
        console.log("Testing connection with:", {
            host: formData.smtp_host,
            user: formData.email
        })

        try {
            const res = await fetch("/api/settings/smtp/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    host: formData.smtp_host,
                    port: formData.smtp_port,
                    user: formData.email,
                    pass: formData.password
                })
            })

            const data = await res.json()

            if (res.ok && data.success) {
                toast.success("✅ Connexion réussie !", {
                    description: "Vos identifiants sont valides."
                })
            } else {
                toast.error("❌ Echec connexion", {
                    description: data.error || "Vérifiez vos identifiants."
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
                // Reset form
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
                    description: data.error || "Impossible d'enregistrer."
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
                    {/* KEY FIX: sm:max-w-7xl overrides the default sm:max-w-lg */}
                    <DialogContent className="sm:max-w-7xl w-[95vw] md:w-[90vw] lg:w-[85vw] max-h-[90vh] p-0 overflow-hidden gap-0 border-none shadow-2xl flex flex-col">
                        <div className="flex-1 grid lg:grid-cols-12 overflow-hidden bg-white">

                            {/* LEFT COLUMN: Form (7 columns) */}
                            <div className="lg:col-span-7 p-6 lg:p-8 overflow-y-auto custom-scrollbar">
                                <DialogHeader className="mb-6">
                                    <DialogTitle className="text-2xl font-bold text-gray-900">Configurer un compte d'envoi</DialogTitle>
                                    <DialogDescription className="text-base">
                                        Connectez votre email pour envoyer vos campagnes (SMTP).
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-8">
                                    {/* 1. Provider Selection */}
                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold text-gray-800">1. Fournisseur</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[
                                                { id: 'gmail', name: 'Gmail', icon: 'G', color: 'text-red-600 bg-red-50 border-red-100' },
                                                { id: 'outlook', name: 'Outlook', icon: 'O', color: 'text-blue-600 bg-blue-50 border-blue-100' },
                                                { id: 'ionos', name: 'Ionos', icon: 'I', color: 'text-yellow-700 bg-yellow-50 border-yellow-100' },
                                                { id: 'custom', name: 'Autre', icon: '?', color: 'text-gray-600 bg-gray-50 border-gray-100' }
                                            ].map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => handleProviderChange(p.id)}
                                                    className={cn(
                                                        "cursor-pointer border-2 rounded-xl p-3 text-center transition-all duration-200 hover:scale-[1.02]",
                                                        formData.provider === p.id
                                                            ? `border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/50`
                                                            : "border-transparent bg-gray-50 hover:bg-white hover:border-gray-200 shadow-sm"
                                                    )}
                                                >
                                                    <div className={cn("text-xl font-black mb-1 w-8 h-8 mx-auto rounded-full flex items-center justify-center", p.color)}>
                                                        {p.icon}
                                                    </div>
                                                    <div className="text-xs font-bold">{p.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. Basic Info */}
                                    <div className="space-y-4">
                                        <Label className="text-base font-semibold text-gray-800">2. Identifiants</Label>

                                        <div className="space-y-4">
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
                                                    <Label className="text-xs font-medium text-gray-600 uppercase">
                                                        Mot de passe
                                                    </Label>
                                                    <div className="relative">
                                                        <Shield className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                                                        <Input
                                                            className="pl-9 bg-emerald-50/30 border-emerald-100 focus-visible:ring-emerald-500"
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
                                                        placeholder="ex: Mon Gmail Pro"
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
                                    </div>

                                    {/* 3. Advanced (Custom) */}
                                    {formData.provider === 'custom' && (
                                        <div className="space-y-3 pt-2 border-t border-dashed">
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
                                                        onChange={e => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Guide (5 columns) */}
                            <div className="hidden lg:block lg:col-span-5 bg-gradient-to-br from-indigo-50 to-white border-l border-indigo-100 p-8 overflow-y-auto">
                                <div className="sticky top-0 space-y-6">
                                    <div className="flex items-center gap-3 text-indigo-900 mb-6">
                                        <div className="p-2 bg-indigo-100 rounded-lg">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-bold">Guide de connexion</h4>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm space-y-2">
                                        <h5 className="font-bold text-sm text-gray-900">1. Mot de passe d'application</h5>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            Pour Gmail/Outlook avec 2FA, votre mot de passe habituel ne fonctionne pas. Vous devez en générer un spécifique.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Comment faire ?</h5>

                                        <div className="bg-white p-3 rounded-lg border hover:border-red-200 transition-colors group">
                                            <div className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                                                <span className="w-5 h-5 bg-red-100 text-red-600 rounded flex items-center justify-center text-xs">G</span>
                                                Google / Gmail
                                            </div>
                                            <ul className="text-[11px] space-y-1.5 text-gray-500 list-disc list-inside">
                                                <li>Gestion compte {'>'} Sécurité</li>
                                                <li>Validation en 2 étapes {'>'} Mots de passe d'app</li>
                                                <li>Créer "Messagerie" + "Windows"</li>
                                            </ul>
                                            <a href="https://myaccount.google.com/apppasswords" target="_blank" className="mt-2 block text-center text-[10px] text-blue-600 bg-blue-50 py-1.5 rounded hover:bg-blue-100 transition-colors">
                                                Ouvrir Google Security <ExternalLink className="inline w-2 h-2 ml-1" />
                                            </a>
                                        </div>

                                        <div className="bg-white p-3 rounded-lg border hover:border-blue-200 transition-colors">
                                            <div className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                                                <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs">O</span>
                                                Outlook
                                            </div>
                                            <p className="text-[11px] text-gray-500">
                                                Activez "SMTP Authenticated" dans l'admin 365. Si 2FA activé, créez un mot de passe d'application Microsoft.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                            <Button
                                variant="ghost"
                                onClick={handleTestConnection}
                                disabled={testingConnection}
                                className="text-xs text-muted-foreground hover:text-gray-900"
                            >
                                {testingConnection ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                                Tester la connexion
                            </Button>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                                    En enregistrant, vous acceptez d'utiliser ce compte.
                                </span>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px]"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    Enregistrer
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.map(config => (
                    <Card key={config.id} className="group hover:border-indigo-300 transition-all hover:shadow-md cursor-default">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-bold flex items-center gap-3">
                                    {config.provider === 'gmail' && <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-100 flex items-center justify-center text-sm font-black">G</div>}
                                    {config.provider === 'outlook' && <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-sm font-black">O</div>}
                                    {config.provider === 'ionos' && <div className="w-8 h-8 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-100 flex items-center justify-center text-sm font-black">I</div>}
                                    {config.provider === 'custom' && <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-600 border border-gray-100 flex items-center justify-center text-sm font-black">?</div>}
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
