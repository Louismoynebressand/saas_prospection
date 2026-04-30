"use client"

import { CampaignList } from "@/components/features/CampaignList"
import { StatsCards } from "@/components/features/StatsCards"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SmtpSettings } from "@/components/features/SmtpSettings"
import { MailgunSettings } from "@/components/features/MailgunSettings"
import { Server, Zap, BarChart2 } from "lucide-react"

export default function EmailsPage() {
    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 relative max-w-[1400px] mx-auto">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-3xl opacity-50 animate-pulse" />
                <div className="absolute top-[40%] right-[-10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-3xl opacity-40 delay-700 animate-pulse" />
            </div>

            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate bg-gradient-to-r from-emerald-900 to-blue-900 dark:from-emerald-200 dark:to-blue-300 bg-clip-text text-transparent pb-1">
                    Prospection Mail
                </h1>
                <p className="text-muted-foreground mt-0.5 text-sm md:text-base">
                    Campagnes, configurations d'envoi et emails personnalisés IA.
                </p>
            </div>

            <Tabs defaultValue="campaigns" className="space-y-4 md:space-y-6">
                {/* Tabs list — scrollable horizontally on mobile */}
                <TabsList className="w-full overflow-x-auto flex justify-start gap-0 h-auto p-1">
                    <TabsTrigger
                        value="campaigns"
                        className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm"
                    >
                        <BarChart2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Campagnes</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="smtp"
                        className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm"
                    >
                        <Server className="w-3.5 h-3.5 shrink-0" />
                        <span>SMTP</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="mailgun"
                        className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm"
                    >
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        <span>Mailgun</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="campaigns" className="space-y-4 md:space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
