/**
 * Creates the Supabase auth account for a new staff member / agent.
 *
 * The service-role key can never reach the browser, so this goes through the
 * `/api/admin/create-auth-user` route handler, which re-checks that the caller
 * is an active admin before provisioning the account.
 */
export async function createAuthUser(email: string): Promise<string> {
  const res = await fetch("/api/admin/create-auth-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const result = await res.json().catch(() => null);

  if (!res.ok || !result?.user_id) {
    throw new Error(
      `Error creating auth user: ${result?.error || res.statusText}`,
    );
  }

  return result.user_id as string;
}
