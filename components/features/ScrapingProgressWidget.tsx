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
    onComplete?: () => void
}

export function ScrapingProgressWidget({ jobId, maxResults, onComplete }: ScrapingProgressWidgetProps) {
    const router = useRouter()
    const supabase = createClient()

    // Core state
    const [status, setStatus] = useState<string>('running') // Start as running immediately  
    const [prospectCount, setProspectCount] = useState(0)
    const [emailCount, setEmailCount] = useState(0)
    const [deepSearchCount, setDeepSearchCount] = useState(0)
    const [progress, setProgress] = useState(0)
    const [confettiTriggered, setConfettiTriggered] = useState(false)

    // Refs for cleanup
    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const mountedRef = useRef(true)

    // Optimized stats calculation from prospects array
    const calculateStats = useCallback((prospects: any[]) => {
        if (!mountedRef.current) return

        const count = prospects.length
        setProspectCount(count)

        // Count emails
        const emails = prospects.filter(p => {
            if (p.email_adresse_verified === true) return true
            if (p.data_scrapping) {
                try {
                    const data = typeof p.data_scrapping === 'string'
                        ? JSON.parse(p.data_scrapping)
                        : p.data_scrapping
                    if (data.Email) return true
                } catch { return false }
            }
            return false
        }).length
        setEmailCount(emails)

        // Count enriched (deep search)
        const deep = prospects.filter(p => {
            if (!p.deep_search) return false
            try {
                const data = typeof p.deep_search === 'string'
                    ? JSON.parse(p.deep_search)
                    : p.deep_search
                return Object.keys(data).length > 0
            } catch { return false }
        }).length
        setDeepSearchCount(deep)

        // Calculate progress based on prospects found
        const progressValue = count > 0
            ? Math.min(Math.round((count / maxResults) * 100), 98)
            : 5 // Show at least 5% when job started
        setProgress(progressValue)
    }, [maxResults])

    // OPTIMIZED: Fetch stats with minimal columns
    const fetchStats = useCallback(async () => {
        if (!mountedRef.current) return

        try {
            const { data: prospects, error } = await supabase
                .from('scrape_prospect')
                .select('id_prospect, email_adresse_verified, data_scrapping, deep_search')
                .eq('id_jobs', String(jobId))

            if (error) {
                console.error('[Widget] Error fetching prospects:', error)
                return
            }

            if (prospects && mountedRef.current) {
                calculateStats(prospects)
            }
        } catch (err) {
            console.error('[Widget] fetchStats error:', err)
        }
    }, [jobId, supabase, calculateStats])

    // OPTIMIZED: Check job status
    const checkJobStatus = useCallback(async () => {
        if (!mountedRef.current) return

        try {
            const { data: job, error } = await supabase
                .from('scrape_jobs')
                .select('statut')
                .eq('id_jobs', String(jobId))
                .single()

            if (error) {
                console.error('[Widget] Error fetching job status:', error)
                return
            }

            if (job && mountedRef.current) {
                console.log('[Widget] Job status:', job.statut)

                if (['done', 'ALLfinish'].includes(job.statut)) {
                    setStatus('completed')
                    setProgress(100)
                    if (onComplete) onComplete()
                    return true // Signal completion
                } else if (job.statut === 'error') {
                    setStatus('error')
                    toast.error("Erreur de scraping")
                    return true // Signal completion (error)
                } else if (job.statut === 'queued') {
                    setStatus('queued')
                } else {
                    setStatus('running')
                }
            }
            return false // Not completed yet
        } catch (err) {
            console.error('[Widget] checkJobStatus error:', err)
            return false
        }
    }, [jobId, supabase, onComplete])

    // IMMEDIATE: Fetch data on mount
    useEffect(() => {
        mountedRef.current = true

        // Immediate first fetch
        const init = async () => {
            await Promise.all([checkJobStatus(), fetchStats()])
        }
        init()

        return () => {
            mountedRef.current = false
        }
    }, [checkJobStatus, fetchStats])

    // REALTIME: Subscribe to both job and prospect changes
    useEffect(() => {
        const jobIdStr = String(jobId)

        // Job status subscription
        const jobChannel = supabase
            .channel(`widget_job_${jobIdStr}`)
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'scrape_jobs',
                    filter: `id_jobs=eq.${jobIdStr}`
                },
                (payload) => {
                    const newStatus = payload.new?.statut
                    console.log('[Widget] Realtime job update:', newStatus)

                    if (['done', 'ALLfinish'].includes(newStatus)) {
                        setStatus('completed')
                        setProgress(100)
                        fetchStats() // Final stats fetch
                        if (onComplete) onComplete()
                    } else if (newStatus === 'error') {
                        setStatus('error')
                        toast.error("Erreur de scraping")
                    } else if (newStatus === 'running') {
                        setStatus('running')
                    }
                }
            )
            .subscribe()

        // Prospect inserts/updates subscription
        const prospectChannel = supabase
            .channel(`widget_prospects_${jobIdStr}`)
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'scrape_prospect',
                    filter: `id_jobs=eq.${jobIdStr}`
                },
                () => {
                    console.log('[Widget] Realtime prospect update')
                    fetchStats() // Refresh stats on any prospect change
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(jobChannel)
            supabase.removeChannel(prospectChannel)
        }
    }, [jobId, supabase, fetchStats, onComplete])

    // POLLING FALLBACK: Poll every 3s until complete (realtime backup)
    useEffect(() => {
        if (status === 'completed' || status === 'error') {
            // Clear polling if complete
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
            }
            return
        }

        // Start polling as backup for realtime
        pollingRef.current = setInterval(async () => {
            if (!mountedRef.current) return

            const isComplete = await checkJobStatus()
            if (!isComplete) {
                await fetchStats()
            }
        }, 3000) // Poll every 3 seconds

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
            }
        }
    }, [status, checkJobStatus, fetchStats])

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
        if (status === 'running') return "Scraping en cours"
        if (status === 'completed') return "✨ Scraping terminé !"
        if (status === 'error') return "Erreur survenue"
        return "Scraping en cours" // Default to running
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
                {/* Animated shimmer on top */}
                {(status === 'running' || status === 'queued') && (
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r 
                                    from-transparent via-indigo-500 to-transparent 
                                    animate-shimmer opacity-75" />
                )}

                {/* Success pulse */}
                {status === 'completed' && (
                    <motion.div
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.05, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: 2 }}
                        className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-lg pointer-events-none"
                    />
                )}

                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            {(status === 'running' || status === 'queued') && (
                                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                            )}
                            {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}

                            <motion.span
                                key={status}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="truncate"
                            >
                                {getStatusText()}
                            </motion.span>
                        </CardTitle>

                        <AIBadge>Deep Search</AIBadge>
                    </div>
                    <CardDescription className="text-base">
                        {status === 'queued' ? "Votre recherche est dans la file d'attente." :
                            status === 'completed' ? "🎉 Données enrichies et prêtes !" :
                                "Récupération et enrichissement des données en temps réel."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Gradient Progress Bar */}
                    <div className="space-y-2">
                        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 
                                           rounded-full shadow-lg shadow-indigo-300/50"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                            {(status === 'running' || status === 'queued') && (
                                <motion.div
                                    className="absolute inset-y-0 w-20 bg-white/40 blur-sm"
                                    animate={{ x: ['-100%', '500%'] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                />
                            )}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>{prospectCount} / {maxResults} prospects</span>
                            <span className="text-indigo-600 font-bold">{progress}%</span>
                        </div>
                    </div>

                    {/* Animated Stats with CountUp */}
                    <div className="grid grid-cols-3 gap-3">
                        <StatBox
                            icon={Search}
                            value={prospectCount}
                            label="Prospects"
                            gradient="from-blue-500 to-indigo-600"
                        />
                        <StatBox
                            icon={Mail}
                            value={emailCount}
                            label="Emails"
                            gradient="from-cyan-500 to-blue-600"
                        />
                        <StatBox
                            icon={Eye}
                            value={deepSearchCount}
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

// Enhanced StatBox with gradient and CountUp
function StatBox({ icon: Icon, value, label, gradient }: { icon: any, value: number, label: string, gradient: string }) {
    return (
        <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            className="relative flex flex-col items-center justify-center p-4 rounded-xl 
                       bg-white border-2 border-gray-200 
                       hover:border-indigo-300 hover:shadow-lg 
                       transition-all duration-300 overflow-hidden group"
        >
            {/* Gradient background on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 
                           group-hover:opacity-10 transition-opacity`} />

            <Icon className={`h-5 w-5 mb-2 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`} />
            <motion.span
                key={value}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
            >
                <CountUp end={value} duration={0.8} preserveValue />
            </motion.span>
            <span className="text-xs text-muted-foreground font-medium mt-1">{label}</span>
        </motion.div>
    )
}
