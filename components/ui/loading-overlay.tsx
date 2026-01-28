"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Brain, Sparkles } from "lucide-react"

interface LoadingOverlayProps {
    message?: string
    subMessage?: string
}

export function LoadingOverlay({
    message = "IA en action",
    subMessage = "L'intelligence artificielle analyse les données..."
}: LoadingOverlayProps) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 rounded-lg"
            >
                {/* Animated orbitals */}
                <div className="relative w-32 h-32 mb-8">
                    {/* Center Brain */}
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-xl opacity-50" />
                            <Brain className="w-16 h-16 text-indigo-600 relative z-10" />
                        </div>
                    </motion.div>

                    {/* Orbital 1 */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute inset-0"
                    >
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                        </div>
                    </motion.div>

                    {/* Orbital 2 */}
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute inset-0"
                    >
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                        </div>
                    </motion.div>

                    {/* Orbital 3 */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute inset-0 scale-75"
                    >
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
                            <Sparkles className="w-3 h-3 text-pink-500" />
                        </div>
                    </motion.div>

                    {/* Orbital 4 */}
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{
                            duration: 6,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute inset-0 scale-75"
                    >
                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                            <Sparkles className="w-3 h-3 text-cyan-500" />
                        </div>
                    </motion.div>
                </div>

                {/* Text */}
                <motion.h3
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2"
                >
                    ✨ {message}
                </motion.h3>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-sm text-muted-foreground text-center max-w-md"
                >
                    {subMessage}
                </motion.p>

                {/* Animated dots */}
                <motion.div className="flex gap-2 mt-6">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.4, 1, 0.4]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.2
                            }}
                            className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        />
                    ))}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
