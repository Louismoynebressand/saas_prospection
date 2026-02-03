"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle, Server, Mail, Shield, BookOpen, ExternalLink } from "lucide-react"
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
            toast.error("Veuillez remplir les informations de connexion")
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
                    user: formData.email, // Use email as user
                    pass: formData.password
                })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                toast.success("Connexion réussie ! ✅")
            } else {
                toast.error(`Echec connexion: ${data.error || "Erreur inconnue"}`)
            }
        } catch (error) {
            toast.error("Erreur lors du test de connexion")
        } finally {
            setTestingConnection(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.smtp_host || !formData.email || !formData.password) {
            toast.error("Veuillez remplir tous les champs obligatoires")
            return
        }

        setSaving(true)
        try {
            const payload = {
                name: formData.name,
                provider: formData.provider,
                smtp_host: formData.smtp_host,
                smtp_port: formData.smtp_port,
                smtp_user: formData.email, // Use email
                smtp_password: formData.password,
                from_email: formData.email, // Use email
                from_name: formData.from_name
            }

            const res = await fetch("/api/settings/smtp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

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
                const data = await res.json()
                toast.error(data.error || "Erreur lors de l'enregistrement")
            }
        } catch (error) {
            toast.error("Erreur serveur")
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
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Comptes d'envoi Email</h3>
                    <p className="text-sm text-muted-foreground">Gérez vos connexions SMTP pour l'envoi de campagnes.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="w-4 h-4 mr-2" /> Ajouter un compte
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
                        <div className="grid md:grid-cols-5 h-[600px]">
                            {/* LEFT COLUMN: Form */}
                            <div className="md:col-span-3 p-6 overflow-y-auto space-y-6">
                                <DialogHeader>
                                    <DialogTitle>Configurer un compte d'envoi</DialogTitle>
                                    <DialogDescription>
                                        Connectez votre adresse email professionnelle pour envoyer vos campagnes.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4">
                                    {/* 1. Provider Selection */}
                                    <div className="space-y-2">
                                        <Label>Fournisseur de messagerie</Label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { id: 'gmail', name: 'Gmail', icon: 'G' },
                                                { id: 'outlook', name: 'Outlook', icon: 'O' },
                                                { id: 'ionos', name: 'Ionos', icon: 'I' },
                                                { id: 'custom', name: 'Autre', icon: '?' }
                                            ].map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => handleProviderChange(p.id)}
                                                    className={cn(
                                                        "cursor-pointer border rounded-lg p-3 text-center transition-all hover:bg-accent",
                                                        formData.provider === p.id
                                                            ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 text-indigo-700"
                                                            : "border-muted bg-background text-muted-foreground"
                                                    )}
                                                >
                                                    <div className="font-bold text-lg mb-1">{p.icon}</div>
                                                    <div className="text-xs font-medium">{p.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. Basic Info */}
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <Label>Nom du compte <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="ex: Mon Gmail Pro"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Email d'envoi <span className="text-red-500">*</span></Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        className="pl-9"
                                                        placeholder="vous@entreprise.com"
                                                        value={formData.email}
                                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Mot de passe <span className="text-red-500">*</span></Label>
                                                <div className="relative">
                                                    <Shield className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        className="pl-9"
                                                        type="password"
                                                        placeholder="Mot de passe d'application"
                                                        value={formData.password}
                                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Nom d'expéditeur (Optionnel)</Label>
                                            <Input
                                                placeholder="ex: Jean Dupont"
                                                value={formData.from_name}
                                                onChange={e => setFormData({ ...formData, from_name: e.target.value })}
                                            />
                                            <p className="text-[10px] text-muted-foreground">Le nom qui s'affichera chez vos destinataires.</p>
                                        </div>
                                    </div>

                                    {/* 3. Advanced (Custom) */}
                                    {formData.provider === 'custom' && (
                                        <div className="p-4 bg-muted/50 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
                                            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                                <Server className="w-3 h-3" /> Configuration Serveur
                                            </h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="col-span-2 space-y-1">
                                                    <Label className="text-xs">Hôte SMTP</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        placeholder="smtp.example.com"
                                                        value={formData.smtp_host}
                                                        onChange={e => setFormData({ ...formData, smtp_host: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Port</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-sm"
                                                        placeholder="587"
                                                        value={formData.smtp_port}
                                                        onChange={e => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-4 flex justify-between">
                                    <Button
                                        variant="outline"
                                        onClick={handleTestConnection}
                                        disabled={testingConnection}
                                        className="text-xs"
                                    >
                                        {testingConnection ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Server className="w-3 h-3 mr-2" />}
                                        Tester la connexion
                                    </Button>
                                    <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                                        {saving && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                                        Enregistrer le compte
                                    </Button>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Guide */}
                            <div className="md:col-span-2 bg-indigo-900/5 border-l p-6 overflow-y-auto hidden md:block">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                                        <BookOpen className="w-4 h-4" />
                                        <h4>Guide de connexion</h4>
                                    </div>

                                    <div className="space-y-4 text-sm text-gray-600">
                                        <div className="space-y-2">
                                            <h5 className="font-medium text-gray-900">Pourquoi connecter son email ?</h5>
                                            <p className="text-xs leading-relaxed">
                                                Pour assurer une délivrabilité maximale, nous utilisons vos propres serveurs SMTP. Cela évite que vos emails ne tombent dans les spams.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <h5 className="font-medium text-gray-900">Mot de passe d'application</h5>
                                            <p className="text-xs leading-relaxed">
                                                Pour Gmail et Outlook, n'utilisez <strong>pas</strong> votre mot de passe habituel. Vous devez générer un "Mot de passe d'application".
                                            </p>
                                        </div>

                                        <div className="bg-white p-3 rounded border shadow-sm space-y-2">
                                            <div className="flex items-center gap-2 font-medium text-xs text-indigo-600">
                                                <span className="bg-indigo-100 p-1 rounded">G</span> Gmail / Google
                                            </div>
                                            <ol className="list-decimal list-inside text-[10px] space-y-1 text-gray-500">
                                                <li>Activez la "Validation en 2 étapes".</li>
                                                <li>Allez dans Sécurité {'>'} Mots de passe d'application.</li>
                                                <li>Créez un mot de passe et collez-le ici.</li>
                                            </ol>
                                            <a href="https://support.google.com/accounts/answer/185833" target="_blank" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                                                Voir le guide Google <ExternalLink className="w-2 h-2" />
                                            </a>
                                        </div>

                                        <div className="bg-white p-3 rounded border shadow-sm space-y-2">
                                            <div className="flex items-center gap-2 font-medium text-xs text-blue-600">
                                                <span className="bg-blue-100 p-1 rounded">O</span> Outlook / Office 365
                                            </div>
                                            <p className="text-[10px] text-gray-500">
                                                SMTP activé requis. Si l'authentification échoue, vérifiez que "SMTP Authenticated" est activé dans votre panneau admin Office 365.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.map(config => (
                    <Card key={config.id} className="group hover:border-indigo-200 transition-colors">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    {config.provider === 'gmail' && <div className="w-6 h-6 rounded bg-red-100 text-red-600 flex items-center justify-center text-xs">G</div>}
                                    {config.provider === 'outlook' && <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs">O</div>}
                                    {config.provider === 'ionos' && <div className="w-6 h-6 rounded bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs">I</div>}
                                    {config.provider === 'custom' && <div className="w-6 h-6 rounded bg-gray-100 text-gray-600 flex items-center justify-center text-xs">?</div>}
                                    {config.name}
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(config.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <CardDescription className="text-xs break-all">{config.from_email}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3">
                            <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                    <span>Serveur:</span>
                                    <span className="font-mono text-xs bg-muted px-1 rounded">{config.smtp_host}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-1 rounded w-full justify-center font-medium border border-green-100">
                                <CheckCircle2 className="w-3 h-3" /> Compte actif
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {configs.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 bg-muted/20 rounded-xl border-2 border-dashed border-muted-foreground/20 text-center">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                            <Mail className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Aucun compte configuré</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
                            Connectez une adresse email pour commencer à envoyer vos campagnes de prospection.
                        </p>
                        <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                            Connecter un email
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
