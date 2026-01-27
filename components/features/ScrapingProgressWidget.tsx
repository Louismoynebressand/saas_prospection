"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, Search, Mail, Eye, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface ScrapingProgressWidgetProps {
    jobId: string | number
    maxResults: number
    onComplete?: () => void
}

export function ScrapingProgressWidget({ jobId, maxResults, onComplete }: ScrapingProgressWidgetProps) {
    const router = useRouter()
    const [status, setStatus] = useState<string>('initializing')
    const [prospectCount, setProspectCount] = useState(0)
    const [emailCount, setEmailCount] = useState(0)
    const [deepSearchCount, setDeepSearchCount] = useState(0)
    const [progress, setProgress] = useState(0)
    const [hasStarted, setHasStarted] = useState(false)

    // Calculate stats from a list of prospects
    const calculateStats = (prospects: any[]) => {
        setProspectCount(prospects.length)

        const emails = prospects.filter(p => {
            // Check boolean flag first, then fallback to JSON data
            if (p.email_adresse_verified === true) return true;

            // Check raw scraping data
            if (p.data_scrapping) {
                try {
                    const data = typeof p.data_scrapping === 'string' ? JSON.parse(p.data_scrapping) : p.data_scrapping;
                    if (data.Email) return true;
                } catch (e) { return false }
            }
            return false;
        }).length
        setEmailCount(emails)

        const deep = prospects.filter(p => {
            if (!p.deep_search) return false;
            try {
                const data = typeof p.deep_search === 'string' ? JSON.parse(p.deep_search) : p.deep_search;
                return Object.keys(data).length > 0;
            } catch (e) { return false }
        }).length
        setDeepSearchCount(deep)
    }

    const fetchStats = async () => {
        const { data: prospects } = await supabase
            .from('scrape_prospect')
            .select('*')
            .eq('id_jobs', jobId)

        if (prospects) calculateStats(prospects)
    }

    // Initial Load
    useEffect(() => {
        let mounted = true
        const start = async () => {
            // 1. Check Job Status
            const { data: job } = await supabase.from('scrape_jobs').select('statut').eq('id_jobs', jobId).single()
            if (job && mounted) {
                console.log("[Widget] Initial Job Status:", job.statut)
                if (['done', 'ALLfinish'].includes(job.statut)) {
                    setStatus('completed')
                } else if (job.statut === 'error') {
                    setStatus('error')
                } else {
                    // 'queued' or 'running'
                    setStatus(job.statut)
                    if (job.statut !== 'initializing') setHasStarted(true)
                }
            }
            // 2. Load Stats
            if (mounted) await fetchStats()
        }
        start()
        return () => { mounted = false }
    }, [jobId])

    // Realtime Subscriptions
    useEffect(() => {
        // Job Status Subscription
        const jobSub = supabase.channel(`job_${jobId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scrape_jobs', filter: `id_jobs=eq.${jobId}` }, (payload) => {
                const s = payload.new.statut
                console.log("[Widget] Realtime Job Update:", s)
                if (['done', 'ALLfinish'].includes(s)) {
                    setStatus('completed'); setProgress(100); if (onComplete) onComplete();
                } else if (s === 'running') {
                    setStatus('running'); setHasStarted(true);
                } else if (s === 'error') {
                    setStatus('error'); toast.error("Erreur de scraping");
                }
            })
            .subscribe()

        // Prospect Data Subscription (Insert & Update)
        const prospectSub = supabase.channel(`prospects_${jobId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scrape_prospect', filter: `id_jobs=eq.${jobId}` }, () => {
                // Optimization: Instead of full fetch on every event, we could increment. 
                // But full fetch ensures consistency for counters (Emails/Deep) which might toggle.
                // Given max 50 items, strict fetch is better for accuracy than buggy optimistic updates.
                if (!hasStarted) setHasStarted(true)
                if (status === 'queued') setStatus('running')
                fetchStats()
            })
            .subscribe()

        return () => { supabase.removeChannel(jobSub); supabase.removeChannel(prospectSub) }
    }, [jobId, hasStarted, status])

    // Progress Bar Logic
    useEffect(() => {
        if (status === 'completed') setProgress(100)
        else setProgress(Math.min(Math.round((prospectCount / maxResults) * 100), 98))
    }, [prospectCount, maxResults, status])

    const handleViewDetails = () => router.push(`/searches/${jobId}`)

    const getStatusText = () => {
        if (status === 'initializing' && !hasStarted) return "Initialisation..."
        if (status === 'queued') return "En attente de prise en charge..."
        if (status === 'running') return `Scraping en cours (${Math.round(progress)}%)`
        if (status === 'completed') return "Scraping terminé !"
        if (status === 'error') return "Erreur survenue"
        return "Chargement..."
    }

    return (
        <Card className="w-full border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden">
            {status === 'running' && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer" />
            )}
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    {['initializing', 'queued', 'running'].includes(status) && status !== 'completed' && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}

                    <motion.span
                        key={status} // Key change triggers animation
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="truncate"
                    >
                        {getStatusText()}
                    </motion.span>
                </CardTitle>
                <CardDescription>
                    {status === 'queued' ? "Votre recherche est dans la file d'attente." :
                        status === 'initializing' ? "Connexion au serveur..." :
                            "Récupération et enrichissement des données en temps réel."}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Animated Progress Bar */}
                <div className="space-y-1">
                    <Progress value={progress} className="h-2 transition-all duration-500 ease-out" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{prospectCount} / {maxResults} attendus</span>
                        <span>{progress}%</span>
                    </div>
                </div>

                {/* Animated Counters */}
                <div className="grid grid-cols-3 gap-2">
                    <StatBox
                        icon={Search}
                        value={prospectCount}
                        label="Prospects"
                        color="text-primary"
                    />
                    <StatBox
                        icon={Mail}
                        value={emailCount}
                        label="Emails"
                        color="text-blue-500"
                    />
                    <StatBox
                        icon={Eye}
                        value={deepSearchCount}
                        label="Enrichis"
                        color="text-purple-500"
                    />
                </div>
            </CardContent>

            <CardFooter>
                <Button
                    className="w-full transition-all duration-300"
                    variant={status === 'completed' ? "default" : "secondary"}
                    onClick={handleViewDetails}
                >
                    Voir les résultats <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    )
}

// Sub-component for animated numbers
function StatBox({ icon: Icon, value, label, color }: { icon: any, value: number, label: string, color: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-background/50 border transition-colors duration-300 hover:bg-background/80">
            <Icon className={`h-4 w-4 mb-2 ${color}`} />
            <motion.span
                key={value} // Trigger animation on value change
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-2xl font-bold"
            >
                {value}
            </motion.span>
            <span className="text-xs text-muted-foreground text-center">{label}</span>
        </div>
    )
}
