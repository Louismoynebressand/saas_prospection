"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, Search, Mail, Eye, ArrowRight } from "lucide-react"
import { toast } from "sonner"

interface ScrapingProgressWidgetProps {
    jobId: string | number
    maxResults: number
    onComplete?: () => void
}

export function ScrapingProgressWidget({ jobId, maxResults, onComplete }: ScrapingProgressWidgetProps) {
    const router = useRouter()
    const [status, setStatus] = useState<string>('initializing') // initializing, running, completed, error
    const [prospectCount, setProspectCount] = useState(0)
    const [emailCount, setEmailCount] = useState(0)
    const [deepSearchCount, setDeepSearchCount] = useState(0)
    const [progress, setProgress] = useState(0)

    // Pour détecter si le scraping a vraiment démarré (première donnée reçue)
    const [hasStarted, setHasStarted] = useState(false)

    useEffect(() => {
        // Initialiser la souscription Realtime
        console.log(`[Widget] Subscribing to job ${jobId}`)

        // 1. Souscription aux changements du Job (Statut global)
        const jobSubscription = supabase
            .channel(`job_status_${jobId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'scrape_jobs',
                filter: `id_jobs=eq.${jobId}`
            }, (payload) => {
                const newStatus = payload.new.statut
                if (newStatus === 'done' || newStatus === 'ALLfinish') {
                    setStatus('completed')
                    setProgress(100)
                    if (onComplete) onComplete()
                } else if (newStatus === 'error') {
                    setStatus('error')
                    toast.error("Une erreur est survenue pendant le scraping")
                }
            })
            .subscribe()

        // 2. Souscription aux apparitions de prospects (Progression)
        const prospectSubscription = supabase
            .channel(`job_prospects_${jobId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'scrape_prospect',
                filter: `id_jobs=eq.${jobId}` // Note: id_jobs est une string/text dans cette table selon le schéma
            }, (payload) => {
                // Dès qu'on reçoit un prospect, le scraping a démarré
                if (!hasStarted) setHasStarted(true)
                if (status === 'initializing') setStatus('running')

                const newProspect = payload.new
                setProspectCount(prev => prev + 1)

                // Vérifier si des emails ou deepsearch sont présents
                const hasEmail = newProspect.email_adresse_verified ||
                    (newProspect.data_scrapping && (JSON.parse(newProspect.data_scrapping).Email))

                if (hasEmail) setEmailCount(prev => prev + 1)

                const hasDeep = newProspect.deep_search && Object.keys(JSON.parse(newProspect.deep_search) || {}).length > 0
                if (hasDeep) setDeepSearchCount(prev => prev + 1)

                // Mettre à jour la progression
                // On utilise une approche optimiste : chaque prospect ajoute une portion
                // On plafonne à 95% tant que le statut n'est pas 'done'
                setProspectCount(current => {
                    const newCount = current // (déjà incrémenté par le setProspectCount isolé ?) Non, attention closure
                    // On recalcule la progress basée sur le nouveau compte théorique
                    // Mais ici on est dans le callback, utilisons la valeur locale
                    return current
                })
            })
            .subscribe()

        return () => {
            jobSubscription.unsubscribe()
            prospectSubscription.unsubscribe()
        }
    }, [jobId])

    // Update progress bar based on count
    useEffect(() => {
        const calculatedProgress = Math.min(Math.round((prospectCount / maxResults) * 100), 98)
        if (status !== 'completed') {
            setProgress(calculatedProgress)
        }
    }, [prospectCount, maxResults, status])

    const handleViewDetails = () => {
        router.push(`/searches/${jobId}`)
    }

    return (
        <Card className="w-full border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden">
            {/* Background effects */}
            {status === 'running' && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer" />
            )}

            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    {status === 'initializing' && !hasStarted && (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            Démarrage du scraping...
                        </>
                    )}
                    {(status === 'running' || hasStarted) && status !== 'completed' && (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            Scraping en cours ({Math.round(progress)}%)
                        </>
                    )}
                    {status === 'completed' && (
                        <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Scraping terminé !
                        </>
                    )}
                </CardTitle>
                <CardDescription>
                    {status === 'initializing' && !hasStarted
                        ? "Connexion aux agents de recherche..."
                        : "Récupération et enrichissement des données en temps réel."}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Progress Bar */}
                <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{prospectCount} / {maxResults} attendus</span>
                        <span>{progress}%</span>
                    </div>
                </div>

                {/* Counters Grid */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-background/50 border">
                        <Search className="h-4 w-4 mb-2 text-primary" />
                        <span className="text-2xl font-bold">{prospectCount}</span>
                        <span className="text-xs text-muted-foreground text-center">Prospects</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-background/50 border">
                        <Mail className="h-4 w-4 mb-2 text-blue-500" />
                        <span className="text-2xl font-bold">{emailCount}</span>
                        <span className="text-xs text-muted-foreground text-center">Emails</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-background/50 border">
                        <Eye className="h-4 w-4 mb-2 text-purple-500" />
                        <span className="text-2xl font-bold">{deepSearchCount}</span>
                        <span className="text-xs text-muted-foreground text-center">Enrichis</span>
                    </div>
                </div>
            </CardContent>

            <CardFooter>
                <Button
                    className="w-full"
                    variant={status === 'completed' ? "default" : "secondary"}
                    onClick={handleViewDetails}
                >
                    Voir les résultats <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    )
}
