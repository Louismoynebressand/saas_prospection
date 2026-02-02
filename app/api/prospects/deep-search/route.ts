"use server"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/prospects/deep-search
 * 
 * Déclenche un Deep Search manuel pour des prospects qui n'en ont pas encore.
 * 
 * Flow:
 * 1. Vérifier quota utilisateur
 * 2. Créer job dans deep_search_jobs (status='pending')
 * 3. Décrémenter quota
 * 4. Déclencher webhook n8n
 * 5. n8n traite et met à jour directement la BDD
 */
export async function POST(request: NextRequest) {
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

        // 1. Vérifier quota
        const { data: quota, error: quotaError } = await supabase
            .from('quotas')
            .select('deep_search_used, deep_search_limit')
            .eq('user_id', user.id)
            .single()

        if (quotaError) {
            console.error('Quota check error:', quotaError)
            return NextResponse.json({ error: 'Failed to check quota' }, { status: 500 })
        }

        const remaining = (quota?.deep_search_limit || 0) - (quota?.deep_search_used || 0)

        if (!quota || remaining < prospectIds.length) {
            return NextResponse.json({
                error: 'Crédits insuffisants',
                required: prospectIds.length,
                available: remaining
            }, { status: 402 })
        }

        // 2. Créer job AVANT webhook
        const { data: job, error: jobError } = await supabase
            .from('deep_search_jobs')
            .insert({
                user_id: user.id,
                prospect_ids: prospectIds,
                prospects_total: prospectIds.length,
                status: 'pending'
            })
            .select('id')
            .single()

        if (jobError || !job) {
            console.error('Error creating job:', jobError)
            return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
        }

        // 3. Décrémenter crédits (atomique avec vérification)
        const { error: decrementError } = await supabase.rpc('decrement_deep_search_quota', {
            p_user_id: user.id,
            p_amount: prospectIds.length
        })

        if (decrementError) {
            console.error('Error decrementing quota:', decrementError)
            // Rollback job
            await supabase.from('deep_search_jobs').delete().eq('id', job.id)
            return NextResponse.json({ error: 'Crédits insuffisants' }, { status: 402 })
        }

        // 4. Déclencher webhook n8n
        const webhookUrl = process.env.N8N_DEEP_SEARCH_WEBHOOK
        if (!webhookUrl) {
            console.error('N8N_DEEP_SEARCH_WEBHOOK not configured')
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
        }

        console.log('📤 Triggering Deep Search webhook:', {
            job_id: job.id,
            prospects_count: prospectIds.length
        })

        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                job_id: job.id,
                prospect_ids: prospectIds
            }),
            signal: AbortSignal.timeout(10000) // 10s timeout for webhook trigger
        })

        if (!webhookResponse.ok) {
            console.error('Webhook failed:', webhookResponse.statusText)
            // Marquer job comme failed
            await supabase
                .from('deep_search_jobs')
                .update({ status: 'failed', error_message: `Webhook failed: ${webhookResponse.statusText}` })
                .eq('id', job.id)

            return NextResponse.json({ error: 'Failed to trigger Deep Search' }, { status: 500 })
        }

        console.log('✅ Deep Search job created:', job.id)

        // Mettre à jour job à "processing"
        await supabase
            .from('deep_search_jobs')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', job.id)

        return NextResponse.json({
            job_id: job.id,
            status: 'processing',
            prospects_count: prospectIds.length
        })

    } catch (error: any) {
        console.error('Error in deep-search endpoint:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
