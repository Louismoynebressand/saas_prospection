import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    console.log('🚀 [API] /api/campaigns/analyze started');
    try {
        const body = await req.json();
        const { website, company, siren, userId } = body;
        console.log('📦 [API] Request body:', { website, company, siren, userId });

        if (!website) {
            console.warn('⚠️ [API] Missing website');
            return NextResponse.json(
                { error: 'Website is required' },
                { status: 400 }
            );
        }

        const webhookUrl = 'https://n8n.srv903375.hstgr.cloud/webhook/remplissage-campagne-cold-email';
        console.log('🔗 [API] Calling n8n webhook:', webhookUrl);

        // Call n8n Webhook
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
        });

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
        console.error('🔥 [API] Error in analyze API:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
