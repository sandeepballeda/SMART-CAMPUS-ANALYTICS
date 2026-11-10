import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AllocStat = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  department_id: string;
  subject: string;
  subject_code: string;
  section: string;
  hours: number;
  attendancePct: number | null;
  avgMarksPct: number | null;
  sessions: number;
};

/** Loads every allocation visible to the signed-in user (access rules decide scope) with aggregates. */
export function useAllocationStats() {
  return useQuery({
    queryKey: ["alloc-stats"],
    queryFn: async () => {
      const [{ data: allocs }, { data: att }, { data: marks }] = await Promise.all([
        supabase.from("allocations").select("id, teacher_id, section, hours_per_week, subjects(name, code, department_id), profiles(full_name)"),
        supabase.from("attendance_records").select("allocation_id, total_students, present_count").limit(5000),
        supabase.from("marks").select("allocation_id, marks_obtained, max_marks").limit(10000),
      ]);
      const attMap = new Map<string, { t: number; p: number; n: number }>();
      for (const r of att ?? []) {
        const m = attMap.get(r.allocation_id) ?? { t: 0, p: 0, n: 0 };
        m.t += r.total_students; m.p += r.present_count; m.n++;
        attMap.set(r.allocation_id, m);
      }
      const mkMap = new Map<string, { o: number; m: number }>();
      for (const r of marks ?? []) {
        const m = mkMap.get(r.allocation_id) ?? { o: 0, m: 0 };
        m.o += Number(r.marks_obtained); m.m += Number(r.max_marks);
        mkMap.set(r.allocation_id, m);
      }
      return (allocs ?? []).map((a): AllocStat => {
        const s = a.subjects as { name: string; code: string; department_id: string } | null;
        const at = attMap.get(a.id);
        const mk = mkMap.get(a.id);
        return {
          id: a.id,
          teacher_id: a.teacher_id,
          teacher_name: (a.profiles as { full_name: string } | null)?.full_name ?? "—",
          department_id: s?.department_id ?? "",
          subject: s?.name ?? "—",
          subject_code: s?.code ?? "",
          section: a.section,
          hours: a.hours_per_week,
          attendancePct: at && at.t ? (at.p / at.t) * 100 : null,
          avgMarksPct: mk && mk.m ? (mk.o / mk.m) * 100 : null,
          sessions: at?.n ?? 0,
        };
      });
    },
  });
}

export const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export const OVERLOAD_HOURS = 16;
export const UNDERUTILIZED_HOURS = 6;

export function workloadStatus(hours: number): "overloaded" | "underutilized" | "balanced" {
  if (hours > OVERLOAD_HOURS) return "overloaded";
  if (hours < UNDERUTILIZED_HOURS) return "underutilized";
  return "balanced";
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
