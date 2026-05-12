/**
 * GET /api/track/[code]
 * 
 * Endpoint de redirection pour les liens traçables.
 * - Cherche le short_code en base
 * - Incrémente les compteurs de clics
 * - Enregistre l'événement de clic
 * - Redirige vers l'URL originale
 * 
 * Utilise service_role pour bypasser RLS (pas d'auth user dans un email).
 * Utilise edge runtime pour une latence minimale.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    const { code } = await params

    if (!code || code.length < 4) {
        return new NextResponse('Invalid tracking code', { status: 400 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key'
    )

    try {
        // 1. Lookup the tracked link
        const { data: link, error } = await supabaseAdmin
            .from('email_tracked_links')
            .select('id, original_url, campaign_id, prospect_id, click_count, first_clicked_at')
            .eq('short_code', code)
            .single()

        if (error || !link) {
            console.error(`[Track] Code "${code}" not found:`, error?.message)
            // Redirect to homepage instead of 404 to avoid revealing tracking info
            return NextResponse.redirect(
                process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app',
                { status: 302 }
            )
        }

        const now = new Date().toISOString()
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown'
        const userAgent = request.headers.get('user-agent') || ''

        // 2. Update click stats on tracked link (non-blocking)
        const updatePromise = supabaseAdmin
            .from('email_tracked_links')
            .update({
                click_count: (link.click_count || 0) + 1,
                last_clicked_at: now,
                first_clicked_at: link.first_clicked_at || now,
            })
            .eq('id', link.id)

        // 3. Insert click event (non-blocking)
        const clickPromise = supabaseAdmin
            .from('email_link_clicks')
            .insert({
                tracked_link_id: link.id,
                clicked_at: now,
                user_agent: userAgent.slice(0, 500),
                ip_address: ip,
            })

        // 4. Increment links_click_count on campaign_prospects (non-blocking)
        const cpPromise = supabaseAdmin.rpc('increment_links_click_count', {
            p_campaign_id: link.campaign_id,
            p_prospect_id: link.prospect_id,
        }).then(({ error: rpcError }) => {
            if (rpcError) {
                // Fallback: manual increment
                return supabaseAdmin
                    .from('campaign_prospects')
                    .select('links_click_count')
                    .eq('campaign_id', link.campaign_id)
                    .eq('prospect_id', link.prospect_id)
                    .single()
                    .then(({ data: cp }) => {
                        if (cp) {
                            return supabaseAdmin
                                .from('campaign_prospects')
                                .update({ links_click_count: (cp.links_click_count || 0) + 1 })
                                .eq('campaign_id', link.campaign_id)
                                .eq('prospect_id', link.prospect_id)
                        }
                    })
            }
        })

        // Fire all updates in parallel, don't await (return redirect immediately)
        Promise.all([updatePromise, clickPromise, cpPromise]).catch(err =>
            console.error('[Track] Background update error:', err)
        )

        // 5. Redirect to original URL
        const destination = link.original_url
        return NextResponse.redirect(destination, { status: 302 })

    } catch (err) {
        console.error('[Track] Unexpected error:', err)
        return NextResponse.redirect(
            process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app',
            { status: 302 }
        )
    }
}
