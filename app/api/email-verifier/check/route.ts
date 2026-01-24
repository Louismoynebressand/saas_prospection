import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { emails } = body

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return NextResponse.json({ error: 'Liste d\'emails requise' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
        }

        // 1. Create Job in DB
        const { data: job, error: jobError } = await supabase
            .from('email_verification_jobs')
            .insert({
                id_user: user.id,
                status: 'pending',
                total_emails: emails.length
            })
            .select()
            .single()

        if (jobError) {
            console.error('Error creating job:', jobError)
            return NextResponse.json({ error: 'Impossible de créer le job de vérification' }, { status: 500 })
        }

        // 2. Prepare payload for n8n Webhook
        const payload = {
            emails: emails,
            is_single: emails.length === 1,
            id_user: user.id,
            id_job: job.id
        }

        // 3. Call n8n Webhook
        const WEBHOOK_URL = 'https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_check_emails'

        try {
            // We don't await the full response if it takes too long, OR we assume n8n returns quickly.
            // User requested "display return in console", so likely synchronous response expected or quick enough.
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                // Determine if it's a webhook error or network error
                throw new Error(`Webhook error: ${response.status} ${response.statusText}`)
            }

            // 4. Update job status to completed (assuming n8n handles the rest or returns data)
            // If n8n returns the results immediately, we could save them here too, but plan says n8n likely updates DB?
            // "il va falloir ... afficher le retour dans la console ... afficher le résultat"
            // Let's assume n8n returns the result JSON for the console AND updates DB? 
            // Or maybe just returns it. 
            // Plan says: "Webhook n8n ... avec historique". 
            // I'll return the webhook response to the frontend for the "console".

            const resultData = await response.json()

            // Update Job status to completed
            await supabase
                .from('email_verification_jobs')
                .update({ status: 'completed' })
                .eq('id', job.id)

            return NextResponse.json({
                success: true,
                jobId: job.id,
                webhookResponse: resultData
            })

        } catch (webhookError: any) {
            console.error('Webhook execution failed:', webhookError)
            await supabase
                .from('email_verification_jobs')
                .update({ status: 'failed' })
                .eq('id', job.id)

            return NextResponse.json({ error: `Erreur lors de l'appel au service de vérification: ${webhookError.message}` }, { status: 502 })
        }

    } catch (error: any) {
        console.error('Error in email verifier API:', error)
        return NextResponse.json({ error: error.message || 'Une erreur inconnue est survenue' }, { status: 500 })
    }
}
