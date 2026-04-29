"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Sparkles, Loader2, ChevronDown, Check } from "lucide-react"
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface FrenchCity {
    nom: string
    code: string
    codesPostaux: string[]
    centre: { type: string; coordinates: [number, number] } // [lng, lat]
    codeDepartement: string
    codeRegion: string
}

interface SelectedCity {
    name: string
    postalCode: string
    departement: string
    lat: number
    lng: number
}

// ─── Country config (extensible) ──────────────────────────────────────────────
const COUNTRIES = [
    { code: 'FR', label: 'France', flag: '🇫🇷', searchSuffix: ', France', active: true },
    // { code: 'BE', label: 'Belgique', flag: '🇧🇪', searchSuffix: ', Belgique', active: false },
    // { code: 'CH', label: 'Suisse', flag: '🇨🇭', searchSuffix: ', Suisse', active: false },
]

// ─── CityAutocomplete component ───────────────────────────────────────────────
function CityAutocomplete({
    value,
    onChange,
    onSelect,
    disabled,
    onFocus,
    onBlur,
}: {
    value: string
    onChange: (v: string) => void
    onSelect: (city: SelectedCity) => void
    disabled?: boolean
    onFocus?: () => void
    onBlur?: () => void
}) {
    const [suggestions, setSuggestions] = useState<FrenchCity[]>([])
    const [open, setOpen] = useState(false)
    const [searching, setSearching] = useState(false)
    const [selected, setSelected] = useState<SelectedCity | null>(null)
    const debounceRef = useRef<NodeJS.Timeout>()
    const containerRef = useRef<HTMLDivElement>(null)

    const searchCities = useCallback(async (query: string) => {
        if (query.length < 2) { setSuggestions([]); setOpen(false); return }
        setSearching(true)
        try {
            const res = await fetch(
                `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,centre,codeDepartement,codeRegion&boost=population&limit=8`
            )
            const data: FrenchCity[] = await res.json()
            setSuggestions(data)
            setOpen(data.length > 0)
        } catch {
            setSuggestions([])
        } finally {
            setSearching(false)
        }
    }, [])

    const handleInput = (v: string) => {
        onChange(v)
        setSelected(null)
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => searchCities(v), 250)
    }

    const handleSelect = (city: FrenchCity) => {
        const postalCode = city.codesPostaux[0] || ''
        const [lng, lat] = city.centre?.coordinates ?? [0, 0]
        const sel: SelectedCity = {
            name: city.nom,
            postalCode,
            departement: city.codeDepartement,
            lat,
            lng,
        }
        setSelected(sel)
        onChange(`${city.nom} (${postalCode})`)
        setSuggestions([])
        setOpen(false)
        onSelect(sel)
    }

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    type="text"
                    placeholder="ex: Lyon, Valence, Grenoble..."
                    className="h-12 pl-9 pr-10 border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                    value={value}
                    onChange={e => handleInput(e.target.value)}
                    onFocus={() => { onFocus?.(); if (suggestions.length > 0) setOpen(true) }}
                    onBlur={onBlur}
                    disabled={disabled}
                    autoComplete="off"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {searching
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        : selected
                            ? <Check className="h-4 w-4 text-green-500" />
                            : null
                    }
                </div>
            </div>

            <AnimatePresence>
                {open && suggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-50 mt-1 w-full rounded-xl border border-indigo-100 bg-white shadow-xl overflow-hidden"
                    >
                        {suggestions.map((city, i) => (
                            <button
                                key={`${city.code}-${i}`}
                                type="button"
                                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors group"
                                onMouseDown={() => handleSelect(city)}
                            >
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                    <span className="font-medium text-sm text-foreground">{city.nom}</span>
                                    <span className="text-xs text-muted-foreground">({city.codeDepartement})</span>
                                </div>
                                <span className="text-xs font-mono text-indigo-600 bg-indigo-50 group-hover:bg-white px-2 py-0.5 rounded-full transition-colors">
                                    {city.codesPostaux[0]}
                                </span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Main form ────────────────────────────────────────────────────────────────
export function LaunchSearchForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [activeJobId, setActiveJobId] = useState<string | number | null>(null)
    const [isCardFocused, setIsCardFocused] = useState(false)
    const [countryCode] = useState('FR') // 🇫🇷 locked for now, extensible later
    const [formData, setFormData] = useState({
        query: "",
        city: "",         // display string (e.g. "Valence (26000)")
        maxResults: 10,
        enrichmentEnabled: true,
    })
    const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!selectedCity) {
            toast.error("Ville requise", {
                description: "Veuillez sélectionner une ville dans la liste de suggestions."
            })
            return
        }

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

            // Build Google Maps URL using real GPS coordinates from the selected city
            const country = COUNTRIES.find(c => c.code === countryCode)
            const mapsUrl = selectedCity.lat && selectedCity.lng
                ? `https://www.google.com/maps/search/${encodeURIComponent(formData.query)}/@${selectedCity.lat},${selectedCity.lng},13z`
                : `https://www.google.com/maps/search/${encodeURIComponent(formData.query + ' ' + selectedCity.name + (country?.searchSuffix || ', France'))}`

            console.log(`[Client] mapsUrl: ${mapsUrl}`)

            const response = await authenticatedFetch('/api/scrape/launch', {
                method: 'POST',
                body: JSON.stringify({
                    mapsUrl,
                    query: formData.query,
                    city: selectedCity.name, // clean city name (no postal code) for n8n
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

            toast.success("Recherche lancée ! 🚀", {
                description: formData.enrichmentEnabled
                    ? "L'IA enrichit vos prospects en temps réel..."
                    : "Prospection en cours...",
            })

            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })

            setActiveJobId(jobId)
            setLoading(false)

        } catch (err: any) {
            console.error(`[Client] Unexpected error (debugId: ${debugId}):`, err)
            toast.error("Erreur inattendue", {
                description: (
                    <div>
                        <p>{err.message || "Une erreur est survenue lors du lancement"}</p>
                        <p className="text-xs mt-1 opacity-70">ID de debug: {debugId.slice(0, 8)}</p>
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
                enrichmentEnabled={formData.enrichmentEnabled}
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
                                <label className="text-sm font-semibold flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4" />
                                        Ville
                                    </span>
                                    {/* Country badge — locked to 🇫🇷, extensible */}
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
                                        🇫🇷 France
                                        <span className="text-blue-400 text-[10px]">(uniquement)</span>
                                    </span>
                                </label>
                                <CityAutocomplete
                                    value={formData.city}
                                    onChange={(v) => setFormData({ ...formData, city: v })}
                                    onSelect={(city) => setSelectedCity(city)}
                                    disabled={loading}
                                    onFocus={() => setIsCardFocused(true)}
                                    onBlur={() => setIsCardFocused(false)}
                                />
                                {selectedCity && (
                                    <p className="text-xs text-green-600 flex items-center gap-1.5 pl-1">
                                        <Check className="h-3 w-3" />
                                        {selectedCity.name} ({selectedCity.postalCode}) — Dép. {selectedCity.departement}
                                        &nbsp;·&nbsp;{selectedCity.lat.toFixed(4)}, {selectedCity.lng.toFixed(4)}
                                    </p>
                                )}
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
