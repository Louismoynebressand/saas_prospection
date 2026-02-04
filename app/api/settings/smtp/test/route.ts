import { NextRequest, NextResponse } from "next/server"
import { verifySmtpWithWebhook } from "@/lib/smtp-verification"

// Export a robust POST handler for testing SMTP via Webhook
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { host, port, user, pass, from_email, from_name, provider } = body

        console.log("Testing SMTP Connection via Webhook:", { host, port, user })

        if (!host || !port || !user || !pass) {
            return NextResponse.json({ success: false, error: "Paramètres manquants" }, { status: 400 })
        }

        // Use the shared verification logic
        const result = await verifySmtpWithWebhook({
            smtp_host: host,
            smtp_port: parseInt(port.toString()),
            smtp_user: user,
            smtp_password: pass,
            from_email,
            from_name,
            provider
        })

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: result.message || "Connexion validée par le système de test"
            })
        } else {
            return NextResponse.json({
                success: false,
                error: result.message || "Echec de connexion",
                details: result.details
            }, { status: 400 }) // Return 400 on logical failure
        }

    } catch (error: any) {
        console.error("SMTP Test Route Error:", error)
        return NextResponse.json({
            success: false,
            error: "Erreur interne lors du test",
            details: error.message
        }, { status: 500 })
    }
}
