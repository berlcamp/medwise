import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER ONLY.
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses RLS and is deliberately not prefixed with
 * NEXT_PUBLIC_, so it is never inlined into the browser bundle. Importing this
 * module from a `'use client'` component used to build a client with an empty
 * key, which threw "supabaseKey is required." during module evaluation and
 * crashed the whole page. Call it only from route handlers / server code.
 */
function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: {
      schema: "medwise", // ✅ Use the custom schema by default
    },
  });
}

let client: ReturnType<typeof buildAdminClient> | null = null;

export function getSupabaseAdmin() {
  if (typeof window !== "undefined") {
    throw new Error(
      "getSupabaseAdmin() was called in the browser. The service-role key is server-only.",
    );
  }

  if (!client) {
    client = buildAdminClient();
  }

  return client;
}
