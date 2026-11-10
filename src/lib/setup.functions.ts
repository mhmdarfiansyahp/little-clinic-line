import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public by design: only works while the clinic has no admin yet.
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
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

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, full_name: data.fullName, email: data.email });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) throw new Error(roleError.message);
    return { ok: true };
  });
