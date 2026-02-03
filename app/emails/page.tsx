"use client"

import { CampaignList } from "@/components/features/CampaignList"
import { StatsCards } from "@/components/features/StatsCards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Send, TrendingUp, Eye } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SmtpSettings } from "@/components/features/SmtpSettings"

export default function EmailsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Prospection Mail</h1>
                <p className="text-muted-foreground mt-1">
                    Gérez vos profils de campagne, configurations d'envoi et générez des emails ultra-personnalisés.
                </p>
            </div>

            <Tabs defaultValue="campaigns" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="campaigns">Campagnes & Stats</TabsTrigger>
                    <TabsTrigger value="settings">Comptes d'envoi (SMTP)</TabsTrigger>
                </TabsList>

                <TabsContent value="campaigns" className="space-y-6">
                    {/* Global Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatsCards />
                    </div>

                    <CampaignList />
                </TabsContent>

                <TabsContent value="settings">
                    <SmtpSettings />
                </TabsContent>
            </Tabs>
        </div>
    )
}
