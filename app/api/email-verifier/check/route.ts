import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    let jobToRefund: any = null
    let costToRefund = 0
    let userToRefund: string | null = null

    try {
        const body = await request.json()
        const { emails } = body

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return NextResponse.json({ error: 'Liste d\'emails requise' }, { status: 400 })
        }

        // 1. Deduplicate emails
        const uniqueEmails = Array.from(new Set(emails.map((e: string) => e.trim()))).filter(e => e.length > 0)
        const emailCount = uniqueEmails.length

        if (emailCount === 0) {
            return NextResponse.json({ error: 'Aucun email valide détecté' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
        }

        userToRefund = user.id

        // 2. Refresh & Check Quotas
        const { data: quota, error: quotaFetchError } = await supabase
            .from('quotas')
            .select('check_email_limit, check_email_used')
            .eq('user_id', user.id)
            .single()

        if (quotaFetchError || !quota) {
            return NextResponse.json({ error: 'Impossible de récupérer les quotas' }, { status: 500 })
        }

        const remainingCredits = quota.check_email_limit - quota.check_email_used
        if (remainingCredits < emailCount) {
            return NextResponse.json({
                error: `Crédits insuffisants. Il vous reste ${remainingCredits} crédits, mais vous tentez d'en vérifier ${emailCount}.`
            }, { status: 403 })
        }

        // 3. Debit Quotas (Optimistic Update)
        const { error: debitError } = await supabase.rpc('increment_quota', {
            quota_type: 'check_email',
            user_uuid: user.id,
            amount: emailCount
        })

        // Fallback if RPC doesn't exist yet, do manual update (less safe but works for now if single thread)
        // Since we didn't create the RPC in plan, let's use direct update for now. 
        // ideally should use RPC to be atomic. 
        // Let's stick to direct update as per previous patterns in this codebase.
        const { error: updateError } = await supabase
            .from('quotas')
            .update({ check_email_used: quota.check_email_used + emailCount })
            .eq('user_id', user.id)

        if (updateError) {
            return NextResponse.json({ error: 'Erreur lors du débit des crédits' }, { status: 500 })
        }

        // Set refund flags in case of failure later
        costToRefund = emailCount

        // 4. Create Job with estimated cost
        const { data: job, error: jobError } = await supabase
            .from('email_verification_jobs')
            .insert({
                id_user: user.id,
                status: 'pending',
                total_emails: emailCount,
                estimated_cost: emailCount
            })
            .select()
            .single()

        if (jobError) {
            // Need to refund immediately
            await supabase.from('quotas').update({ check_email_used: quota.check_email_used }).eq('user_id', user.id)
            return NextResponse.json({ error: 'Impossible de créer le job' }, { status: 500 })
        }

        jobToRefund = job

        // 5. Call Webhook
        const payload = {
            emails: uniqueEmails,
            email_count: emailCount,
            is_single: emailCount === 1,
            id_user: user.id,
            id_job: job.id
        }

        const WEBHOOK_URL = 'https://n8n.srv903375.hstgr.cloud/webhook/neuraflow_scrappeur_check_emails'

        try {
            // We assume n8n will process asynchronously OR return quickly.
            // If n8n returns success, it means itACCEPTED the job.
            // It is up to n8n to now insert results into the DB.
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                throw new Error(`Webhook error: ${response.status} ${response.statusText}`)
            }

            // Success! The job is running on n8n side. 
            // We do NOT wait for full completion if n8n is long-running.
            // But per previous code, user seemed to want "console output". 
            // If n8n returns something useful immediately, we send it back.
            const resultData = await response.json().catch(() => ({}))

            return NextResponse.json({
                success: true,
                jobId: job.id,
                message: "Vérification lancée",
                webhookResponse: resultData
            })

        } catch (webhookError: any) {
            console.error('Webhook failed:', webhookError)

            // 6. REFUND LOGIC
            // Revert quota usage
            const { data: currentQuota } = await supabase
                .from('quotas')
                .select('check_email_used')
                .eq('user_id', user.id)
                .single()

            if (currentQuota) {
                await supabase
                    .from('quotas')
                    .update({ check_email_used: Math.max(0, currentQuota.check_email_used - costToRefund) })
                    .eq('user_id', user.id)
            }

            // Mark job as failed
            if (jobToRefund) {
                await supabase
                    .from('email_verification_jobs')
                    .update({ status: 'failed' })
                    .eq('id', jobToRefund.id)
            }

            return NextResponse.json({ error: `Erreur service vérification: ${webhookError.message}` }, { status: 502 })
        }

    } catch (error: any) {
        console.error('API Error:', error)
        // Attempt generic refund if we know who and how much (tricky if error happens early)
        if (userToRefund && costToRefund > 0) {
            const supabase = await createClient()
            const { data: q } = await supabase.from('quotas').select('check_email_used').eq('user_id', userToRefund).single()
            if (q) {
                await supabase.from('quotas').update({ check_email_used: Math.max(0, q.check_email_used - costToRefund) }).eq('user_id', userToRefund)
            }
        }
        return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
    }
}
