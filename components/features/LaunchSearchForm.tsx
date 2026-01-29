"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Rocket, Sparkles, Loader2, Zap } from "lucide-react"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { v4 as uuidv4 } from 'uuid'
import { Button } from "@/components/ui/button"
import { AIButton } from "@/components/ui/ai-button"
import { AIBadge } from "@/components/ui/ai-badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/fetch-client"
import { toast } from "sonner"
import { ScrapingProgressWidget } from "./ScrapingProgressWidget"

export function LaunchSearchForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [activeJobId, setActiveJobId] = useState<string | number | null>(null)
    const [formData, setFormData] = useState({
        query: "",
        city: "",
        maxResults: 10,
        deepScan: true,
        enrichEmails: true,
    })

    const geocodeCity = async (city: string): Promise<{ lat: number; lon: number } | null> => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", France")}&format=json&limit=1`,
                {
                    headers: {
                        'User-Agent': 'SuperProspect-App'
                    }
                }
            )
            const data = await response.json()
            if (data && data[0]) {
                return {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon)
                }
            }
            return null
        } catch (error) {
            console.error("Geocoding error:", error)
            return null
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const debugId = uuidv4()
        console.log(`[Client] Launching scrape job (debugId: ${debugId})`)

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                toast.error("Authentification requise", {
                    description: "Vous devez être connecté pour lancer une recherche"
                })
                setLoading(false)
                return
            }

            const { data: hasQuota, error: quotaCheckError } = await supabase
                .rpc('check_quota', {
                    p_user_id: user.id,
                    p_quota_type: 'scraps'
                })

            if (quotaCheckError) {
                console.error("Quota check error:", quotaCheckError)
                toast.error("Erreur de vérification", {
                    description: "Impossible de vérifier vos quotas"
                })
                setLoading(false)
                return
            }

            if (!hasQuota) {
                toast.error("Quota insuffisant", {
                    description: "Vous avez atteint votre limite mensuelle de recherches. Passez à un plan supérieur."
                })
                setLoading(false)
                return
            }

            const coords = await geocodeCity(formData.city)

            let mapsUrl: string
            if (coords) {
                mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(formData.query)}/@${coords.lat},${coords.lon},14z/data=!3m1!1e3?entry=ttu`
            } else {
                mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(formData.query + " " + formData.city + ", France")}`
            }

            const { data: newJob, error: jobError } = await supabase
                .from('scrape_jobs')
                .insert({
                    id_user: user.id,
                    statut: 'queued',
                    request_search: JSON.stringify(formData.query),
                    request_url: mapsUrl,
                    resuest_ville: formData.city,
                    request_count: formData.maxResults,
                    localisation: coords ? { lat: coords.lat, lng: coords.lon } : null,
                    deepscan: formData.deepScan,
                    enrichie_emails: formData.enrichEmails,
                    Estimate_coast: null,
                    debug_id: debugId
                })
                .select()
                .single()

            if (jobError) {
                console.error("Job creation error:", jobError)
                toast.error("Impossible de créer la recherche", {
                    description: jobError.message
                })
                setLoading(false)
                return
            }

            const payload = {
                job: {
                    id: newJob.id_jobs || newJob.id,
                    source: "google_maps",
                    mapsUrl: mapsUrl,
                    query: formData.query,
                    location: {
                        city: formData.city,
                        radiusKm: 20,
                        geo: coords ? { lat: coords.lat, lng: coords.lon } : { lat: null, lng: null }
                    },
                    limits: { maxResults: Number(formData.maxResults) },
                    options: {
                        deepScan: formData.deepScan,
                        enrichEmails: formData.enrichEmails
                    }
                },
                actor: { userId: user.id, sessionId: null },
                meta: {
                    searchId: newJob.id_jobs || newJob.id,
                    debugId
                }
            }

            try {
                const apiResponse = await authenticatedFetch('/api/scrape/launch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jobId: newJob.id_jobs || newJob.id,
                        debugId,
                        payload
                    })
                })

                const result = await apiResponse.json()

                if (!result.ok) {
                    throw new Error(result.error || 'Unknown API error')
                }

                console.log(`[Client] Job launched successfully (duration: ${result.duration}ms)`)

            } catch (apiError: any) {
                console.error(`[Client] API call failed (debugId: ${debugId}):`, apiError)
                toast.warning("Recherche créée", {
                    description: "Le scraping démarrera dans quelques instants. Erreur temporaire de communication."
                })
            }

            // Success confetti! 🎉
            confetti({
                particleCount: 60,
                angle: 60,
                spread: 55,
                origin: { x: 0.5, y: 0.7 },
                colors: ['#667eea', '#764ba2', '#4facfe']
            })

            toast.success("🚀 Recherche lancée !", {
                description: "L'IA va analyser les données et enrichir vos prospects..."
            })

            setActiveJobId(newJob.id_jobs || newJob.id)

        } catch (err: any) {
            console.error(`[Client] Unexpected error (debugId: ${debugId}):`, err)
            toast.error("Erreur inattendue", {
                description: (
                    <div>
                        <p>{err.message || "Une erreur est survenue lors du lancement"}</p>
                        <p className="text-xs mt-1 opacity-70">
                            ID de debug: {debugId.slice(0, 8)}
                        </p>
                    </div>
                )
            })
            setLoading(false)
        }
    }

    if (activeJobId) {
        return (
            <ScrapingProgressWidget
                jobId={activeJobId}
                maxResults={formData.maxResults}
            />
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full relative group"
        >
            {/* Rotating Glow Border */}
            <div className="absolute -inset-[2px] rounded-xl overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute inset-[-200%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_90deg,#6366f1_180deg,#a855f7_270deg,transparent_360deg)] opacity-40 will-change-transform"
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 8,
                        ease: "linear",
                        repeat: Infinity
                    }}
                />
            </div>

            {/* Secondary subtle glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-xl transform scale-95 -z-10 rounded-xl" />

            <Card className="w-full relative overflow-hidden border bg-white/95 backdrop-blur-sm shadow-xl">

                <CardHeader className="relative z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <motion.div
                                    animate={{ rotate: [0, 360] }}
                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                >
                                    <Sparkles className="h-6 w-6 text-indigo-600" />
                                </motion.div>
                                Nouvelle Recherche
                            </CardTitle>
                            <CardDescription className="text-base mt-1">
                                Lancez une prospection ciblée enrichie par l'IA
                            </CardDescription>
                        </div>
                        <AIBadge>Deep Search</AIBadge>
                    </div>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="space-y-2"
                            >
                                <label className="text-sm font-semibold flex items-center gap-2">
                                    <Search className="w-4 h-4 text-indigo-600" />
                                    Activité / Keyword
                                </label>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-indigo-600 transition-colors" />
                                    <Input
                                        placeholder="ex: Agence Immobilière"
                                        className="pl-10 h-12 border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                        value={formData.query}
                                        onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="space-y-2"
                            >
                                <label className="text-sm font-semibold flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-600" />
                                    Ville
                                </label>
                                <div className="relative group">
                                    <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-indigo-600 transition-colors" />
                                    <Input
                                        placeholder="ex: Paris, Lyon..."
                                        className="pl-10 h-12 border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </motion.div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-2"
                        >
                            <label className="text-sm font-semibold">Nombre de résultats max</label>
                            <Input
                                type="number"
                                min={1}
                                max={50}
                                className="h-12 border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                value={formData.maxResults}
                                onChange={(e) => setFormData({ ...formData, maxResults: parseInt(e.target.value) })}
                                disabled={loading}
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-3 px-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200"
                        >
                            <label className="flex items-center gap-3 text-sm font-medium cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="accent-indigo-600 h-5 w-5 rounded border-gray-300 cursor-pointer"
                                    checked={formData.deepScan}
                                    onChange={(e) => setFormData({ ...formData, deepScan: e.target.checked })}
                                    disabled={loading}
                                />
                                <span className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-indigo-600" />
                                    Deep Scan (Site web + IA)
                                </span>
                            </label>
                            <label className="flex items-center gap-3 text-sm font-medium cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="accent-indigo-600 h-5 w-5 rounded border-gray-300 cursor-pointer"
                                    checked={formData.enrichEmails}
                                    onChange={(e) => setFormData({ ...formData, enrichEmails: e.target.checked })}
                                    disabled={loading}
                                />
                                <span className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-600" />
                                    Enrichir Emails
                                </span>
                            </label>
                        </motion.div>

                        {/* Info card */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4 text-sm"
                        >
                            <p className="text-blue-900 font-semibold mb-1">✨ Deep Search IA activé</p>
                            <p className="text-blue-700 text-xs leading-relaxed">
                                L'IA va scraper Google Maps, analyser les sites web, enrichir les emails et extraire des insights pour une prospection ultra-personnalisée.
                            </p>
                        </motion.div>
                    </CardContent>

                    <CardFooter className="relative z-10">
                        <div className="w-full group">
                            <AIButton
                                type="submit"
                                disabled={loading}
                                loading={loading}
                                className="w-full h-14 text-lg relative overflow-hidden"
                                variant="primary"
                            >
                                {loading ? (
                                    "Lancement en cours..."
                                ) : (
                                    <>
                                        <motion.div
                                            className="flex items-center gap-2"
                                            whileHover={{ scale: 1.05 }}
                                        >
                                            <Rocket className="w-5 h-5" />
                                            <span>Lancer la recherche</span>
                                        </motion.div>
                                    </>
                                )}
                            </AIButton>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </motion.div>
    )
}
