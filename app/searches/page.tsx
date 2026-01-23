import { SearchHistoryTable } from "@/components/features/SearchHistoryTable"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function SearchesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Historique</h2>
                <p className="text-muted-foreground">Retrouvez toutes vos campagnes de prospection.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recherches</CardTitle>
                    <CardDescription>Liste de vos extractions Google Maps</CardDescription>
                </CardHeader>
                <CardContent>
                    <SearchHistoryTable />
                </CardContent>
            </Card>
        </div>
    )
}
