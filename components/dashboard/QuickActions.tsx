"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Search, History, ShieldCheck, Mail } from "lucide-react"

export function QuickActions() {
    const actions = [
        {
            label: "Nouvelle recherche",
            href: "/recherche-prospect",
            icon: Search,
            variant: "default" as const
        },
        {
            label: "Historique",
            href: "/searches",
            icon: History,
            variant: "outline" as const
        },
        {
            label: "Vérifier emails",
            href: "/email-verifier",
            icon: ShieldCheck,
            variant: "outline" as const
        },
        {
            label: "Générer emails",
            href: "/emails",
            icon: Mail,
            variant: "outline" as const
        }
    ]

    return (
        <div className="flex flex-wrap gap-3">
            {actions.map((action) => {
                const Icon = action.icon
                return (
                    <Button
                        key={action.href}
                        variant={action.variant}
                        size="sm"
                        asChild
                        className="
                            transition-all duration-300
                            hover:scale-105 hover:shadow-md
                            active:scale-95
                        "
                    >
                        <Link href={action.href} className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {action.label}
                        </Link>
                    </Button>
                )
            })}
        </div>
    )
}
