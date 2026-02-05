"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, CheckCircle2, Server, Mail, Shield, RefreshCw, Info, Building2, Globe, Zap, Edit2, Check, ExternalLink, BookOpen } from "lucide-react"
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
    updated_at?: string
}

interface SmtpPreset {
    name: string
    host: string
    port: number
    altPorts?: number[]
    category: "public" | "pro" | "relay" | "custom"
    note?: string
    icon?: string
    guide?: {
        title: string
        steps: string[]
        links?: { label: string; url: string }[]
        tips?: string[]
    }
}

// Comprehensive SMTP Provider Presets with Guides
const SMTP_PRESETS: Record<string, SmtpPreset> = {
    // ===== Grand Public =====
    gmail: {
        name: "Gmail",
        host: "smtp.gmail.com",
        port: 465,
        altPorts: [587],
        category: "public",
        icon: "G",
        note: "Recommandé pour usage personnel",
        guide: {
            title: "Configuration Gmail",
            steps: [
                "Connectez-vous à votre compte Google",
                "Activez la validation en 2 étapes si ce n'est pas déjà fait",
                "Allez dans 'Mots de passe d'application'",
                "Sélectionnez 'Autre (nom personnalisé)' et entrez 'NeuraFlow'",
                "Copiez le mot de passe de 16 caractères généré",
                "Collez-le dans le champ 'Mot de passe' ci-contre"
            ],
            links: [
                { label: "Créer un mot de passe d'application", url: "https://myaccount.google.com/apppasswords" },
                { label: "Activer la validation en 2 étapes", url: "https://myaccount.google.com/signinoptions/two-step-verification" }
            ],
            tips: [
                "Le mot de passe d'application est différent de votre mot de passe Gmail habituel",
                "Port 465 recommandé (SSL), sinon utilisez 587 (STARTTLS)"
            ]
        }
    },
    outlook: {
        name: "Microsoft 365",
        host: "smtp.office365.com",
        port: 587,
        category: "public",
        icon: "O",
        note: "Pour comptes professionnels Microsoft",
        guide: {
            title: "Configuration Microsoft 365",
            steps: [
                "Vérifiez que SMTP AUTH est activé (demandez à votre admin si besoin)",
                "Utilisez votre adresse email complète comme identifiant",
                "Utilisez votre mot de passe Microsoft habituel",
                "Si vous avez activé l'authentification multi-facteurs (MFA), créez un mot de passe d'application"
            ],
            links: [
                { label: "Activer SMTP AUTH", url: "https://learn.microsoft.com/fr-fr/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission" }
            ],
            tips: [
                "Certains administrateurs désactivent SMTP AUTH par défaut",
                "Port 587 avec STARTTLS obligatoire"
            ]
        }
    },
    outlook_com: {
        name: "Outlook.com",
        host: "smtp-mail.outlook.com",
        port: 587,
        category: "public",
        icon: "OL",
        note: "Pour comptes Outlook/Hotmail personnels",
        guide: {
            title: "Configuration Outlook.com",
            steps: [
                "Utilisez votre adresse @outlook.com, @hotmail.com ou @live.com",
                "Activez la validation en 2 étapes dans les paramètres de sécurité",
                "Créez un mot de passe d'application dédié",
                "Utilisez ce mot de passe d'application (pas votre mot de passe principal)"
            ],
            links: [
                { label: "Sécurité du compte Microsoft", url: "https://account.microsoft.com/security" }
            ]
        }
    },
    zoho: {
        name: "Zoho Mail",
        host: "smtp.zoho.com",
        port: 465,
        altPorts: [587],
        category: "public",
        icon: "Z",
        guide: {
            title: "Configuration Zoho Mail",
            steps: [
                "Utilisez votre adresse email Zoho complète",
                "Utilisez votre mot de passe Zoho habituel",
                "Si vous avez activé la 2FA, créez un mot de passe d'application"
            ],
            links: [
                { label: "Aide SMTP Zoho", url: "https://www.zoho.com/mail/help/adminconsole/smtp-settings.html" }
            ]
        }
    },

    // ===== Hébergeurs Pro France =====
    o2switch: {
        name: "o2switch",
        host: "",
        port: 465,
        altPorts: [587],
        category: "pro",
        icon: "O2",
        note: "Serveur dépend de votre compte",
        guide: {
            title: "Configuration o2switch",
            steps: [
                "Option 1 (Recommandée) : Utilisez mail.VOTRE-DOMAINE.fr si vous avez un certificat SSL actif",
                "Option 2 : Utilisez mail.SERVEUR.o2switch.net (ex: mail.niaouli.o2switch.net)",
                "Trouvez le nom de votre serveur dans l'email de bienvenue o2switch",
                "N'utilisez JAMAIS directement votre nom de domaine sans 'mail.' devant",
                "Utilisez votre adresse email complète comme identifiant",
                "Le mot de passe est celui de votre compte email (défini dans cPanel)"
            ],
            tips: [
                "Si vous obtenez une erreur de certificat SSL, utilisez l'option 2",
                "Port 465 (SSL) ou 587 (STARTTLS) fonctionnent tous les deux"
            ]
        }
    },
    ovh_mx: {
        name: "OVH MX Plan",
        host: "ssl0.ovh.net",
        port: 587,
        altPorts: [465],
        category: "pro",
        icon: "MX",
        note: "Offre email de base OVH",
        guide: {
            title: "Configuration OVH MX Plan",
            steps: [
                "Serveur SMTP : ssl0.ovh.net (ou smtp.mail.ovh.net)",
                "Utilisez votre adresse email complète comme identifiant",
                "Le mot de passe est celui défini lors de la création du compte email",
                "Port recommandé : 587 (STARTTLS)"
            ],
            links: [
                { label: "Guide OVH MX Plan", url: "https://docs.ovh.com/fr/emails/generalites-sur-les-emails-mutualises/" }
            ]
        }
    },
    ovh_pro: {
        name: "OVH Email Pro",
        host: "pro1.mail.ovh.net",
        port: 587,
        category: "pro",
        icon: "EP",
        note: "Le numéro de cluster peut varier",
        guide: {
            title: "Configuration OVH Email Pro",
            steps: [
                "Le serveur est pro1.mail.ovh.net, pro2.mail.ovh.net, etc.",
                "Trouvez votre cluster dans l'espace client OVH > Email Pro > Informations générales",
                "Utilisez votre adresse email complète",
                "Port 587 avec STARTTLS"
            ],
            links: [
                { label: "Espace client OVH", url: "https://www.ovh.com/manager/" }
            ]
        }
    },
    ovh_exchange: {
        name: "OVH Exchange",
        host: "ex3.mail.ovh.net",
        port: 587,
        category: "pro",
        icon: "EX",
        note: "Serveur Exchange hébergé",
        guide: {
            title: "Configuration OVH Exchange",
            steps: [
                "Le serveur est ex1.mail.ovh.net, ex2.mail.ovh.net, ex3.mail.ovh.net, etc.",
                "Vérifiez votre numéro de cluster dans l'espace client OVH",
                "Utilisez votre adresse email complète",
                "Port 587 obligatoire"
            ]
        }
    },
    ionos: {
        name: "IONOS",
        host: "smtp.ionos.com",
        port: 587,
        altPorts: [465],
        category: "pro",
        icon: "IO",
        guide: {
            title: "Configuration IONOS",
            steps: [
                "Serveur SMTP : smtp.ionos.com (anciennement smtp.1and1.com)",
                "Utilisez votre adresse email complète",
                "Mot de passe défini dans votre espace IONOS"
            ]
        }
    },
    infomaniak: {
        name: "Infomaniak",
        host: "mail.infomaniak.com",
        port: 587,
        altPorts: [465],
        category: "pro",
        icon: "IK",
        guide: {
            title: "Configuration Infomaniak",
            steps: [
                "Serveur SMTP : mail.infomaniak.com",
                "Utilisez votre adresse email complète",
                "Le mot de passe est celui de votre compte email"
            ],
            links: [
                { label: "Aide Infomaniak", url: "https://www.infomaniak.com/fr/support" }
            ]
        }
    },
    gandi: {
        name: "Gandi",
        host: "mail.gandi.net",
        port: 587,
        altPorts: [465],
        category: "pro",
        icon: "GA",
        guide: {
            title: "Configuration Gandi Mail",
            steps: [
                "Serveur SMTP : mail.gandi.net",
                "Utilisez votre adresse email complète",
                "Mot de passe défini lors de la création du compte email"
            ],
            links: [
                { label: "Documentation Gandi", url: "https://docs.gandi.net/fr/gandimail/" }
            ]
        }
    },
    hostinger: {
        name: "Hostinger",
        host: "smtp.hostinger.com",
        port: 587,
        altPorts: [465],
        category: "pro",
        icon: "HO",
        guide: {
            title: "Configuration Hostinger",
            steps: [
                "Serveur SMTP : smtp.hostinger.com",
                "Utilisez votre adresse email complète",
                "Le mot de passe est celui défini dans le panneau de contrôle"
            ]
        }
    },
    cpanel: {
        name: "cPanel générique",
        host: "",
        port: 465,
        altPorts: [587],
        category: "pro",
        icon: "CP",
        note: "Pour hébergeurs avec cPanel",
        guide: {
            title: "Configuration cPanel",
            steps: [
                "Utilisez mail.VOTRE-DOMAINE.fr (si certificat SSL actif)",
                "Ou utilisez le hostname de votre serveur (fourni par l'hébergeur)",
                "L'identifiant est votre adresse email complète",
                "Le mot de passe est celui défini dans cPanel > Comptes email"
            ],
            tips: [
                "La plupart des hébergeurs cPanel utilisent cette configuration",
                "En cas de doute, contactez votre hébergeur pour le hostname exact"
            ]
        }
    },

    // ===== Services SMTP Relay =====
    brevo: {
        name: "Brevo",
        host: "smtp-relay.brevo.com",
        port: 587,
        altPorts: [465, 2525],
        category: "relay",
        icon: "BR",
        note: "Ex-Sendinblue, excellent pour volumes",
        guide: {
            title: "Configuration Brevo (Sendinblue)",
            steps: [
                "Connectez-vous à votre compte Brevo",
                "Allez dans Paramètres > SMTP & API",
                "Récupérez vos identifiants SMTP dédiés",
                "Attention : Ce ne sont PAS vos identifiants de connexion Brevo",
                "Utilisez l'email affiché dans la section SMTP",
                "Utilisez la clé SMTP comme mot de passe"
            ],
            links: [
                { label: "Console Brevo SMTP", url: "https://app.brevo.com/settings/keys/smtp" }
            ],
            tips: [
                "Brevo offre 300 emails/jour gratuits",
                "Excellente délivrabilité"
            ]
        }
    },
    sendgrid: {
        name: "SendGrid",
        host: "smtp.sendgrid.net",
        port: 587,
        altPorts: [465],
        category: "relay",
        icon: "SG",
        note: "Service Twilio, très fiable",
        guide: {
            title: "Configuration SendGrid",
            steps: [
                "Créez une clé API dans Settings > API Keys",
                "Donnez les permissions 'Mail Send'",
                "Identifiant : tapez exactement 'apikey' (oui, le mot 'apikey')",
                "Mot de passe : collez la clé API générée"
            ],
            links: [
                { label: "Créer une API Key", url: "https://app.sendgrid.com/settings/api_keys" }
            ],
            tips: [
                "L'identifiant est toujours 'apikey', pas votre email",
                "100 emails/jour gratuits"
            ]
        }
    },
    mailgun: {
        name: "Mailgun",
        host: "smtp.mailgun.org",
        port: 587,
        altPorts: [465],
        category: "relay",
        icon: "MG",
        note: "Serveur US",
        guide: {
            title: "Configuration Mailgun",
            steps: [
                "Choisissez smtp.mailgun.org (US) ou smtp.eu.mailgun.org (EU)",
                "Trouvez vos identifiants SMTP dans Domain Settings > SMTP credentials",
                "Utilisez le format : postmaster@VOTRE-DOMAINE.mailgun.org",
                "Ou créez un utilisateur SMTP personnalisé"
            ],
            links: [
                { label: "Dashboard Mailgun", url: "https://app.mailgun.com/" }
            ]
        }
    },
    mailgun_eu: {
        name: "Mailgun EU",
        host: "smtp.eu.mailgun.org",
        port: 587,
        altPorts: [465],
        category: "relay",
        icon: "MG",
        note: "Serveur Europe (RGPD)",
        guide: {
            title: "Configuration Mailgun EU",
            steps: [
                "Région Europe pour conformité RGPD",
                "Fonctionnement identique à Mailgun US",
                "Trouvez vos credentials dans Domain Settings"
            ]
        }
    },
    ses: {
        name: "Amazon SES",
        host: "",
        port: 587,
        altPorts: [465],
        category: "relay",
        icon: "AWS",
        note: "Serveur dépend de la région AWS",
        guide: {
            title: "Configuration Amazon SES",
            steps: [
                "Choisissez votre région AWS (ex: eu-west-1, us-east-1)",
                "Serveur : email-smtp.REGION.amazonaws.com",
                "Exemples : email-smtp.eu-west-1.amazonaws.com",
                "Créez des 'SMTP Credentials' dans la console SES",
                "Utilisez l'Access Key et Secret Key générés"
            ],
            links: [
                { label: "Console Amazon SES", url: "https://console.aws.amazon.com/ses/" }
            ],
            tips: [
                "Sortez du mode sandbox pour envoyer à tous",
                "Très économique pour gros volumes"
            ]
        }
    },

    // Autre
    custom: {
        name: "Autre",
        host: "",
        port: 587,
        category: "custom",
        icon: "?",
        guide: {
            title: "Configuration personnalisée",
            steps: [
                "Contactez votre fournisseur de messagerie",
                "Demandez les paramètres SMTP :",
                "- Serveur SMTP (hostname)",
                "- Port (généralement 587 ou 465)",
                "- Type de sécurité (SSL/TLS ou STARTTLS)",
                "Remplissez les champs ci-contre avec ces informations"
            ]
        }
    }
}

