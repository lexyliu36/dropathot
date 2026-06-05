import { createClient } from '@supabase/supabase-js'

const key = process.env.SUPABASE_SERVICE_KEY

// Service role key must be a JWT (starts with eyJ). If it's a different format
// (e.g. sb_secret_...) PostgREST will fall back to anon role and all table
// queries will fail with "permission denied".
if (key && !key.startsWith('eyJ')) {
  console.warn(
    '\n⚠️  SUPABASE_SERVICE_KEY does not look like a JWT.\n' +
    '   Go to Supabase Dashboard → Settings → API and copy the service_role key (starts with eyJ).\n'
  )
}

export const supabase = createClient(process.env.SUPABASE_URL, key, {
  auth: {
    persistSession: false,   // don't store user JWTs between calls — prevents
    autoRefreshToken: false, // signInWithPassword from overwriting service_role context
    detectSessionInUrl: false,
  },
})
