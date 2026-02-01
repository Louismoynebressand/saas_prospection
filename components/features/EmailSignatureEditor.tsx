"use client"

import { useState, useEffect, useRef } from "react"
import { Campaign } from "@/types"
import {
    SignatureConfig,
    generateSignatureHTML,
    getDefaultElementsOrder,
    validateSignatureConfig
} from "@/lib/email-signature-generator"
import { SignaturePreview } from "@/components/ui/signature-preview"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Eye, Save, Upload, FileText, Settings } from "lucide-react"
import { motion } from "framer-motion"

interface EmailSignatureEditorProps {
    initialData: Partial<Campaign>
    onSave: (html: string, config: Partial<SignatureConfig>) => Promise<void>
    showAIAssist?: boolean
}

export function EmailSignatureEditor({
    initialData,
    onSave,
    showAIAssist = false
}: EmailSignatureEditorProps) {
    const [mode, setMode] = useState<'form' | 'html'>('form')
    const [config, setConfig] = useState<SignatureConfig>({
        signature_name: initialData.signature_name || '',
        signature_title: initialData.signature_title || '',
        signature_company: initialData.signature_company || initialData.my_company_name || '',
        signature_phone: initialData.signature_phone || '',
        signature_email: initialData.signature_email || '',
        signature_ps: initialData.signature_ps || '',
        my_website: initialData.my_website || '',
        signature_show_phone: initialData.signature_show_phone ?? true,
        signature_show_email: initialData.signature_show_email ?? true,
        signature_show_website: initialData.signature_show_website ?? true,
        signature_website_text: initialData.signature_website_text || 'Visitez notre site web',
        signature_custom_link_url: initialData.signature_custom_link_url || '',
        signature_custom_link_text: initialData.signature_custom_link_text || '',
        signature_elements_order: initialData.signature_elements_order || getDefaultElementsOrder(),
    })

    const [saving, setSaving] = useState(false)
    const [customHTML, setCustomHTML] = useState(initialData.signature_html || '')
    const [generatedHTML, setGeneratedHTML] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Generate HTML whenever config changes
    useEffect(() => {
        if (mode === 'form') {
            const html = generateSignatureHTML(config)
            setGeneratedHTML(html)
        }
    }, [config, mode])

    const handleSave = async () => {
        setSaving(true)
        try {
            const htmlToSave = mode === 'html' ? customHTML : generatedHTML

            if (!htmlToSave) {
                toast.error('Veuillez remplir au moins le nom ou importer du HTML')
                setSaving(false)
                return
            }

            // Si mode HTML, on sauvegarde juste le HTML
            if (mode === 'html') {
                await onSave(htmlToSave, { signature_html: htmlToSave })
            } else {
                // Mode formulaire : valider et sauvegarder
                const validation = validateSignatureConfig(config)
                if (!validation.valid) {
                    toast.error('Configuration invalide', {
                        description: validation.errors.join(', ')
                    })
                    setSaving(false)
                    return
                }
                await onSave(htmlToSave, config)
            }

            toast.success('✅ Signature sauvegardée avec succès !')
        } catch (error) {
            console.error('Save error:', error)
            toast.error('Erreur lors de la sauvegarde')
        } finally {
            setSaving(false)
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                const html = event.target?.result as string
                setCustomHTML(html)
                toast.success('Fichier importé avec succès')
            }
            reader.readAsText(file)
        }
    }

    return (
        <div className="space-y-4">
            {/* Mode Selector */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'form' | 'html')}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="form" className="gap-2">
                        <Settings className="w-4 h-4" />
                        Formulaire
                    </TabsTrigger>
                    <TabsTrigger value="html" className="gap-2">
                        <FileText className="w-4 h-4" />
                        Import HTML
                    </TabsTrigger>
                </TabsList>

                {/* Form Mode */}
                <TabsContent value="form" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Configuration Panel */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Configuration de la signature</CardTitle>
                                    <CardDescription>
                                        Personnalisez les informations affichées dans votre signature email
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="sig-name">Nom complet *</Label>
                                        <Input
                                            id="sig-name"
                                            value={config.signature_name}
                                            onChange={(e) => setConfig({ ...config, signature_name: e.target.value })}
                                            placeholder="Marie Dupont"
                                        />
                                    </div>

                                    {/* Title */}
                                    <div className="space-y-2">
                                        <Label htmlFor="sig-title">Titre / Poste</Label>
                                        <Input
                                            id="sig-title"
                                            value={config.signature_title}
                                            onChange={(e) => setConfig({ ...config, signature_title: e.target.value })}
                                            placeholder="Directrice Marketing"
                                        />
                                    </div>

                                    {/* Company */}
                                    <div className="space-y-2">
                                        <Label htmlFor="sig-company">Entreprise</Label>
                                        <Input
                                            id="sig-company"
                                            value={config.signature_company}
                                            onChange={(e) => setConfig({ ...config, signature_company: e.target.value })}
                                            placeholder="Ma Super Entreprise"
                                        />
                                    </div>

                                    {/* Phone with checkbox */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="sig-phone">Téléphone</Label>
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="show-phone"
                                                    checked={config.signature_show_phone}
                                                    onCheckedChange={(checked) =>
                                                        setConfig({ ...config, signature_show_phone: checked as boolean })
                                                    }
                                                />
                                                <label htmlFor="show-phone" className="text-sm text-gray-600 cursor-pointer">
                                                    Afficher
                                                </label>
                                            </div>
                                        </div>
                                        <Input
                                            id="sig-phone"
                                            value={config.signature_phone}
                                            onChange={(e) => setConfig({ ...config, signature_phone: e.target.value })}
                                            placeholder="+33 6 12 34 56 78"
                                            disabled={!config.signature_show_phone}
                                        />
                                    </div>

                                    {/* Email with checkbox */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="sig-email">Email</Label>
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="show-email"
                                                    checked={config.signature_show_email}
                                                    onCheckedChange={(checked) =>
                                                        setConfig({ ...config, signature_show_email: checked as boolean })
                                                    }
                                                />
                                                <label htmlFor="show-email" className="text-sm text-gray-600 cursor-pointer">
                                                    Afficher
                                                </label>
                                            </div>
                                        </div>
                                        <Input
                                            id="sig-email"
                                            type="email"
                                            value={config.signature_email}
                                            onChange={(e) => setConfig({ ...config, signature_email: e.target.value })}
                                            placeholder="marie@entreprise.com"
                                            disabled={!config.signature_show_email}
                                        />
                                    </div>

                                    {/* Website with checkbox */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="sig-website">Site web</Label>
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="show-website"
                                                    checked={config.signature_show_website}
                                                    onCheckedChange={(checked) =>
                                                        setConfig({ ...config, signature_show_website: checked as boolean })
                                                    }
                                                />
                                                <label htmlFor="show-website" className="text-sm text-gray-600 cursor-pointer">
                                                    Afficher
                                                </label>
                                            </div>
                                        </div>
                                        <Input
                                            id="sig-website-text"
                                            value={config.signature_website_text}
                                            onChange={(e) => setConfig({ ...config, signature_website_text: e.target.value })}
                                            placeholder="Texte du lien"
                                            className="mb-2"
                                            disabled={!config.signature_show_website}
                                        />
                                        <Input
                                            id="sig-website"
                                            value={config.my_website}
                                            onChange={(e) => setConfig({ ...config, my_website: e.target.value })}
                                            placeholder="https://www.entreprise.com"
                                            disabled={!config.signature_show_website}
                                        />
                                    </div>

                                    {/* Custom Link */}
                                    <div className="space-y-2 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                        <Label className="text-indigo-900 font-semibold">Lien personnalisé (optionnel)</Label>
                                        <p className="text-xs text-indigo-700 mb-2">
                                            Ex: Calendly, prise de RDV, formulaire...
                                        </p>
                                        <Input
                                            value={config.signature_custom_link_text}
                                            onChange={(e) => setConfig({ ...config, signature_custom_link_text: e.target.value })}
                                            placeholder="Texte du lien (ex: Prendre rendez-vous)"
                                            className="mb-2 bg-white"
                                        />
                                        <Input
                                            value={config.signature_custom_link_url}
                                            onChange={(e) => setConfig({ ...config, signature_custom_link_url: e.target.value })}
                                            placeholder="URL (ex: https://calendly.com/...)"
                                            className="bg-white"
                                        />
                                    </div>

                                    {/* PS */}
                                    <div className="space-y-2">
                                        <Label htmlFor="sig-ps">PS personnalisé (optionnel)</Label>
                                        <Textarea
                                            id="sig-ps"
                                            value={config.signature_ps}
                                            onChange={(e) => setConfig({ ...config, signature_ps: e.target.value })}
                                            placeholder="P.S. Un message personnalisé..."
                                            rows={3}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Preview Panel */}
                        <div className="space-y-4">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Eye className="w-5 h-5" />
                                            Aperçu en temps réel
                                        </CardTitle>
                                        <CardDescription>
                                            Voici comment votre signature apparaîtra dans les emails
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <SignaturePreview config={config} />
                                    </CardContent>
                                </Card>

                                {/* Actions */}
                                <div className="flex gap-2 mt-4">
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-1"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {saving ? 'Sauvegarde...' : 'Enregistrer'}
                                    </Button>
                                </div>

                                {showAIAssist && (
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs text-blue-900">
                                            💡 <strong>Astuce :</strong> Les champs sont pré-remplis avec les informations de votre campagne
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    </div>
                </TabsContent>

                {/* HTML Import Mode */}
                <TabsContent value="html" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Import Panel */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Importer une signature HTML</CardTitle>
                                    <CardDescription>
                                        Copiez/collez votre code HTML ou importez un fichier
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* HTML Textarea */}
                                    <div className="space-y-2">
                                        <Label htmlFor="html-input">Code HTML</Label>
                                        <Textarea
                                            id="html-input"
                                            value={customHTML}
                                            onChange={(e) => setCustomHTML(e.target.value)}
                                            placeholder="<table>...</table>"
                                            rows={15}
                                            className="font-mono text-sm"
                                        />
                                    </div>

                                    {/* File Upload */}
                                    <div className="space-y-2">
                                        <Label>Ou importer un fichier</Label>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".html,.htm"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full"
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Choisir un fichier HTML
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Preview Panel */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Eye className="w-5 h-5" />
                                        Aperçu
                                    </CardTitle>
                                    <CardDescription>
                                        Voici le rendu de votre signature HTML
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 min-h-[200px]">
                                        {customHTML ? (
                                            <div dangerouslySetInnerHTML={{ __html: customHTML }} />
                                        ) : (
                                            <p className="text-gray-400 text-center">
                                                Collez votre HTML pour voir l'aperçu
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || !customHTML}
                                    className="flex-1"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {saving ? 'Sauvegarde...' : 'Enregistrer'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
