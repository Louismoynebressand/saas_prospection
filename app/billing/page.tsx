"use client"

import { Check, Crown, Zap, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const plans = [
    {
        name: "Starter",
        price: "49",
        description: "Parfait pour démarrer votre prospection",
        isActive: true,
        icon: Zap,
        features: [
            "100 scraps par mois",
            "50 deep search par mois",
            "100 cold emails par mois",
            "Support email",
            "Historique 30 jours"
        ]
    },
    {
        name: "Pro",
        price: "149",
        description: "Pour les équipes en croissance",
        isActive: false,
        icon: Crown,
        popular: true,
        features: [
            "500 scraps par mois",
            "250 deep search par mois",
            "500 cold emails par mois",
            "Support prioritaire",
            "Historique illimité",
            "Export CSV/PDF",
            "API Access"
        ]
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "Solutions sur mesure pour grandes entreprises",
        isActive: false,
        icon: Rocket,
        features: [
            "Scraps illimités",
            "Deep search illimité",
            "Cold emails illimités",
            "Support dédié 24/7",
            "Gestionnaire de compte",
            "Intégrations personnalisées",
            "SLA garanti",
            "Formation équipe"
        ]
    }
]

export default function BillingPage() {
    const handleUpgrade = (planName: string) => {
        alert(`Mise à niveau vers ${planName} (Fonctionnalité à venir)`)
    }

    const handleManageSubscription = () => {
        alert("Gestion de l'abonnement (Fonctionnalité à venir)")
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Forfait & Facturation</h1>
                <p className="text-muted-foreground mt-1">
                    Gérez votre abonnement et consultez l'historique de facturation
                </p>
            </div>

            {/* Current Plan Banner */}
            <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="default" className="bg-green-600">Plan Actif</Badge>
                                <h3 className="text-xl font-bold">Starter</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Prochaine facturation le <strong>23 février 2026</strong> • <strong>49€/mois</strong>
                            </p>
                        </div>
                        <Button variant="outline" onClick={handleManageSubscription}>
                            Gérer l'abonnement
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {plans.map((plan) => {
                    const Icon = plan.icon
                    return (
                        <Card
                            key={plan.name}
                            className={`relative ${plan.popular ? 'border-primary shadow-lg shadow-primary/20' : ''} ${plan.isActive ? 'border-green-500' : ''}`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-primary">Populaire</Badge>
                                </div>
                            )}
                            {plan.isActive && (
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
                                    {plan.price !== "Custom" && <span className="text-muted-foreground">€/mois</span>}
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
                                {plan.isActive ? (
                                    <Button variant="outline" className="w-full" disabled>
                                        Plan Actuel
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full"
                                        variant={plan.popular ? "default" : "outline"}
                                        onClick={() => handleUpgrade(plan.name)}
                                    >
                                        {plan.price === "Custom" ? "Nous contacter" : "Passer à ce plan"}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>

            {/* Billing History */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Historique de facturation</CardTitle>
                    <CardDescription>Consultez vos factures précédentes</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[
                            { date: "23 janvier 2026", amount: "49€", status: "Payée", invoice: "#INV-2026-001" },
                            { date: "23 décembre 2025", amount: "49€", status: "Payée", invoice: "#INV-2025-012" },
                            { date: "23 novembre 2025", amount: "49€", status: "Payée", invoice: "#INV-2025-011" },
                        ].map((bill, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="font-medium">{bill.invoice}</p>
                                        <p className="text-sm text-muted-foreground">{bill.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        {bill.status}
                                    </Badge>
                                    <p className="font-medium">{bill.amount}</p>
                                    <Button variant="ghost" size="sm">
                                        Télécharger
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
