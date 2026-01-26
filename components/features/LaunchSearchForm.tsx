"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Send, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function LaunchSearchForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
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
                    Estimate_coast: null
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

            // 6. Decrement quotas
            const { error: quotaError } = await supabase.rpc('decrement_quota', {
                p_user_id: user.id,
                p_quota_type: 'scraps'
            })

            if (quotaError) {
                console.error("Quota decrement error:", quotaError)
                // Non-blocking: job is created, quota error is logged but doesn't stop flow
            }

            // 7. If deep scan, decrement deep_search quota
            if (formData.deepScan) {
                await supabase.rpc('decrement_quota', {
                    p_user_id: user.id,
                    p_quota_type: 'deep_search'
                })
            }

            // 8. Prepare Webhook Payload
            const payload = {
                job: {
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
                meta: { searchId: newJob.id_jobs } // ← NEW: Pass id_jobs to n8n
            }

            const webhookUrl = process.env.NEXT_PUBLIC_SCRAPE_WEBHOOK_URL
            if (!webhookUrl) {
                console.error("Webhook URL not configured")
                toast.warning("Recherche créée", {
                    description: "Le scraping démarrera manuellement (webhook non configuré)"
                })
            } else {
                // 9. Trigger Webhook (non-blocking, fire and forget)
                fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }).catch(async (err) => {
                    console.error("Webhook error:", err)
                    // Update job status to error if webhook fails
                    await supabase
                        .from('scrape_jobs')
                        .update({ statut: 'error' })
                        .eq('id_jobs', newJob.id_jobs)
                })
            }

            // 10. Success -> Redirect to job detail page
            toast.success("Recherche lancée !", {
                description: "Le scraping est en cours. Les résultats apparaîtront dans quelques instants."
            })

            router.push(`/searches/${newJob.id_jobs}`)
            router.refresh()

        } catch (err: any) {
            console.error("Unexpected error:", err)
            toast.error("Erreur inattendue", {
                description: err.message || "Une erreur est survenue lors du lancement"
            })
        } finally {
            setLoading(false)
        }
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
                                Création en cours...
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
