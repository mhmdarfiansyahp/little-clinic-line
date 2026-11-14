import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Constant-time comparison so the setup code can't be guessed by timing responses.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Public route, but locked behind a secret SETUP_TOKEN and only while the clinic has no admin.
export const createFirstAdmin = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        setupCode: z.string().trim().min(1).max(200),
        fullName: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const expected = process.env["SETUP_TOKEN"];
    if (!expected) {
      throw new Error("Setup is disabled. Ask whoever deployed ClinicQueue to set SETUP_TOKEN.");
    }
    if (!safeEqual(data.setupCode, expected)) {
      throw new Error("Invalid setup code.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) throw new Error("This clinic is already set up. Please sign in.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the admin account.");
    const userId = created.user.id;

    // Roll back the auth user if the rest of the setup fails, so no role-less account is left behind.
    const fail = async (message: string): Promise<never> => {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(message);
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName, email: data.email });
    if (profileError) await fail(profileError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleError) await fail(roleError.message);

    return { ok: true };
  });