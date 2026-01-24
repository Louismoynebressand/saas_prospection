"use client"

import { useEffect, useState } from "react"
import { Check, Crown, Zap, Rocket, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"

export default function BillingPage() {
    const [currentPlan, setCurrentPlan] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchSubscription = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (data) {
                    setCurrentPlan(data)
                }
            }
            setLoading(false)
        }

        fetchSubscription()
    }, [])

    const handleUpgrade = (planName: string) => {
        // Implement Stripe redirect here later
        alert(`Redirection vers la passerelle de paiement pour ${planName}`)
    }

    const plans = [
        {
            id: 'starter',
            name: "Starter",
            price: "29",
            description: "Parfait pour démarrer votre prospection",
            icon: Zap,
            features: [
                "100 scraps par mois",
                "50 deep search par mois",
                "50 cold emails par mois",
                "Support email"
            ]
        },
        {
            id: 'pro',
            name: "Pro",
            price: "79",
            description: "Pour les équipes en croissance",
            icon: Crown,
            popular: true,
            features: [
                "500 scraps par mois",
                "200 deep search par mois",
                "200 cold emails par mois",
                "Support prioritaire",
                "Export CSV/PDF"
            ]
        },
        {
            id: 'enterprise',
            name: "Enterprise",
            price: "199",
            description: "Solutions sur mesure pour grandes entreprises",
            icon: Rocket,
            features: [
                "Illimité (999k)",
                "1000 Deep Search",
                "1000 Cold Emails",
                "Support dédié 24/7"
            ]
        }
    ]

    const activePlanId = currentPlan?.plan || 'free'

    if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin h-8 w-8" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Forfait & Facturation</h1>
                <p className="text-muted-foreground mt-1">
                    Gérez votre abonnement et consultez votre plan actuel
                </p>
            </div>

            {/* Current Plan Banner */}
            <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="default" className="bg-green-600">Plan Actif</Badge>
                                <h3 className="text-xl font-bold capitalize">{activePlanId}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {currentPlan?.end_date ? (
                                    <>Prochain renouvellement le <strong>{format(new Date(currentPlan.end_date), 'dd/MM/yyyy')}</strong></>
                                ) : "Aucun abonnement actif"}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {plans.map((plan) => {
                    const Icon = plan.icon
                    const isCurrent = activePlanId === plan.id
                    return (
                        <Card
                            key={plan.id}
                            className={`relative ${plan.popular ? 'border-primary shadow-lg shadow-primary/20' : ''} ${isCurrent ? 'border-green-500' : ''}`}
                        >
                            {plan.popular && !isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-primary">Populaire</Badge>
                                </div>
                            )}
                            {isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-green-600">Plan Actuel</Badge>
                                </div>
                            )}

                            <CardHeader>
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className="h-6 w-6 text-primary" />
                                    <CardTitle>{plan.name}</CardTitle>
                                </div>
                                <CardDescription>{plan.description}</CardDescription>
                                <div className="mt-4">
                                    <span className="text-4xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground">€/mois</span>
                                </div>
                            </CardHeader>

                            <CardContent>
                                <ul className="space-y-3">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter>
                                {isCurrent ? (
                                    <Button variant="outline" className="w-full" disabled>
                                        Plan Actuel
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full"
                                        variant={plan.popular ? "default" : "outline"}
                                        onClick={() => handleUpgrade(plan.name)}
                                    >
                                        Passer à ce plan
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
