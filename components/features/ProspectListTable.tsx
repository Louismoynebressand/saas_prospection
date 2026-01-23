"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MoreHorizontal, Mail, Phone, Building2, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ScrapeProspect } from "@/types"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

export function ProspectListTable({ searchId }: { searchId: string }) {
    const [prospects, setProspects] = useState<Prospect[]>([])
    const [loading, setLoading] = useState(true)

    const fetchProspects = async () => {
        try {
            const { data, error } = await supabase
                .from('prospects')
                .select('*')
                .eq('search_id', searchId)
                .order('created_at', { ascending: false })

            if (error) throw error
            if (data) setProspects(data as Prospect[])
        } catch (error) {
            console.error('Error fetching prospects:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProspects()

        const subscription = supabase
            .channel(`prospects_list_${searchId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'prospects',
                filter: `search_id=eq.${searchId}`
            }, (payload) => {
                // Insert new prospect at the top
                setProspects(prev => [payload.new as Prospect, ...prev])
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [searchId])

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
                Aucun prospect trouvé pour cette recherche.
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
                    {prospects.map((prospect) => (
                        <TableRow key={prospect.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    {prospect.full_name || "N/A"}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    {prospect.company || "N/A"}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    {prospect.emails && prospect.emails.length > 0 && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Mail className="h-3 w-3" />
                                            {prospect.emails[0]}
                                        </div>
                                    )}
                                    {prospect.phones && prospect.phones.length > 0 && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Phone className="h-3 w-3" />
                                            {prospect.phones[0]}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>{prospect.city}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/prospects/${prospect.id}`}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
