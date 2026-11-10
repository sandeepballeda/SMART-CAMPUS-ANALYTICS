import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(120),
  role: z.enum(["teacher", "hod"]),
  department_id: z.string().uuid(),
  designation: z.string().max(120).optional(),
  qualification: z.string().max(200).optional(),
  experience_years: z.number().int().min(0).max(60).optional(),
  phone: z.string().max(20).optional(),
  personal_email: z.string().email().optional(),
  gender: z.enum(["Female", "Male", "Other"]).optional(),
  blood_group: z.string().max(6).optional(),
  address: z.string().max(300).optional(),
  emergency_contact_name: z.string().max(120).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
  date_of_birth: dateField.optional(),
  date_of_joining: dateField.optional(),
});

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only administrators can create accounts");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    const id = created.user.id;
    const { error: pe } = await supabaseAdmin.from("profiles").insert({
      id,
      email: data.email,
      full_name: data.full_name,
      department_id: data.department_id,
      designation: data.designation ?? null,
      qualification: data.qualification ?? null,
      experience_years: data.experience_years ?? 0,
      phone: data.phone ?? null,
      personal_email: data.personal_email ?? null,
      gender: data.gender ?? null,
      blood_group: data.blood_group ?? null,
      address: data.address ?? null,
      emergency_contact_name: data.emergency_contact_name ?? null,
      emergency_contact_phone: data.emergency_contact_phone ?? null,
      date_of_birth: data.date_of_birth ?? null,
      date_of_joining: data.date_of_joining ?? null,
    });
    if (pe) throw new Error(pe.message);
    const roles = data.role === "hod" ? ["hod", "teacher"] : ["teacher"];
    await supabaseAdmin.from("user_roles").insert(roles.map((role) => ({ user_id: id, role: role as "hod" | "teacher" })));
    return { id };
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only administrators can delete accounts");
    if (data.id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
