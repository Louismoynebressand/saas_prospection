"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Rocket, Zap, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function OnboardingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)
    const [initialCheckDone, setInitialCheckDone] = useState(false)

    // Verify user is authenticated on mount
    useEffect(() => {
        const checkUser = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
            }
            setInitialCheckDone(true)
        }
        checkUser()
    }, [router])

    const handleSelectPlan = async (plan: string) => {
        if (loading) return
        setLoading(plan)

        try {
            const response = await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Une erreur est survenue")
            }

            toast.success("Forfait activé avec succès !")
            router.push('/dashboard')
            router.refresh()
        } catch (error: any) {
            console.error("Error selecting plan:", error)
            toast.error(error.message || "Impossible d'activer ce forfait. Veuillez réessayer.")
            setLoading(null)
        }
    }

    const plans = [
        {
            id: 'starter',
            name: "Starter",
            price: "29€",
            description: "Idéal pour démarrer la prospection",
            icon: Rocket,
            features: ["100 Leads / mois", "50 Deep Search", "50 Cold Emails", "Support Basic"],
            color: "bg-blue-500/10 text-blue-500"
        },
        {
            id: 'pro',
            name: "Pro",
            price: "79€",
            description: "Pour les équipes commerciales",
            icon: Zap,
            features: ["500 Leads / mois", "200 Deep Search", "200 Cold Emails", "Support Prioritaire"],
            popular: true,
            color: "bg-purple-500/10 text-purple-500"
        },
        {
            id: 'enterprise',
            name: "Enterprise",
            price: "199€",
            description: "Pour les agences et grandes structures",
            icon: Building,
            features: ["Illimité Leads / mois", "1000 Deep Search", "1000 Cold Emails", "Support Dédié"],
            color: "bg-orange-500/10 text-orange-500"
        }
    ]

    if (!initialCheckDone) {
        return (
            <div className="min-h-screen bg-muted/30 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
            <div className="max-w-5xl w-full space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-3">
                    <h1 className="text-4xl font-bold tracking-tight">Choisissez votre forfait</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Sélectionnez le plan qui correspond le mieux à vos besoins. Vous pourrez changer de forfait à tout moment.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                        const Icon = plan.icon
                        return (
                            <Card key={plan.id} className={`relative transition-all hover:shadow-lg ${plan.popular ? 'border-primary ring-1 ring-primary shadow-md' : ''}`}>
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                                        Recommandé
                                    </div>
                                )}
                                <CardHeader>
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${plan.color}`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                    <CardDescription>{plan.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-end gap-1">
                                        <span className="text-4xl font-bold">{plan.price}</span>
                                        <span className="text-muted-foreground mb-1">/mois</span>
                                    </div>
                                    <div className="space-y-3 pt-4">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm">
                                                <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                                    <Check className="h-3 w-3 text-green-600" />
                                                </div>
                                                {feature}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        variant={plan.popular ? "default" : "outline"}
                                        onClick={() => handleSelectPlan(plan.id)}
                                        disabled={loading !== null}
                                    >
                                        {loading === plan.id ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Activation...
                                            </>
                                        ) : "Choisir ce plan"}
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>

                <div className="text-center">
                    <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => handleSelectPlan('starter')}
                        disabled={loading !== null}
                    >
                        {loading === 'starter' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Continuer avec l'essai gratuit (5 jours)
                    </Button>
                </div>
            </div>
        </div>
    )
}
