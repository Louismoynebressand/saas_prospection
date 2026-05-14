"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Globe, Link, MousePointerClick, Calendar, ArrowUpRight, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface TrackedLink {
    id: string
    link_type: 'phone' | 'email' | 'website' | 'custom'
    link_label: string
    original_url: string
    click_count: number
    first_clicked_at: string | null
    last_clicked_at: string | null
    campaign_name?: string
}

interface EmailLinkStatsProps {
    prospectId: number | string
    campaignId?: string          // if set, filter to one campaign
    compact?: boolean            // for table cell / popover use
    className?: string
}

const LINK_ICONS: Record<string, React.ReactNode> = {
    phone: <Phone className="h-4 w-4 text-blue-500" />,
    email: <Mail className="h-4 w-4 text-violet-500" />,
    website: <Globe className="h-4 w-4 text-emerald-500" />,
    custom: <Link className="h-4 w-4 text-amber-500" />,
}

const LINK_TYPE_LABELS: Record<string, string> = {
    phone: 'Téléphone',
    email: 'Email',
    website: 'Site web',
    custom: 'Lien perso',
}

const LINK_GRADIENTS: Record<string, string> = {
    phone: 'from-blue-500/10 to-transparent border-blue-200/50',
    email: 'from-violet-500/10 to-transparent border-violet-200/50',
    website: 'from-emerald-500/10 to-transparent border-emerald-200/50',
    custom: 'from-amber-500/10 to-transparent border-amber-200/50',
}

const LINK_COLORS_COMPACT: Record<string, string> = {
    phone: 'bg-blue-50 border-blue-200 text-blue-700',
    email: 'bg-violet-50 border-violet-200 text-violet-700',
    website: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    custom: 'bg-amber-50 border-amber-200 text-amber-700',
}

export function EmailLinkStats({ prospectId, campaignId, compact = false, className }: EmailLinkStatsProps) {
    const [links, setLinks] = useState<TrackedLink[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const fetchLinks = async () => {
            setLoading(true)
            let query = supabase
                .from('email_tracked_links')
                .select(`
                    id, link_type, link_label, original_url,
                    click_count, first_clicked_at, last_clicked_at,
                    campaign:cold_email_campaigns(name)
                `)
                .eq('prospect_id', Number(prospectId))
                .order('click_count', { ascending: false })

            if (campaignId) {
                query = query.eq('campaign_id', campaignId)
            }

            const { data } = await query

            if (data) {
                setLinks(data.map((d: any) => ({
                    ...d,
                    campaign_name: d.campaign?.name,
                })))
            }
            setLoading(false)
        }
        fetchLinks()
    }, [prospectId, campaignId])

    const totalClicks = links.reduce((s, l) => s + l.click_count, 0)
    const clickedLinks = links.filter(l => l.click_count > 0)

    if (loading) return null

    if (links.length === 0) {
        return compact ? null : (
            <div className={cn("text-sm text-slate-400 italic flex items-center justify-center p-6 border border-dashed rounded-xl bg-slate-50/50", className)}>
                Aucun lien traçable configuré pour ce prospect.
            </div>
        )
    }

    // ── Compact view (for table cell / popover) ──────────────────────────────
    if (compact) {
        if (totalClicks === 0) return (
            <span className="text-xs text-slate-300 font-medium">—</span>
        )
        return (
            <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
                {clickedLinks.map(l => (
                    <span
                        key={l.id}
                        className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border font-bold shadow-sm transition-transform hover:scale-105", LINK_COLORS_COMPACT[l.link_type])}
                        title={`${LINK_TYPE_LABELS[l.link_type]}: ${l.click_count} clic(s)`}
                    >
                        {LINK_ICONS[l.link_type]}
                        {l.click_count}
                    </span>
                ))}
            </div>
        )
    }

    // ── Full view (for prospect detail page) ─────────────────────────────────
    return (
        <div className={cn("space-y-4", className)}>
            {/* Summary Header */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Activity className="w-24 h-24" />
                </div>
                <div className="relative z-10 flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Engagement Liens</span>
                    <div className="flex items-center gap-2">
                        <MousePointerClick className="h-5 w-5 text-indigo-400" />
                        <span className="text-2xl font-bold">{totalClicks} clic{totalClicks > 1 ? 's' : ''} total</span>
                    </div>
                </div>
                <div className="relative z-10 text-right">
                    <span className="block text-3xl font-black text-white/90">{clickedLinks.length}</span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400">Liens cliqués</span>
                </div>
            </div>

            {/* Per-link breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {links.map(link => {
                    const isClicked = link.click_count > 0
                    return (
                        <div
                            key={link.id}
                            className={cn(
                                "group relative overflow-hidden rounded-xl border bg-white p-4 transition-all duration-300 shadow-sm",
                                isClicked 
                                    ? `bg-gradient-to-br ${LINK_GRADIENTS[link.link_type]} shadow-md hover:shadow-lg` 
                                    : "opacity-75 hover:opacity-100 bg-slate-50 border-slate-200"
                            )}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "p-2 rounded-lg",
                                        isClicked ? "bg-white shadow-sm border border-slate-100" : "bg-slate-200/50"
                                    )}>
                                        {LINK_ICONS[link.link_type]}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {LINK_TYPE_LABELS[link.link_type]}
                                        </span>
                                        {link.campaign_name && !campaignId && (
                                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                                {link.campaign_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={cn(
                                        "text-2xl font-black tabular-nums leading-none",
                                        isClicked ? "text-slate-900" : "text-slate-300"
                                    )}>
                                        {link.click_count}
                                    </div>
                                    <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Clics</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 truncate">
                                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <a href={link.original_url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline truncate">
                                        {link.link_label || link.original_url}
                                    </a>
                                </div>
                                {link.last_clicked_at ? (
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                        <Calendar className="h-3 w-3" />
                                        Dernier : <span className="text-slate-700 font-semibold">{format(new Date(link.last_clicked_at), 'd MMM yyyy, HH:mm', { locale: fr })}</span>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-400 italic">Jamais cliqué</div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Tiny badge for use in tables ─────────────────────────────────────────────

export function EmailLinkClicksBadge({ clickCount }: { clickCount: number }) {
    if (!clickCount || clickCount === 0) return <span className="text-xs text-slate-300 font-medium">—</span>
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md shadow-sm">
            <MousePointerClick className="h-3 w-3" />
            {clickCount}
        </span>
    )
}

