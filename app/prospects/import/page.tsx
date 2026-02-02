"use client"

import { useState } from 'react'
import { Download, Upload, UserPlus, ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ProspectImportData } from '@/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CSVImporter } from '@/components/features/CSVImporter'
import { CSVPreview } from '@/components/features/CSVPreview'
import { ManualProspectForm } from '@/components/features/ManualProspectForm'
import { toast } from 'sonner'

export default function ProspectsImportPage() {
    const router = useRouter()
    const [parsedData, setParsedData] = useState<ProspectImportData[]>([])
    const [isImporting, setIsImporting] = useState(false)

    const handleDownloadTemplate = async () => {
        try {
            const response = await fetch('/api/prospects/template')
            if (!response.ok) {
                toast.error('Erreur lors du téléchargement du modèle')
                return
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'modele_import_prospects.csv'
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success('Modèle CSV téléchargé !')
        } catch (error) {
            console.error('Error downloading template:', error)
            toast.error('Erreur lors du téléchargement')
        }
    }

    const handleDataParsed = (data: ProspectImportData[]) => {
        setParsedData(data)
        toast.success(`${data.length} prospect${data.length > 1 ? 's' : ''} détecté${data.length > 1 ? 's' : ''} !`)
    }

    const handleError = (error: string) => {
        toast.error(error)
        setParsedData([])
    }

    const handleImport = async () => {
        if (parsedData.length === 0) {
            toast.error('Aucun prospect à importer')
            return
        }

        setIsImporting(true)

        try {
            const response = await fetch('/api/prospects/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospects: parsedData }),
            })

            const result = await response.json()

            if (!response.ok) {
                toast.error(result.error || 'Erreur lors de l\'importation')
                return
            }

            toast.success(
                `✅ ${result.imported_count} prospect${result.imported_count > 1 ? 's' : ''} importé${result.imported_count > 1 ? 's' : ''} avec succès !`,
                { duration: 5000 }
            )

            if (result.failed_count > 0) {
                toast.warning(
                    `⚠️ ${result.failed_count} prospect${result.failed_count > 1 ? 's ont' : ' a'} échoué`,
                    { duration: 5000 }
                )
            }

            // Reset and redirect after success
            setParsedData([])
            setTimeout(() => {
                router.push('/prospects')
            }, 2000)

        } catch (error) {
            console.error('Error importing prospects:', error)
            toast.error('Erreur lors de l\'importation')
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push('/prospects')}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">Importer des prospects</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Importez vos prospects via un fichier CSV ou ajoutez-les manuellement
                    </p>
                </div>

                <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Télécharger le modèle CSV
                </Button>
            </div>

            {/* Main Content */}
            <Tabs defaultValue="csv" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="csv" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Import CSV
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Ajout manuel
                    </TabsTrigger>
                </TabsList>

                {/* CSV Import Tab */}
                <TabsContent value="csv" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Étape 1 : Charger le fichier CSV</CardTitle>
                            <CardDescription>
                                Utilisez notre modèle CSV ou créez le vôtre avec les colonnes appropriées.
                                Le champ <strong>Titre</strong> est obligatoire.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CSVImporter
                                onDataParsed={handleDataParsed}
                                onError={handleError}
                            />
                        </CardContent>
                    </Card>

                    {parsedData.length > 0 && (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Étape 2 : Vérification des données</CardTitle>
                                    <CardDescription>
                                        Vérifiez les prospects détectés avant l'importation finale.
                                        Les erreurs bloquantes sont indiquées en rouge.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <CSVPreview data={parsedData} />
                                </CardContent>
                            </Card>

                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setParsedData([])}
                                    disabled={isImporting}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="gap-2"
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Importation en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Importer {parsedData.length} prospect{parsedData.length > 1 ? 's' : ''}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </TabsContent>

                {/* Manual Entry Tab */}
                <TabsContent value="manual">
                    <ManualProspectForm />
                </TabsContent>
            </Tabs>
        </div>
    )
}
