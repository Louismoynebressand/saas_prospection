"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Mail, Phone, Building2, User, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ProspectListTable({ searchId, autoRefresh }: { searchId: string, autoRefresh?: boolean }) {
    const router = useRouter()
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
                        <TableHead>Société</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Ville</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {prospects.map((prospect) => {
                        const raw = prospect.data_scrapping || {};
                        const deep = prospect.deep_search || {};
                        const idStr = String(prospect.id_prospect || "");

                        // Priority Mapping Logic for Name/Company
                        const company = raw.Titre || raw.title || deep.nom_raison_sociale || "Société Inconnue";
                        const category = raw["Nom de catégorie"] || "N/A";

                        const city = prospect.ville || raw.address;

                        // Email Logic
                        // 1. Verified email first
                        // 2. Scraped email second
                        let email = null;
                        if (prospect.email_adresse_verified && prospect.email_adresse_verified.length > 0) {
                            email = Array.isArray(prospect.email_adresse_verified) ? prospect.email_adresse_verified[0] : prospect.email_adresse_verified;
                        } else if (raw.Email) {
                            email = raw.Email;
                        } else if (deep.emails && deep.emails.length > 0) {
                            email = deep.emails[0];
                        }

                        const phone = raw["Téléphone"] || raw.phone;

                        return (
                            <TableRow
                                key={idStr}
                                className="cursor-pointer hover:bg-muted/50 transition-colors pointer-events-auto"
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    router.push(`/prospects/${idStr}`)
                                }}
                            >
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        {company}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        {category}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {email ? (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Mail className="h-3 w-3 text-primary" />
                                                <span className="truncate max-w-[150px]">{email}</span>
                                            </div>
                                        ) : <span className="text-xs text-muted-foreground">-</span>}

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
                                    <Button variant="ghost" size="icon" onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/prospects/${idStr}`);
                                    }}>
                                        <MoreHorizontal className="h-4 w-4" />
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