export function SmtpSettings() {
    const [configs, setConfigs] = useState<SmtpConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [testingConnection, setTestingConnection] = useState(false)
    const [saving, setSaving] = useState(false)
    const [isVerified, setIsVerified] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<"public" | "pro" | "relay" | "custom">("public")

    // Form State
    const [formData, setFormData] = useState({
        id: "",
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

    // Reset verified state when credentials change
    useEffect(() => {
        setIsVerified(false)
    }, [formData.email, formData.password, formData.smtp_host, formData.smtp_port])

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

    const resetForm = () => {
        setFormData({
            id: "",
            name: "",
            provider: "gmail",
            smtp_host: "smtp.gmail.com",
            smtp_port: 465,
            email: "",
            password: "",
            from_name: ""
        })
        setIsVerified(false)
        setSelectedCategory("public")
    }

    const handleOpenDialog = (config?: SmtpConfig) => {
        if (config) {
            setFormData({
                id: config.id,
                name: config.name,
                provider: config.provider,
                smtp_host: config.smtp_host,
                smtp_port: config.smtp_port,
                email: config.smtp_user,
                password: "",
                from_name: config.from_name || ""
            })
            const preset = SMTP_PRESETS[config.provider]
            if (preset) setSelectedCategory(preset.category)
            setIsVerified(true)
        } else {
            resetForm()
        }
        setIsDialogOpen(true)
    }

    const handleProviderChange = (value: string) => {
        const preset = SMTP_PRESETS[value]
        if (preset) {
            let host = preset.host
            // Auto-suggest mail.domain for custom/pro providers if email is already present
            if (host === "" && formData.email && formData.email.includes('@')) {
                const domain = formData.email.split('@')[1]
                if (domain) {
                    host = `mail.${domain}`
                }
            }

            setFormData(prev => ({
                ...prev,
                provider: value,
                smtp_host: host,
                smtp_port: preset.port
            }))
        }
    }

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value
        let newHost = formData.smtp_host

        // Auto-suggest mail.domain when typing email for providers without fixed host
        const preset = SMTP_PRESETS[formData.provider]
        if (preset && preset.host === "" && email.includes('@')) {
            const domain = email.split('@')[1]
            if (domain) {
                newHost = `mail.${domain}`
            }
        }

        setFormData(prev => ({ ...prev, email: email, smtp_host: newHost }))
    }

    const performVerification = async (): Promise<boolean> => {
        if (!formData.email || !formData.password || !formData.smtp_host) {
            toast.error("Veuillez remplir email, mot de passe et hôte")
            return false
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
                setIsVerified(true)
                return true
            } else {
                toast.error("❌ Echec connexion", {
                    description: data.error || "Vérifiez vos identifiants.",
                    duration: 6000
                })
                setIsVerified(false)
                return false
            }
        } catch (error) {
            console.error("Test Error:", error)
            toast.error("Erreur technique lors du test")
            return false
        } finally {
            setTestingConnection(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.smtp_host || !formData.email) {
            toast.error("Champs obligatoires manquants", {
                description: "Merci de remplir Nom, Email et Serveur."
            })
            return
        }

        if (!formData.id && !formData.password) {
            toast.error("Mot de passe requis pour une nouvelle configuration")
            return
        }

        if (formData.id && !formData.password) {
            toast.error("Veuillez confirmer votre mot de passe pour modifier")
            return
        }



        setSaving(true)
        try {
            const payload = {
                id: formData.id || undefined,
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
                toast.success(formData.id ? "Configuration mise à jour !" : "Configuration enregistrée !", {
                    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />
                })
                setIsDialogOpen(false)
                fetchConfigs()
                resetForm()
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

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm("Supprimer cette configuration ?")) return
        try {
            const res = await fetch(`/api/settings/smtp?id=${id}`, { method: "DELETE" })
            if (res.ok) {
                toast.success("Supprimé")
                fetchConfigs()
            } else {
                const data = await res.json()
                toast.error("Erreur: " + (data.error || "Inconnue"))
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
                        <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-md" onClick={() => handleOpenDialog()}>
                            <Plus className="w-4 h-4 mr-2" /> Connecter un Email
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] lg:max-w-[1300px] xl:max-w-[1450px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 lg:p-8">
                        <DialogHeader className="mb-6">
                            <DialogTitle className="text-xl sm:text-2xl flex items-center gap-3">
                                {formData.id ? "Modifier le compte" : "Configurer un compte d'envoi"}
                                {isVerified && (
                                    <span className="text-sm font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                                        <CheckCircle2 className="w-4 h-4" /> Connecté
                                    </span>
                                )}
                            </DialogTitle>
                            <DialogDescription className="text-base">
                                Sélectionnez votre fournisseur email et connectez votre compte SMTP.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
                            {/* LEFT: Form (Full width on mobile, 8 cols on desktop) */}
                            <div className="lg:col-span-7 xl:col-span-8 space-y-8">
                                {/* Provider Selection */}
                                <div className="space-y-4">
                                    <Label className="text-base font-semibold block">1. Quel est votre fournisseur email ?</Label>

                                    <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1">
                                            <TabsTrigger value="public" className="py-2 flex items-center gap-1.5 min-h-[40px]">
                                                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span>Grand Public</span>
                                            </TabsTrigger>
                                            <TabsTrigger value="pro" className="py-2 flex items-center gap-1.5 min-h-[40px]">
                                                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span>Hébergeurs Pro</span>
                                            </TabsTrigger>
                                            <TabsTrigger value="relay" className="py-2 flex items-center gap-1.5 min-h-[40px]">
                                                <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span>Services SMTP</span>
                                            </TabsTrigger>
                                            <TabsTrigger value="custom" className="py-2 flex items-center gap-1.5 min-h-[40px]">
                                                <Server className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span>Autre</span>
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="public" className="mt-4">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {publicProviders.map(([key, preset]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => handleProviderChange(key)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:scale-[1.02] min-h-[100px] justify-center",
                                                            formData.provider === key
                                                                ? "border-indigo-600 bg-indigo-50 shadow-md"
                                                                : "border-gray-200 bg-white hover:border-indigo-300"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black shadow-sm",
                                                            formData.provider === key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                                                        )}>
                                                            {preset.icon}
                                                        </div>
                                                        <span className="text-xs font-bold text-center leading-tight">{preset.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="pro" className="mt-4">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {proProviders.map(([key, preset]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => handleProviderChange(key)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:scale-[1.02] min-h-[100px] justify-center",
                                                            formData.provider === key
                                                                ? "border-indigo-600 bg-indigo-50 shadow-md"
                                                                : "border-gray-200 bg-white hover:border-indigo-300"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shadow-sm",
                                                            formData.provider === key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                                                        )}>
                                                            {preset.icon}
                                                        </div>
                                                        <span className="text-xs font-bold text-center leading-tight">{preset.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="relay" className="mt-4">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {relayProviders.map(([key, preset]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => handleProviderChange(key)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:scale-[1.02] min-h-[100px] justify-center",
                                                            formData.provider === key
                                                                ? "border-indigo-600 bg-indigo-50 shadow-md"
                                                                : "border-gray-200 bg-white hover:border-indigo-300"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shadow-sm",
                                                            formData.provider === key ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                                                        )}>
                                                            {preset.icon}
                                                        </div>
                                                        <span className="text-xs font-bold text-center leading-tight">{preset.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="custom" className="mt-4">
                                            <div className="p-8 bg-slate-50 rounded-xl border-2 border-dashed text-center">
                                                <Server className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                                                <p className="text-base font-medium text-slate-700">Configuration manuelle sélectionnée</p>
                                                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                                                    Utilisez cette option si votre fournisseur n'est pas dans la liste. Vous devrez saisir le serveur et le port manuellement.
                                                </p>
                                            </div>
                                        </TabsContent>
                                    </Tabs>

                                    {currentPreset?.note && (
                                        <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-blue-900 leading-relaxed font-medium">{currentPreset.note}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Credentials */}
                                <div className="space-y-4">
                                    <Label className="text-base font-semibold block">2. Identifiants de connexion</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Email d'envoi</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input
                                                    className="pl-10 bg-gray-50/50 border-gray-200 h-10"
                                                    placeholder="vous@entreprise.com"
                                                    value={formData.email}
                                                    onChange={handleEmailChange}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex justify-between items-center">
                                                <span>Mot de passe</span>
                                                {formData.id && <span className="text-[10px] normal-case text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">(Requis pour modifier)</span>}
                                            </Label>
                                            <div className="relative">
                                                <Shield className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                                                <Input
                                                    className="pl-10 bg-emerald-50/30 border-emerald-100 h-10"
                                                    type="password"
                                                    placeholder={formData.id ? "Entrez à nouveau le mot de passe" : "Mot de passe d'application"}
                                                    value={formData.password}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Nom de la config (interne)</Label>
                                            <Input
                                                className="bg-gray-50/50 border-gray-200 h-10"
                                                placeholder="ex: Mon Email Pro"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Nom de l'expéditeur (visible)</Label>
                                            <Input
                                                className="bg-gray-50/50 border-gray-200 h-10"
                                                placeholder="ex: Jean Dupont"
                                                value={formData.from_name}
                                                onChange={e => setFormData({ ...formData, from_name: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced Settings */}
                                <div className="space-y-4 pt-4 border-t border-dashed">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">3. Serveur SMTP (Avancé)</Label>
                                        <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded">Rempli automatiquement</span>
                                    </div>
                                    <div className="p-5 bg-slate-50 border rounded-xl grid grid-cols-12 gap-4">
                                        <div className="col-span-8 sm:col-span-9 space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Hôte SMTP</Label>
                                            <Input
                                                className="text-sm bg-white font-mono"
                                                placeholder="smtp.example.com"
                                                value={formData.smtp_host}
                                                onChange={e => setFormData({ ...formData, smtp_host: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-4 sm:col-span-3 space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Port</Label>
                                            <Input
                                                type="number"
                                                className="text-sm bg-white font-mono"
                                                placeholder="587"
                                                value={formData.smtp_port}
                                                onChange={e => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 587 })}
                                            />
                                        </div>
                                    </div>
                                    {currentPreset?.altPorts && currentPreset.altPorts.length > 0 && (
                                        <div className="flex flex-wrap gap-2 text-xs text-slate-500 justify-end">
                                            <span className="flex items-center gap-1">
                                                <Info className="w-3 h-3" /> Ports alternatifs possibles :
                                            </span>
                                            <span className="font-mono bg-slate-100 px-1.5 rounded">{currentPreset.port}</span>
                                            {currentPreset.altPorts.map(p => (
                                                <span key={p} className="font-mono bg-slate-100 px-1.5 rounded">{p}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: Contextual Guide (Full width on mobile, 4 cols on desktop) */}
                            <div className="lg:col-span-5 xl:col-span-4 mt-8 lg:mt-0">
                                <div className="lg:sticky lg:top-4 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-2xl border-2 border-indigo-100/50 shadow-sm p-6 lg:max-h-[calc(85vh-100px)] lg:overflow-y-auto backdrop-blur-sm">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-indigo-200/50">
                                        <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-indigo-900 text-lg leading-tight">
                                                {currentPreset?.guide?.title || "Guide de configuration"}
                                            </h3>
                                            <p className="text-xs text-indigo-600/80 font-medium">Suivez les étapes ci-dessous</p>
                                        </div>
                                    </div>

                                    {currentPreset?.guide ? (
                                        <div className="space-y-6">
                                            {/* Steps */}
                                            <div className="space-y-3">
                                                {currentPreset.guide.steps.map((step, idx) => (
                                                    <div key={idx} className="flex gap-3 text-sm group">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white border-2 border-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mt-0.5 shadow-sm group-hover:border-indigo-600 group-hover:text-indigo-600 transition-colors">
                                                            {idx + 1}
                                                        </div>
                                                        <p className="text-slate-700 leading-relaxed font-medium pt-0.5">{step}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Links */}
                                            {currentPreset.guide.links && currentPreset.guide.links.length > 0 && (
                                                <div className="pt-5 border-t border-indigo-200/50 space-y-3">
                                                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Liens utiles</p>
                                                    <div className="flex flex-col gap-2">
                                                        {currentPreset.guide.links.map((link, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={link.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 text-sm font-medium text-indigo-700 bg-white/50 p-2.5 rounded-lg border border-indigo-100 hover:bg-white hover:border-indigo-300 hover:shadow-sm transition-all"
                                                            >
                                                                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                                                <span>{link.label}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tips */}
                                            {currentPreset.guide.tips && currentPreset.guide.tips.length > 0 && (
                                                <div className="pt-5 border-t border-indigo-200/50 space-y-3">
                                                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">💡 Conseils & Astuces</p>
                                                    <div className="bg-white/60 rounded-xl p-4 border border-indigo-50 space-y-2">
                                                        {currentPreset.guide.tips.map((tip, idx) => (
                                                            <p key={idx} className="text-sm text-slate-600 leading-relaxed pl-2 border-l-2 border-indigo-200">
                                                                {tip}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 px-4 text-slate-500">
                                            <Server className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                            <p className="text-sm font-medium">Sélectionnez un fournisseur à gauche pour voir le guide de configuration détaillé ici.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="mt-6 flex justify-between items-center sm:gap-0 gap-4 flex-col sm:flex-row">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                {!isVerified ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => performVerification()}
                                        disabled={testingConnection}
                                        className="text-xs w-full sm:w-auto border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                    >
                                        {testingConnection ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                                        Vérifier maintenant
                                    </Button>
                                ) : (
                                    <div className="flex items-center text-green-600 text-sm font-medium bg-green-50 px-3 py-2 rounded-md border border-green-100 w-full justify-center sm:w-auto">
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Vérification OK
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className={cn(
                                    "min-w-[160px] w-full sm:w-auto transition-all",
                                    isVerified ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"
                                )}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    isVerified ? <Check className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />
                                )}
                                {saving ? "Enregistrement..." : (isVerified ? "Enregistrer" : "Vérifier & Enregistrer")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configs.map(config => (
                    <Card
                        key={config.id}
                        className="group hover:border-indigo-300 transition-all hover:shadow-md cursor-pointer relative"
                        onClick={() => handleOpenDialog(config)}
                    >
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenDialog(config)
                                }}
                            >
                                <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDelete(config.id, e)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>

                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-bold flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-sm font-black">
                                        {SMTP_PRESETS[config.provider]?.icon || "?"}
                                    </div>
                                    <span className="truncate max-w-[150px]">{config.name}</span>
                                </CardTitle>
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
                        <Button onClick={() => handleOpenDialog()} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                            <Plus className="w-4 h-4 mr-2" /> Connecter un email
                        </Button>
                    </div>
                )}
            </div>


        </div>
    )
}
