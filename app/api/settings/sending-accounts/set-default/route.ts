import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * POST /api/settings/sending-accounts/set-default
 * Définit un compte d'envoi comme compte par défaut pour l'utilisateur.
 * Remet is_default=false sur tous les autres comptes de l'utilisateur.
 *
 * Body: { account_id: string }
 */
export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { account_id } = body

        if (!account_id) {
            return NextResponse.json({ error: "account_id requis" }, { status: 400 })
        }

        // Vérifier la propriété du compte
        const { data: account, error: verifyError } = await supabase
            .from("smtp_configurations")
            .select("id, provider, from_email")
            .eq("id", account_id)
            .eq("user_id", user.id)
            .single()

        if (verifyError || !account) {
            return NextResponse.json({ error: "Compte introuvable ou non autorisé" }, { status: 404 })
        }

        // Retirer is_default de tous les autres comptes de l'utilisateur
        const { error: resetError } = await supabase
            .from("smtp_configurations")
            .update({ is_default: false })
            .eq("user_id", user.id)
            .neq("id", account_id)

        if (resetError) throw resetError

        // Définir ce compte comme défaut
        const { error: setError } = await supabase
            .from("smtp_configurations")
            .update({ is_default: true })
            .eq("id", account_id)
            .eq("user_id", user.id)

        if (setError) throw setError

        return NextResponse.json({
            success: true,
            default_account: { id: account.id, from_email: account.from_email, provider: account.provider }
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur serveur"
        console.error("[set-default] Error:", message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
