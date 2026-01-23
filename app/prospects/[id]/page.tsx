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
    const [prospect, setProspect] = useState<Prospect | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchProspect = async () => {
            const { data, error } = await supabase
                .from('prospects')
                .select('*')
                .eq('id', id)
                .single()

            if (data) setProspect(data as Prospect)
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

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/searches/${prospect.search_id}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight">{prospect.company || "Société Inconnue"}</h2>
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3" /> {prospect.address || prospect.city || "Adresse inconnue"}
                    </p>
                </div>
                {prospect.source_url && (
                    <Button variant="outline" size="sm" asChild>
                        <a href={prospect.source_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-3 w-3" /> Voir sur Maps
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
                            <span className="col-span-2">{prospect.full_name || "-"}</span>

                            <span className="font-medium text-muted-foreground">Société</span>
                            <span className="col-span-2">{prospect.company || "-"}</span>

                            <span className="font-medium text-muted-foreground">Domaine</span>
                            <span className="col-span-2">{prospect.domain || "-"}</span>
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
                            {prospect.emails && prospect.emails.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {prospect.emails.map((email, idx) => (
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
                            {prospect.phones && prospect.phones.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {prospect.phones.map((phone, idx) => (
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
                    <CardTitle className="text-sm font-medium text-muted-foreground">Données brutes</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-x-auto">
                        {JSON.stringify(prospect.raw || {}, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    )
}
