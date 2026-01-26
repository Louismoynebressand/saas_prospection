"use client"

import { CampaignList } from "@/components/features/CampaignList"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Send, TrendingUp, Eye } from "lucide-react"

export default function EmailsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Prospection Mail</h1>
                <p className="text-muted-foreground mt-1">
                    Gérez vos profils de campagne et générez des emails ultra-personnalisés.
                </p>
            </div>

            {/* Global Stats - Placeholder for now, can be connected to real data later */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Send className="h-4 w-4 text-primary" />
                            Emails Générés
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground mt-1">Total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-600" />
                            Taux Ouverture
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">-</div>
                        <p className="text-xs text-muted-foreground mt-1">N/A</p>
                    </CardContent>
                </Card>
            </div>

            <CampaignList />
        </div>
    )
}
