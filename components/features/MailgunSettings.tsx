"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    Loader2, Plus, Trash2, CheckCircle2, Zap, Copy, ExternalLink,
    Globe, Eye, EyeOff, AlertCircle, RefreshCw, Edit2, Webhook, Star
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MailgunConfig {
    id: string
    name: string
    provider: string
    mailgun_domain: string
    mailgun_region: "US" | "EU"
    from_email: string
    from_name?: string
    reply_to?: string
    daily_limit?: number
    tracking_opens: boolean
    tracking_clicks: boolean
    is_active: boolean
    is_default: boolean
    created_at: string
}

const WEBHOOK_EVENTS = [
    { key: "delivered", label: "Délivré", color: "bg-green-100 text-green-700" },
    { key: "failed", label: "Échec", color: "bg-red-100 text-red-700" },
    { key: "opened", label: "Ouvert", color: "bg-blue-100 text-blue-700" },
    { key: "clicked", label: "Cliqué", color: "bg-purple-100 text-purple-700" },
    { key: "complained", label: "Spam", color: "bg-orange-100 text-orange-700" },
    { key: "unsubscribed", label: "Désinscrit", color: "bg-gray-100 text-gray-700" },
]

const DEFAULT_FORM = {
    id: "",
    name: "",
    mailgun_domain: "",
    mailgun_region: "US" as "US" | "EU",
    mailgun_api_key: "",
    mailgun_webhook_signing_key: "",
    from_email: "",
    from_name: "",
    reply_to: "",
    daily_limit: "",
    tracking_opens: true,
    tracking_clicks: true,
    is_active: true,
}

