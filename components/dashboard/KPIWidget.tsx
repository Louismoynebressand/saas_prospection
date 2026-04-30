"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LucideIcon, AlertCircle, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface KPIWidgetProps {
    title: string
    icon: LucideIcon
    value?: string | number
    subtitle?: string
    trend?: {
        value: number
        label: string
    }
    loading?: boolean
    error?: string
    onRetry?: () => void
    isEmpty?: boolean
    emptyMessage?: string
    emptyAction?: {
        label: string
        href: string
    }
    className?: string
    accentColor?: "violet" | "indigo" | "fuchsia" | "emerald" | "cyan" | "amber" | "rose"
}

const accentMap = {
    violet: {
        bg: "from-violet-500/10 via-violet-400/5 to-transparent",
        iconBg: "bg-violet-100/80 dark:bg-violet-900/30",
        icon: "text-violet-600 dark:text-violet-400",
        glow: "hover:shadow-violet-200/40 dark:hover:shadow-violet-900/40",
        border: "hover:border-violet-200/60",
        value: "text-foreground",
        pulse: "bg-violet-400",
    },
    indigo: {
        bg: "from-indigo-500/10 via-indigo-400/5 to-transparent",
        iconBg: "bg-indigo-100/80 dark:bg-indigo-900/30",
        icon: "text-indigo-600 dark:text-indigo-400",
        glow: "hover:shadow-indigo-200/40 dark:hover:shadow-indigo-900/40",
        border: "hover:border-indigo-200/60",
        value: "text-foreground",
        pulse: "bg-indigo-400",
    },
    fuchsia: {
        bg: "from-fuchsia-500/10 via-fuchsia-400/5 to-transparent",
        iconBg: "bg-fuchsia-100/80 dark:bg-fuchsia-900/30",
        icon: "text-fuchsia-600 dark:text-fuchsia-400",
        glow: "hover:shadow-fuchsia-200/40",
        border: "hover:border-fuchsia-200/60",
        value: "text-foreground",
        pulse: "bg-fuchsia-400",
    },
    emerald: {
        bg: "from-emerald-500/10 via-emerald-400/5 to-transparent",
        iconBg: "bg-emerald-100/80 dark:bg-emerald-900/30",
        icon: "text-emerald-600 dark:text-emerald-400",
        glow: "hover:shadow-emerald-200/40",
        border: "hover:border-emerald-200/60",
        value: "text-foreground",
        pulse: "bg-emerald-400",
    },
    cyan: {
        bg: "from-cyan-500/10 via-cyan-400/5 to-transparent",
        iconBg: "bg-cyan-100/80 dark:bg-cyan-900/30",
        icon: "text-cyan-600 dark:text-cyan-400",
        glow: "hover:shadow-cyan-200/40",
        border: "hover:border-cyan-200/60",
        value: "text-foreground",
        pulse: "bg-cyan-400",
    },
    amber: {
        bg: "from-amber-500/10 via-amber-400/5 to-transparent",
        iconBg: "bg-amber-100/80 dark:bg-amber-900/30",
        icon: "text-amber-600 dark:text-amber-400",
        glow: "hover:shadow-amber-200/40",
        border: "hover:border-amber-200/60",
        value: "text-foreground",
        pulse: "bg-amber-400",
    },
    rose: {
        bg: "from-rose-500/10 via-rose-400/5 to-transparent",
        iconBg: "bg-rose-100/80 dark:bg-rose-900/30",
        icon: "text-rose-600 dark:text-rose-400",
        glow: "hover:shadow-rose-200/40",
        border: "hover:border-rose-200/60",
        value: "text-foreground",
        pulse: "bg-rose-400",
    },
}

export function KPIWidget({
    title,
    icon: Icon,
    value,
    subtitle,
    trend,
    loading = false,
    error,
    onRetry,
    isEmpty = false,
    emptyMessage,
    emptyAction,
    className = "",
    accentColor = "violet",
}: KPIWidgetProps) {
    const accent = accentMap[accentColor]

    return (
        <Card
            className={cn(
                "group relative overflow-hidden",
                "transition-all duration-300 ease-in-out",
                "bg-white/70 dark:bg-slate-900/50",
                "backdrop-blur-md",
                "border border-slate-200/60 dark:border-white/8",
                "shadow-sm hover:shadow-xl",
                accent.glow,
                accent.border,
                "hover:-translate-y-0.5",
                className
            )}
        >
            {/* Gradient background accent */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none transition-opacity duration-500 group-hover:opacity-100",
                accent.bg
            )} />

            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "16px 16px" }} />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {title}
                </CardTitle>
                <div className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center",
                    "transition-all duration-300",
                    "group-hover:scale-110 group-hover:shadow-md",
                    accent.iconBg,
                )}>
                    <Icon className={cn("h-4 w-4", accent.icon)} />
                </div>
            </CardHeader>

            <CardContent className="relative z-10 pb-4">
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-20 bg-muted/50" />
                        <Skeleton className="h-3 w-28 bg-muted/30" />
                    </div>
                ) : error ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Erreur</span>
                        </div>
                        {onRetry && (
                            <Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs">
                                Réessayer
                            </Button>
                        )}
                    </div>
                ) : isEmpty ? (
                    <div className="space-y-2">
                        <div className="text-2xl font-bold text-muted-foreground/20">—</div>
                        <p className="text-xs text-muted-foreground/70">{emptyMessage || "Aucune donnée"}</p>
                        {emptyAction && (
                            <Link
                                href={emptyAction.href}
                                className={cn(
                                    "inline-flex items-center gap-1 text-xs font-medium transition-colors",
                                    accent.icon,
                                    "hover:opacity-80"
                                )}
                            >
                                {emptyAction.label}
                                <ArrowUpRight className="h-3 w-3" />
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="text-3xl font-bold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors tabular-nums">
                            {typeof value === "number" ? value.toLocaleString('fr-FR') : value}
                        </div>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground/80 font-medium">
                                {subtitle}
                            </p>
                        )}
                        {trend && (
                            <div className={cn(
                                "text-xs font-medium flex items-center gap-1 mt-2 px-2 py-1 rounded-full w-fit",
                                trend.value > 0
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                    : trend.value < 0
                                        ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                        : "bg-muted text-muted-foreground"
                            )}>
                                {trend.value > 0 && "↑"}{trend.value < 0 && "↓"}
                                {trend.value !== 0 && ` ${Math.abs(trend.value)}%`}
                                <span className="opacity-70 font-normal">{trend.label}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
