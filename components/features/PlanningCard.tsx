"use client"

import { useRef, useState, MouseEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Play, Send, Inbox, Zap } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion"

interface PlanningCardProps {
    schedule: any
    stats: {
        pending: number
        sent: number
    }
}

export function PlanningCard({ schedule, stats }: PlanningCardProps) {
    const activeDays = schedule.days_of_week || []

    // Tilt Effect State
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 })
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 })

    function onMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
        const { left, top, width, height } = currentTarget.getBoundingClientRect()
        const xPct = (clientX - left) / width - 0.5
        const yPct = (clientY - top) / height - 0.5

        // Tilt range: -10deg to 10deg
        x.set(xPct)
        y.set(yPct)
    }

    function onMouseLeave() {
        x.set(0)
        y.set(0)
    }

    const rotateX = useMotionTemplate`${mouseY.get() * -20}deg` // Invert Y for correct tilt feel
    const rotateY = useMotionTemplate`${mouseX.get() * 20}deg`

    const weekDays = [
        { val: 1, label: 'L' },
        { val: 2, label: 'M' },
        { val: 3, label: 'M' },
        { val: 4, label: 'J' },
        { val: 5, label: 'V' },
        { val: 6, label: 'S' },
        { val: 7, label: 'D' },
    ]

    return (
        <motion.div
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{
                perspective: 1000,
                transformStyle: "preserve-3d",
                rotateX,
                rotateY
            }}
            className="group h-full"
        >
            <Card className="flex flex-col h-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 rounded-2xl overflow-hidden relative">

                {/* Glow Effect Layer */}
                <div className="absolute inset-0 z-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                {/* Dynamic Sheen/Spotlight */}
                <motion.div
                    style={{
                        background: useMotionTemplate`radial-gradient(
                            600px circle at ${mouseX.get() * 100 + 50}% ${mouseY.get() * 100 + 50}%,
                            rgba(99, 102, 241, 0.10),
                            transparent 40%
                        )`,
                    }}
                    className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                />

                {/* Decorational Gradients (Subtle fixed ones) */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none" />

                <Link href={`/campaigns/${schedule.campaign_id}?tab=planning`} className="absolute inset-0 z-10" />

                <CardHeader className="pb-3 z-20 relative">
                    <div className="flex justify-between items-start mb-4">
                        <Badge variant="outline" className="bg-white/50 backdrop-blur border-indigo-100 text-indigo-600 text-[10px] uppercase tracking-wider font-bold shadow-sm">
                            Mail Prospection
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100/50 px-2.5 py-1 rounded-full border border-slate-100">
                            <Clock className="w-3.5 h-3.5 text-indigo-500/70" />
                            <span>{schedule.time_window_start.slice(0, 5)} - {schedule.time_window_end.slice(0, 5)}</span>
                        </div>
                    </div>

                    <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors duration-300 line-clamp-1">
                        {schedule.campaign.campaign_name}
                    </CardTitle>
                    <CardDescription className="line-clamp-1 text-slate-500">
                        {schedule.campaign.target_audience || "Audience non définie"}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 z-20 relative pointer-events-none">
                    {/* 3D Pop stats grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6" style={{ transform: "translateZ(20px)" }}>
                        {/* Box 1: Envois / Jour */}
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300 group/box">
                            <div className="text-[10px] text-slate-400 group-hover/box:text-indigo-400 uppercase font-black tracking-wider mb-1 flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                Envois / Jour
                            </div>
                            <div className="text-lg font-black text-slate-800 flex items-baseline gap-1 group-hover/box:text-indigo-600 transition-colors">
                                {schedule.daily_limit}
                                <span className="text-xs font-semibold text-slate-400">auth.</span>
                            </div>
                        </div>

                        {/* Box 2: En attente */}
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 transition-all duration-300 group/box">
                            <div className="text-[10px] text-slate-400 group-hover/box:text-blue-400 uppercase font-black tracking-wider mb-1 flex items-center gap-1">
                                <Inbox className="w-3 h-3" />
                                En attente
                            </div>
                            <div className="text-lg font-black text-slate-800 group-hover/box:text-blue-600 transition-colors">
                                {stats.pending}
                            </div>
                        </div>

                        {/* Box 3: Total */}
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 col-span-2 flex justify-between items-center hover:border-emerald-200 hover:bg-white hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-all duration-300 group/box">
                            <div className="text-[10px] text-slate-400 group-hover/box:text-emerald-500 uppercase font-black tracking-wider flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                Total Envoyés
                            </div>
                            <div className="text-lg font-black text-emerald-600 group-hover/box:scale-110 transition-transform">{stats.sent}</div>
                        </div>
                    </div>

                    {/* Days Visualization */}
                    <div className="mb-2" style={{ transform: "translateZ(10px)" }}>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2 pl-1">Jours actifs</div>
                        <div className="flex justify-between items-center gap-1">
                            {weekDays.map((d) => {
                                const isActive = activeDays.includes(d.val)
                                return (
                                    <div
                                        key={d.val}
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500",
                                            isActive
                                                ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 scale-100 opacity-100 ring-2 ring-white"
                                                : "bg-slate-100/50 text-slate-300 scale-90 border border-slate-100"
                                        )}
                                    >
                                        {d.label}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </CardContent>

                <div className="p-5 pt-0 mt-auto z-30 relative" style={{ transform: "translateZ(30px)" }}>
                    <Button
                        className="w-full bg-slate-900/95 hover:bg-indigo-600 text-white gap-2 pointer-events-auto rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-indigo-500/30 hover:scale-105 transition-all duration-300"
                        asChild
                    >
                        <Link href={`/campaigns/${schedule.campaign_id}?tab=planning`}>
                            En savoir plus
                            <Play className="w-3 h-3 ml-1 fill-current opacity-70" />
                        </Link>
                    </Button>
                </div>
            </Card>
        </motion.div>
    )
}