export function MailgunSettings() {
    const [configs, setConfigs] = useState<MailgunConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [showApiKey, setShowApiKey] = useState(false)
    const [formData, setFormData] = useState(DEFAULT_FORM)
    const [showDefaultDialog, setShowDefaultDialog] = useState(false)
    const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null)
    const [settingDefault, setSettingDefault] = useState(false)

    const appUrl = typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "https://votre-domaine.com"
    const webhookUrl = `${appUrl}/api/webhooks/mailgun`

    useEffect(() => { fetchConfigs() }, [])

    const fetchConfigs = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/settings/mailgun")
            if (res.ok) {
                const data = await res.json()
                setConfigs(data.configs || [])
            }
        } catch {
            toast.error("Impossible de charger les configurations Mailgun")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => { setFormData(DEFAULT_FORM); setShowApiKey(false) }

    const openDialog = (config?: MailgunConfig) => {
        if (config) {
            setFormData({
                id: config.id,
                name: config.name,
                mailgun_domain: config.mailgun_domain,
                mailgun_region: config.mailgun_region || "US",
                mailgun_api_key: "",
                mailgun_webhook_signing_key: "",
                from_email: config.from_email,
                from_name: config.from_name || "",
                reply_to: config.reply_to || "",
                daily_limit: config.daily_limit ? String(config.daily_limit) : "",
                tracking_opens: config.tracking_opens,
                tracking_clicks: config.tracking_clicks,
                is_active: config.is_active,
            })
        } else {
            resetForm()
        }
        setIsDialogOpen(true)
    }

    const handleTest = async () => {
        if (!formData.mailgun_api_key || !formData.mailgun_domain) {
            toast.error("Clé API et domaine requis pour le test")
            return
        }
        setTesting(true)
        try {
            const res = await fetch("/api/settings/mailgun/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: formData.mailgun_api_key,
                    domain: formData.mailgun_domain,
                    region: formData.mailgun_region,
                }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success(data.message || "✅ Connexion Mailgun réussie !")
            } else {
                toast.error("❌ " + (data.error || "Échec de la connexion"), { duration: 6000 })
            }
        } catch {
            toast.error("Erreur réseau lors du test")
        } finally {
            setTesting(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name || !formData.mailgun_domain || !formData.from_email) {
            toast.error("Nom, domaine et email d'envoi sont requis")
            return
        }
        if (!formData.id && !formData.mailgun_api_key) {
            toast.error("La clé API est requise pour un nouveau compte")
            return
        }
        setSaving(true)
        try {
            const payload: Record<string, unknown> = {
                id: formData.id || undefined,
                provider: "mailgun_api",
                name: formData.name,
                mailgun_domain: formData.mailgun_domain,
                mailgun_region: formData.mailgun_region,
                from_email: formData.from_email,
                from_name: formData.from_name || undefined,
                reply_to: formData.reply_to || undefined,
                daily_limit: formData.daily_limit ? Number(formData.daily_limit) : null,
                tracking_opens: formData.tracking_opens,
                tracking_clicks: formData.tracking_clicks,
                is_active: formData.is_active,
            }
            if (formData.mailgun_api_key) payload.mailgun_api_key = formData.mailgun_api_key
            if (formData.mailgun_webhook_signing_key) payload.mailgun_webhook_signing_key = formData.mailgun_webhook_signing_key

            const res = await fetch("/api/settings/mailgun", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (res.ok) {
                const isNew = !formData.id
                const savedId = data.config?.id
                toast.success(formData.id ? "Compte mis à jour !" : "Compte Mailgun ajouté !")
                setIsDialogOpen(false)
                fetchConfigs()
                resetForm()
                // Pour un nouveau compte, proposer de le définir comme défaut
                if (isNew && savedId) {
                    setPendingDefaultId(savedId)
                    setShowDefaultDialog(true)
                }
            } else {
                toast.error(data.error || "Erreur lors de la sauvegarde", { duration: 6000 })
            }
        } catch {
            toast.error("Erreur serveur")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce compte Mailgun ?")) return
        try {
            const res = await fetch(`/api/settings/mailgun?id=${id}`, { method: "DELETE" })
            if (res.ok) { toast.success("Compte supprimé"); fetchConfigs() }
            else { const d = await res.json(); toast.error(d.error || "Erreur suppression") }
        } catch { toast.error("Erreur suppression") }
    }

    const handleSetDefault = async (accountId: string) => {
        setSettingDefault(true)
        try {
            const res = await fetch("/api/settings/sending-accounts/set-default", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_id: accountId }),
            })
            if (res.ok) {
                toast.success("✅ Compte défini comme compte d'envoi par défaut !")
                fetchConfigs()
            } else {
                const d = await res.json()
                toast.error(d.error || "Erreur")
            }
        } catch {
            toast.error("Erreur réseau")
        } finally {
            setSettingDefault(false)
            setShowDefaultDialog(false)
            setPendingDefaultId(null)
        }
    }

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl)
        toast.success("URL copiée !")
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-500" />
                        Comptes Mailgun API
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Envoi direct via l'API Mailgun — tracking automatique, webhooks natifs.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-orange-600 hover:bg-orange-700 shadow-md" onClick={() => openDialog()}>
                            <Plus className="w-4 h-4 mr-2" /> Ajouter Mailgun
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <Zap className="w-5 h-5 text-orange-500" />
                                {formData.id ? "Modifier le compte Mailgun" : "Connecter Mailgun API"}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleSave} className="space-y-5 pt-2">
                            {/* Infos générales */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <Label>Nom du compte *</Label>
                                    <Input
                                        placeholder="Ex: Mon domaine pro"
                                        value={formData.name}
                                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Domaine Mailgun *</Label>
                                    <Input
                                        placeholder="mg.mondomaine.com"
                                        value={formData.mailgun_domain}
                                        onChange={e => setFormData(p => ({ ...p, mailgun_domain: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Région Mailgun *</Label>
                                    <Select value={formData.mailgun_region} onValueChange={v => setFormData(p => ({ ...p, mailgun_region: v as "US" | "EU" }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="US">🌎 US (api.mailgun.net)</SelectItem>
                                            <SelectItem value="EU">🇪🇺 EU (api.eu.mailgun.net) — RGPD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* API Key */}
                            <div className="space-y-1.5">
                                <Label>Clé API Mailgun {formData.id ? "(laisser vide pour conserver)" : "*"}</Label>
                                <div className="relative">
                                    <Input
                                        type={showApiKey ? "text" : "password"}
                                        placeholder={formData.id ? "••••••••••••••••" : "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                                        value={formData.mailgun_api_key}
                                        onChange={e => setFormData(p => ({ ...p, mailgun_api_key: e.target.value }))}
                                        className="pr-10"
                                    />
                                    <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">Trouvez votre clé dans Mailgun › Settings › API Keys</p>
                            </div>

                            {/* Bouton test */}
                            <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !formData.mailgun_api_key || !formData.mailgun_domain} className="w-full border-orange-200 text-orange-700 hover:bg-orange-50">
                                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Tester la connexion Mailgun
                            </Button>

                            {/* From / Reply-To */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Email d'envoi (From) *</Label>
                                    <Input type="email" placeholder="hello@mondomaine.com" value={formData.from_email} onChange={e => setFormData(p => ({ ...p, from_email: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Nom d'affichage</Label>
                                    <Input placeholder="Mon Entreprise" value={formData.from_name} onChange={e => setFormData(p => ({ ...p, from_name: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Reply-To (optionnel)</Label>
                                    <Input type="email" placeholder="contact@mondomaine.com" value={formData.reply_to} onChange={e => setFormData(p => ({ ...p, reply_to: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Limite journalière (optionnel)</Label>
                                    <Input type="number" placeholder="200" value={formData.daily_limit} onChange={e => setFormData(p => ({ ...p, daily_limit: e.target.value }))} />
                                </div>
                            </div>

                            {/* Tracking */}
                            <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
                                <p className="text-sm font-semibold text-gray-700">Options de tracking</p>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Tracking ouvertures</p>
                                        <p className="text-xs text-muted-foreground">Suivre quand l'email est ouvert</p>
                                    </div>
                                    <Switch checked={formData.tracking_opens} onCheckedChange={v => setFormData(p => ({ ...p, tracking_opens: v }))} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Tracking clics</p>
                                        <p className="text-xs text-muted-foreground">Suivre les liens cliqués</p>
                                    </div>
                                    <Switch checked={formData.tracking_clicks} onCheckedChange={v => setFormData(p => ({ ...p, tracking_clicks: v }))} />
                                </div>
                            </div>

                            {/* Webhook Signing Key */}
                            <div className="space-y-1.5">
                                <Label>Webhook Signing Key (recommandé)</Label>
                                <Input
                                    type="password"
                                    placeholder="Clé de signature des webhooks Mailgun"
                                    value={formData.mailgun_webhook_signing_key}
                                    onChange={e => setFormData(p => ({ ...p, mailgun_webhook_signing_key: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground">Mailgun › Settings › Webhooks → "HTTP webhook signing key"</p>
                            </div>

                            {/* Actif */}
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                                <div>
                                    <p className="text-sm font-medium">Compte actif</p>
                                    <p className="text-xs text-muted-foreground">Désactivez temporairement sans supprimer</p>
                                </div>
                                <Switch checked={formData.is_active} onCheckedChange={v => setFormData(p => ({ ...p, is_active: v }))} />
                            </div>

                            {/* Section Webhooks */}
                            <div className="p-4 rounded-lg border-2 border-dashed border-orange-200 bg-orange-50/50 space-y-3">
                                <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                                    <Webhook className="w-4 h-4" /> Webhooks à configurer dans Mailgun
                                </p>
                                <div className="flex items-center gap-2">
                                    <Input value={webhookUrl} readOnly className="text-xs bg-white font-mono" />
                                    <Button type="button" size="icon" variant="outline" onClick={copyWebhookUrl}>
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {WEBHOOK_EVENTS.map(ev => (
                                        <span key={ev.key} className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ev.color)}>{ev.label}</span>
                                    ))}
                                </div>
                                <a href="https://app.mailgun.com/app/sending/domains" target="_blank" rel="noopener noreferrer" className="text-xs text-orange-700 hover:underline flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" /> Ouvrir Mailgun Dashboard
                                </a>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }} className="flex-1">Annuler</Button>
                                <Button type="submit" disabled={saving} className="flex-1 bg-orange-600 hover:bg-orange-700">
                                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    {formData.id ? "Mettre à jour" : "Enregistrer"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Liste des configs */}
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
            ) : configs.length === 0 ? (
                <Card className="border-dashed border-2 border-orange-200 bg-orange-50/30">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                            <Zap className="w-7 h-7 text-orange-500" />
                        </div>
                        <p className="font-semibold text-gray-800">Aucun compte Mailgun configuré</p>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Connectez votre domaine Mailgun pour envoyer vos campagnes directement via l'API avec tracking avancé.
                        </p>
                        <Button onClick={() => openDialog()} className="bg-orange-600 hover:bg-orange-700">
                            <Plus className="w-4 h-4 mr-2" /> Ajouter un compte Mailgun
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {configs.map(config => (
                        <Card key={config.id} className={cn("border-2 transition-all hover:shadow-md", config.is_active ? "border-orange-200 hover:border-orange-300" : "border-gray-200 opacity-60")}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">MG</div>
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                {config.name}
                                                {config.is_default && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                                            </CardTitle>
                                            <CardDescription className="text-xs">{config.from_email} · {config.mailgun_domain}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn("text-xs", config.mailgun_region === "EU" ? "border-blue-300 text-blue-700" : "border-gray-300 text-gray-600")}>
                                            <Globe className="w-3 h-3 mr-1" />{config.mailgun_region}
                                        </Badge>
                                        {config.is_default && (
                                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Par défaut</Badge>
                                        )}
                                        <Badge className={config.is_active ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}>
                                            {config.is_active ? "Actif" : "Inactif"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                                    {config.tracking_opens && <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-blue-500" />Ouvertures</span>}
                                    {config.tracking_clicks && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-purple-500" />Clics</span>}
                                    {config.daily_limit && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" />{config.daily_limit}/jour</span>}
                                </div>
                                <div className="flex gap-2">
                                    {!config.is_default && (
                                        <Button size="sm" variant="outline" onClick={() => handleSetDefault(config.id)} className="gap-1 text-amber-600 border-amber-200 hover:bg-amber-50">
                                            <Star className="w-3 h-3" /> Définir par défaut
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" onClick={() => openDialog(config)} className="gap-1">
                                        <Edit2 className="w-3 h-3" /> Modifier
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDelete(config.id)} className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="w-3 h-3" /> Supprimer
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Webhook info globale */}
            {configs.length > 0 && (
                <Card className="border-dashed border-orange-200 bg-orange-50/30">
                    <CardContent className="pt-4">
                        <p className="text-sm font-semibold text-orange-800 flex items-center gap-2 mb-2">
                            <Webhook className="w-4 h-4" /> URL Webhook Mailgun
                        </p>
                        <div className="flex items-center gap-2">
                            <Input value={webhookUrl} readOnly className="text-xs font-mono bg-white" />
                            <Button size="icon" variant="outline" onClick={copyWebhookUrl}><Copy className="w-4 h-4" /></Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Configurez cette URL dans Mailgun › Sending › Domains › Webhooks pour chaque événement.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Dialog : définir comme compte par défaut */}
            <Dialog open={showDefaultDialog} onOpenChange={setShowDefaultDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-amber-400" /> Compte par défaut ?
                        </DialogTitle>
                        <DialogDescription>
                            Voulez-vous utiliser ce compte Mailgun comme compte d'envoi par défaut pour toutes vos campagnes ?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setShowDefaultDialog(false); setPendingDefaultId(null) }}>Non, merci</Button>
                        <Button
                            className="bg-amber-500 hover:bg-amber-600"
                            disabled={settingDefault}
                            onClick={() => pendingDefaultId && handleSetDefault(pendingDefaultId)}
                        >
                            {settingDefault ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
                            Oui, définir par défaut
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
