const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL) {
  console.error("SUPABASE_URL missing from .env");
}

// Use service role key on the backend (bypasses RLS — safe for server-side use)
// Falls back to anon key if service key not set
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!key) console.error("No Supabase key found in .env");

const supabase = createClient(process.env.SUPABASE_URL, key);

module.exports = supabase;