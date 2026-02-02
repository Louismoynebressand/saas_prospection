"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Rocket, Sparkles, Loader2, Info } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function LaunchSearchForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [activeJobId, setActiveJobId] = useState<string | number | null>(null)
    const [isCardFocused, setIsCardFocused] = useState(false) // For edge glow animation
    const [formData, setFormData] = useState({
        query: "",
        city: "",
        maxResults: 10,
        enrichmentEnabled: true,
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
                mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(formData.query)}/@${coords.lat},${coords.lon},13z`
            } else {
                mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(formData.query + " " + formData.city)}`
            }

            console.log(`[Client] Calling /api/scrape/launch with enrichment=${formData.enrichmentEnabled}`)
            const response = await authenticatedFetch('/api/scrape/launch', {
                method: 'POST',
                body: JSON.stringify({
                    mapsUrl,
                    query: formData.query,
                    city: formData.city,
                    maxResults: formData.maxResults,
                    enrichmentEnabled: formData.enrichmentEnabled,
                    debugId
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Erreur lors du lancement')
            }

            const result = await response.json()
            const jobId = result.jobId

            console.log(`[Client] Job created with ID: ${jobId} (debugId: ${debugId})`)

            toast.success("Recherche lancée ! 🚀", {
                description: formData.enrichmentEnabled
                    ? "L'IA enrichit vos prospects en temps réel..."
                    : "Prospection en cours...",
            })

            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            })

            setActiveJobId(jobId)

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
            className="w-full relative"
        >
            {/* ✨ Siri-like Edge Glow Effect */}
            <style jsx>{`
                @keyframes siri-pulse {
                    0% {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    50% {
                        opacity: 0.4;
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1.05);
                    }
                }

                @keyframes siri-rotate {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }

                @keyframes siri-breathe {
                    0%, 100% {
                        opacity: 0.6;
                    }
                    50% {
                        opacity: 0.8;
                    }
                }

                .siri-glow-container {
                    position: relative;
                }

                .siri-glow-border {
                    position: absolute;
                    inset: -6px;
                    border-radius: 1rem;
                    padding: 6px;
                    background: conic-gradient(
                        from 0deg,
                        #8b5cf6,
                        #06b6d4,
                        #ec4899,
                        #8b5cf6
                    );
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    animation: siri-rotate 8s linear infinite, siri-breathe 3s ease-in-out infinite;
                    pointer-events: none;
                }

                .siri-glow-border.active {
                    opacity: 1;
                }

                .siri-glow-halo {
                    position: absolute;
                    inset: -6px;
                    border-radius: 1rem;
                    background: radial-gradient(
                        circle at 50% 50%,
                        rgba(139, 92, 246, 0.3),
                        rgba(6, 182, 212, 0.2),
                        rgba(236, 72, 153, 0.3),
                        transparent 70%
                    );
                    filter: blur(30px);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    animation: siri-breathe 3s ease-in-out infinite;
                    pointer-events: none;
                }

                .siri-glow-halo.active {
                    opacity: 1;
                }

                .siri-pulse-wave {
                    position: absolute;
                    inset: -6px;
                    border-radius: 1rem;
                    background: radial-gradient(
                        circle at 50% 50%,
                        rgba(139, 92, 246, 0.4),
                        rgba(6, 182, 212, 0.3),
                        transparent 60%
                    );
                    filter: blur(60px);
                    opacity: 0;
                    animation: siri-pulse 0.5s ease-out;
                    pointer-events: none;
                }
            `}</style>

            <div className="siri-glow-container">
                {/* Animated pulse wave on focus */}
                <AnimatePresence>
                    {isCardFocused && (
                        <motion.div
                            key="pulse"
                            className="siri-pulse-wave"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                        />
                    )}
                </AnimatePresence>

                {/* Rotating border */}
                <div className={`siri-glow-border ${isCardFocused ? 'active' : ''}`} />

                {/* Outer halo */}
                <div className={`siri-glow-halo ${isCardFocused ? 'active' : ''}`} />

                <Card className="w-full relative overflow-hidden border-2 bg-white/95 backdrop-blur-sm shadow-xl transition-all duration-300">
                    <form onSubmit={handleSubmit}>
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

                        <CardContent className="space-y-5 relative z-10">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="space-y-2"
                            >
                                <label className="text-sm font-semibold flex items-center gap-2">
                                    <Search className="w-4 h-4" />
                                    Activité / Keyword
                                </label>
                                <Input
                                    type="text"
                                    placeholder="ex: Tennis, Pizzeria, Agence immobilière..."
                                    className="h-12 border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                    value={formData.query}
                                    onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                                    onFocus={() => setIsCardFocused(true)}
                                    onBlur={() => setIsCardFocused(false)}
                                    disabled={loading}
                                    required
                                />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="space-y-2"
                            >
                                <label className="text-sm font-semibold flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    Ville
                                </label>
                                <Input
                                    type="text"
                                    placeholder="ex: Lyon, Paris..."
                                    className="h-12 border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    onFocus={() => setIsCardFocused(true)}
                                    onBlur={() => setIsCardFocused(false)}
                                    disabled={loading}
                                    required
                                />
                            </motion.div>

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
                                    onFocus={() => setIsCardFocused(true)}
                                    onBlur={() => setIsCardFocused(false)}
                                    disabled={loading}
                                />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="flex items-center justify-between py-4 px-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200"
                            >
                                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="accent-indigo-600 h-5 w-5 rounded border-gray-300 cursor-pointer"
                                        checked={formData.enrichmentEnabled}
                                        onChange={(e) => setFormData({ ...formData, enrichmentEnabled: e.target.checked })}
                                        onFocus={() => setIsCardFocused(true)}
                                        onBlur={() => setIsCardFocused(false)}
                                        disabled={loading}
                                    />
                                    <span className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                        <span className="font-semibold">Enrichissement Intelligent (IA)</span>
                                    </span>
                                </label>

                                <TooltipProvider>
                                    <Tooltip delayDuration={200}>
                                        <TooltipTrigger asChild>
                                            <button type="button" className="text-indigo-600 hover:text-indigo-700 transition-colors">
                                                <Info className="w-5 h-5" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs p-4 bg-gradient-to-br from-indigo-900 to-purple-900 text-white border-indigo-400">
                                            <p className="font-semibold mb-2">🚀 Deep Search + Email Enrichment</p>
                                            <p className="text-sm leading-relaxed mb-2">
                                                L'IA va extraire des <strong>informations détaillées</strong> sur chaque prospect en analysant leur site web et leurs données publiques.
                                            </p>
                                            <p className="text-sm leading-relaxed mb-2">
                                                Si un email existe, il sera <strong>vérifié automatiquement</strong>. Sinon, plusieurs <strong>combinaisons intelligentes</strong> seront générées pour trouver une adresse email valide.
                                            </p>
                                            <p className="text-xs text-indigo-200 border-t border-indigo-400 pt-2 mt-2">
                                                ⚠️ <strong>Obligatoire</strong> pour générer des emails de prospection par la suite.
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </motion.div>

                            {formData.enrichmentEnabled && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4 text-sm"
                                >
                                    <p className="text-blue-900 font-semibold mb-1">✨ Enrichissement IA activé</p>
                                    <p className="text-blue-700 text-xs leading-relaxed">
                                        L'IA va scraper Google Maps, analyser les sites web, enrichir et vérifier les emails pour une prospection ultra-personnalisée.
                                    </p>
                                </motion.div>
                            )}
                        </CardContent>

                        <CardFooter className="relative z-10">
                            <div className="w-full">
                                <AIButton
                                    type="submit"
                                    disabled={loading}
                                    loading={loading}
                                    className="w-full h-14 text-lg"
                                    variant="primary"
                                >
                                    {loading ? (
                                        "Lancement en cours..."
                                    ) : (
                                        <motion.div
                                            className="flex items-center justify-center gap-2"
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <Rocket className="w-5 h-5" />
                                            <span>Lancer la recherche</span>
                                        </motion.div>
                                    )}
                                </AIButton>
                            </div>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </motion.div>
    )
}
