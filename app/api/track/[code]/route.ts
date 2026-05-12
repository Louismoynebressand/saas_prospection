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

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key'
    )

    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown'
        const userAgent = request.headers.get('user-agent') || ''

        // 1. Process the click fully in the database (bypasses RLS securely via RPC)
        const { data: originalUrl, error } = await supabase.rpc('process_tracked_link_click', {
            p_short_code: code,
            p_ip_address: ip,
            p_user_agent: userAgent.slice(0, 500)
        })

        if (error || !originalUrl) {
            console.error(`[Track] Code "${code}" not found or RPC error:`, error?.message)
            // Redirect to homepage instead of 404 to avoid revealing tracking info
            return NextResponse.redirect(
                process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app',
                { status: 302 }
            )
        }

        // 2. Redirect to original URL
        return NextResponse.redirect(originalUrl, { status: 302 })

    } catch (err) {
        console.error('[Track] Unexpected error:', err)
        return NextResponse.redirect(
            process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app',
            { status: 302 }
        )
    }
}
