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
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/emails')}
                    className="mb-3 gap-1.5 -ml-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </Button>

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
                            {campaign.campaign_name}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {campaign.target_audience || "Audience non définie"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden md:block">
                            <CampaignSchedulerModal campaignId={campaignId} onScheduled={handleScheduleUpdate} hasSchedule={!!schedule} />
                        </div>
                        <div className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-300",
                            campaign.status === 'ACTIVE'
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                            <div className="flex items-center gap-1.5">
                                {campaign.status === 'ACTIVE' && (
                                    <div className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                    </div>
                                )}
                                {campaign.status === 'ACTIVE' ? 'Actif' : campaign.status}
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
                    <TabsList className="w-full overflow-x-auto flex justify-start gap-0 h-auto p-1 mb-4">
                        <TabsTrigger value="prospects" className="flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            Prospects
                        </TabsTrigger>
                        <TabsTrigger value="planning" className="flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            Planification
                        </TabsTrigger>
                        <TabsTrigger value="configuration" className="flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap">
                            <Settings className="w-3.5 h-3.5 shrink-0" />
                            Paramètres
                        </TabsTrigger>
                        <TabsTrigger value="personalization" className="flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap">
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            IA Perso
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
