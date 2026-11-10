import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarX, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, DAYS } from "@/lib/session";
import type { AllocStat } from "@/lib/analytics";
import { findClashes, leaveAffectedSlots, lowAttendance, missingSessions, toMin, LOW_ATTENDANCE_PCT, type Slot } from "@/lib/campus-tools";
import { StatusBadge, pct } from "@/components/campus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const today = () => new Date().toISOString().slice(0, 10);
const label = (a?: AllocStat) => (a ? `${a.subject_code} ${a.section}` : "—");

/** Schedules for the given allocations, tagged with the teacher. */
function useSlots(allocs: AllocStat[]) {
  const ids = allocs.map((a) => a.id);
  return useQuery({
    queryKey: ["slots", ids.join()],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Slot[]> => {
      const { data } = await supabase.from("schedules").select("*").in("allocation_id", ids);
      const t = new Map(allocs.map((a) => [a.id, a.teacher_id]));
      return (data ?? []).map((s) => ({ ...s, teacher_id: t.get(s.allocation_id) ?? "" }));
    },
  });
}

/* ---------------- Timetable grid ---------------- */

export function TimetableGrid({ allocs, showTeacher }: { allocs: AllocStat[]; showTeacher?: boolean }) {
  const [teacher, setTeacher] = useState("all");
  const { data: slots = [] } = useSlots(allocs);
  const byId = new Map(allocs.map((a) => [a.id, a]));
  const teachers = Array.from(new Map(allocs.map((a) => [a.teacher_id, a.teacher_name])));
  const shown = slots.filter((s) => teacher === "all" || s.teacher_id === teacher);
  const clashes = useMemo(() => findClashes(slots), [slots]);
  const times = Array.from(new Set(shown.map((s) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`))).sort((a, b) => toMin(a) - toMin(b));
  const days = [1, 2, 3, 4, 5, 6];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Weekly timetable</CardTitle>
        <div className="flex items-center gap-3">
          {clashes.size > 0 ? <Badge variant="destructive">{clashes.size} clashing slots</Badge> : <Badge variant="secondary">No clashes</Badge>}
          {showTeacher && (
            <Select value={teacher} onValueChange={setTeacher}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers</SelectItem>
                {teachers.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {times.length === 0 ? <p className="text-sm text-muted-foreground">No classes scheduled.</p> : (
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-xs">
            <thead><tr><th className="w-24 text-left font-medium text-muted-foreground">Time</th>{days.map((d) => <th key={d} className="font-semibold">{DAYS[d]}</th>)}</tr></thead>
            <tbody>
              {times.map((t) => (
                <tr key={t}>
                  <td className="whitespace-nowrap font-medium text-muted-foreground">{t}</td>
                  {days.map((d) => {
                    const here = shown.filter((s) => s.day_of_week === d && `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}` === t);
                    if (!here.length) return <td key={d} className="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground/60">Free</td>;
                    return (
                      <td key={d} className="align-top">
                        {here.map((s) => {
                          const a = byId.get(s.allocation_id);
                          const bad = clashes.has(s.id);
                          return (
                            <div key={s.id} className={`mb-1 rounded-md p-2 ${bad ? "bg-destructive/15 ring-1 ring-destructive" : "bg-primary/10"}`}>
                              <div className="font-semibold">{label(a)}</div>
                              {showTeacher && <div className="truncate text-muted-foreground">{a?.teacher_name}</div>}
                              <div className="text-muted-foreground">{s.room ?? ""}{bad && " · clash"}</div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Missing attendance ---------------- */

export function MissingAttendance({ allocs, showTeacher }: { allocs: AllocStat[]; showTeacher?: boolean }) {
  const { data: slots = [] } = useSlots(allocs);
  const ids = allocs.map((a) => a.id);
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: recorded = [] } = useQuery({
    queryKey: ["att-recent", ids.join(), since],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("attendance_records").select("allocation_id, class_date").in("allocation_id", ids).gte("class_date", since)).data ?? [],
  });
  const missing = missingSessions(slots, recorded, today());
  const byId = new Map(allocs.map((a) => [a.id, a]));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarX className="h-4 w-4 text-accent" />Attendance not recorded (last 7 days)</CardTitle>
        <Badge variant={missing.length ? "destructive" : "secondary"}>{missing.length}</Badge>
      </CardHeader>
      <CardContent>
        {missing.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Every scheduled class has attendance.</p> : (
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Class</TableHead>{showTeacher && <TableHead>Teacher</TableHead>}</TableRow></TableHeader>
              <TableBody>{missing.map((m) => { const a = byId.get(m.allocation_id); return <TableRow key={`${m.allocation_id}${m.date}`}><TableCell>{m.date} ({DAYS[new Date(m.date).getUTCDay()]})</TableCell><TableCell>{label(a)} · {a?.subject}</TableCell>{showTeacher && <TableCell>{a?.teacher_name}</TableCell>}</TableRow>; })}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Low attendance alerts ---------------- */

export function LowAttendanceAlerts({ allocs, showTeacher }: { allocs: AllocStat[]; showTeacher?: boolean }) {
  const low = lowAttendance(allocs);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-destructive" />Classes below {LOW_ATTENDANCE_PCT}% attendance</CardTitle>
        <Badge variant={low.length ? "destructive" : "secondary"}>{low.length}</Badge>
      </CardHeader>
      <CardContent>
        {low.length === 0 ? <p className="text-sm text-muted-foreground">All classes are at or above {LOW_ATTENDANCE_PCT}%.</p> : (
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Class</TableHead>{showTeacher && <TableHead>Teacher</TableHead>}<TableHead>Attendance</TableHead><TableHead>Sessions</TableHead></TableRow></TableHeader>
              <TableBody>{low.map((a) => <TableRow key={a.id}><TableCell>{label(a)} · {a.subject}</TableCell>{showTeacher && <TableCell>{a.teacher_name}</TableCell>}<TableCell className="font-semibold text-destructive">{pct(a.attendancePct!)}</TableCell><TableCell>{a.sessions}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Leave ---------------- */

const LEAVE_TYPES = ["Casual", "Sick", "Earned", "On duty", "Other"];

export function LeaveApply({ allocs }: { allocs: AllocStat[] }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [f, setF] = useState({ start: today(), end: today(), type: "Casual", reason: "" });
  const { data: slots = [] } = useSlots(allocs);
  const affected = f.end >= f.start ? leaveAffectedSlots(f.start, f.end, slots) : [];
  const { data: rows = [] } = useQuery({
    queryKey: ["leave", "mine"], enabled: !!me,
    queryFn: async () => (await supabase.from("leave_requests").select("*").eq("teacher_id", me!.id).order("start_date", { ascending: false })).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      if (f.end < f.start) throw new Error("End date must be on or after start date");
      const { error } = await supabase.from("leave_requests").insert({ teacher_id: me!.id, department_id: me!.department_id, start_date: f.start, end_date: f.end, leave_type: f.type, reason: f.reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave request sent to your HOD"); setF((x) => ({ ...x, reason: "" })); qc.invalidateQueries({ queryKey: ["leave"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("leave_requests").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave"] }),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Apply for leave</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Type</Label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Reason</Label><Textarea rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">{affected.length ? `You'd miss ${affected.length} scheduled class${affected.length > 1 ? "es" : ""} — your HOD will arrange substitutes.` : "No scheduled classes in this period."}</p>
          <Button disabled={!f.reason.trim() || add.isPending} onClick={() => add.mutate()}>Submit</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">My leave</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No leave requests yet.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Dates</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.start_date}{r.end_date !== r.start_date && ` → ${r.end_date}`}</TableCell>
                  <TableCell>{r.leave_type}</TableCell>
                  <TableCell className="max-w-56">{r.reason}{r.review_note && <div className="text-xs text-muted-foreground">Note: {r.review_note}</div>}</TableCell>
                  <TableCell><StatusBadge s={r.status} /></TableCell>
                  <TableCell className="text-right">{r.status === "pending" && <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>Cancel</Button>}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function LeaveReview({ allocs }: { allocs: AllocStat[] }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data: slots = [] } = useSlots(allocs);
  const byAlloc = new Map(allocs.map((a) => [a.id, a]));
  const { data: rows = [] } = useQuery({
    queryKey: ["leave", "review"],
    queryFn: async () => (await supabase.from("leave_requests").select("*, profiles!leave_requests_teacher_id_fkey(full_name)").order("start_date", { ascending: false })).data ?? [],
  });
  const review = useMutation({
    mutationFn: async ({ id, s }: { id: string; s: string }) => {
      const { error } = await supabase.from("leave_requests").update({ status: s, review_note: notes[id]?.trim() || null, reviewed_by: me!.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave updated"); qc.invalidateQueries({ queryKey: ["leave"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const shown = rows.filter((r) => (status === "all" || r.status === status) && r.teacher_id !== me?.id);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>Show</Label>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{["pending", "approved", "rejected", "all"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No leave requests here.</p>}
      {shown.map((r) => {
        const mine = slots.filter((s) => s.teacher_id === r.teacher_id);
        const affected = leaveAffectedSlots(r.start_date, r.end_date, mine);
        return (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{(r.profiles as { full_name: string } | null)?.full_name ?? "Teacher"} · {r.leave_type} leave</h3>
                  <p className="text-sm text-muted-foreground">{r.start_date}{r.end_date !== r.start_date && ` → ${r.end_date}`}</p>
                </div>
                <StatusBadge s={r.status} />
              </div>
              <p className="text-sm">{r.reason}</p>
              {affected.length > 0 && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                  <div className="mb-1 font-semibold">{affected.length} class{affected.length > 1 ? "es need" : " needs"} a substitute</div>
                  <ul className="space-y-0.5 text-xs">{affected.map(({ date, slot }) => { const a = byAlloc.get(slot.allocation_id); return <li key={date + slot.id}>{date} ({DAYS[slot.day_of_week]}) · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {label(a)} {a?.subject} {slot.room && `· ${slot.room}`}</li>; })}</ul>
                </div>
              )}
              {r.status === "pending" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="max-w-sm" placeholder="Note (optional, e.g. substitute name)" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                  <Button size="sm" onClick={() => review.mutate({ id: r.id, s: "approved" })}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, s: "rejected" })}>Reject</Button>
                </div>
              ) : r.review_note && <p className="text-xs text-muted-foreground">Note: {r.review_note}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
