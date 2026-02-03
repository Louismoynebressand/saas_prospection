"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle, Server } from "lucide-react"

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
        provider: "custom",
        smtp_host: "",
        smtp_port: 587,
        smtp_user: "",
        smtp_password: "",
        from_email: "",
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
        }

        setFormData(prev => ({ ...prev, ...updates }))
    }

    const handleTestConnection = async () => {
        setTestingConnection(true)
        try {
            const res = await fetch("/api/settings/smtp/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    host: formData.smtp_host,
                    port: formData.smtp_port,
                    user: formData.smtp_user,
                    pass: formData.smtp_password
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
        if (!formData.name || !formData.smtp_host || !formData.smtp_user || !formData.smtp_password) {
            toast.error("Veuillez remplir tous les champs obligatoires")
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/settings/smtp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                toast.success("Configuration enregistrée !")
                setIsDialogOpen(false)
                fetchConfigs()
                // Reset form
                setFormData({
                    name: "",
                    provider: "custom",
                    smtp_host: "",
                    smtp_port: 587,
                    smtp_user: "",
                    smtp_password: "",
                    from_email: "",
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
                        <Button><Plus className="w-4 h-4 mr-2" /> Ajouter un compte</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Nouvelle Configuration SMTP</DialogTitle>
                            <DialogDescription>
                                Ajoutez vos identifiants SMTP. Pour Gmail, utilisez un "Mot de passe d'application".
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nom de la configuration</Label>
                                    <Input
                                        placeholder="Mon Gmail Pro"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fournisseur</Label>
                                    <Select
                                        value={formData.provider}
                                        onValueChange={handleProviderChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choisir..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gmail">Gmail / Google Workspace</SelectItem>
                                            <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                                            <SelectItem value="ionos">Ionos</SelectItem>
                                            <SelectItem value="custom">Autre (Custom)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <Label>Serveur SMTP (Hôte)</Label>
                                    <Input
                                        placeholder="smtp.example.com"
                                        value={formData.smtp_host}
                                        onChange={e => setFormData({ ...formData, smtp_host: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Port</Label>
                                    <Input
                                        type="number"
                                        placeholder="587"
                                        value={formData.smtp_port}
                                        onChange={e => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Utilisateur SMTP</Label>
                                    <Input
                                        placeholder="email@example.com"
                                        value={formData.smtp_user}
                                        onChange={e => setFormData({ ...formData, smtp_user: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mot de passe</Label>
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        value={formData.smtp_password}
                                        onChange={e => setFormData({ ...formData, smtp_password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div className="space-y-2">
                                    <Label>Email d'envoi (From)</Label>
                                    <Input
                                        placeholder="contact@mon-saas.com"
                                        value={formData.from_email}
                                        onChange={e => setFormData({ ...formData, from_email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nom d'expéditeur</Label>
                                    <Input
                                        placeholder="Jean Dupont"
                                        value={formData.from_name}
                                        onChange={e => setFormData({ ...formData, from_name: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex justify-between items-center sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleTestConnection}
                                disabled={testingConnection}
                            >
                                {testingConnection ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Server className="w-4 h-4 mr-2" />}
                                Tester la connexion
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.map(config => (
                    <Card key={config.id}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    {config.provider === 'gmail' && <span className="text-red-500">G</span>}
                                    {config.provider === 'outlook' && <span className="text-blue-500">O</span>}
                                    {config.name}
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(config.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <CardDescription className="text-xs break-all">{config.from_email}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3">
                            <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                    <span>Hôte:</span>
                                    <span className="font-mono">{config.smtp_host}:{config.smtp_port}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>User:</span>
                                    <span className="font-mono">{config.smtp_user}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded w-full justify-center">
                                <CheckCircle2 className="w-3 h-3" /> Configuré
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {configs.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 bg-muted/30 rounded-lg border border-dashed">
                        <p className="text-muted-foreground">Aucun compte configuré.</p>
                        <Button variant="link" onClick={() => setIsDialogOpen(true)}>Ajouter un premier compte</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
