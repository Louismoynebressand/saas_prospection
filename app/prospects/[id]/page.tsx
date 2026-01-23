"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe, ExternalLink, User } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function ProspectPage() {
    const params = useParams()
    const id = params.id as string
    const [prospect, setProspect] = useState<ScrapeProspect | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchProspect = async () => {
            const { data, error } = await supabase
                .from('scrape_prospect')
                .select('*')
                .eq('id_prospect', id)
                .single()

            if (data) setProspect(data as ScrapeProspect)
            setLoading(false)
        }

        fetchProspect()
    }, [id])

    if (loading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
        </div>
    }

    if (!prospect) {
        return <div>Prospect non trouvé</div>
    }

    // Helper extraction
    const raw = prospect.data_scrapping || {};
    const name = raw.name || raw.title || "Nom Inconnu";
    const company = raw.company || raw.title || "Société Inconnue";
    const address = prospect.ville || raw.address;
    const emails = prospect.email_adresse_verified || raw.emails || [];
    const phones = raw.phone ? [raw.phone] : (raw.phones || []);
    const website = raw.website || prospect.deep_search?.website;
    const url = raw.url || raw.googleMapsUrl || prospect.data_scrapping?.url;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/searches/${prospect.id_jobs}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight">{company}</h2>
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3" /> {address || "Adresse inconnue"}
                    </p>
                </div>
                {url && (
                    <Button variant="outline" size="sm" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-3 w-3" /> Voir sur Maps
                        </a>
                    </Button>
                )}
                {website && (
                    <Button variant="outline" size="sm" asChild>
                        <a href={website} target="_blank" rel="noopener noreferrer">
                            <Globe className="mr-2 h-3 w-3" /> Site Web
                        </a>
                    </Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Identity Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5 text-primary" /> Identité
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="font-medium text-muted-foreground">Nom complet</span>
                            <span className="col-span-2">{name}</span>

                            <span className="font-medium text-muted-foreground">Société</span>
                            <span className="col-span-2">{company}</span>

                            <span className="font-medium text-muted-foreground">Domaine</span>
                            <span className="col-span-2">{raw.category || "-"}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Phone className="h-5 w-5 text-primary" /> Contact
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                <Mail className="h-3 w-3" /> Emails
                            </h4>
                            {emails.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {emails.map((email: string, idx: number) => (
                                        <Badge key={idx} variant="outline" className="text-xs py-1">
                                            {email}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Aucun email trouvé</p>
                            )}
                        </div>

                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                <Phone className="h-3 w-3" /> Téléphones
                            </h4>
                            {phones.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {phones.map((phone: string, idx: number) => (
                                        <Badge key={idx} variant="secondary" className="text-xs py-1">
                                            {phone}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Aucun téléphone trouvé</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Raw Data Accordion or Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Données brutes (Scraping + Deep Search)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-x-auto">
                        {JSON.stringify(prospect.data_scrapping || {}, null, 2)}
                    </pre>
                    <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-x-auto">
                        {JSON.stringify(prospect.deep_search || {}, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    )
}
