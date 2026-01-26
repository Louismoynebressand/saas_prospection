"use client"

import { Check, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrapeJob } from "@/types"
import { getJobStages, getJobProgress, normalizeStatus, JobStatus } from "@/lib/jobStatus"

interface JobStepperProps {
    job: ScrapeJob
    className?: string
}

export function JobStepper({ job, className }: JobStepperProps) {
    const stages = getJobStages(job)
    const progress = getJobProgress(job.statut, stages)
    const currentStatus = normalizeStatus(job.statut)

    // Find current stage index
    const currentStageIndex = stages.findIndex(s => s.key === currentStatus)

    return (
        <div className={cn("space-y-6", className)}>
            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Progression</span>
                    <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Stepper */}
            <div className="relative">
                <div className="flex items-start justify-between">
                    {stages.map((stage, index) => {
                        const isActive = stage.key === currentStatus
                        const isDone = index < currentStageIndex || currentStatus === JobStatus.DONE
                        const isCurrent = index === currentStageIndex && currentStatus !== JobStatus.DONE

                        return (
                            <div key={stage.key} className="flex-1 relative flex flex-col items-center">
                                {/* Connector Line */}
                                {index < stages.length - 1 && (
                                    <div
                                        className={cn(
                                            "absolute top-5 left-1/2 w-full h-0.5",
                                            isDone ? "bg-primary" : "bg-muted"
                                        )}
                                        style={{ zIndex: -1 }}
                                    />
                                )}

                                {/* Step Circle */}
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center",
                                    "transition-all duration-300 relative z-10 bg-background",
                                    "border-2",
                                    isDone && "bg-primary border-primary text-primary-foreground",
                                    isCurrent && "border-primary bg-primary/10 text-primary animate-pulse",
                                    !isDone && !isCurrent && "border-muted bg-muted/50 text-muted-foreground"
                                )}>
                                    {isDone ? (
                                        <Check className="h-5 w-5" />
                                    ) : isCurrent ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span className="text-sm font-semibold">{index + 1}</span>
                                    )}
                                </div>

                                {/* Step Label */}
                                <div className="mt-3 text-center max-w-[120px]">
                                    <p className={cn(
                                        "text-sm font-medium leading-tight",
                                        isCurrent && "text-primary",
                                        isDone && "text-foreground",
                                        !isDone && !isCurrent && "text-muted-foreground"
                                    )}>
                                        {stage.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-tight">
                                        {stage.description}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Estimated Time Alert */}
            {progress < 100 && currentStatus !== JobStatus.ERROR && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-900 dark:text-blue-100">
                        Temps estimé: <strong>2-5 minutes</strong> selon le volume de résultats et les options sélectionnées.
                    </AlertDescription>
                </Alert>
            )}

            {/* Completion Message */}
            {currentStatus === JobStatus.DONE && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-900 dark:text-green-100">
                        <strong>Recherche terminée !</strong> Les prospects sont prêts à être consultés ci-dessous.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    )
}
