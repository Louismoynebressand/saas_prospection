
import { createClient } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

const WEBHOOK_URL = process.env.N8N_WEBHOOK_COLD_EMAIL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient()
        const body = await req.json()
        const { campaignId, prospectIds, userId } = body

        if (!campaignId || !prospectIds || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        if (!WEBHOOK_URL) {
            return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
        }

        // 1. Verify Quotas
        const { data: quota, error: quotaError } = await supabase
            .from('quotas')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (quotaError || !quota) {
            return NextResponse.json({ error: "Impossible de vérifier les quotas" }, { status: 400 })
        }

        // Optional: Block if quota exceeded (soft or hard limit)
        // For now, we just proceed and increment later.

        // 2. Fetch Campaign Details
        const { data: campaign, error: campError } = await supabase
            .from('cold_email_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()

        if (campError || !campaign) {
            return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 })
        }

        // 3. Create Job
        const { data: job, error: jobError } = await supabase
            .from('cold_email_jobs')
            .insert({
                user_id: userId,
                campaign_id: campaignId,
                status: 'queued',
                prospect_ids: prospectIds,
                started_at: new Date().toISOString()
            })
            .select()
            .single()

        if (jobError) {
            console.error(jobError)
            return NextResponse.json({ error: "Erreur création job" }, { status: 500 })
        }

        // 4. Fetch Prospects Data for Payload
        // We need to send rich data to the webhook so it can generate the email
        const { data: prospects } = await supabase
            .from('scrape_prospect')
            .select('*')
            .in('id_prospect', prospectIds)

        if (!prospects || prospects.length === 0) {
            return NextResponse.json({ error: "Aucun prospect trouvé" }, { status: 404 })
        }

        // 5. Trigger Webhook
        const payload = {
            job_id: job.id,
            user_id: userId,
            campaign: {
                name: campaign.nom_campagne,
                my_company: campaign.nom_entreprise_client,
                my_offer: campaign.offre_principale_client,
                tone: campaign.ton_souhaite,
                constraints: campaign.contraintes,
                // Add all other relevant fields...
                website: campaign.site_web_client,
                pitch: campaign.phrase_positionnement_client
            },
            prospects: prospects.map((p: any) => ({
                id: p.id_prospect,
                data: typeof p.data_scrapping === 'string' ? JSON.parse(p.data_scrapping) : p.data_scrapping,
                deep_search: typeof p.deep_search === 'string' ? JSON.parse(p.deep_search) : p.deep_search
            }))
        }

        // Fire and forget mechanism for speed, or await? 
        // Better to await to confirm receipt.
        try {
            const webhookRes = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!webhookRes.ok) {
                console.error("Webhook Error", await webhookRes.text())
                // Only log, don't fail the job yet, maybe N8N is busy
            }
        } catch (e) {
            console.error("Webhook Network Error", e)
        }

        // 6. Update Job Status to Running
        await supabase
            .from('cold_email_jobs')
            .update({ status: 'running' })
            .eq('id', job.id)

        return NextResponse.json({ success: true, jobId: job.id })

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
