"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Campaign } from "@/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Settings, Sparkles, Clock } from "lucide-react"
import { motion } from "framer-motion"
import { CampaignProspectsList } from "@/components/features/CampaignProspectsList"
import { CampaignConfigEditor } from "@/components/features/CampaignConfigEditor"
import { CampaignSchedulerModal } from "@/components/features/CampaignSchedulerModal"
import { PlanningTab } from "@/components/features/PlanningTab"
import { AIBadge } from "@/components/ui/ai-badge"
import Link from "next/link"

export default function CampaignDetailPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const campaignId = params.id as string
    const defaultTab = searchParams.get('tab') || 'prospects'

    const [campaign, setCampaign] = useState<Campaign | null>(null)
    const [loading, setLoading] = useState(true)

    // State for Scheduling
    const [schedule, setSchedule] = useState<any>(null)
    const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0, total: 0 })

    useEffect(() => {
        const fetchCampaign = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('cold_email_campaigns')
                .select('*')
                .eq('id', campaignId)
                .single()

            if (data) {
                setCampaign(data as Campaign)
            }
            setLoading(false)
        }

        const fetchSchedule = async () => {
            const supabase = createClient()
            const { data: sched } = await supabase
                .from('campaign_schedules')
                .select('*')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (sched) {
                setSchedule(sched)
                // Fetch Queue Stats
                const { count: pending } = await supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'pending')
                const { count: sent } = await supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'sent')
                const { count: failed } = await supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed')

                setQueueStats({
                    pending: pending || 0,
                    sent: sent || 0,
                    failed: failed || 0,
                    total: (pending || 0) + (sent || 0) + (failed || 0)
                })
            }
        }

        fetchCampaign()
        fetchSchedule()
    }, [campaignId])

    const handleScheduleUpdate = () => {
        // Refresh page or re-fetch
        window.location.reload()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Chargement de la campagne...</p>
                </div>
            </div>
        )
    }

    if (!campaign) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <p className="text-2xl font-bold mb-2">Campagne introuvable</p>
                    <Button asChild variant="outline">
                        <Link href="/prospection-mail">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Retour aux campagnes
                        </Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/prospection-mail')}
                    className="mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour aux campagnes
                </Button>

                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold tracking-tight">{campaign.campaign_name}</h1>
                            <AIBadge>AI-Powered</AIBadge>
                        </div>
                        <p className="text-muted-foreground">
                            {campaign.target_audience || "Audience non définie"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden md:block">
                            <CampaignSchedulerModal campaignId={campaignId} onScheduled={handleScheduleUpdate} />
                        </div>
                        <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {campaign.status}
                        </Badge>
                    </div>
                </div>
            </motion.div>

            {/* Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <Tabs defaultValue={defaultTab} className="w-full">
                    <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
                        <TabsTrigger value="prospects" className="gap-2">
                            <Mail className="w-4 h-4" />
                            Prospects
                        </TabsTrigger>
                        <TabsTrigger value="planning" className="gap-2">
                            <Clock className="w-4 h-4" />
                            Planning
                        </TabsTrigger>
                        <TabsTrigger value="configuration" className="gap-2">
                            <Settings className="w-4 h-4" />
                            Configuration
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="prospects" className="space-y-4">
                        <CampaignProspectsList campaignId={campaignId} campaign={campaign} />
                    </TabsContent>

                    <TabsContent value="planning" className="space-y-4">
                        <div className="mb-4 md:hidden">
                            <CampaignSchedulerModal campaignId={campaignId} onScheduled={handleScheduleUpdate} />
                        </div>
                        <PlanningTab schedule={schedule} queueStats={queueStats} />
                    </TabsContent>

                    <TabsContent value="configuration" className="space-y-4">
                        <CampaignConfigEditor
                            campaign={campaign}
                            onUpdate={(updated: Campaign) => setCampaign(updated)}
                        />
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div >
    )
}
