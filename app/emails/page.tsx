"use client"

import { CampaignList } from "@/components/features/CampaignList"
import { StatsCards } from "@/components/features/StatsCards"
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

            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCards />
            </div>

            <CampaignList />
        </div>
    )
}
