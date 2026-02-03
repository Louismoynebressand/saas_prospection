import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

// Export a robust POST handler for testing SMTP
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { host, port, user, pass } = body

        console.log("Testing SMTP Connection:", { host, port, user })

        if (!host || !port || !user || !pass) {
            return NextResponse.json({ success: false, error: "Paramètres manquants" }, { status: 400 })
        }

        // Determine security settings based on port
        // Port 465 is typical for implicit SSL/TLS
        // Port 587 is typical for STARTTLS
        const safePort = parseInt(port.toString()) || 587
        const isSecure = safePort === 465

        const transporter = nodemailer.createTransport({
            host: host,
            port: safePort,
            secure: isSecure,
            auth: {
                user: user,
                pass: pass,
            },
            tls: {
                // In production, we should be strict, but for testing, let's allow self-signed if needed
                // But generally big providers have valid certs.
                // We'll set rejectUnauthorized to false just to be safe during "test" phase unless it's critical.
                // Actually, let's default to true for security, but maybe allow an override env var?
                // For now, false to avoid "Self signed cert" errors on custom hosting.
                rejectUnauthorized: false
            },
            connectionTimeout: 10000, // 10s timeout
            debug: true,
            logger: true
        })

        // Verify connection configuration
        await transporter.verify()

        console.log(`SMTP Connection verified successfully for ${user} on ${host}:${safePort}`)
        return NextResponse.json({ success: true, message: "Connexion réussie" })

    } catch (error: any) {
        console.error("SMTP Test Failed:", error)

        let userMessage = "Erreur de connexion inconnue"

        if (error.code === 'EAUTH') {
            userMessage = "Authentification échouée. Vérifiez votre email et mot de passe (ou mot de passe d'application)."
        } else if (error.code === 'ESOCKET') {
            userMessage = "Impossible de se connecter au serveur. Vérifiez l'hôte et le port."
        } else if (error.code === 'ETIMEDOUT') {
            userMessage = "Le serveur ne répond pas (Délai dépassé)."
        } else if (error.message) {
            userMessage = error.message
        }

        return NextResponse.json({
            success: false,
            error: userMessage,
            details: error.message
        }, { status: 500 })
    }
}
