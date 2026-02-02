"use client"

import { useMemo } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Building2, Mail, Phone, MapPin } from 'lucide-react'
import { ProspectImportData } from '@/types'
import { validateProspectBatch } from '@/lib/csv-validator'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface CSVPreviewProps {
    data: ProspectImportData[]
}

export function CSVPreview({ data }: CSVPreviewProps) {
    const validatedData = useMemo(() => {
        return validateProspectBatch(data)
    }, [data])

    const stats = useMemo(() => {
        const valid = validatedData.filter(v => v.validation.isValid).length
        const withWarnings = validatedData.filter(v => v.validation.warnings.length > 0).length
        const withErrors = validatedData.filter(v => !v.validation.isValid).length

        return { valid, withWarnings, withErrors, total: data.length }
    }, [validatedData])

    const getStatusIcon = (validation: any) => {
        if (!validation.isValid) {
            return <AlertCircle className="h-4 w-4 text-destructive" />
        }
        if (validation.warnings.length > 0) {
            return <AlertTriangle className="h-4 w-4 text-orange-500" />
        }
        return <CheckCircle className="h-4 w-4 text-green-600" />
    }

    const getStatusBadge = (validation: any) => {
        if (!validation.isValid) {
            return <Badge variant="destructive">Erreur</Badge>
        }
        if (validation.warnings.length > 0) {
            return <Badge variant="outline" className="border-orange-500 text-orange-700">Avertissements</Badge>
        }
        return <Badge variant="outline" className="border-green-600 text-green-700">Valide</Badge>
    }

    return (
        <div className="space-y-4">
            {/* Stats Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Aperçu des prospects</CardTitle>
                    <CardDescription>
                        {stats.total} prospect{stats.total > 1 ? 's' : ''} détecté{stats.total > 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                                <p className="text-2xl font-bold text-green-700">{stats.valid}</p>
                                <p className="text-xs text-muted-foreground">Valides</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            <div>
                                <p className="text-2xl font-bold text-orange-600">{stats.withWarnings}</p>
                                <p className="text-xs text-muted-foreground">Avertissements</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            <div>
                                <p className="text-2xl font-bold text-destructive">{stats.withErrors}</p>
                                <p className="text-xs text-muted-foreground">Erreurs</p>
                            </div>
                        </div>
                    </div>

                    {stats.withErrors > 0 && (
                        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-sm text-destructive font-medium">
                                ⚠️ {stats.withErrors} prospect{stats.withErrors > 1 ? 's' : ''} ne pourr{stats.withErrors > 1 ? 'ont' : 'a'} pas être importé{stats.withErrors > 1 ? 's' : ''} en raison d'erreurs bloquantes.
                            </p>
                        </div>
                    )}

                    {stats.withWarnings > 0 && stats.withErrors === 0 && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                            <p className="text-sm text-orange-700">
                                ℹ️ {stats.withWarnings} prospect{stats.withWarnings > 1 ? 's' : ''} peu{stats.withWarnings > 1 ? 'vent' : 't'} être importé{stats.withWarnings > 1 ? 's' : ''} mais présente{stats.withWarnings > 1 ? 'nt' : ''} des avertissements (champs recommandés manquants).
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Preview Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border-0 max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-12">Statut</TableHead>
                                    <TableHead>Titre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Site web</TableHead>
                                    <TableHead>Téléphone</TableHead>
                                    <TableHead>Ville</TableHead>
                                    <TableHead>Détails</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {validatedData.map(({ index, data, validation }) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        {getStatusIcon(validation)}
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <div className="space-y-1">
                                                            {validation.errors.map((err, i) => (
                                                                <p key={i} className="text-xs text-destructive">❌ {err}</p>
                                                            ))}
                                                            {validation.warnings.map((warn, i) => (
                                                                <p key={i} className="text-xs text-orange-600">⚠️ {warn}</p>
                                                            ))}
                                                            {validation.isValid && validation.warnings.length === 0 && (
                                                                <p className="text-xs text-green-600">✅ Prospect valide</p>
                                                            )}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="truncate max-w-[200px]">{data.titre || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {data.email ? (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3 text-primary" />
                                                    <span className="text-sm truncate max-w-[150px]">{data.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {data.site_web ? (
                                                <span className="text-sm truncate max-w-[150px] block">{data.site_web}</span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {data.telephone ? (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    <span className="text-sm whitespace-nowrap">{data.telephone}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {data.ville ? (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-sm">{data.ville}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(validation)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
