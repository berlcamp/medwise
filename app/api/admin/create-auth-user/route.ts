import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Only these account types may provision login accounts for staff/agents.
const ALLOWED_TYPES = ["admin", "super_admin"];

export async function POST(request: Request) {
  let email = "";

  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const supabase = await getSupabaseClient();

  // 🔹 Step 1: The caller must be signed in.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 🔹 Step 2: ...and must be an active admin (same lookup AuthGuard uses).
  const { data: systemUser, error: systemUserError } = await supabase
    .from("users")
    .select("type")
    .eq("email", user.email)
    .eq("is_active", true)
    .maybeSingle();

  if (systemUserError) {
    console.error("Failed to load the calling user:", systemUserError);
    return NextResponse.json(
      { error: "Unable to verify your account" },
      { status: 500 },
    );
  }

  if (!systemUser || !ALLOWED_TYPES.includes(systemUser.type ?? "")) {
    return NextResponse.json(
      { error: "You are not allowed to create login accounts" },
      { status: 403 },
    );
  }

  // 🔹 Step 3: Create the auth user with the service-role key.
  const { data: newAuth, error: createAuthError } =
    await getSupabaseAdmin().auth.admin.createUser({
      email,
      email_confirm: true,
      password:
        process.env.DEFAULT_PASSWORD ||
        process.env.NEXT_PUBLIC_DEFAULT_PASSWORD ||
        "Password123!",
    });

  if (createAuthError || !newAuth?.user) {
    console.error("Error creating auth user:", createAuthError);
    return NextResponse.json(
      { error: createAuthError?.message || "Error creating auth user" },
      { status: 400 },
    );
  }

  return NextResponse.json({ user_id: newAuth.user.id });
}
