import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2];
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCascade() {
  const { data: job } = await supabase.from('scrape_jobs').select('id_jobs').limit(1).single();
  if (job) {
     const { error } = await supabase.from('scrape_jobs').delete().eq('id_jobs', job.id_jobs);
     console.log(error ? error.message : "Success");
  }
}
checkCascade();
