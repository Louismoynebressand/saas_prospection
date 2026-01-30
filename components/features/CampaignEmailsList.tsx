"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { GenerateEmailDialog } from "./GenerateEmailDialog"
import { Plus, Mail, Search, Calendar, User, ExternalLink, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"

interface EmailGeneration {
    id: string
    id_campaign: string
    id_prospect: string
    subject: string
    body: string
    status: string
    created_at: string
    sent_at?: string
    opened_at?: string
    clicked_at?: string
    replied_at?: string
}

interface CampaignEmailsListProps {
    campaignId: string
}

export function CampaignEmailsList({ campaignId }: CampaignEmailsListProps) {
    const [emails, setEmails] = useState<EmailGeneration[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [isGenerateOpen, setIsGenerateOpen] = useState(false)

    const fetchEmails = async () => {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('email_generations')
            .select(`
                id,
                id_campaign,
                id_prospect,
                subject,
                body,
                status,
                sent_at,
                opened_at,
                clicked_at,
                replied_at,
                created_at
            `)
            .eq('id_campaign', campaignId)
            .order('created_at', { ascending: false })

        if (data) {
            setEmails(data as EmailGeneration[])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchEmails()
    }, [campaignId])

    const filteredEmails = emails.filter(email =>
        email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.body?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getStatusBadge = (email: EmailGeneration) => {
        if (email.replied_at) return <Badge className="bg-green-500">Répondu</Badge>
        if (email.clicked_at) return <Badge className="bg-blue-500">Cliqué</Badge>
        if (email.opened_at) return <Badge className="bg-yellow-500">Ouvert</Badge>
        if (email.sent_at) return <Badge variant="secondary">Envoyé</Badge>
        return <Badge variant="outline">Brouillon</Badge>
    }

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </CardContent>
            </Card>
        )
    }

    if (emails.length === 0) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Emails Générés</CardTitle>
                        <CardDescription>
                            Aucun email généré pour cette campagne
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12 text-muted-foreground">
                            <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium mb-1">Aucun email généré</p>
                            <p className="text-sm mb-6">Les emails apparaîtront ici une fois générés par l'IA</p>
                            <Button onClick={() => setIsGenerateOpen(true)} className="gap-2">
                                <Plus className="w-4 h-4" />
                                Générer un email
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <GenerateEmailDialog
                    open={isGenerateOpen}
                    onOpenChange={setIsGenerateOpen}
                    campaignId={campaignId}
                    onSuccess={() => {
                        fetchEmails()
                        setIsGenerateOpen(false)
                    }}
                />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Total Générés</CardDescription>
                            <CardTitle className="text-3xl">{emails.length}</CardTitle>
                        </CardHeader>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Envoyés</CardDescription>
                            <CardTitle className="text-3xl">
                                {emails.filter(e => e.sent_at).length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Ouverts</CardDescription>
                            <CardTitle className="text-3xl">
                                {emails.filter(e => e.opened_at).length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Réponses</CardDescription>
                            <CardTitle className="text-3xl">
                                {emails.filter(e => e.replied_at).length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </motion.div>
            </div>

            {/* Search + List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <CardTitle>Emails Générés</CardTitle>
                            <CardDescription>
                                {filteredEmails.length} email(s) trouvé(s)
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher un email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button onClick={() => setIsGenerateOpen(true)} className="gap-2">
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Nouveau</span>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredEmails.map((email, index) => (
                            <motion.div
                                key={email.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Mail className="h-4 w-4 text-indigo-600 shrink-0" />
                                                    <h4 className="font-semibold truncate">{email.subject}</h4>
                                                    {getStatusBadge(email)}
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                                    {email.body}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {format(new Date(email.created_at), "d MMM yyyy", { locale: fr })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </CardContent>
            </Card>

            <GenerateEmailDialog
                open={isGenerateOpen}
                onOpenChange={setIsGenerateOpen}
                campaignId={campaignId}
                onSuccess={() => {
                    fetchEmails()
                }}
            />
        </div>
    )
}
