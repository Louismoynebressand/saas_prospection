"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Database, Send, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, DEMO_USER_ID } from "@/lib/utils"

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // 1. Prepare search data for scrape_jobs
            const jobData = {
                id_user: DEMO_USER_ID,
                request_search: JSON.stringify(formData.query),
                resuest_ville: formData.city,
                request_url: "google_maps", // or specific URL if available
                request_count: Number(formData.maxResults),
                localisation: { lat: 48.8566, lng: 2.3522 }, // Default loc or fetch geocode
                deepscan: formData.deepScan,
                enrichie_emails: formData.enrichEmails,
                statut: "queued"
            }

            // 2. Insert into scrape_jobs 
            const { data: job, error: insertError } = await supabase
                .from('scrape_jobs')
                .insert(jobData)
                .select()
                .single()

            if (insertError) throw new Error("Erreur insertion DB: " + insertError.message)
            if (!job) throw new Error("Erreur: pas de job créé")

            // 3. Call Webhook
            const payload = {
                job: {
                    source: "google_maps",
                    query: formData.query,
                    location: {
                        city: formData.city,
                        radiusKm: 20,
                        geo: { lat: null, lng: null }
                    },
                    limits: { maxResults: Number(formData.maxResults) },
                    options: {
                        deepScan: formData.deepScan,
                        enrichEmails: formData.enrichEmails
                    }
                },
                actor: { userId: DEMO_USER_ID, sessionId: null },
                meta: { searchId: job.id_jobs } // Number id
            }

            const webhookUrl = process.env.NEXT_PUBLIC_SCRAPE_WEBHOOK_URL
            if (!webhookUrl) throw new Error("Webhook URL non configurée")

            const res = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const errText = await res.text()
                // 4a. Handle Webhook Error
                await supabase
                    .from('scrape_jobs')
                    .update({ statut: 'error' })
                    .eq('id_jobs', job.id_jobs)

                throw new Error(`Webhook Error: ${res.status}`)
            }

            // 5. Success -> Redirect
            router.push(`/searches/${job.id_jobs}`)
            router.refresh()

        } catch (err: any) {
            console.error(err)
            alert(err.message || "Erreur lors du lancement")
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
                        />
                    </div>

                    <div className="flex items-center gap-4 py-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                className="accent-primary h-4 w-4 rounded border-gray-300"
                                checked={formData.deepScan}
                                onChange={(e) => setFormData({ ...formData, deepScan: e.target.checked })}
                            />
                            Deep Scan (Site web)
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                className="accent-primary h-4 w-4 rounded border-gray-300"
                                checked={formData.enrichEmails}
                                onChange={(e) => setFormData({ ...formData, enrichEmails: e.target.checked })}
                            />
                            Enrichir Emails
                        </label>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" disabled={loading}>
                        {loading ? "Lancement..." : (
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
