import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: NextRequest) {
    try {
        const { user_id, prospects_count } = await request.json()

        if (!user_id || prospects_count === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: user_id, prospects_count' },
                { status: 400 }
            )
        }

        if (prospects_count < 0) {
            return NextResponse.json(
                { error: 'prospects_count must be positive' },
                { status: 400 }
            )
        }

        logInfo('Decrementing prospects quota', { user_id, prospects_count })

        const supabase = await createClient()

        // Décrémenter les quotas
        const { error } = await supabase.rpc('decrement_prospects_quota', {
            p_user_id: user_id,
            p_count: prospects_count
        })

        if (error) {
            logError('Failed to decrement quota', error, { user_id, prospects_count })
            throw error
        }

        logInfo('Quota decremented successfully', { user_id, prospects_count })

        return NextResponse.json({
            success: true,
            decremented: prospects_count,
            user_id
        })

    } catch (error: any) {
        logError('Quota decrement error', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
