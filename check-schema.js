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
  const { data, error } = await supabase.rpc('query_foreign_keys');
  if (error) {
     console.log("No rpc. Let's do a dummy insert/delete test.");
     // We can't easily query information_schema from client API without RPC.
  } else {
     console.log(data);
  }
}
checkCascade();
