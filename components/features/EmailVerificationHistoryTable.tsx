"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Eye } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"

type Job = {
    id: string
    created_at: string
    status: string
    total_emails: number
    id_user: string
    estimated_cost: number
}

type Result = {
    id: string
    email_checked: string
    is_valid: boolean
    status: string
}

export function EmailVerificationHistoryTable() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
    const [jobDetails, setJobDetails] = useState<Result[]>([])
    const [loadingDetails, setLoadingDetails] = useState(false)

    const fetchJobs = async () => {
        setLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('email_verification_jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        if (data) setJobs(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchJobs()
    }, [])

    const loadDetails = async (jobId: string) => {
        setLoadingDetails(true)
        setSelectedJobId(jobId)
        const supabase = createClient()
        const { data } = await supabase
            .from('email_verification_results')
            .select('*')
            .eq('id_job', jobId)
            .order('is_valid', { ascending: false }) // Valid first
        
        if (data) setJobDetails(data)
        setLoadingDetails(false)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Emails Vérifiés</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && jobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : jobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    Aucune vérification effectuée pour le moment.
                                </TableCell>
                            </TableRow>
                        ) : (
                            jobs.map((job) => (
                                <TableRow key={job.id}>
                                    <TableCell>
                                        {format(new Date(job.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{job.total_emails}</div>
                                        <div className="text-xs text-muted-foreground">Coût estimé: {job.estimated_cost || job.total_emails} crédits</div>
                                    </TableCell>
                                    <TableCell>
                                        {job.status === 'completed' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">Terminé</Badge>}
                                        {job.status === 'pending' && <Badge variant="outline" className="border-yellow-500 text-yellow-600">En cours</Badge>}
                                        {job.status === 'failed' && <Badge variant="destructive">Erreur</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button size="sm" variant="ghost" onClick={() => loadDetails(job.id)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                                                <DialogHeader>
                                                    <DialogTitle>Détails de la vérification</DialogTitle>
                                                </DialogHeader>
                                                <div className="flex-1 overflow-y-auto pr-2">
                                                    {loadingDetails ? (
                                                        <div className="py-8 flex justify-center">
                                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {jobDetails.map((res) => (
                                                                <div key={res.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                                                                    <span className="font-mono">{res.email_checked}</span>
                                                                    {res.is_valid ? (
                                                                        <Badge className="bg-green-600">Valide</Badge>
                                                                    ) : (
                                                                        <Badge variant="destructive">Invalide</Badge>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
