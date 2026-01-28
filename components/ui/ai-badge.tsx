"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AIBadgeProps {
    children?: React.ReactNode
    className?: string
    animated?: boolean
}

export function AIBadge({
    children = "AI-Powered",
    className,
    animated = true
}: AIBadgeProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
                "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
                "text-white shadow-lg",
                className
            )}
        >
            {animated ? (
                <motion.div
                    animate={{
                        rotate: [0, 360],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Sparkles className="w-3 h-3" />
                </motion.div>
            ) : (
                <Sparkles className="w-3 h-3" />
            )}
            <span>{children}</span>

            {/* Glow pulse */}
            {animated && (
                <motion.div
                    className="absolute inset-0 rounded-full blur-md opacity-50"
                    style={{
                        background: "linear-gradient(135deg, rgb(99 102 241), rgb(168 85 247), rgb(236 72 153))"
                    }}
                    animate={{
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            )}
        </motion.div>
    )
}
