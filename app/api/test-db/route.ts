import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabase.from('scrape_prospect').select('email_adresse_verified, deep_search, data_scrapping').not('email_adresse_verified', 'is', null).limit(10);
    return NextResponse.json({ data, error });
}
