"use server"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/prospects/deep-search
 * 
 * Déclenche un Deep Search manuel pour des prospects qui n'en ont pas encore.
 * Pattern copié de email-verifier/check qui fonctionne.
 * 
 * Flow:
 * 1. Vérifier quota utilisateur (lecture directe)
 * 2. Décrémenter quota (UPDATE direct, pas RPC)
 * 3. Créer job dans deep_search_jobs (status='pending')
 * 4. Déclencher webhook n8n
 * 5. Si erreur webhook: rollback quota + job
 */
export async function POST(request: NextRequest) {
    let jobToRollback: any = null
    let quotaToRefund = 0
    let userToRefund: string | null = null

    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectIds } = body

        if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
            return NextResponse.json({ error: 'prospect_ids required' }, { status: 400 })
        }

        // Get user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        userToRefund = user.id
        const prospectCount = prospectIds.length

        console.log('🔍 Deep Search requested by user:', user.id, 'for', prospectCount, 'prospects')

        // 1. Vérifier quota (lecture directe comme email-verifier)
        const { data: quota, error: quotaFetchError } = await supabase
            .from('quotas')
            .select('deep_search_used, deep_search_limit')
            .eq('user_id', user.id)
            .single()

        if (quotaFetchError || !quota) {
            console.error('❌ Failed to fetch quota:', quotaFetchError)
            return NextResponse.json({
                error: 'Impossible de récupérer les quotas',
                details: quotaFetchError?.message
            }, { status: 500 })
        }

        console.log('✅ Quota fetched:', quota)

        const remaining = quota.deep_search_limit - quota.deep_search_used
        if (remaining < prospectCount) {
            return NextResponse.json({
                error: `Crédits insuffisants. Il vous reste ${remaining} crédits, mais vous tentez d'en utiliser ${prospectCount}.`,
                required: prospectCount,
                available: remaining
            }, { status: 403 })
        }

        // 2. Décrémenter quota (UPDATE direct comme email-verifier - PAS de RPC)
        const { error: updateError } = await supabase
            .from('quotas')
            .update({
                deep_search_used: quota.deep_search_used + prospectCount,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)

        if (updateError) {
            console.error('❌ Failed to update quota:', updateError)
            return NextResponse.json({
                error: 'Erreur lors du débit des crédits',
                details: updateError.message
            }, { status: 500 })
        }

        console.log('✅ Quota debited:', prospectCount)
        quotaToRefund = prospectCount

        // 3. Créer job AVANT webhook
        const { data: job, error: jobError } = await supabase
            .from('deep_search_jobs')
            .insert({
                user_id: user.id,
                prospect_ids: prospectIds,
                prospects_total: prospectCount,
                status: 'pending'
            })
            .select('id')
            .single()

        if (jobError || !job) {
            console.error('❌ Error creating job:', jobError)
            // Rollback quota
            await supabase
                .from('quotas')
                .update({ deep_search_used: quota.deep_search_used })
                .eq('user_id', user.id)
            return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
        }

        console.log('✅ Job created:', job.id)
        jobToRollback = job

        // 4. Déclencher webhook n8n
        const webhookUrl = process.env.N8N_DEEP_SEARCH_WEBHOOK
        if (!webhookUrl) {
            console.error('❌ N8N_DEEP_SEARCH_WEBHOOK not configured')
            // Rollback
            await rollback(supabase, user.id, quota.deep_search_used, job.id)
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
        }

        console.log('📤 Triggering Deep Search webhook:', {
            job_id: job.id,
            prospects_count: prospectCount
        })

        try {
            const webhookResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    job_id: job.id,
                    prospect_ids: prospectIds
                }),
                signal: AbortSignal.timeout(10000) // 10s timeout
            })

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text()
                console.error('❌ Webhook failed:', webhookResponse.status, errorText)
                throw new Error(`Webhook returned ${webhookResponse.status}: ${errorText}`)
            }

            console.log('✅ Deep Search webhook triggered successfully')

            // Mettre à jour job à "processing"
            await supabase
                .from('deep_search_jobs')
                .update({ status: 'processing', started_at: new Date().toISOString() })
                .eq('id', job.id)

            return NextResponse.json({
                success: true,
                job_id: job.id,
                status: 'processing',
                prospects_count: prospectCount,
                message: 'Deep Search lancé avec succès'
            })

        } catch (webhookError: any) {
            console.error('❌ Webhook error:', webhookError)
            // Rollback quota + mark job as failed
            await rollback(supabase, user.id, quota.deep_search_used, job.id)
            return NextResponse.json({
                error: `Erreur service Deep Search: ${webhookError.message}`
            }, { status: 502 })
        }

    } catch (error: any) {
        console.error('❌ Deep Search API error:', error)

        // Attempt rollback if we know who and how much
        if (userToRefund && quotaToRefund > 0) {
            try {
                const supabase = await createClient()
                const { data: currentQuota } = await supabase
                    .from('quotas')
                    .select('deep_search_used')
                    .eq('user_id', userToRefund)
                    .single()

                if (currentQuota) {
                    await supabase
                        .from('quotas')
                        .update({ deep_search_used: Math.max(0, currentQuota.deep_search_used - quotaToRefund) })
                        .eq('user_id', userToRefund)
                }

                if (jobToRollback) {
                    await supabase
                        .from('deep_search_jobs')
                        .update({ status: 'failed', error_message: error.message })
                        .eq('id', jobToRollback.id)
                }
            } catch (rollbackError) {
                console.error('❌ Rollback error:', rollbackError)
            }
        }

        return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
    }
}

// Helper function for rollback
async function rollback(supabase: any, userId: string, originalUsed: number, jobId: string) {
    try {
        // Revert quota
        await supabase
            .from('quotas')
            .update({ deep_search_used: originalUsed })
            .eq('user_id', userId)

        // Mark job as failed
        await supabase
            .from('deep_search_jobs')
            .update({ status: 'failed', error_message: 'Webhook failed' })
            .eq('id', jobId)

        console.log('✅ Rollback completed')
    } catch (rollbackError) {
        console.error('❌ Rollback error:', rollbackError)
    }
}
