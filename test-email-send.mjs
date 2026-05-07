import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lvjrkoxvjwynkbdkocmh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2anJrb3h2and5bmtiZGtvY21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjg2MzQ2NiwiZXhwIjoyMDUyNDM5NDY2fQ.8Ky4xTjQVzZWGvgjHg_A_UF84DvDZPWPXmDJCRTWqQc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
    // 1. Get a prospect that is 'generated'
    const { data: cp, error: cpError } = await supabase
        .from('campaign_prospects')
        .select('*')
        .eq('email_status', 'generated')
        .limit(1)
        .single();
    
    if (cpError || !cp) {
        console.error('No generated prospect found', cpError);
        return;
    }
    
    console.log('Testing with prospect:', cp.prospect_id);
    
    // Get campaign for user_id
    const { data: campaign } = await supabase
        .from('cold_email_campaigns')
        .select('user_id')
        .eq('id', cp.campaign_id)
        .single();
        
    let htmlContent = '';
    if (typeof cp.generated_email_content === 'string') {
        htmlContent = cp.generated_email_content;
    } else if (cp.generated_email_content) {
        htmlContent = cp.generated_email_content.body || cp.generated_email_content.html || '';
    }
    
    console.log('HTML Content length:', htmlContent.length);

    const payload = {
        user_id: campaign?.user_id,
        campaign_id: cp.campaign_id,
        lead_id: cp.prospect_id,
        sending_account_id: null,
        provider: 'mailgun',
        from_email: 'test@test.com',
        to_email: cp.prospect_email || 'test@test.com',
        subject: cp.generated_email_subject || 'Subject',
        html: htmlContent,
        status: 'prepared',
    };
    
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const { data, error } = await supabase
        .from('email_sends')
        .insert(payload)
        .select('id')
        .single();
        
    if (error) {
        console.error('INSERT ERROR:', error);
    } else {
        console.log('INSERT SUCCESS:', data);
        
        // Clean up
        await supabase.from('email_sends').delete().eq('id', data.id);
    }
}

testInsert();
