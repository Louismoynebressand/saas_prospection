"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LucideIcon, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    className = ""
}: KPIWidgetProps) {
    return (
        <Card
            className={`
                group relative overflow-hidden
                transition-all duration-300 ease-in-out
                bg-white/60 dark:bg-slate-900/40 
                backdrop-blur-md
                border border-white/20 dark:border-white/10
                shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]
                hover:shadow-[0_4px_30px_-5px_rgba(139,92,246,0.15)]
                hover:-translate-y-1
                ${className}
            `}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    {title}
                </CardTitle>
                <div className="h-9 w-9 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center transition-all duration-300 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40 group-hover:scale-110 shadow-sm group-hover:shadow group-hover:shadow-violet-200/50 dark:group-hover:shadow-violet-900/50">
                    <Icon className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400 opacity-80 group-hover:opacity-100" />
                </div>
            </CardHeader>
            <CardContent className="relative z-10">
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-24 bg-muted/50" />
                        <Skeleton className="h-4 w-32 bg-muted/30" />
                    </div>
                ) : error ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Erreur</span>
                        </div>
                        {onRetry && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRetry}
                                className="h-8 text-xs bg-white/50 hover:bg-white/80"
                            >
                                Réessayer
                            </Button>
                        )}
                    </div>
                ) : isEmpty ? (
                    <div className="space-y-2">
                        <div className="text-2xl font-bold text-muted-foreground/30">—</div>
                        <p className="text-xs text-muted-foreground/80">
                            {emptyMessage || "Aucune donnée"}
                        </p>
                        {emptyAction && (
                            <Button
                                variant="link"
                                size="sm"
                                asChild
                                className="h-auto p-0 text-xs text-violet-600 hover:text-violet-700 font-medium"
                            >
                                <a href={emptyAction.href}>{emptyAction.label} →</a>
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="text-3xl font-bold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
                            {value?.toLocaleString('fr-FR')}
                        </div>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground/80 font-medium tracking-wide">
                                {subtitle}
                            </p>
                        )}
                        {trend && (
                            <div className={`text-xs font-medium flex items-center gap-1 mt-2 p-1 px-2 rounded-full w-fit ${trend.value > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : trend.value < 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-gray-50 text-gray-700'
                                }`}>
                                {trend.value > 0 && '↑'}
                                {trend.value < 0 && '↓'}
                                {trend.value !== 0 && ` ${Math.abs(trend.value)}%`}
                                <span className="opacity-70 ml-1 font-normal">{trend.label}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
