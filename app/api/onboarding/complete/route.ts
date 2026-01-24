import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { plan } = body

        if (!plan) {
            return NextResponse.json({ error: 'Plan required' }, { status: 400 })
        }

        console.log('[Onboarding] Starting plan selection:', plan)

        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            console.error('[Onboarding] Auth error:', authError)
            return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
        }

        console.log('[Onboarding] User authenticated:', user.id)

        // Mapping frontend plan ID to DB "offre" name
        const planMapping: Record<string, string> = {
            'starter': 'Starter',
            'pro': 'Pro',
            'enterprise': 'Entreprise'
        }

        const dbPlanName = planMapping[plan] || 'Starter'

        // Fetch limits from 'forfait' table
        const { data: forfaitData, error: forfaitError } = await supabase
            .from('forfait')
            .select('*')
            .eq('offre', dbPlanName)
            .single()

        if (forfaitError || !forfaitData) {
            console.error('[Onboarding] Error fetching forfait:', forfaitError)
            // Fallback to hardcoded if DB fetch fails (safety net)
            // But ideally we should throw error
            throw new Error("Impossible de récupérer les détails du forfait.")
        }

        const limits = {
            scraps: forfaitData.scrape_count,
            deep_search: forfaitData.deep_search_count,
            emails: forfaitData.cold_mail_count,
            check_emails: forfaitData.check_email_count
        }

        console.log('[Onboarding] Fetched limits:', limits)

        // 1. Create/Update Subscription
        const { error: subError } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                plan: plan, // We keep the slug 'starter'/'pro'/'enterprise' in our subscriptions table for consistency
                status: 'active',
                start_date: new Date().toISOString(),
                // End date is 1 month from now
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }, { onConflict: 'user_id' })

        if (subError) {
            console.error('[Onboarding] Subscription error:', subError)
            throw new Error(`Erreur lors de la création de l'abonnement: ${subError.message}`)
        }

        // 2. Create/Update Quotas
        const { error: quotaError } = await supabase
            .from('quotas')
            .upsert({
                user_id: user.id,
                scraps_limit: limits.scraps,
                deep_search_limit: limits.deep_search,
                emails_limit: limits.emails,
                check_email_limit: limits.check_emails,
                reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }, { onConflict: 'user_id' })

        if (quotaError) {
            console.error('[Onboarding] Quota error:', quotaError)
            throw new Error(`Erreur lors de la création des quotas: ${quotaError.message}`)
        }

        console.log('[Onboarding] Success for user:', user.id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error in onboarding API:', error)
        return NextResponse.json({ error: error.message || 'Une erreur inconnue est survenue' }, { status: 500 })
    }
}
