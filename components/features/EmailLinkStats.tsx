"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Globe, Link, MousePointerClick, Calendar } from "lucide-react"
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
    phone: <Phone className="h-3.5 w-3.5 text-blue-600" />,
    email: <Mail className="h-3.5 w-3.5 text-violet-600" />,
    website: <Globe className="h-3.5 w-3.5 text-emerald-600" />,
    custom: <Link className="h-3.5 w-3.5 text-amber-600" />,
}

const LINK_TYPE_LABELS: Record<string, string> = {
    phone: 'Téléphone',
    email: 'Email',
    website: 'Site web',
    custom: 'Lien perso',
}

const LINK_COLORS: Record<string, string> = {
    phone: 'bg-blue-50 border-blue-200 text-blue-800',
    email: 'bg-violet-50 border-violet-200 text-violet-800',
    website: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    custom: 'bg-amber-50 border-amber-200 text-amber-800',
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
            <div className={cn("text-sm text-muted-foreground italic", className)}>
                Aucun lien traçable généré pour ce prospect.
            </div>
        )
    }

    // ── Compact view (for table cell / popover) ──────────────────────────────
    if (compact) {
        if (totalClicks === 0) return (
            <span className="text-xs text-muted-foreground">—</span>
        )
        return (
            <div className={cn("flex items-center gap-1 flex-wrap", className)}>
                {clickedLinks.map(l => (
                    <span
                        key={l.id}
                        className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium", LINK_COLORS[l.link_type])}
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
        <div className={cn("space-y-3", className)}>
            {/* Summary */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MousePointerClick className="h-4 w-4 text-indigo-600" />
                    <span>{totalClicks} clic{totalClicks > 1 ? 's' : ''} total</span>
                </div>
                <span className="text-muted-foreground text-xs">
                    sur {links.length} lien{links.length > 1 ? 's' : ''} traqué{links.length > 1 ? 's' : ''}
                </span>
            </div>

            {/* Per-link breakdown */}
            <div className="space-y-2">
                {links.map(link => (
                    <div
                        key={link.id}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border",
                            link.click_count > 0
                                ? LINK_COLORS[link.link_type]
                                : "bg-slate-50 border-slate-200 text-slate-500"
                        )}
                    >
                        <div className="shrink-0">{LINK_ICONS[link.link_type]}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">{LINK_TYPE_LABELS[link.link_type]}</span>
                                {link.campaign_name && !campaignId && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{link.campaign_name}</Badge>
                                )}
                            </div>
                            <p className="text-[11px] truncate opacity-70">{link.link_label || link.original_url}</p>
                            {link.last_clicked_at && (
                                <p className="text-[10px] opacity-60 flex items-center gap-1 mt-0.5">
                                    <Calendar className="h-2.5 w-2.5" />
                                    Dernier clic : {format(new Date(link.last_clicked_at), 'd MMM à HH:mm', { locale: fr })}
                                </p>
                            )}
                        </div>
                        <div className="shrink-0 text-right">
                            <span className={cn(
                                "text-lg font-bold",
                                link.click_count > 0 ? "text-current" : "text-slate-300"
                            )}>
                                {link.click_count}
                            </span>
                            <p className="text-[10px] opacity-70">clic{link.click_count > 1 ? 's' : ''}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Tiny badge for use in tables ─────────────────────────────────────────────

export function EmailLinkClicksBadge({ clickCount }: { clickCount: number }) {
    if (!clickCount || clickCount === 0) return <span className="text-xs text-muted-foreground">—</span>
    return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
            <MousePointerClick className="h-3 w-3" />
            {clickCount}
        </span>
    )
}
