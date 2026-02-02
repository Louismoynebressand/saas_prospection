"use client"

import { motion } from "framer-motion"
import { Loader2, Sparkles } from "lucide-react"
import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AIButtonProps extends Omit<ButtonProps, "variant"> {
    loading?: boolean
    variant?: "primary" | "secondary" | "success" | "outline"
    children: React.ReactNode
    hideIcon?: boolean
}

export function AIButton({
    loading = false,
    variant = "primary",
    children,
    className,
    disabled,
    ...props
}: AIButtonProps) {

    const variantStyles = {
        primary: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700",
        secondary: "bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 hover:from-blue-600 hover:via-cyan-600 hover:to-teal-600",
        success: "bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600",
        outline: "bg-white border-2 border-indigo-100 hover:border-indigo-300 text-indigo-700 hover:bg-indigo-50"
    }

    return (
        <motion.div
            whileHover={{ scale: disabled || loading ? 1 : 1.05 }}
            whileTap={{ scale: disabled || loading ? 1 : 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={variant === 'outline' ? "p-[1px] rounded-md bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" : ""}
        >
            <Button
                className={cn(
                    "relative overflow-hidden group text-white shadow-lg",
                    variantStyles[variant],
                    disabled && "opacity-50 cursor-not-allowed",
                    variant === 'outline' && "shadow-sm border-0 w-full h-full",
                    className
                )}
                disabled={disabled || loading}
                {...props}
            >
                {/* Animated shimmer effect */}
                <motion.div
                    className={cn(
                        "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent",
                        variant === 'outline' && "via-indigo-100/30"
                    )}
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{
                        repeat: Infinity,
                        duration: 2,
                        ease: "linear"
                    }}
                />

                {/* Content */}
                <span className="relative z-10 flex items-center gap-2">
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : !props.hideIcon && (
                        <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                    )}
                    {children}
                </span>
            </Button>
        </motion.div>
    )
}
