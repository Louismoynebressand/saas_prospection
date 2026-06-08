import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('scrape_prospect').select('email_adresse_verified, deep_search, data_scrapping').not('email_adresse_verified', 'is', null).limit(10);
    console.log("Error:", error);
    console.log("Data:", JSON.stringify(data, null, 2));
}

check();
