import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailStatus } from '@/types'

export const dynamic = 'force-dynamic'

// Ordre logique du cycle de vie — un statut ne peut pas reculer au-delà de son rang
const STATUS_RANK: Record<EmailStatus, number> = {
    'not_generated': 0,
    'pending':       1,
    'generated':     2,
    'sending':       3,
    'sent':          4,
    'delivered':     5,
    'opened':        6,
    'clicked':       7,
    'bounced':       8,
    'replied':       9,
}

// Statuts après lesquels un retour arrière est dangereux et doit être bloqué
const IRREVERSIBLE_FROM = new Set<EmailStatus>(['sent', 'delivered', 'opened', 'clicked', 'bounced', 'replied'])

/**
 * PATCH /api/campaigns/[id]/update-status
 * Manually update email status for a prospect
 * Body: { prospectId: string, newStatus: EmailStatus, force?: boolean }
 * 
 * Returns 409 with { error, currentStatus, canForce: true } if trying to go backwards
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { prospectId, newStatus, force = false } = body
        const { id: campaignId } = await params

        if (!prospectId || !newStatus) {
            return NextResponse.json({ error: 'prospectId and newStatus requis' }, { status: 400 })
        }

        const validStatuses = Object.keys(STATUS_RANK) as EmailStatus[]
        if (!validStatuses.includes(newStatus as EmailStatus)) {
            return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
        }

        // Auth check
        const { data: campaign, error: campaignError } = await supabase
            .from('cold_email_campaigns')
            .select('id, user_id')
            .eq('id', campaignId)
            .single()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.id !== campaign.user_id) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
        }

        // Récupérer le statut actuel
        const { data: current } = await supabase
            .from('campaign_prospects')
            .select('email_status, generated_email_subject, generated_email_content')
            .eq('campaign_id', campaignId)
            .eq('prospect_id', prospectId)
            .single()

        const currentStatus = (current?.email_status || 'not_generated') as EmailStatus
        const newStatusTyped = newStatus as EmailStatus

        // Vérifier si c'est un retour arrière depuis un statut irréversible
        const isGoingBackwards = STATUS_RANK[newStatusTyped] < STATUS_RANK[currentStatus]
        const isFromIrreversible = IRREVERSIBLE_FROM.has(currentStatus)

        if (isGoingBackwards && isFromIrreversible && !force) {
            const label: Record<EmailStatus, string> = {
                'not_generated': 'Non généré',
                'pending': 'En attente',
                'generated': 'Généré',
                'sending': 'En cours d\'envoi',
                'sent': 'Envoyé',
                'delivered': 'Délivré',
                'opened': 'Ouvert',
                'clicked': 'Cliqué',
                'bounced': 'Rebond',
                'replied': 'Répondu',
            }
            return NextResponse.json({
                error: `⚠️ Cet email est actuellement "${label[currentStatus]}". Revenir à "${label[newStatusTyped]}" effacera l'historique de tracking Mailgun. Confirmez-vous ?`,
                currentStatus,
                newStatus,
                canForce: true,
                hasEmailContent: !!(current?.generated_email_subject || current?.generated_email_content)
            }, { status: 409 })
        }

        // Construire l'update avec les bons timestamps
        const now = new Date().toISOString()
        const updateData: Record<string, unknown> = {
            email_status: newStatus,
            updated_at: now
        }

        // Timestamps spécifiques par statut
        if (newStatusTyped === 'sent')      updateData.email_sent_at = now
        if (newStatusTyped === 'delivered') updateData.email_delivered_at = now
        if (newStatusTyped === 'opened')    updateData.email_opened_at = now
        if (newStatusTyped === 'clicked')   updateData.email_clicked_at = now
        if (newStatusTyped === 'bounced')   updateData.email_bounced_at = now

        const { data: updated, error: updateError } = await supabase
            .from('campaign_prospects')
            .update(updateData)
            .eq('campaign_id', campaignId)
            .eq('prospect_id', prospectId)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating status:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, updated })
    } catch (error: any) {
        console.error('Error in PATCH /api/campaigns/[id]/update-status:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
