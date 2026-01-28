import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { website, company, siren } = await req.json();

        if (!website) {
            return NextResponse.json(
                { error: 'Website is required' },
                { status: 400 }
            );
        }

        const webhookUrl = 'https://n8n.srv903375.hstgr.cloud/webhook/remplissage-campagne-cold-email';

        // Call n8n Webhook
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                website,
                company,
                siren
            }),
        });

        if (!response.ok) {
            throw new Error(`n8n webhook failed with status: ${response.status}`);
        }

        const data = await response.json();

        // Expecting data structure like:
        // {
        //   "pitch": "...",
        //   "main_offer": "...",
        //   "pain_points": ["...", "..."] or "text..."
        // }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Error in analyze API:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
