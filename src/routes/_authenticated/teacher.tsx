import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe, DAYS } from "@/lib/session";
import { useAllocationStats, avg, workloadStatus, type AllocStat } from "@/lib/analytics";
import { ProfileTab } from "@/components/portal-shared";
import { TimetableGrid, MissingAttendance, LowAttendanceAlerts, LeaveApply } from "@/components/campus-tools";
import { PortalShell, Stat, Insights, Announcements, StatusBadge, pct } from "@/components/campus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({ meta: [{ title: "Teacher Portal — Smart Campus" }, { name: "description", content: "Your classes, attendance, marks and insights." }] }),
  component: TeacherPortal,
});

function TeacherPortal() {
  return (
    <PortalShell role="teacher" title="My teaching">
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="marks">Internal marks</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="timetable"><MyTimetable /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab /></TabsContent>
        <TabsContent value="leave"><MyLeave /></TabsContent>
        <TabsContent value="marks"><MarksTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="announcements"><Announcements /></TabsContent>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
      </Tabs>
    </PortalShell>
  );
}

function MyTimetable() { const { data } = useMyAllocs(); return <TimetableGrid allocs={data} />; }
function MyLeave() { const { data } = useMyAllocs(); return <LeaveApply allocs={data} />; }

function useMyAllocs() {
  const { data: me } = useMe();
  const q = useAllocationStats();
  return { ...q, data: (q.data ?? []).filter((a) => a.teacher_id === me?.id) };
}

