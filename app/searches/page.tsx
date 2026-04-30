import { SearchHistoryTable } from "@/components/features/SearchHistoryTable"
import { EmailVerificationHistoryTable } from "@/components/features/EmailVerificationHistoryTable"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SearchesPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative max-w-[1400px] mx-auto">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[5%] right-[10%] w-[35%] h-[35%] bg-orange-500/10 rounded-full blur-3xl opacity-50 animate-pulse" />
                <div className="absolute bottom-[20%] left-[-5%] w-[40%] h-[40%] bg-rose-500/10 rounded-full blur-3xl opacity-40 delay-500 animate-pulse" />
            </div>

            <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight truncate bg-gradient-to-r from-orange-600 to-rose-600 dark:from-orange-200 dark:to-rose-300 bg-clip-text text-transparent pb-1">
                    Historique Unifié
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm md:text-base">Retrouvez toutes vos campagnes de prospection et vérifications.</p>
            </div>

            <Tabs defaultValue="searches" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="searches">Recherches Prospects</TabsTrigger>
                    <TabsTrigger value="emails">Vérifications Emails</TabsTrigger>
                </TabsList>
                
                <TabsContent value="searches" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recherches</CardTitle>
                            <CardDescription>Liste de vos extractions Google Maps</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SearchHistoryTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="emails" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Vérifications Emails</CardTitle>
                            <CardDescription>Historique de vos campagnes de vérification</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EmailVerificationHistoryTable />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
