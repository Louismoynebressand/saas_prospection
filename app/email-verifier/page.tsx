"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Terminal, ShieldCheck, CheckCircle, XCircle, AlertCircle, History, RefreshCw } from "lucide-react"
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
    estimated_cost: number
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white shadow-2xl">
                <div className="relative z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">
                        Vérificateur d'Emails <span className="text-violet-200">Pro</span>
                    </h1>
                    <p className="text-violet-100 max-w-xl text-lg opacity-90">
                        Nettoyez vos listes de contacts avec notre algorithme de validation en temps réel. Fiabilité maximale.
                    </p>
                </div>
                {/* Abstract Shapes */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-black/10 blur-2xl"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Input Zone - Modern Card */}
                <Card className="lg:col-span-2 border-0 shadow-lg ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500"></div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-violet-500" />
                            Zone de Check
                        </CardTitle>
                        <CardDescription>
                            Copiez vos emails ici. Détection auto des doublons.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Textarea
                                placeholder="exemple@gmail.com&#10;contact@startup.io&#10;ceo@tesla.com"
                                className="min-h-[200px] font-mono text-sm resize-y bg-slate-50 dark:bg-slate-900/50 border-input focus:ring-violet-500"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading || !!currentJobId}
                            />
                            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded shadow-sm border">
                                {parsedEmails.length} détecté(s)
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center py-4">
                        <div className="text-xs text-muted-foreground">
                            Coût estimé : <span className="font-bold text-foreground">{parsedEmails.length} crédits</span>
                        </div>
                        {currentJobId ? (
                            <Button
                                variant="secondary"
                                onClick={() => { setCurrentJobId(null); setInput(""); setResults([]); setFilterText("") }}
                                className="hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Nouveau Test
                            </Button>
                        ) : (
                            <Button
                                onClick={handleVerify}
                                disabled={loading || parsedEmails.length === 0}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02]"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Traitement...
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-4 w-4 fill-current" />
                                        Lancer l'Analyse
                                    </>
                                )}
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                {/* Quick Stats / Info Widget */}
                <div className="space-y-6">
                    <Card className="border-0 shadow-md bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                        <CardHeader>
                            <CardTitle className="text-lg">Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300">Jobs Récents</span>
                                <span className="font-bold text-2xl">{history.length}</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-400 w-3/4"></div>
                            </div>
                            <p className="text-xs text-slate-400">
                                Vos crédits sont débités uniquement pour les vérifications réussies.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Mini History List */}
                    <Card className="border shadow-sm h-[300px] flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Récents
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto pr-2 space-y-2 pt-2">
                            {history.length === 0 ? (
                                <p className="text-sm text-center text-muted-foreground py-8">Vide</p>
                            ) : (
                                history.map(job => (
                                    <div
                                        key={job.id}
                                        onClick={() => loadJobDetails(job.id)}
                                        className="group flex flex-col gap-1 p-3 rounded-lg border hover:border-violet-500/50 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 cursor-pointer transition-all"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm">{job.total_emails} emails</span>
                                            {job.status === 'completed' ? (
                                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                            ) : (
                                                <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                            {format(new Date(job.created_at), "d MMM, HH:mm", { locale: fr })}
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Results Section (Full Width) */}
            {(currentJobId || results.length > 0) && (
                <Card className="border-0 shadow-xl overflow-hidden animate-slide-up">
                    <div className="h-1 bg-gradient-to-r from-emerald-400 to-cyan-400"></div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 dark:bg-slate-900/50">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                Résultats d'Analyse
                            </CardTitle>
                            <CardDescription>
                                {results.length} email(s) traités sur {parsedEmails.length > 0 ? parsedEmails.length : results.length}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                className="text-sm border rounded-full px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 transition-all"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-muted/30 sticky top-0 backdrop-blur-sm z-10 text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Email Adresse</th>
                                        <th className="px-6 py-4 font-semibold text-center">Diagnostic</th>
                                        <th className="px-6 py-4 font-semibold text-right">Métadonnées</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredResults.map((res) => (
                                        <tr key={res.id} className="hover:bg-muted/10 transition-colors group">
                                            <td className="px-6 py-3 font-mono text-sm text-foreground/80 group-hover:text-violet-600 transition-colors">
                                                {res.email_checked}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {res.is_valid ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Valide
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                                        <XCircle className="w-3 h-3 mr-1" />
                                                        Invalide
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right text-xs text-muted-foreground font-mono">
                                                {res.status || "N/A"}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredResults.length === 0 && results.length > 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                                                Aucun résultat ne correspond à la recherche.
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
    )
}
