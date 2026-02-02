import { NextResponse } from 'next/server'

/**
 * GET /api/test-env
 * 
 * Endpoint de debug pour vérifier que les variables d'environnement sont bien chargées
 */
export async function GET() {
    const webhookUrl = process.env.N8N_DEEP_SEARCH_WEBHOOK || process.env.NEXT_PUBLIC_N8N_DEEP_SEARCH_WEBHOOK

    return NextResponse.json({
        webhook_found: !!webhookUrl,
        webhook_preview: webhookUrl ? `${webhookUrl.substring(0, 60)}...` : 'NOT FOUND',
        env_vars_checked: [
            'N8N_DEEP_SEARCH_WEBHOOK',
            'NEXT_PUBLIC_N8N_DEEP_SEARCH_WEBHOOK'
        ],
        timestamp: new Date().toISOString()
    })
}
