"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Terminal, ShieldCheck, CheckCircle, XCircle, AlertCircle, History } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface JobHistory {
    id: string
    created_at: string
    status: string
    total_emails: number
    id_user: string
}

export default function EmailVerifierPage() {
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [parsedEmails, setParsedEmails] = useState<string[]>([])
    const [history, setHistory] = useState<JobHistory[]>([])
    const [results, setResults] = useState<any[]>([])
    const [currentJobId, setCurrentJobId] = useState<string | null>(null)
    const [filterText, setFilterText] = useState("")

    // Parse emails in real-time or just before submit
    useEffect(() => {
        // Simple regex or split logic
        const emails = input
            .split(/[\s,;\n]+/) // Split by whitespace, comma, semicolon, newline
            .map(e => e.trim())
            .filter(e => e.length > 0 && e.includes('@')) // Basic filter
        setParsedEmails(emails)
    }, [input])

    // Load history on mount
    useEffect(() => {
        loadHistory()
    }, [])

    // Realtime subscription for results
    useEffect(() => {
        if (!currentJobId) return

        const supabase = createClient()
        const channel = supabase
            .channel(`job-${currentJobId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'email_verification_results',
                    filter: `id_job=eq.${currentJobId}`
                },
                (payload) => {
                    setResults(prev => [...prev, payload.new])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentJobId])

    const loadHistory = async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('email_verification_jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        if (data) setHistory(data)
    }

    const loadJobDetails = async (jobId: string) => {
        setLoading(true)
        setCurrentJobId(jobId)
        setFilterText("")

        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('email_verification_results')
                .select('*')
                .eq('id_job', jobId)
                .order('created_at', { ascending: true })

            if (error) throw error
            setResults(data || [])
            toast.success("Détails chargés")
        } catch (e) {
            console.error(e)
            toast.error("Impossible de charger le détail")
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async () => {
        if (parsedEmails.length === 0) return
        setLoading(true)
        setResults([])
        setCurrentJobId(null)
        setFilterText("")

        try {
            const response = await fetch('/api/email-verifier/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails: parsedEmails })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Erreur lors de la vérification")
            }

            toast.success(`Vérification lancée pour ${parsedEmails.length} emails`)
            setCurrentJobId(data.jobId)

            // Refresh history immediately to show "pending" job
            loadHistory()
            setLoading(false)

        } catch (error: any) {
            console.error("Verification error:", error)
            toast.error(error.message)
            setLoading(false)
        }
    }

    const filteredResults = results.filter(r =>
        r.email_checked.toLowerCase().includes(filterText.toLowerCase()) ||
        (r.status && r.status.toLowerCase().includes(filterText.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Vérificateur d'Emails</h1>
                <p className="text-muted-foreground mt-1">
                    Vérifiez la validité de vos adresses emails en temps réel.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Adresses à vérifier</CardTitle>
                            <CardDescription>
                                Copiez-collez vos emails ci-dessous. Doublons supprimés automatiquement.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="louis@outlook.fr&#10;contact@entreprise.com&#10;..."
                                className="min-h-[150px] font-mono"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading || !!currentJobId}
                            />
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>{parsedEmails.length} email(s) détecté(s)</span>
                                {parsedEmails.length > 0 && (
                                    <span className={parsedEmails.length > 100 ? "text-orange-500" : "text-green-500"}>
                                        {parsedEmails.length > 100 ? "Volume important" : "Prêt"}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter>
                            {currentJobId ? (
                                <Button className="w-full" variant="secondary" onClick={() => { setCurrentJobId(null); setInput(""); setResults([]); setFilterText("") }}>
                                    Nouvelle vérification
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleVerify}
                                    disabled={loading || parsedEmails.length === 0}
                                    className="w-full sm:w-auto"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Lancement...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="mr-2 h-4 w-4" />
                                            Lancer le test ({parsedEmails.length} crédits)
                                        </>
                                    )}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>

                    {/* Results Area */}
                    {(currentJobId || results.length > 0) && (
                        <Card className="border-primary/20">
                            <CardHeader className="pb-3 border-b">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-5 w-5 text-primary" />
                                            Résultats
                                        </div>
                                        <Badge variant="outline" className="font-mono ml-2">
                                            {results.length} traité(s)
                                        </Badge>
                                    </CardTitle>

                                    {/* Filter Input */}
                                    <input
                                        type="text"
                                        placeholder="Filtrer par email..."
                                        className="text-sm border rounded px-3 py-1 bg-background"
                                        value={filterText}
                                        onChange={(e) => setFilterText(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-muted-foreground bg-muted/50 uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Email</th>
                                                <th className="px-4 py-3 font-medium text-center">Statut</th>
                                                <th className="px-4 py-3 font-medium text-right">Détails</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.length === 0 && loading && (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                                                        Chargement...
                                                    </td>
                                                </tr>
                                            )}
                                            {filteredResults.map((res) => (
                                                <tr key={res.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                                    <td className="px-4 py-3 font-mono text-xs">{res.email_checked}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {res.is_valid ? (
                                                            <Badge className="bg-green-600 hover:bg-green-700">Valide</Badge>
                                                        ) : (
                                                            <Badge variant="destructive">Invalide</Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                                                        {res.status || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredResults.length === 0 && results.length > 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                                        Aucun résultat pour "{filterText}"
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column: History */}
                <div className="md:col-span-1">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5" />
                                Historique
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {history.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Aucun historique récent</p>
                                ) : (
                                    history.map((job) => (
                                        <div
                                            key={job.id}
                                            className="flex items-start justify-between border-b pb-3 last:border-0 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                                            onClick={() => loadJobDetails(job.id)}
                                        >
                                            <div>
                                                <div className="font-medium text-sm">
                                                    {job.total_emails} email{job.total_emails > 1 ? 's' : ''}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {format(new Date(job.created_at), "d MMM HH:mm", { locale: fr })}
                                                </div>
                                            </div>
                                            <div>
                                                {job.status === 'completed' && <Badge variant="default" className="bg-green-600 text-[10px]">Terminé</Badge>}
                                                {job.status === 'pending' && <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-[10px]">En cours</Badge>}
                                                {job.status === 'failed' && <Badge variant="destructive" className="text-[10px]">Erreur</Badge>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
