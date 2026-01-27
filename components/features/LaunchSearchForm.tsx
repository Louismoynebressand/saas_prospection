"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Send, Sparkles, Loader2 } from "lucide-react"
import { v4 as uuidv4 } from 'uuid'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
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

    // Geocoding helper using Nominatim (OpenStreetMap free API)
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

        // Generate unique debug ID for tracking
        const debugId = uuidv4()
        console.log(`[Client] Launching scrape job (debugId: ${debugId})`)

        try {
            const supabase = createClient()

            // 1. Get authenticated user
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                toast.error("Authentification requise", {
                    description: "Vous devez être connecté pour lancer une recherche"
                })
                setLoading(false)
                return
            }

            // 2. Check quotas before proceeding
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

            // 3. Geocode the city to get coordinates
            const coords = await geocodeCity(formData.city)

            // 4. Build precise Google Maps URL with coordinates
            let mapsUrl: string
            if (coords) {
                mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(formData.query)}/@${coords.lat},${coords.lon},14z/data=!3m1!1e3?entry=ttu`
            } else {
                mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(formData.query + " " + formData.city + ", France")}`
            }

            // 5. Create job in Supabase FIRST (UI is source of truth)
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


            // 6. Prepare Webhook Payload
            const payload = {
                job: {
                    id: newJob.id_jobs || newJob.id, // Handle both cases (int vs uuid)
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
                    debugId // Pass debugId for tracking
                }
            }

            // 9. Call server-side API proxy (not direct webhook)
            try {
                const apiResponse = await fetch('/api/scrape/launch', {
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
                // toast.success("Debug: API Webhook OK") // Uncomment for debug

            } catch (apiError: any) {
                console.error(`[Client] API call failed (debugId: ${debugId}):`, apiError)
                // Don't block user - job is created, show warning
                toast.warning("Recherche créée", {
                    description: "Le scraping démarrera dans quelques instants. Erreur temporaire de communication."
                })
            }

            // 10. Success -> Switch to Progress Widget
            toast.success("Recherche initialisée !", {
                description: "Le scraping va démarrer..."
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
        <Card className="w-full relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-secondary/30">
            <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Nouvelle Recherche
                </CardTitle>
                <CardDescription>
                    Lancez une prospection ciblée via Google Maps
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Activité / Keyword</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="ex: Agence Immobilière"
                                    className="pl-9"
                                    value={formData.query}
                                    onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ville</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="ex: Paris, Lyon..."
                                    className="pl-9"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nombre de résultats max</label>
                        <Input
                            type="number"
                            min={1}
                            max={50}
                            value={formData.maxResults}
                            onChange={(e) => setFormData({ ...formData, maxResults: parseInt(e.target.value) })}
                            disabled={loading}
                        />
                    </div>

                    <div className="flex items-center gap-4 py-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                className="accent-primary h-4 w-4 rounded border-gray-300"
                                checked={formData.deepScan}
                                onChange={(e) => setFormData({ ...formData, deepScan: e.target.checked })}
                                disabled={loading}
                            />
                            Deep Scan (Site web)
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                className="accent-primary h-4 w-4 rounded border-gray-300"
                                checked={formData.enrichEmails}
                                onChange={(e) => setFormData({ ...formData, enrichEmails: e.target.checked })}
                                disabled={loading}
                            />
                            Enrichir Emails
                        </label>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Initialisation...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" /> Lancer la recherche
                            </>
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
