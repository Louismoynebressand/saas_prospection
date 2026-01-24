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
    const [consoleOutput, setConsoleOutput] = useState<string | null>(null)
    const [parsedEmails, setParsedEmails] = useState<string[]>([])
    const [history, setHistory] = useState<JobHistory[]>([])

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

    const loadHistory = async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('email_verification_jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        if (data) setHistory(data)
    }

    const handleVerify = async () => {
        if (parsedEmails.length === 0) return
        setLoading(true)
        setConsoleOutput(null)

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

            setConsoleOutput(JSON.stringify(data.webhookResponse || { message: "Succès" }, null, 2))
            toast.success("Vérification lancée avec succès !")

            // Refresh history
            loadHistory()
        } catch (error: any) {
            console.error("Verification error:", error)
            setConsoleOutput(`Error: ${error.message}`)
            toast.error("Erreur lors du lancement de la vérification")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Vérificateur d'Emails</h1>
                <p className="text-muted-foreground mt-1">
                    Vérifiez la validité de vos adresses emails en temps réel.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Input */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Adresses à vérifier</CardTitle>
                            <CardDescription>
                                Copiez-collez vos emails ci-dessous (séparés par des espaces, virgules ou sauts de ligne).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="louis@outlook.fr&#10;contact@entreprise.com&#10;..."
                                className="min-h-[200px] font-mono"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>{parsedEmails.length} email(s) détecté(s)</span>
                                {parsedEmails.length > 0 && (
                                    <span className={parsedEmails.length > 100 ? "text-orange-500" : "text-green-500"}>
                                        {parsedEmails.length > 100 ? "Attention : gros volume" : "Prêt à vérifier"}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                onClick={handleVerify}
                                disabled={loading || parsedEmails.length === 0}
                                className="w-full sm:w-auto"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Vérification en cours...
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-4 w-4" />
                                        Lancer le test
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Console Output */}
                    <Card className="bg-slate-950 text-slate-50 border-slate-800">
                        <CardHeader className="pb-3 border-b border-slate-800">
                            <CardTitle className="text-sm font-mono flex items-center gap-2">
                                <Terminal className="h-4 w-4" />
                                Console
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <pre className="font-mono text-xs overflow-auto max-h-[300px] whitespace-pre-wrap">
                                {consoleOutput || "// Les résultats s'afficheront ici..."}
                            </pre>
                        </CardContent>
                    </Card>
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
                                        <div key={job.id} className="flex items-start justify-between border-b pb-3 last:border-0">
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
