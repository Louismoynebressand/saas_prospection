"use client"

import { useState } from "react"
import { Mail, Send, Plus, MoreHorizontal, Eye, Trash2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const mockCampaigns = [
    {
        id: 1,
        name: "Prospection Agences Immobilières Paris",
        status: "active",
        sent: 45,
        opened: 23,
        replied: 8,
        createdAt: new Date(2026, 0, 20)
    },
    {
        id: 2,
        name: "Restaurants Lyon - Offre Spéciale",
        status: "draft",
        sent: 0,
        opened: 0,
        replied: 0,
        createdAt: new Date(2026, 0, 22)
    },
    {
        id: 3,
        name: "Relance Salons de Coiffure Toulouse",
        status: "completed",
        sent: 120,
        opened: 67,
        replied: 15,
        createdAt: new Date(2026, 0, 15)
    },
]

export default function EmailsPage() {
    const [campaigns] = useState(mockCampaigns)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-blue-600">En cours</Badge>
            case 'draft':
                return <Badge variant="outline">Brouillon</Badge>
            case 'completed':
                return <Badge variant="default" className="bg-green-600">Terminée</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const handleCreateCampaign = () => {
        alert("Créer une campagne (Fonctionnalité à venir)")
    }

    const handleViewCampaign = (id: number) => {
        alert(`Voir campagne ${id} (Fonctionnalité à venir)`)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Mails de Prospection</h1>
                    <p className="text-muted-foreground mt-1">
                        Gérez vos campagnes d'emailing et suivez les performances
                    </p>
                </div>
                <Button onClick={handleCreateCampaign} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nouvelle Campagne
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Send className="h-4 w-4 text-primary" />
                            Emails Envoyés
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">165</div>
                        <p className="text-xs text-muted-foreground mt-1">Ce mois-ci</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-600" />
                            Taux d'Ouverture
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">54.5%</div>
                        <p className="text-xs text-muted-foreground mt-1">+12% vs mois dernier</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-green-600" />
                            Taux de Réponse
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">13.9%</div>
                        <p className="text-xs text-muted-foreground mt-1">+5% vs mois dernier</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-600" />
                            Conversions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8</div>
                        <p className="text-xs text-muted-foreground mt-1">Nouveaux clients</p>
                    </CardContent>
                </Card>
            </div>

            {/* Campaigns Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Campagnes</CardTitle>
                    <CardDescription>Liste de vos campagnes d'emailing</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Envoyés</TableHead>
                                <TableHead className="text-right">Ouverts</TableHead>
                                <TableHead className="text-right">Réponses</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {campaigns.map((campaign) => (
                                <TableRow key={campaign.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewCampaign(campaign.id)}>
                                    <TableCell className="font-medium">{campaign.name}</TableCell>
                                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                                    <TableCell className="text-right">{campaign.sent}</TableCell>
                                    <TableCell className="text-right">
                                        <span className="text-blue-600">{campaign.opened}</span>
                                        {campaign.sent > 0 && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                                ({Math.round((campaign.opened / campaign.sent) * 100)}%)
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="text-green-600">{campaign.replied}</span>
                                        {campaign.sent > 0 && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                                ({Math.round((campaign.replied / campaign.sent) * 100)}%)
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(campaign.createdAt, "d MMM yyyy", { locale: fr })}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewCampaign(campaign.id); }}>
                                                    <Eye className="mr-2 h-4 w-4" /> Voir
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
