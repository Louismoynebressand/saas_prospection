"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Send, MailOpen, MousePointerClick, Reply, TrendingUp } from "lucide-react"

interface AnalyticsData {
    total: number
    sent: number
    opened: number
    clicked: number
    replied: number
}

export function CampaignAnalyticsTab({ campaignId }: { campaignId: string }) {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch(`/api/campaigns/${campaignId}/analytics`)
                const json = await res.json()
                if (json.analytics) {
                    setData(json.analytics)
                }
            } catch (error) {
                console.error("Failed to fetch analytics", error)
            } finally {
                setLoading(false)
            }
        }
        fetchAnalytics()
    }, [campaignId])

    if (loading) {
        return <div className="text-center p-8">Calcul des statistiques en cours...</div>
    }

    if (!data) {
        return <div className="text-center p-8 text-red-500">Impossible de charger les statistiques.</div>
    }

    // Helper for percentages
    const percentage = (value: number, total: number) => {
        if (total === 0) return 0
        return Math.round((value / total) * 100)
    }

    const stats = [
        {
            title: "Prospects Engagés",
            value: data.total,
            description: "Total dans la campagne",
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50",
            percent: 100,
        },
        {
            title: "Emails Envoyés",
            value: data.sent,
            description: `${percentage(data.sent, data.total)}% de couverture`,
            icon: Send,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            percent: percentage(data.sent, Math.max(data.total, 1)),
        },
        {
            title: "Ouvertures",
            value: data.opened,
            description: `${percentage(data.opened, data.sent)}% des envoyés`,
            icon: MailOpen,
            color: "text-amber-600",
            bg: "bg-amber-50",
            percent: percentage(data.opened, Math.max(data.total, 1)),
        },
        {
            title: "Clics",
            value: data.clicked,
            description: `${percentage(data.clicked, data.opened)}% des ouverts`,
            icon: MousePointerClick,
            color: "text-purple-600",
            bg: "bg-purple-50",
            percent: percentage(data.clicked, Math.max(data.total, 1)),
        },
        {
            title: "Réponses",
            value: data.replied,
            description: `${percentage(data.replied, data.opened)}% des ouverts`,
            icon: Reply,
            color: "text-pink-600",
            bg: "bg-pink-50",
            percent: percentage(data.replied, Math.max(data.total, 1)),
        }
    ]

    return (
        <div className="space-y-6">
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle>Entonnoir de Conversion</CardTitle>
                            <CardDescription>
                                Suivez l'efficacité de votre campagne à chaque étape du parcours.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {stats.map((stat, index) => (
                            <div key={index} className="relative group">
                                {/* Connector line between items (desktop only) */}
                                {index < stats.length - 1 && (
                                    <div className="hidden md:block absolute top-1/2 -right-2 w-4 border-t-2 border-slate-200 border-dashed z-0" />
                                )}
                                
                                <Card className="relative z-10 overflow-hidden border-slate-100 hover:border-slate-200 transition-colors">
                                    {/* Progress bar background */}
                                    <div 
                                        className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${stat.bg.replace('bg-', 'bg-').replace('50', '300')}`}
                                        style={{ width: `${stat.percent}%` }}
                                    />
                                    
                                    <CardContent className="p-4 sm:p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500 truncate">{stat.title}</p>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                                                    {stat.value}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {stat.description}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Insights (Optional bonus for the user) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-slate-50 border-slate-100">
                    <CardContent className="p-4 flex items-start gap-4">
                        <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                            <TrendingUp className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-slate-900">Taux de Conversion Final</h4>
                            <p className="text-2xl font-bold mt-1 text-slate-900">
                                {percentage(data.replied, data.sent)}%
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Pourcentage d'emails envoyés ayant reçu une réponse.</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-100">
                    <CardContent className="p-4 flex items-start gap-4">
                        <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                            <MailOpen className="w-4 h-4 text-amber-700" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-slate-900">Performance d'Ouverture</h4>
                            <p className="text-2xl font-bold mt-1 text-slate-900">
                                {percentage(data.opened, data.sent)}%
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {percentage(data.opened, data.sent) > 40 ? "Excellent taux ! Vos objets d'emails sont performants." : "Un taux d'ouverture sain se situe autour de 40%."}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
