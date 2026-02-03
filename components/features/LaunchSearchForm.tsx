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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

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
            {/* 🧠 Organic AI Shockwave & Breathing Effect */}
            <style jsx>{`
                @keyframes shockwave-scan {
                    0% {
                        left: -50%;
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    90% {
                        opacity: 1;
                    }
                    100% {
                        left: 150%;
                        opacity: 0;
                    }
                }

                @keyframes ai-breathe {
                    0%, 100% {
                        box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
                        border-color: rgba(99, 102, 241, 0.3);
                    }
                    50% {
                        box-shadow: 0 0 25px rgba(168, 85, 247, 0.4);
                        border-color: rgba(168, 85, 247, 0.6);
                    }
                }

                @keyframes border-trace {
                    0% { clip-path: inset(0 100% 0 0); }
                    100% { clip-path: inset(0 0 0 0); }
                }

                .ai-card-container {
                    position: relative;
                    border-radius: 1rem;
                    /* Initial state: no visible border, just the card content */
                    padding: 2px; /* Space for the border */
                    background: transparent;
                    transition: all 0.5s ease;
                }

                /* The card itself */
                .ai-card-inner {
                    border-radius: 0.9rem; /* Slightly smaller than container */
                    z-index: 2;
                    position: relative;
                    background: rgba(255, 255, 255, 0.95);
                }

                /* The Living Border (Breathing) */
                .ai-card-container.living {
                    animation: ai-breathe 4s ease-in-out infinite;
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
                }

                /* The Shockwave Overlay */
                .ai-shockwave {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    border-radius: 1rem;
                    pointer-events: none;
                    overflow: hidden;
                    z-index: 10;
                }

                .ai-shockwave::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 50%; /* Width of the wave */
                    background: linear-gradient(
                        90deg, 
                        transparent, 
                        rgba(99, 102, 241, 0.15), 
                        rgba(236, 72, 153, 0.2), 
                        transparent
                    );
                    transform: skewX(-20deg);
                    opacity: 0;
                }

                .ai-shockwave.active::before {
                    animation: shockwave-scan 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
            `}</style>

            <div
                className={`ai-card-container ${isCardFocused ? 'living' : ''}`}
            >
                {/* Shockwave Effect Layer */}
                <div className={`ai-shockwave ${isCardFocused ? 'active' : ''}`} />

                <Card className="w-full relative overflow-hidden bg-white/95 backdrop-blur-sm shadow-xl transition-all duration-300 border-0 ai-card-inner">
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
                                <HoverCard openDelay={200}>
                                    <HoverCardTrigger asChild>
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
                                                <Sparkles className="w-4 h-4 text-purple-600 fill-purple-100" />
                                                <span className="font-semibold">Deep Search IA</span>
                                            </span>
                                        </label>
                                    </HoverCardTrigger>
                                    <HoverCardContent
                                        className="w-80 backdrop-blur-lg bg-white/95 dark:bg-slate-900/95 border border-purple-200/50 dark:border-purple-700/50 shadow-xl"
                                        align="center"
                                        side="top"
                                        sideOffset={8}
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-5 h-5 text-purple-600 fill-purple-100" />
                                                <p className="font-semibold text-purple-900 dark:text-purple-100">Deep Search + Email Enrichment</p>
                                            </div>
                                            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                                L'IA va extraire des <strong>informations détaillées</strong> sur chaque prospect en analysant leur site web et leurs données publiques.
                                            </p>
                                            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                                Si un email existe, il sera <strong>vérifié automatiquement</strong>. Sinon, plusieurs <strong>combinaisons intelligentes</strong> seront générées pour trouver une adresse email valide.
                                            </p>
                                            <p className="text-xs text-purple-700 dark:text-purple-300 border-t border-purple-200 dark:border-purple-700 pt-2 mt-2">
                                                ⚠️ <strong>Obligatoire</strong> pour générer des emails de prospection par la suite.
                                            </p>
                                        </div>
                                    </HoverCardContent>
                                </HoverCard>
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
                                    variant="outline"
                                    hideIcon={true}
                                >
                                    {loading ? (
                                        "Lancement en cours..."
                                    ) : (
                                        <motion.div
                                            className="flex items-center justify-center gap-3"
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
                                            <span className="font-medium bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                                Lancer la recherche
                                            </span>
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
