import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { plan } = body

        if (!plan) {
            return NextResponse.json({ error: 'Plan required' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Define limits based on plan
        let limits = {
            scraps: 100,
            deep_search: 50,
            emails: 50
        }

        if (plan === 'pro') {
            limits = { scraps: 500, deep_search: 200, emails: 200 }
        } else if (plan === 'enterprise') {
            limits = { scraps: 999999, deep_search: 1000, emails: 1000 }
        }

        // 1. Create/Update Subscription
        const { error: subError } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                plan: plan,
                status: 'active',
                start_date: new Date().toISOString(),
                // End date is 1 month from now
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }, { onConflict: 'user_id' })

        if (subError) throw subError

        // 2. Create/Update Quotas
        const { error: quotaError } = await supabase
            .from('quotas')
            .upsert({
                user_id: user.id,
                scraps_limit: limits.scraps,
                deep_search_limit: limits.deep_search,
                emails_limit: limits.emails,
                reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }, { onConflict: 'user_id' })

        if (quotaError) throw quotaError

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error in onboarding API:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
