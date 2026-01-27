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
                transition-all duration-300 ease-out
                hover:shadow-[0_0_0_1px_hsl(270,70%,60%),0_0_20px_hsla(270,70%,60%,0.15)]
                active:scale-[0.98]
                bg-card/50 backdrop-blur-sm
                ${className}
            `}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-300 group-hover:bg-violet-500/20 group-hover:scale-110">
                    <Icon className="h-4 w-4 text-violet-600" />
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-24 bg-muted/50" />
                        <Skeleton className="h-4 w-32 bg-muted/30" />
                    </div>
                ) : error ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Erreur de chargement</span>
                        </div>
                        {onRetry && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRetry}
                                className="h-8 text-xs"
                            >
                                Réessayer
                            </Button>
                        )}
                    </div>
                ) : isEmpty ? (
                    <div className="space-y-2">
                        <div className="text-2xl font-bold text-muted-foreground/50">—</div>
                        <p className="text-xs text-muted-foreground">
                            {emptyMessage || "Aucune donnée"}
                        </p>
                        {emptyAction && (
                            <Button
                                variant="link"
                                size="sm"
                                asChild
                                className="h-auto p-0 text-xs text-violet-600 hover:text-violet-700"
                            >
                                <a href={emptyAction.href}>{emptyAction.label} →</a>
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="text-3xl font-bold tracking-tight">
                            {value?.toLocaleString('fr-FR')}
                        </div>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                {subtitle}
                            </p>
                        )}
                        {trend && (
                            <div className={`text-xs font-medium flex items-center gap-1 ${trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-red-600' : 'text-muted-foreground'
                                }`}>
                                {trend.value > 0 && '↑'}
                                {trend.value < 0 && '↓'}
                                {trend.value !== 0 && ` ${Math.abs(trend.value)}%`}
                                <span className="text-muted-foreground ml-1">{trend.label}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
