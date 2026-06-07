const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data, error } = await supabase
        .from('email_tracked_links')
        .select(`
            id, link_type, link_label, original_url,
            click_count, first_clicked_at, last_clicked_at,
            campaign:cold_email_campaigns(name)
        `)
        .limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
}
test();
