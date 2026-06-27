import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// service_role client — bypasses RLS. Server-only, never expose to a client.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
