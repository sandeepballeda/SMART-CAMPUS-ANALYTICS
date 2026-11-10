import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe, DAYS } from "@/lib/session";
import { useAllocationStats, avg, workloadStatus, downloadCsv, OVERLOAD_HOURS } from "@/lib/analytics";
import { PortalShell, Stat, Insights, Announcements, StatusBadge, pct } from "@/components/campus";
import { ProfileTab, RequestsReview } from "@/components/portal-shared";
import { TimetableGrid, MissingAttendance, LowAttendanceAlerts, LeaveReview } from "@/components/campus-tools";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/hod")({
  head: () => ({ meta: [{ title: "HOD Portal — Smart Campus" }, { name: "description", content: "Department faculty, workload and performance." }] }),
  component: HodPortal,
});

function HodPortal() {
  const { data: me } = useMe();
  return (
    <PortalShell role="hod" title={me?.department_name ?? "Department"}>
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="faculty">Faculty</TabsTrigger>
          <TabsTrigger value="allocations">Allocations & schedule</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="faculty"><Faculty /></TabsContent>
        <TabsContent value="allocations"><Allocations /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="timetable"><TimetableTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
        <TabsContent value="requests"><Requests /></TabsContent>
        <TabsContent value="announcements"><Announcements canPost departmentId={me?.department_id ?? null} /></TabsContent>
        <TabsContent value="reports"><Reports /></TabsContent>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
      </Tabs>
    </PortalShell>
  );
}

function useDeptTeachers() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["dept-teachers", me?.department_id], enabled: !!me,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("department_id", me!.department_id!).neq("id", me!.id).order("full_name")).data ?? [],
  });
}

function useFacultyAttendance() {
  return useQuery({
    queryKey: ["fac-att"],
    queryFn: async () => (await supabase.from("faculty_attendance").select("teacher_id, status, work_date")).data ?? [],
  });
}

function useFacultyRows() {
  const { data: me } = useMe();
  const { data: teachers = [] } = useDeptTeachers();
  const { data: stats = [] } = useAllocationStats();
  const { data: fa = [] } = useFacultyAttendance();
  const deptStats = stats.filter((s) => s.department_id === me?.department_id && s.teacher_id !== me?.id);
  return teachers.map((t) => {
    const mine = deptStats.filter((s) => s.teacher_id === t.id);
    const days = fa.filter((x) => x.teacher_id === t.id);
    const present = days.filter((x) => x.status === "present").length;
    const hours = mine.reduce((s, a) => s + a.hours, 0);
    return {
      ...t,
      hours,
      classes: mine.length,
      status: workloadStatus(hours),
      presence: days.length ? (present / days.length) * 100 : null,
      att: avg(mine.map((m) => m.attendancePct)),
      marks: avg(mine.map((m) => m.avgMarksPct)),
    };
  });
}

