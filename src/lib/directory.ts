import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DirectoryRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  qualification: string | null;
  experience_years: number | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  personal_email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  date_of_joining: string | null;
  department: string | null;
  roles: string[];
};

type ProfileRecord = Omit<DirectoryRow, "department" | "roles"> & {
  department_id: string | null;
  departments: { code: string } | null;
};

export const directoryQuery = queryOptions({
  queryKey: ["directory"],
  queryFn: async (): Promise<DirectoryRow[]> => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*, departments(code)").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleRows = roles ?? [];
    return (profiles ?? []).map((raw) => {
      const p = raw as unknown as ProfileRecord;
      const { departments, ...rest } = p;
      return {
        ...rest,
        department: departments?.code ?? null,
        roles: roleRows.filter((r) => r.user_id === p.id).map((r) => r.role),
      };
    });
  },
});

/** Teaching staff = anyone holding the teacher role. HODs also hold it; admins do not. */
export const isTeachingStaff = (row: { roles: string[] }) => row.roles.includes("teacher");

export const digitsOnly = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export function filterDirectory(
  rows: DirectoryRow[],
  { q = "", dept = "all" }: { q?: string; dept?: string } = {},
): DirectoryRow[] {
  const needle = q.trim().toLowerCase();
  const needleDigits = digitsOnly(needle);
  return rows.filter((row) => {
    if (!isTeachingStaff(row)) return false;
    if (dept !== "all" && row.department !== dept) return false;
    if (!needle) return true;
    const haystack = [row.full_name, row.email, row.designation, row.personal_email]
      .join(" ")
      .toLowerCase();
    if (haystack.includes(needle)) return true;
    return needleDigits.length >= 2 && digitsOnly(row.phone).includes(needleDigits);
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d || m > 12 || d > 31) return "—";
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function ageFrom(iso: string | null | undefined, today = new Date()): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export const PERSONAL_FIELDS = [
  { key: "phone", label: "Phone" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "blood_group", label: "Blood group" },
  { key: "personal_email", label: "Personal email" },
  { key: "address", label: "Address" },
  { key: "emergency_contact_name", label: "Emergency contact" },
  { key: "emergency_contact_phone", label: "Emergency phone" },
  { key: "date_of_joining", label: "Date of joining" },
] as const;

export type PersonalFieldKey = (typeof PERSONAL_FIELDS)[number]["key"];

export function missingPersonalFields(row: DirectoryRow): string[] {
  return PERSONAL_FIELDS.filter((f) => !String(row[f.key] ?? "").trim()).map((f) => f.label);
}
