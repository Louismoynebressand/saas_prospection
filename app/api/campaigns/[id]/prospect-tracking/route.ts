/**
 * GET /api/campaigns/[id]/prospect-tracking?prospect_id=123
 * 
 * Retourne les liens de tracking pour un prospect donné dans une campagne.
 * Utilisé par N8N pour récupérer les shortcodes et URLs de tracking
 * avant d'envoyer un email.
 * 
 * Réponse :
 * {
 *   prospect_id: number,
 *   campaign_id: string,
 *   signature_tracked_html: string,  ← HTML de signature avec liens de tracking intégrés
 *   tracked_links: [
 *     {
 *       type: "phone"|"email"|"website"|"custom",
 *       label: string,
 *       original_url: string,
 *       tracking_url: string,   ← "https://saas-prospection.vercel.app/api/track/ABC123"
 *       short_code: string      ← "ABC123"
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    extractSignatureLinks,
    createTrackedLinksForProspect,
    buildTrackedSignatureHtml
} from '@/lib/email-link-tracker'

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: campaignId } = await params
        const prospectId = request.nextUrl.searchParams.get('prospect_id')

        if (!prospectId) {
            return NextResponse.json({ error: 'prospect_id is required' }, { status: 400 })
        }

        const supabase = await createClient()

        // Auth — supporte aussi les calls internes (N8N via API key header)
        const apiKey = request.headers.get('x-api-key')
        const isInternalCall = apiKey === process.env.INTERNAL_API_KEY
        
        if (!isInternalCall) {
            const { error: authError } = await supabase.auth.getUser()
            if (authError) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        const pId = Number(prospectId)

        // 1. Chercher les liens existants dans email_tracked_links
        const { data: existingLinks, error: linksError } = await supabase
            .from('email_tracked_links')
            .select('id, link_type, link_label, original_url, short_code, click_count, first_click_at')
            .eq('campaign_id', campaignId)
            .eq('prospect_id', pId)
            .order('created_at', { ascending: true })

        // 2. Récupérer la signature HTML déjà trackée depuis campaign_prospects
        const { data: cpRecord } = await supabase
            .from('campaign_prospects')
            .select('signature_tracked_html, links_click_count')
            .eq('campaign_id', campaignId)
            .eq('prospect_id', pId)
            .single()

        if (existingLinks && existingLinks.length > 0 && cpRecord?.signature_tracked_html) {
            // Les liens existent déjà — les retourner directement
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://saas-prospection.vercel.app'
            
            return NextResponse.json({
                prospect_id: pId,
                campaign_id: campaignId,
                signature_tracked_html: cpRecord.signature_tracked_html,
                links_click_count: cpRecord.links_click_count || 0,
                tracked_links: existingLinks.map((link: any) => ({
                    type: link.link_type,
                    label: link.link_label,
                    original_url: link.original_url,
                    short_code: link.short_code,
                    tracking_url: `${baseUrl}/api/track/${link.short_code}`,
                    click_count: link.click_count || 0,
                    first_click_at: link.first_click_at
                }))
            })
        }

        // 3. Pas encore de liens — les générer maintenant
        const { data: campaign } = await supabase
            .from('cold_email_campaigns')
            .select(`
                id, my_website,
                signature_name, signature_title, signature_company,
                signature_phone, signature_email, signature_ps,
                signature_show_phone, signature_show_email, signature_show_website,
                signature_website_text, signature_custom_link_url, signature_custom_link_text,
                signature_elements_order
            `)
            .eq('id', campaignId)
            .single()

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        const signatureLinks = extractSignatureLinks(campaign)

        if (signatureLinks.length === 0) {
            return NextResponse.json({
                prospect_id: pId,
                campaign_id: campaignId,
                signature_tracked_html: '',
                tracked_links: [],
                warning: 'No trackable links found in campaign signature'
            })
        }

        // Supprimer les anciens (au cas où)
        await supabase
            .from('email_tracked_links')
            .delete()
            .eq('campaign_id', campaignId)
            .eq('prospect_id', pId)

        // Créer les nouveaux liens trackés
        const trackedLinks = await createTrackedLinksForProspect(campaignId, pId, signatureLinks)
        const signatureTrackedHtml = buildTrackedSignatureHtml(campaign, trackedLinks)

        // Persister la signature HTML dans campaign_prospects
        await supabase
            .from('campaign_prospects')
            .update({
                signature_tracked_html: signatureTrackedHtml,
                links_click_count: 0,
                updated_at: new Date().toISOString()
            })
            .eq('campaign_id', campaignId)
            .eq('prospect_id', pId)

        return NextResponse.json({
            prospect_id: pId,
            campaign_id: campaignId,
            signature_tracked_html: signatureTrackedHtml,
            links_click_count: 0,
            tracked_links: trackedLinks.map(tl => ({
                type: tl.link_type,
                label: tl.link_label,
                original_url: tl.original_url,
                short_code: tl.short_code,
                tracking_url: tl.tracking_url,
                click_count: 0,
                first_click_at: null
            }))
        })

    } catch (error: any) {
        console.error('[ProspectTracking] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