function Overview() {
  const rows = useFacultyRows();
  const { data: me } = useMe();
  const { data: stats = [] } = useAllocationStats();
  const dept = stats.filter((s) => s.department_id === me?.department_id);
  const mk = avg(dept.map((d) => d.avgMarksPct));
  const insights: string[] = [];
  rows.filter((r) => r.status === "overloaded").forEach((r) => insights.push(`${r.full_name} is overloaded at ${r.hours} hrs/week. Consider redistributing a section.`));
  rows.filter((r) => r.status === "underutilized").forEach((r) => insights.push(`${r.full_name} has only ${r.hours} hrs/week — capacity for more classes.`));
  dept.filter((d) => (d.attendancePct ?? 100) < 75).forEach((d) => insights.push(`${d.subject} Sec ${d.section} (${d.teacher_name}) attendance at ${pct(d.attendancePct!)}.`));
  rows.filter((r) => r.presence != null && r.presence < 85).forEach((r) => insights.push(`${r.full_name}'s presence this month is ${pct(r.presence!)}.`));
  if (insights.length === 0 && rows.length) {
    const top = [...rows].sort((x, y) => (y.marks ?? 0) - (x.marks ?? 0))[0]!;
    insights.push(`Workload is balanced across all ${rows.length} faculty members.`);
    if (top.marks != null) insights.push(`${top.full_name}'s classes lead with a ${pct(top.marks)} average internal score.`);
  }
  const bySubject = Object.values(dept.reduce<Record<string, { name: string; m: number[]; a: number[] }>>((acc, d) => {
    (acc[d.subject_code] ??= { name: d.subject_code, m: [], a: [] });
    if (d.avgMarksPct != null) acc[d.subject_code]!.m.push(d.avgMarksPct);
    if (d.attendancePct != null) acc[d.subject_code]!.a.push(d.attendancePct);
    return acc;
  }, {})).map((s) => ({ name: s.name, Marks: Math.round(avg(s.m) ?? 0), Attendance: Math.round(avg(s.a) ?? 0) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Faculty" value={rows.length} />
        <TeacherAttendance rows={rows} />
        <Stat label="Avg internal score" value={mk != null ? pct(mk) : "—"} />
        <Stat label="Workload flags" value={rows.filter((r) => r.status !== "balanced").length} hint="overloaded or underutilized" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Faculty workload (hrs/week)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={rows.map((r) => ({ name: r.full_name.split(" ")[0], Hours: r.hours }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip />
                <ReferenceLine y={OVERLOAD_HOURS} stroke="var(--destructive)" strokeDasharray="4 4" />
                <Bar dataKey="Hours" fill="var(--chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Insights items={insights} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Subject performance</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={bySubject}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis domain={[0, 100]} fontSize={12} /><Tooltip />
              <Bar dataKey="Attendance" fill="var(--chart-1)" radius={4} /><Bar dataKey="Marks" fill="var(--chart-2)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherAttendance({ rows }: { rows: ReturnType<typeof useFacultyRows> }) {
  const [teacherId, setTeacherId] = useState<string>("");
  const selected = rows.find((r) => r.id === teacherId) ?? rows[0];
  const value = selected?.att ?? null;
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class attendance by teacher</p>
        <Select value={selected?.id ?? ""} onValueChange={setTeacherId}>
          <SelectTrigger className="mt-2 h-8"><SelectValue placeholder="Select teacher" /></SelectTrigger>
          <SelectContent>
            {rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className={`mt-2 font-display text-3xl font-semibold ${value != null && value < 75 ? "text-destructive" : "text-success"}`}>
          {value != null ? pct(value) : "—"}
        </p>
        {selected && <p className="mt-1 text-xs text-muted-foreground">{selected.classes} class{selected.classes === 1 ? "" : "es"} · avg across sections</p>}
      </CardContent>
    </Card>
  );
}

function Faculty() {
  const rows = useFacultyRows();
  const qc = useQueryClient();
  const mark = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("faculty_attendance").upsert({ teacher_id: id, work_date: new Date().toISOString().slice(0, 10), status }, { onConflict: "teacher_id,work_date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked for today"); qc.invalidateQueries({ queryKey: ["fac-att"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Qualification</TableHead><TableHead>Exp</TableHead><TableHead>Load</TableHead><TableHead>Presence (30d)</TableHead><TableHead>Class att.</TableHead><TableHead>Avg marks</TableHead><TableHead>Today</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.full_name}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                <TableCell>{r.designation}</TableCell><TableCell>{r.qualification}</TableCell><TableCell>{r.experience_years}y</TableCell>
                <TableCell><Badge variant={r.status === "overloaded" ? "destructive" : r.status === "underutilized" ? "outline" : "secondary"}>{r.hours}h · {r.status}</Badge></TableCell>
                <TableCell>{r.presence != null ? pct(r.presence) : "—"}</TableCell>
                <TableCell>{r.att != null ? pct(r.att) : "—"}</TableCell>
                <TableCell>{r.marks != null ? pct(r.marks) : "—"}</TableCell>
                <TableCell>
                  <Select onValueChange={(v) => mark.mutate({ id: r.id, status: v })}>
                    <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Mark" /></SelectTrigger>
                    <SelectContent><SelectItem value="present">Present</SelectItem><SelectItem value="leave">Leave</SelectItem><SelectItem value="absent">Absent</SelectItem></SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Allocations() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: teachers = [] } = useDeptTeachers();
  const { data: stats = [] } = useAllocationStats();
  const dept = stats.filter((s) => s.department_id === me?.department_id);
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", me?.department_id], enabled: !!me,
    queryFn: async () => (await supabase.from("subjects").select("*").eq("department_id", me!.department_id!).order("code")).data ?? [],
  });
  const { data: sched = [] } = useQuery({
    queryKey: ["dept-sched"],
    queryFn: async () => (await supabase.from("schedules").select("*").order("day_of_week").order("start_time")).data ?? [],
  });
  const [f, setF] = useState({ teacher: "", subject: "", section: "A", hours: "4" });
  const [s, setS] = useState({ alloc: "", day: "1", start: "09:00", end: "10:00", room: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("allocations").insert({ teacher_id: f.teacher, subject_id: f.subject, section: f.section, hours_per_week: Number(f.hours) || 1 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subject allocated"); qc.invalidateQueries({ queryKey: ["alloc-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("allocations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alloc-stats"] }),
  });
  const addSched = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedules").insert({ allocation_id: s.alloc, day_of_week: Number(s.day), start_time: s.start, end_time: s.end, room: s.room });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Slot added"); qc.invalidateQueries({ queryKey: ["dept-sched"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const byId = new Map(dept.map((a) => [a.id, a]));
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Allocate subject</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Select value={f.teacher} onValueChange={(v) => setF({ ...f, teacher: v })}><SelectTrigger><SelectValue placeholder="Teacher" /></SelectTrigger><SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent></Select>
            <Select value={f.subject} onValueChange={(v) => setF({ ...f, subject: v })}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent>{subjects.map((t) => <SelectItem key={t.id} value={t.id}>{t.code} · {t.name}</SelectItem>)}</SelectContent></Select>
            <div className="space-y-1"><Label>Section</Label><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} /></div>
            <div className="space-y-1"><Label>Hours/week</Label><Input type="number" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
            <Button className="col-span-2" disabled={!f.teacher || !f.subject} onClick={() => add.mutate()}>Allocate</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Add timetable slot</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Select value={s.alloc} onValueChange={(v) => setS({ ...s, alloc: v })}><SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger><SelectContent>{dept.map((a) => <SelectItem key={a.id} value={a.id}>{a.subject_code} {a.section} — {a.teacher_name}</SelectItem>)}</SelectContent></Select></div>
            <Select value={s.day} onValueChange={(v) => setS({ ...s, day: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Room" value={s.room} onChange={(e) => setS({ ...s, room: e.target.value })} />
            <Input type="time" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} />
            <Input type="time" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} />
            <Button className="col-span-2" disabled={!s.alloc} onClick={() => addSched.mutate()}>Add slot</Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Subject allocations</CardTitle></CardHeader>
          <CardContent className="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Subject</TableHead><TableHead>Sec</TableHead><TableHead>Hrs</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{dept.map((a) => <TableRow key={a.id}><TableCell>{a.teacher_name}</TableCell><TableCell>{a.subject_code}</TableCell><TableCell>{a.section}</TableCell><TableCell>{a.hours}</TableCell><TableCell><Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>Remove</Button></TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Class schedule</CardTitle></CardHeader>
          <CardContent className="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Class</TableHead><TableHead>Teacher</TableHead><TableHead>Room</TableHead></TableRow></TableHeader>
              <TableBody>{sched.filter((x) => byId.has(x.allocation_id)).map((x) => { const a = byId.get(x.allocation_id)!; return <TableRow key={x.id}><TableCell>{DAYS[x.day_of_week]}</TableCell><TableCell>{x.start_time.slice(0, 5)}</TableCell><TableCell>{a.subject_code} {a.section}</TableCell><TableCell>{a.teacher_name}</TableCell><TableCell>{x.room}</TableCell></TableRow>; })}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Requests() { return <RequestsReview />; }

function Reports() {
  const rows = useFacultyRows();
  const { data: me } = useMe();
  const { data: stats = [] } = useAllocationStats();
  const dept = stats.filter((s) => s.department_id === me?.department_id);
  const code = me?.department_name?.split(" ")[0] ?? "dept";
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardContent className="space-y-3 p-5">
        <h3 className="font-semibold">Faculty report</h3><p className="text-sm text-muted-foreground">Workload, presence and class results per teacher. Opens in Excel.</p>
        <Button onClick={() => downloadCsv(`${code}-faculty.csv`, rows.map((r) => ({ Name: r.full_name, Email: r.email, Designation: r.designation, Qualification: r.qualification, Experience: r.experience_years, HoursPerWeek: r.hours, Workload: r.status, PresencePct: r.presence?.toFixed(1), ClassAttendancePct: r.att?.toFixed(1), AvgMarksPct: r.marks?.toFixed(1) })))}>Download Excel (CSV)</Button>
      </CardContent></Card>
      <Card><CardContent className="space-y-3 p-5">
        <h3 className="font-semibold">Academic report</h3><p className="text-sm text-muted-foreground">Attendance and marks per class section.</p>
        <Button onClick={() => downloadCsv(`${code}-academic.csv`, dept.map((d) => ({ Subject: d.subject_code, Name: d.subject, Section: d.section, Teacher: d.teacher_name, Sessions: d.sessions, AttendancePct: d.attendancePct?.toFixed(1), AvgMarksPct: d.avgMarksPct?.toFixed(1) })))}>Download Excel (CSV)</Button>
      </CardContent></Card>
      <Card><CardContent className="space-y-3 p-5">
        <h3 className="font-semibold">PDF report</h3><p className="text-sm text-muted-foreground">Print the current dashboard, then choose "Save as PDF".</p>
        <Button variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
      </CardContent></Card>
    </div>
  );
}

function AlertsTab() {
  const { data = [] } = useAllocationStats();
  return <div className="grid gap-6 lg:grid-cols-2"><MissingAttendance allocs={data} showTeacher /><LowAttendanceAlerts allocs={data} showTeacher /></div>;
}
function TimetableTab() { const { data = [] } = useAllocationStats(); return <TimetableGrid allocs={data} showTeacher />; }
function LeaveTab() { const { data = [] } = useAllocationStats(); return <LeaveReview allocs={data} />; }
