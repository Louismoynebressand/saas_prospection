import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { host, port, user, pass } = body

        if (!host || !port || !user || !pass) {
            return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
        }

        // Create a transporter
        const transporter = nodemailer.createTransport({
            host: host,
            port: parseInt(port),
            secure: port == 465, // true for 465, false for other ports
            auth: {
                user: user,
                pass: pass,
            },
            tls: {
                rejectUnauthorized: false // Often needed for local/testing scenarios, be careful in prod
            }
        })

        // Verify connection logic
        await new Promise((resolve, reject) => {
            transporter.verify(function (error, success) {
                if (error) {
                    reject(error)
                } else {
                    resolve(success)
                }
            })
        })

        return NextResponse.json({ success: true, message: "Connexion réussie !" })

    } catch (error: any) {
        console.error("SMTP Test Error:", error)
        return NextResponse.json({ success: false, error: error.message || "Echec de connexion" }, { status: 500 })
    }
}
