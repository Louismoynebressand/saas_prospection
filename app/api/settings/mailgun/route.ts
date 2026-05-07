import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const mailgunBaseSchema = z.object({
    name: z.string().min(1, "Nom requis"),
    provider: z.literal("mailgun_api"),
    mailgun_domain: z.string().min(1, "Domaine Mailgun requis"),
    mailgun_region: z.enum(["US", "EU"]),
    from_email: z.string().email("Email d'envoi invalide"),
    from_name: z.string().optional(),
    reply_to: z.string().email().optional().or(z.literal("")),
    daily_limit: z.number().int().positive().optional().nullable(),
    tracking_opens: z.boolean().default(true),
    tracking_clicks: z.boolean().default(true),
    is_active: z.boolean().default(true),
    mailgun_webhook_signing_key: z.string().optional(),
})

// Create: mailgun_api_key required
const mailgunCreateSchema = mailgunBaseSchema.extend({
    mailgun_api_key: z.string().min(1, "Clé API requise"),
})

// Update: mailgun_api_key optional (not re-sent if not changed)
const mailgunUpdateSchema = mailgunBaseSchema.extend({
    mailgun_api_key: z.string().optional(),
})

// Colonnes à retourner au frontend (jamais les secrets)
const SAFE_SELECT_COLUMNS = [
    "id",
    "name",
    "provider",
    "mailgun_domain",
    "mailgun_region",
    "from_email",
    "from_name",
    "reply_to",
    "daily_limit",
    "tracking_opens",
    "tracking_clicks",
    "is_active",
    "is_default",
    "created_at",
    "updated_at",
    // mailgun_api_key et mailgun_webhook_signing_key JAMAIS renvoyées
].join(", ")

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { data, error } = await supabase
            .from("smtp_configurations")
            .select(SAFE_SELECT_COLUMNS)
            .eq("user_id", user.id)
            .eq("provider", "mailgun_api")
            .order("created_at", { ascending: false })

        if (error) throw error

        return NextResponse.json({ configs: data })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur serveur"
        console.error("[Mailgun Settings GET] Error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
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
        const { id, ...configData } = body

        // Use the appropriate schema depending on create vs update
        const schema = id ? mailgunUpdateSchema : mailgunCreateSchema
        const validation = schema.safeParse(configData)
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation échouée", details: validation.error.format() },
                { status: 400 }
            )
        }

        const payload: Record<string, unknown> = {
            user_id: user.id,
            name: validation.data.name,
            provider: "mailgun_api",
            mailgun_domain: validation.data.mailgun_domain,
            mailgun_region: validation.data.mailgun_region,
            from_email: validation.data.from_email,
            from_name: validation.data.from_name || null,
            reply_to: validation.data.reply_to || null,
            daily_limit: validation.data.daily_limit || null,
            tracking_opens: validation.data.tracking_opens,
            tracking_clicks: validation.data.tracking_clicks,
            is_active: validation.data.is_active,
            mailgun_webhook_signing_key: validation.data.mailgun_webhook_signing_key || null,
            updated_at: new Date().toISOString(),
        }

        // Only update secrets if explicitly provided (not re-sent on simple edits)
        if (validation.data.mailgun_api_key) {
            payload.mailgun_api_key = validation.data.mailgun_api_key
        }


        if (id) {
            // Update
            const { data, error } = await supabase
                .from("smtp_configurations")
                .update(payload)
                .eq("id", id)
                .eq("user_id", user.id)
                .select(SAFE_SELECT_COLUMNS)
                .single()

            if (error) throw error
            return NextResponse.json({ config: data })
        } else {
            // Insert
            const { data, error } = await supabase
                .from("smtp_configurations")
                .insert(payload)
                .select(SAFE_SELECT_COLUMNS)
                .single()

            if (error) throw error
            return NextResponse.json({ config: data })
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur serveur"
        console.error("[Mailgun Settings POST] Error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

        // Vérifier la propriété
        const { data: existing, error: verifyError } = await supabase
            .from("smtp_configurations")
            .select("id")
            .eq("id", id)
            .eq("user_id", user.id)
            .eq("provider", "mailgun_api")
            .single()

        if (verifyError || !existing) {
            return NextResponse.json({ error: "Configuration introuvable ou non autorisée" }, { status: 404 })
        }

        // Découpler des campaign_schedules avant suppression
        const { error: updateError } = await supabase
            .from("campaign_schedules")
            .update({ smtp_configuration_id: null })
            .eq("smtp_configuration_id", id)

        if (updateError) {
            console.error("[Mailgun Settings DELETE] Failed to decouple from schedules:", updateError)
            throw updateError
        }

        const { error } = await supabase
            .from("smtp_configurations")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur serveur"
        console.error("[Mailgun Settings DELETE] Error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
