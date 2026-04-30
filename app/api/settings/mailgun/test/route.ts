import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkMailgunDomain } from "@/lib/mailgun"

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { api_key, domain, region } = body

        if (!api_key || !domain || !region) {
            return NextResponse.json(
                { error: "api_key, domain et region sont requis" },
                { status: 400 }
            )
        }

        if (!["US", "EU"].includes(region)) {
            return NextResponse.json(
                { error: "Région invalide (US ou EU)" },
                { status: 400 }
            )
        }

        const result = await checkMailgunDomain(api_key, domain, region as "US" | "EU")

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `✅ Connexion réussie ! Le domaine "${domain}" est actif sur Mailgun.`,
            })
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error || "Impossible de vérifier le domaine",
                },
                { status: 400 }
            )
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur serveur"
        console.error("[Mailgun Test] Error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
