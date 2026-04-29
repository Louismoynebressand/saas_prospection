import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow Vercel to wait up to 60s for n8n

export async function POST(req: Request) {
    console.log('🚀 [API] /api/campaigns/analyze started');
    try {
        const body = await req.json();
        const { website, company, siren, userId } = body;

        // SIMPLE PROXY MODE: Trust the client-provided userId
        // This avoids Supabase Server-Side Auth locks/timeouts.
        console.log('📦 [API] Request body:', { website, company, siren, userId: userId ? 'Yes' : 'No' });

        if (!website) {
            console.warn('⚠️ [API] Missing website');
            return NextResponse.json(
                { error: 'Website is required' },
                { status: 400 }
            );
        }

        const webhookUrl = 'https://n8n.srv903375.hstgr.cloud/webhook/remplissage-campagne-cold-email';
        console.log('🔗 [API] Calling n8n webhook:', webhookUrl);

        // Call n8n Webhook with Timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    website,
                    company,
                    siren,
                    userId
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            console.log('📩 [API] n8n response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [API] n8n webhook failed:', errorText);
                throw new Error(`n8n webhook failed with status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ [API] n8n success, data received');

            return NextResponse.json(data);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('⏰ [API] n8n webhook timed out (10s)');
                throw new Error('Timeout: Le service IA n\'a pas répondu à temps.');
            }
            throw error;
        }

    } catch (error: any) {
        console.error('🔥 [API] Error in analyze API:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
