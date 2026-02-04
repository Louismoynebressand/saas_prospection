import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const smtpSchema = z.object({
    name: z.string().min(1, "Nom requis"),
    provider: z.enum(['gmail', 'outlook', 'ionos', 'custom']),
    smtp_host: z.string().min(1, "Hôte requis"),
    smtp_port: z.number().int().positive(),
    smtp_user: z.string().email("Email utilisateur invalide"),
    smtp_password: z.string().min(1, "Mot de passe requis"),
    from_email: z.string().email("Email d'envoi invalide"),
    from_name: z.string().optional(),
})

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { data, error } = await supabase
            .from("smtp_configurations")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })

        if (error) throw error

        return NextResponse.json({ configs: data })
    } catch (error: any) {
        console.error("Error fetching SMTP configs:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const validation = smtpSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json({ error: "Validation failed", details: validation.error.format() }, { status: 400 })
        }

        // --- SMTP VERIFICATION STEP ---
        // Import locally to avoid top-level issues if any
        const { verifySmtpWithWebhook } = await import("@/lib/smtp-verification")

        console.log("Verifying SMTP before save...")
        const verificationResult = await verifySmtpWithWebhook({
            smtp_host: validation.data.smtp_host,
            smtp_port: validation.data.smtp_port,
            smtp_user: validation.data.smtp_user,
            smtp_password: validation.data.smtp_password,
            from_email: validation.data.from_email,
            from_name: validation.data.from_name,
            provider: validation.data.provider
        })

        if (!verificationResult.success) {
            console.log("SMTP Verification Failed:", verificationResult.message)
            return NextResponse.json({
                error: verificationResult.message || "Vérification SMTP échouée",
                verification_failed: true
            }, { status: 400 })
        }
        // ------------------------------

        const { data, error } = await supabase
            .from("smtp_configurations")
            .insert({
                user_id: user.id,
                ...validation.data
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ config: data })
    } catch (error: any) {
        console.error("Error creating SMTP config:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

        const { error } = await supabase
            .from("smtp_configurations")
            .delete()
            .eq("id", id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
