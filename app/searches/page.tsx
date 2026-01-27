import { SearchHistoryTable } from "@/components/features/SearchHistoryTable"
import { EmailVerificationHistoryTable } from "@/components/features/EmailVerificationHistoryTable"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SearchesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Historique Unifié</h2>
                <p className="text-muted-foreground">Retrouvez toutes vos campagnes de prospection et vérifications.</p>
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
