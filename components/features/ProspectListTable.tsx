"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { MoreHorizontal, Mail, Phone, Building2, User, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ProspectListTable({ searchId, autoRefresh }: { searchId: string, autoRefresh?: boolean }) {
    const [prospects, setProspects] = useState<ScrapeProspect[]>([])
    const [loading, setLoading] = useState(true)
    const pollInterval = useRef<NodeJS.Timeout | null>(null)

    const fetchProspects = async () => {
        try {
            const { data, error } = await supabase
                .from('scrape_prospect')
                .select('*')
                .eq('id_jobs', searchId)
                .order('created_at', { ascending: false })

            if (error) throw error
            if (data) setProspects(data as ScrapeProspect[])
        } catch (error) {
            console.error('Error fetching prospects:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProspects()

        // 1. Realtime subscription
        const subscription = supabase
            .channel(`scrape_prospects_list_${searchId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'scrape_prospect',
                filter: `id_jobs=eq.${searchId}`
            }, (payload) => {
                setProspects(prev => [payload.new as ScrapeProspect, ...prev])
            })
            .subscribe()

        // 2. Polling if autoRefresh is active
        if (autoRefresh) {
            pollInterval.current = setInterval(() => {
                fetchProspects()
            }, 10000)
        }

        return () => {
            subscription.unsubscribe()
            if (pollInterval.current) clearInterval(pollInterval.current)
        }
    }, [searchId, autoRefresh])

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (prospects.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border rounded-md border-dashed">
                Aucun prospect trouvé pour le moment.
            </div>
        )
    }

    return (
        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Société</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Ville</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {prospects.map((prospect) => {
                        const raw = prospect.data_scrapping || {};
                        const name = raw.name || raw.title || prospect.id_prospect.slice(0, 8);
                        const company = raw.company || raw.title || "N/A";
                        const city = prospect.ville || raw.address;
                        const email = (prospect.email_adresse_verified && prospect.email_adresse_verified[0])
                            || (raw.emails && raw.emails[0]);
                        const phone = raw.phone || (raw.phones && raw.phones[0]);

                        return (
                            <TableRow key={prospect.id_prospect}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        {name}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        {company}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {email && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Mail className="h-3 w-3" />
                                                <span className="truncate max-w-[150px]">{email}</span>
                                            </div>
                                        )}
                                        {phone && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" />
                                                {phone}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[120px] truncate">{city}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link href={`/prospects/${prospect.id_prospect}`}>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
