"use client"

import { useState, useCallback } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import Papa from 'papaparse'
import { ProspectImportData } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CSVImporterProps {
    onDataParsed: (data: ProspectImportData[]) => void
    onError: (error: string) => void
}

export function CSVImporter({ onDataParsed, onError }: CSVImporterProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // CSV column mapping
    const columnMapping: Record<string, keyof ProspectImportData> = {
        'Titre*': 'titre',
        'Titre': 'titre',
        'Email (recommandé)': 'email',
        'Email': 'email',
        'Site web (recommandé)': 'site_web',
        'Site web': 'site_web',
        'Téléphone (recommandé)': 'telephone',
        'Téléphone': 'telephone',
        'Rue (recommandé)': 'rue',
        'Rue': 'rue',
        'Ville (recommandé)': 'ville',
        'Ville': 'ville',
        'Code postal (recommandé)': 'code_postal',
        'Code postal': 'code_postal',
        'Secteur (recommandé)': 'secteur',
        'Secteur': 'secteur',
        'Nom de catégorie': 'categorie',
        'Score total': 'score_total',
        'Nombre d\'avis': 'nombre_avis',
        'Latitude': 'latitude',
        'Longitude': 'longitude',
        'URL Google Maps': 'url_google_maps',
        'Notes': 'notes',
    }

    const handleFileSelect = (selectedFile: File) => {
        if (!selectedFile.name.endsWith('.csv')) {
            onError('Le fichier doit être au format CSV')
            return
        }

        setFile(selectedFile)
        parseCSV(selectedFile)
    }

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const prospects: ProspectImportData[] = []

                    results.data.forEach((row: any, index) => {
                        // Skip comment lines
                        if (row[Object.keys(row)[0]]?.startsWith('#')) {
                            return
                        }

                        const prospect: any = {}

                        // Map CSV columns to prospect fields
                        Object.entries(row).forEach(([csvColumn, value]) => {
                            const mappedField = columnMapping[csvColumn.trim()]
                            if (mappedField && value) {
                                const stringValue = String(value).trim()

                                // Convert numeric fields
                                if (mappedField === 'score_total' || mappedField === 'nombre_avis') {
                                    const numValue = parseFloat(stringValue)
                                    prospect[mappedField] = isNaN(numValue) ? undefined : numValue
                                } else if (mappedField === 'latitude' || mappedField === 'longitude') {
                                    const numValue = parseFloat(stringValue)
                                    prospect[mappedField] = isNaN(numValue) ? undefined : numValue
                                } else {
                                    prospect[mappedField] = stringValue
                                }
                            }
                        })

                        if (Object.keys(prospect).length > 0) {
                            prospects.push(prospect as ProspectImportData)
                        }
                    })

                    if (prospects.length === 0) {
                        onError('Aucun prospect valide trouvé dans le fichier')
                        return
                    }

                    onDataParsed(prospects)
                } catch (error) {
                    onError('Erreur lors du parsing du CSV')
                    console.error('Parse error:', error)
                }
            },
            error: (error) => {
                onError(`Erreur lors de la lecture du fichier: ${error.message}`)
            }
        })
    }

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)

        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            handleFileSelect(droppedFile)
        }
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            handleFileSelect(selectedFile)
        }
    }

    const removeFile = () => {
        setFile(null)
        onDataParsed([])
    }

    return (
        <Card>
            <CardContent className="pt-6">
                {!file ? (
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`
                            border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                        `}
                        onClick={() => document.getElementById('csv-file-input')?.click()}
                    >
                        <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                        <h3 className="text-lg font-semibold mb-2">
                            Glissez-déposez votre fichier CSV ici
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            ou cliquez pour sélectionner un fichier
                        </p>
                        <Button type="button" variant="outline">
                            Parcourir les fichiers
                        </Button>
                        <input
                            id="csv-file-input"
                            type="file"
                            accept=".csv"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-primary" />
                            <div>
                                <p className="font-medium">{file.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {(file.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={removeFile}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
