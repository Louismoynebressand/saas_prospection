"use client"

import { CampaignList } from "@/components/features/CampaignList"
import { StatsCards } from "@/components/features/StatsCards"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SmtpSettings } from "@/components/features/SmtpSettings"
import { MailgunSettings } from "@/components/features/MailgunSettings"
import { Server, Zap } from "lucide-react"

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
                    <TabsTrigger value="smtp" className="gap-1.5">
                        <Server className="w-3.5 h-3.5" />
                        Comptes SMTP
                    </TabsTrigger>
                    <TabsTrigger value="mailgun" className="gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        Mailgun API
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="campaigns" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatsCards />
                    </div>
                    <CampaignList />
                </TabsContent>

                <TabsContent value="smtp">
                    <SmtpSettings />
                </TabsContent>

                <TabsContent value="mailgun">
                    <MailgunSettings />
                </TabsContent>
            </Tabs>
        </div>
    )
}

