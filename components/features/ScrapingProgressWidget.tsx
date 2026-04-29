"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import CountUp from "react-countup"
import confetti from "canvas-confetti"
import { Button } from "@/components/ui/button"
import { AIBadge } from "@/components/ui/ai-badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, CheckCircle2, Search, Mail, Eye, ArrowRight, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface ScrapingProgressWidgetProps {
    jobId: string | number
    maxResults: number
    enrichmentEnabled?: boolean
    onComplete?: () => void
}

export function ScrapingProgressWidget({ jobId, maxResults, enrichmentEnabled = true, onComplete }: ScrapingProgressWidgetProps) {
    const router = useRouter()
    const supabase = createClient()

    // Core state - Start as 'running' for immediate feedback
    const [status, setStatus] = useState<string>('running')
    // Stats
    const [stats, setStats] = useState({
        prospects: 0,
        emails: 0,
        enriched: 0
    })

    // Progress - time-based simulation + real data
    const [progress, setProgress] = useState(3) // Start at 3% visually
    const [confettiTriggered, setConfettiTriggered] = useState(false)

    // Estimated total time in seconds based on params
    // ~45s per result with deep search, ~12s without
    const estimatedSeconds = enrichmentEnabled
        ? Math.max(60, maxResults * 45)
        : Math.max(20, maxResults * 12)

    // Refs
    const mountedRef = useRef(true)
    const simulatedProgressRef = useRef(3) // track simulated value without re-renders
    const startTimeRef = useRef(Date.now())

    // OPTIMIZED: Fetch stats using COUNT queries (Fast & Accurate like KPI cards)
    const fetchStats = useCallback(async () => {
        if (!mountedRef.current) return

        try {
            const jobIdStr = String(jobId)

            // 1. Count Prospects
            const { count: prospectsCount } = await supabase
                .from('scrape_prospect')
                .select('*', { count: 'exact', head: true })
                .eq('id_jobs', jobIdStr)

            // 2. Count Emails (where email_adresse_verified is not null)
            const { count: emailsCount } = await supabase
                .from('scrape_prospect')
                .select('*', { count: 'exact', head: true })
                .eq('id_jobs', jobIdStr)
                .not('email_adresse_verified', 'is', null)

            // 3. Count Enriched (where deep_search is not null)
            const { count: enrichedCount } = await supabase
                .from('scrape_prospect')
                .select('*', { count: 'exact', head: true })
                .eq('id_jobs', jobIdStr)
                .not('deep_search', 'is', null)

            if (mountedRef.current) {
                const currentProspects = prospectsCount || 0
                setStats({
                    prospects: currentProspects,
                    emails: emailsCount || 0,
                    enriched: enrichedCount || 0
                })

                // Real data progress (based on actual prospects found)
                const realProgress = maxResults > 0
                    ? Math.round((currentProspects / maxResults) * 100)
                    : 0

                // Use whichever is higher: simulated or real data
                // Never go above 98% until actually complete
                if (status !== 'completed' && status !== 'done' && status !== 'ALLfinish') {
                    const combined = Math.max(simulatedProgressRef.current, realProgress)
                    setProgress(Math.min(combined, 98))
                } else {
                    setProgress(100)
                }
            }
        } catch (err) {
            console.error('[Widget] fetchStats error:', err)
        }
    }, [jobId, supabase, maxResults, status])

    // Check Job Status
    const checkJobStatus = useCallback(async () => {
        if (!mountedRef.current) return

        try {
            const { data: job, error } = await supabase
                .from('scrape_jobs')
                .select('statut')
                .eq('id_jobs', String(jobId))
                .single()

            if (error) throw error

            if (job && mountedRef.current) {
                if (['done', 'ALLfinish'].includes(job.statut)) {
                    setStatus('completed')
                    setProgress(100)
                    if (onComplete) onComplete()
                } else if (job.statut === 'error') {
                    setStatus('error')
                } else {
                    setStatus(job.statut)
                }
            }
        } catch (err) {
            console.error('[Widget] Status check error:', err)
        }
    }, [jobId, supabase, onComplete])

    // TIME-BASED SIMULATION: advance progress bar smoothly over estimated duration
    useEffect(() => {
        if (status === 'completed' || status === 'error') return

        const interval = setInterval(() => {
            if (!mountedRef.current || status === 'completed' || status === 'error') {
                clearInterval(interval)
                return
            }
            const elapsed = (Date.now() - startTimeRef.current) / 1000
            // Use easing: slow start, accelerating, then plateauing at 92%
            // Formula: 92 * (1 - e^(-3 * elapsed / estimatedSeconds))
            const simulated = Math.min(92, Math.round(92 * (1 - Math.exp(-3 * elapsed / estimatedSeconds))))
            simulatedProgressRef.current = simulated
            setProgress(prev => Math.max(prev, simulated)) // never go backward
        }, 1000)

        return () => clearInterval(interval)
    }, [status, estimatedSeconds])

    // Initial Mount
    useEffect(() => {
        mountedRef.current = true
        fetchStats()
        checkJobStatus()

        // POLLING BACKUP (Every 2s)
        const interval = setInterval(() => {
            if (mountedRef.current && status !== 'completed' && status !== 'error') {
                checkJobStatus()
                fetchStats()
            }
        }, 2000)

        return () => {
            mountedRef.current = false
            clearInterval(interval)
        }
    }, [fetchStats, checkJobStatus, status])

    // REALTIME SUBSCRIPTION
    useEffect(() => {
        const jobIdStr = String(jobId)

        // Listen to prospect changes
        const prospectSub = supabase
            .channel(`widget_prospects_${jobIdStr}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'scrape_prospect', filter: `id_jobs=eq.${jobIdStr}` },
                () => {
                    fetchStats()
                }
            )
            .subscribe()

        // Listen to job status changes
        const jobSub = supabase
            .channel(`widget_job_${jobIdStr}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'scrape_jobs', filter: `id_jobs=eq.${jobIdStr}` },
                (payload: any) => {
                    const newStatus = payload.new?.statut
                    if (['done', 'ALLfinish'].includes(newStatus)) {
                        setStatus('completed')
                        setProgress(100)
                        fetchStats()
                        if (onComplete) onComplete()
                    } else if (newStatus === 'error') {
                        setStatus('error')
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(prospectSub)
            supabase.removeChannel(jobSub)
        }
    }, [jobId, supabase, fetchStats, onComplete])

    // Confetti on completion
    useEffect(() => {
        if (status === 'completed' && !confettiTriggered) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#22c55e', '#10b981', '#4ade80']
            })
            setConfettiTriggered(true)
        }
    }, [status, confettiTriggered])

    const handleViewDetails = () => router.push(`/searches/${jobId}`)

    const getStatusText = () => {
        if (status === 'queued') return "En attente de prise en charge..."
        if (status === 'completed') return "✨ Scraping terminé !"
        if (status === 'error') return "Erreur survenue"
        return "Scraping en cours"
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card className="w-full relative overflow-hidden border-2 
                           border-primary/20 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 
                           shadow-xl hover:shadow-2xl transition-shadow">
                {(status !== 'completed' && status !== 'error') && (
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r 
                                    from-transparent via-indigo-500 to-transparent 
                                    animate-shimmer opacity-75" />
                )}

                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            {(status !== 'completed' && status !== 'error') && (
                                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                            )}
                            {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}

                            <span className="truncate">{getStatusText()}</span>
                        </CardTitle>
                        <AIBadge>Deep Search</AIBadge>
                    </div>
                    <CardDescription className="text-base">
                        {status === 'completed'
                            ? "🎉 Données enrichies et prêtes !"
                            : "Récupération et enrichissement des données en temps réel."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full shadow-lg"
                                initial={{ width: "5%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>{stats.prospects} / {maxResults} prospects</span>
                            <span className="text-indigo-600 font-bold">{progress}%</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <StatBox
                            icon={Search}
                            value={stats.prospects}
                            label="Prospects"
                            gradient="from-blue-500 to-indigo-600"
                        />
                        <StatBox
                            icon={Mail}
                            value={stats.emails}
                            label="Emails"
                            gradient="from-cyan-500 to-blue-600"
                        />
                        <StatBox
                            icon={Eye}
                            value={stats.enriched}
                            label="Enrichis"
                            gradient="from-purple-500 to-pink-600"
                        />
                    </div>
                </CardContent>

                <CardFooter>
                    <Button
                        className={`w-full h-12 transition-all duration-300 ${status === 'completed'
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                            }`}
                        onClick={handleViewDetails}
                    >
                        {status === 'completed' ? (
                            <>
                                <Sparkles className="mr-2 h-5 w-5" />
                                Voir les résultats
                            </>
                        ) : (
                            <>
                                Voir les résultats
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    )
}

function StatBox({ icon: Icon, value, label, gradient }: { icon: any, value: number, label: string, gradient: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-4 rounded-xl 
                       bg-white border-2 border-gray-200 hover:border-indigo-300 transition-all">
            <Icon className={`h-5 w-5 mb-2 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`} />
            <span className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                <CountUp end={value} duration={1} preserveValue />
            </span>
            <span className="text-xs text-muted-foreground font-medium mt-1">{label}</span>
        </div>
    )
}