function Overview() {
  const { data: allocs } = useMyAllocs();
  const [sel, setSel] = useState<string | null>(null);
  const { data: sched = [] } = useQuery({
    queryKey: ["my-sched", allocs.map((a) => a.id).join()],
    enabled: allocs.length > 0,
    queryFn: async () => (await supabase.from("schedules").select("*").in("allocation_id", allocs.map((a) => a.id)).order("day_of_week").order("start_time")).data ?? [],
  });
  const hours = allocs.reduce((s, a) => s + a.hours, 0);
  const att = avg(allocs.map((a) => a.attendancePct));
  const mk = avg(allocs.map((a) => a.avgMarksPct));
  const insights: string[] = [];
  allocs.forEach((a) => {
    if (a.attendancePct != null && a.attendancePct < 75) insights.push(`${a.subject} (Sec ${a.section}) attendance is ${pct(a.attendancePct)} — below the 75% threshold. Consider follow-ups with frequent absentees.`);
    if (a.avgMarksPct != null && a.avgMarksPct < 55) insights.push(`${a.subject} (Sec ${a.section}) average internal score is ${pct(a.avgMarksPct)}. A revision session may help.`);
  });
  const ws = workloadStatus(hours);
  if (ws !== "balanced") insights.push(`Your weekly load is ${hours} hours — ${ws}.`);
  const best = [...allocs].sort((a, b) => (b.avgMarksPct ?? 0) - (a.avgMarksPct ?? 0))[0];
  if (best?.avgMarksPct) insights.push(`Strongest class: ${best.subject} Sec ${best.section} at ${pct(best.avgMarksPct)} average.`);
  const byId = new Map(allocs.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Classes" value={allocs.length} />
        <Stat label="Weekly hours" value={hours} hint={ws} tone={ws === "overloaded" ? "warn" : undefined} />
        <Stat label="Avg attendance" value={att != null ? pct(att) : "—"} tone={att != null && att < 75 ? "warn" : "good"} />
        <Stat label="Avg internal score" value={mk != null ? pct(mk) : "—"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Class performance</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <BarChart data={allocs.map((a) => ({ id: a.id, name: `${a.subject_code}-${a.section}`, Attendance: Math.round(a.attendancePct ?? 0), Marks: Math.round(a.avgMarksPct ?? 0) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} /><YAxis domain={[0, 100]} fontSize={12} /><Tooltip cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="Attendance" fill="var(--chart-1)" radius={4} maxBarSize={28} className="cursor-pointer" onClick={(d) => setSel((d as { id?: string }).id ?? null)} />
                <Bar dataKey="Marks" fill="var(--chart-2)" radius={4} maxBarSize={28} className="cursor-pointer" onClick={(d) => setSel((d as { id?: string }).id ?? null)} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">Click a bar to see that class's marks and attendance.</p>
          </CardContent>
        </Card>
        <Insights items={insights} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <MissingAttendance allocs={allocs} />
        <LowAttendanceAlerts allocs={allocs} />
      </div>
      {sel && <ClassDetail allocId={sel} allocs={allocs} onClose={() => setSel(null)} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Assigned subjects</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Sec</TableHead><TableHead>Hrs/wk</TableHead><TableHead>Sessions</TableHead></TableRow></TableHeader>
              <TableBody>{allocs.map((a) => <TableRow key={a.id}><TableCell>{a.subject_code} · {a.subject}</TableCell><TableCell>{a.section}</TableCell><TableCell>{a.hours}</TableCell><TableCell>{a.sessions}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Weekly schedule</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Class</TableHead><TableHead>Room</TableHead></TableRow></TableHeader>
              <TableBody>{sched.map((s) => { const a = byId.get(s.allocation_id); return <TableRow key={s.id}><TableCell>{DAYS[s.day_of_week]}</TableCell><TableCell>{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</TableCell><TableCell>{a?.subject_code} {a?.section}</TableCell><TableCell>{s.room}</TableCell></TableRow>; })}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClassDetail({ allocId, allocs, onClose }: { allocId: string; allocs: AllocStat[]; onClose: () => void }) {
  const a = allocs.find((x) => x.id === allocId);
  const { data: marks = [] } = useQuery({
    queryKey: ["marks", allocId],
    queryFn: async () => (await supabase.from("marks").select("*").eq("allocation_id", allocId).order("exam_name").order("student_roll")).data ?? [],
  });
  const { data: att = [] } = useQuery({
    queryKey: ["att", allocId],
    queryFn: async () => (await supabase.from("attendance_records").select("*").eq("allocation_id", allocId).order("class_date", { ascending: false })).data ?? [],
  });
  if (!a) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{a.subject_code} · {a.subject} — Section {a.section}</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Student marks</h3>
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Roll</TableHead><TableHead>Marks</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
              <TableBody>{marks.map((r) => <TableRow key={r.id}><TableCell>{r.exam_name}</TableCell><TableCell>{r.student_roll}</TableCell><TableCell>{Number(r.marks_obtained)}/{Number(r.max_marks)}</TableCell><TableCell>{pct((Number(r.marks_obtained) / Number(r.max_marks)) * 100)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
          {marks.length === 0 && <p className="text-sm text-muted-foreground">No marks entered yet.</p>}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Attendance sessions</h3>
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Present</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
              <TableBody>{att.map((r) => <TableRow key={r.id}><TableCell>{r.class_date}</TableCell><TableCell>{r.present_count}/{r.total_students}</TableCell><TableCell>{pct((r.present_count / r.total_students) * 100)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
          {att.length === 0 && <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function AllocPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: allocs } = useMyAllocs();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
      <SelectContent>{allocs.map((a) => <SelectItem key={a.id} value={a.id}>{a.subject_code} · {a.subject} — Sec {a.section}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function AttendanceTab() {
  const qc = useQueryClient();
  const [alloc, setAlloc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState("60");
  const [present, setPresent] = useState("");
  const { data: rows = [] } = useQuery({
    queryKey: ["att", alloc], enabled: !!alloc,
    queryFn: async () => (await supabase.from("attendance_records").select("*").eq("allocation_id", alloc).order("class_date", { ascending: false })).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const t = Number(total), p = Number(present);
      if (!(t > 0) || p < 0 || p > t) throw new Error("Present must be between 0 and total");
      const { error } = await supabase.from("attendance_records").insert({ allocation_id: alloc, class_date: date, total_students: t, present_count: p });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Attendance saved"); setPresent(""); qc.invalidateQueries({ queryKey: ["att"] }); qc.invalidateQueries({ queryKey: ["alloc-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("attendance_records").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["att"] }); qc.invalidateQueries({ queryKey: ["alloc-stats"] }); },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Record a session</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <AllocPicker value={alloc} onChange={setAlloc} />
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Total students</Label><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
            <div className="space-y-1"><Label>Present</Label><Input type="number" value={present} onChange={(e) => setPresent(e.target.value)} /></div>
          </div>
          <Button disabled={!alloc || present === "" || add.isPending} onClick={() => add.mutate()}>Save</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Records</CardTitle></CardHeader>
        <CardContent>
          {!alloc ? <p className="text-sm text-muted-foreground">Choose a class to see its records.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Present</TableHead><TableHead>%</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{rows.map((r) => <TableRow key={r.id}><TableCell>{r.class_date}</TableCell><TableCell>{r.present_count}/{r.total_students}</TableCell><TableCell>{pct((r.present_count / r.total_students) * 100)}</TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}>Remove</Button></TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MarksTab() {
  const qc = useQueryClient();
  const [alloc, setAlloc] = useState("");
  const [exam, setExam] = useState("Internal 1");
  const [roll, setRoll] = useState("");
  const [obt, setObt] = useState("");
  const [max, setMax] = useState("50");
  const { data: rows = [] } = useQuery({
    queryKey: ["marks", alloc], enabled: !!alloc,
    queryFn: async () => (await supabase.from("marks").select("*").eq("allocation_id", alloc).order("exam_name").order("student_roll")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const o = Number(obt), m = Number(max);
      if (!(m > 0) || o < 0 || o > m) throw new Error("Marks must be between 0 and max");
      const { error } = await supabase.from("marks").insert({ allocation_id: alloc, exam_name: exam, student_roll: roll.trim(), marks_obtained: o, max_marks: m });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marks saved"); setRoll(""); setObt(""); qc.invalidateQueries({ queryKey: ["marks"] }); qc.invalidateQueries({ queryKey: ["alloc-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const exams = Array.from(new Set(rows.map((r) => r.exam_name)));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Enter marks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <AllocPicker value={alloc} onChange={setAlloc} />
          <div className="space-y-1"><Label>Exam</Label><Input value={exam} onChange={(e) => setExam(e.target.value)} /></div>
          <div className="space-y-1"><Label>Student roll no.</Label><Input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="R031" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Marks</Label><Input type="number" value={obt} onChange={(e) => setObt(e.target.value)} /></div>
            <div className="space-y-1"><Label>Out of</Label><Input type="number" value={max} onChange={(e) => setMax(e.target.value)} /></div>
          </div>
          <Button disabled={!alloc || !roll || obt === "" || add.isPending} onClick={() => add.mutate()}>Save</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Class results</CardTitle></CardHeader>
        <CardContent>
          {!alloc ? <p className="text-sm text-muted-foreground">Choose a class.</p> : (
            <>
              <div className="mb-4 flex flex-wrap gap-3">
                {exams.map((e) => { const r = rows.filter((x) => x.exam_name === e); const a = r.reduce((s, x) => s + Number(x.marks_obtained) / Number(x.max_marks), 0) / r.length * 100; return <div key={e} className="rounded-lg bg-muted px-3 py-2 text-sm"><b>{e}</b>: avg {pct(a)} · {r.length} students</div>; })}
              </div>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Roll</TableHead><TableHead>Marks</TableHead></TableRow></TableHeader>
                  <TableBody>{rows.map((r) => <TableRow key={r.id}><TableCell>{r.exam_name}</TableCell><TableCell>{r.student_roll}</TableCell><TableCell>{Number(r.marks_obtained)}/{Number(r.max_marks)}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RequestsTab() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => (await supabase.from("dept_requests").select("*").eq("teacher_id", me!.id).order("created_at", { ascending: false })).data ?? [],
    enabled: !!me,
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dept_requests").insert({ teacher_id: me!.id, department_id: me!.department_id, title, body });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request submitted"); setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["my-requests"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">New request to HOD</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label>Subject</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Details</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <Button disabled={!title || !body || add.isPending} onClick={() => add.mutate()}>Submit</Button>
        </CardContent>
      </Card>
      <div className="space-y-3 lg:col-span-2">
        {data.map((r) => (
          <Card key={r.id}><CardContent className="p-5">
            <div className="flex items-center justify-between"><h3 className="font-semibold">{r.title}</h3><StatusBadge s={r.status} /></div>
            <p className="mt-1 text-sm">{r.body}</p>
            {r.review_note && <p className="mt-2 text-xs text-muted-foreground">Note: {r.review_note}</p>}
          </CardContent></Card>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
      </div>
    </div>
  );
}

