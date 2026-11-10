import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "hod" | "teacher";

export type Me = {
  id: string;
  email: string;
  full_name: string;
  department_id: string | null;
  department_name: string | null;
  roles: Role[];
  primaryRole: Role;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*, departments(name)").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const roles = (r ?? []).map((x) => x.role as Role);
    const primaryRole: Role = roles.includes("admin") ? "admin" : roles.includes("hod") ? "hod" : "teacher";
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      full_name: p?.full_name ?? "",
      department_id: p?.department_id ?? null,
      department_name: (p as { departments?: { name: string } | null } | null)?.departments?.name ?? null,
      roles,
      primaryRole,
    };
  },
});

export const useMe = () => useQuery(meQuery);

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
