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
import { AddProspectsToCampaignModal } from "@/components/features/AddProspectsToCampaignModal"
import { PersonalizationTab } from "@/components/features/PersonalizationTab"
import { AIBadge } from "@/components/ui/ai-badge"
import Link from "next/link"
import { cn } from "@/lib/utils"

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

    // Lifted State for Add Prospects
    const [showAddProspectModal, setShowAddProspectModal] = useState(false)
    const [prospectsRefreshTrigger, setProspectsRefreshTrigger] = useState(0)

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
    }, [campaignId, prospectsRefreshTrigger]) // Refresh stats when prospects added

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
                        <Link href="/emails">
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
                <div className="flex justify-between items-start mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/emails')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour aux campagnes
                    </Button>
                </div>

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
                            <CampaignSchedulerModal campaignId={campaignId} onScheduled={handleScheduleUpdate} hasSchedule={!!schedule} />
                        </div>
                        <div className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm backdrop-blur-md border transition-all duration-300",
                            campaign.status === 'ACTIVE'
                                ? "bg-white/80 text-emerald-700 border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                            <div className="flex items-center gap-1.5">
                                {campaign.status === 'ACTIVE' && (
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </div>
                                )}
                                {campaign.status}
                            </div>
                        </div>
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
                    <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-6">
                        <TabsTrigger value="prospects" className="gap-2">
                            <Mail className="w-4 h-4" />
                            <span className="hidden sm:inline">Prospects</span>
                        </TabsTrigger>
                        <TabsTrigger value="personalization" className="gap-2">
                            <Sparkles className="w-4 h-4" />
                            <span className="hidden sm:inline">Personnalisation</span>
                        </TabsTrigger>
                        <TabsTrigger value="planning" className="gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="hidden sm:inline">Planning</span>
                        </TabsTrigger>
                        <TabsTrigger value="configuration" className="gap-2">
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Config</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="prospects" className="space-y-4">
                        <CampaignProspectsList
                            campaignId={campaignId}
                            campaign={campaign}
                            onAddProspects={() => setShowAddProspectModal(true)}
                            refreshTrigger={prospectsRefreshTrigger}
                        />
                    </TabsContent>

                    <TabsContent value="personalization" className="space-y-4">
                        <PersonalizationTab
                            campaign={campaign}
                            onUpdate={(updated) => setCampaign(updated)}
                        />
                    </TabsContent>

                    <TabsContent value="planning" className="space-y-4">
                        <div className="mb-4 md:hidden">
                            <CampaignSchedulerModal campaignId={campaignId} onScheduled={handleScheduleUpdate} hasSchedule={!!schedule} />
                        </div>
                        <PlanningTab
                            schedule={schedule}
                            queueStats={queueStats}
                            onAddProspects={() => setShowAddProspectModal(true)}
                        />
                    </TabsContent>

                    <TabsContent value="configuration" className="space-y-4">
                        <CampaignConfigEditor
                            campaign={campaign}
                            onUpdate={(updated: Campaign) => setCampaign(updated)}
                        />
                    </TabsContent>
                </Tabs>
            </motion.div>

            {/* Global Modals */}
            <AddProspectsToCampaignModal
                open={showAddProspectModal}
                onOpenChange={setShowAddProspectModal}
                campaignId={campaignId}
                onSuccess={() => setProspectsRefreshTrigger(prev => prev + 1)}
            />
        </div>
    )
}
