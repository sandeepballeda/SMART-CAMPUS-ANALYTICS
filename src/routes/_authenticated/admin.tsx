import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAllocationStats, avg, workloadStatus, downloadCsv } from "@/lib/analytics";
import { createStaffAccount, deleteStaffAccount } from "@/lib/admin.functions";
import { PortalShell, Stat, Insights, Announcements, pct } from "@/components/campus";
import { RequestsReview } from "@/components/portal-shared";
import { TeacherDirectory } from "@/components/directory";
import { TimetableGrid, MissingAttendance, LowAttendanceAlerts, LeaveReview } from "@/components/campus-tools";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Portal — Smart Campus" }, { name: "description", content: "Institution-wide administration and analytics." }] }),
  component: AdminPortal,
});

function AdminPortal() {
  return (
    <PortalShell role="admin" title="Institution dashboard">
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">Staff accounts</TabsTrigger>
          <TabsTrigger value="directory">Teacher directory</TabsTrigger>
          <TabsTrigger value="academics">Departments & subjects</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="people"><People /></TabsContent>
        <TabsContent value="directory"><TeacherDirectory /></TabsContent>
        <TabsContent value="academics"><Academics /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="timetable"><TimetableTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
        <TabsContent value="requests"><RequestsReview /></TabsContent>
        <TabsContent value="announcements"><Announcements canPost departmentId={null} /></TabsContent>
      </Tabs>
    </PortalShell>
  );
}

const useDepts = () => useQuery({ queryKey: ["depts"], queryFn: async () => (await supabase.from("departments").select("*").order("code")).data ?? [] });
const usePeople = () => useQuery({
  queryKey: ["people"],
  queryFn: async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*, departments(code)").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    return (p ?? []).map((x) => ({ ...x, roles: (r ?? []).filter((y) => y.user_id === x.id).map((y) => y.role) }));
  },
});

function Overview() {
  const { data: depts = [] } = useDepts();
  const { data: people = [] } = usePeople();
  const { data: stats = [] } = useAllocationStats();
  const chart = depts.map((d) => {
    const s = stats.filter((x) => x.department_id === d.id);
    return { name: d.code, Attendance: Math.round(avg(s.map((x) => x.attendancePct)) ?? 0), Marks: Math.round(avg(s.map((x) => x.avgMarksPct)) ?? 0) };
  });
  const loads = new Map<string, number>();
  stats.forEach((s) => loads.set(s.teacher_id, (loads.get(s.teacher_id) ?? 0) + s.hours));
  const teachers = people.filter((p) => p.roles.includes("teacher") && !p.roles.includes("hod"));
  const over = teachers.filter((t) => workloadStatus(loads.get(t.id) ?? 0) === "overloaded");
  const under = teachers.filter((t) => workloadStatus(loads.get(t.id) ?? 0) === "underutilized");
  const insights: string[] = [];
  const sorted = [...chart].sort((a, b) => b.Marks - a.Marks);
  if (sorted[0]) insights.push(`${sorted[0].name} leads internal performance at ${sorted[0].Marks}%.`);
  if (sorted.length > 1) insights.push(`${sorted[sorted.length - 1]!.name} trails at ${sorted[sorted.length - 1]!.Marks}% — review support needs.`);
  chart.filter((c) => c.Attendance && c.Attendance < 75).forEach((c) => insights.push(`${c.name} attendance is below 75% (${c.Attendance}%).`));
  if (over.length) insights.push(`${over.length} teacher(s) overloaded: ${over.map((o) => o.full_name).join(", ")}.`);
  if (under.length) insights.push(`${under.length} teacher(s) underutilized: ${under.map((o) => o.full_name).join(", ")}.`);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Departments" value={depts.length} />
        <Stat label="HODs" value={people.filter((p) => p.roles.includes("hod")).length} />
        <Stat label="Teachers" value={teachers.length} />
        <Stat label="Avg attendance" value={pct(avg(stats.map((s) => s.attendancePct)) ?? 0)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Department comparison</CardTitle>
            <Button size="sm" variant="outline" onClick={() => downloadCsv("institution-report.csv", chart.map((c) => ({ Department: c.name, AttendancePct: c.Attendance, AvgMarksPct: c.Marks })))}>Export</Button>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis domain={[0, 100]} fontSize={12} /><Tooltip />
                <Bar dataKey="Attendance" fill="var(--chart-1)" radius={4} /><Bar dataKey="Marks" fill="var(--chart-2)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Insights items={insights} />
      </div>
    </div>
  );
}

function People() {
  const qc = useQueryClient();
  const { data: depts = [] } = useDepts();
  const { data: people = [] } = usePeople();
  const create = useServerFn(createStaffAccount);
  const remove = useServerFn(deleteStaffAccount);
  const [f, setF] = useState({ email: "", password: "", full_name: "", phone: "", role: "teacher" as "teacher" | "hod", department_id: "", designation: "", qualification: "", experience_years: "0" });
  const [filter, setFilter] = useState("all");
  const add = useMutation({
    mutationFn: () => create({ data: { ...f, phone: f.phone.trim() || undefined, experience_years: Number(f.experience_years) || 0 } }),
    onSuccess: () => { toast.success("Account created"); setF({ ...f, email: "", password: "", full_name: "", phone: "" }); qc.invalidateQueries({ queryKey: ["people"] }); qc.invalidateQueries({ queryKey: ["directory"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Account removed"); qc.invalidateQueries({ queryKey: ["people"] }); qc.invalidateQueries({ queryKey: ["directory"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const shown = people.filter((p) => filter === "all" || p.roles.includes(filter as "hod"));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Create staff account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 98300 00000" /></div>
          <div className="space-y-1"><Label>Temporary password (8+ chars)</Label><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as "teacher" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="teacher">Teacher</SelectItem><SelectItem value="hod">HOD</SelectItem></SelectContent></Select>
            <Select value={f.department_id} onValueChange={(v) => setF({ ...f, department_id: v })}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Designation</Label><Input value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1"><Label>Qualification</Label><Input value={f.qualification} onChange={(e) => setF({ ...f, qualification: e.target.value })} /></div>
            <div className="space-y-1"><Label>Exp (yrs)</Label><Input type="number" value={f.experience_years} onChange={(e) => setF({ ...f, experience_years: e.target.value })} /></div>
          </div>
          <Button className="w-full" disabled={!f.email || f.password.length < 8 || !f.full_name || !f.department_id || add.isPending} onClick={() => add.mutate()}>{add.isPending ? "Creating…" : "Create account"}</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">All staff</CardTitle>
          <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="hod">HODs</SelectItem><SelectItem value="teacher">Teachers</SelectItem><SelectItem value="admin">Admins</SelectItem></SelectContent></Select>
        </CardHeader>
        <CardContent className="max-h-[36rem] overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Dept</TableHead><TableHead>Role</TableHead><TableHead>Qualification</TableHead><TableHead>Exp</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{shown.map((p) => (
              <TableRow key={p.id}>
                <TableCell><div className="font-medium">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.email}</div></TableCell>
                <TableCell>{(p.departments as { code: string } | null)?.code ?? "—"}</TableCell>
                <TableCell className="space-x-1">{p.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>)}</TableCell>
                <TableCell className="text-sm">{p.qualification}</TableCell><TableCell>{p.experience_years}y</TableCell>
                <TableCell>{!p.roles.includes("admin") && <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${p.full_name}'s account?`) && del.mutate(p.id)}>Delete</Button>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Academics() {
  const qc = useQueryClient();
  const { data: depts = [] } = useDepts();
  const { data: subjects = [] } = useQuery({ queryKey: ["all-subjects"], queryFn: async () => (await supabase.from("subjects").select("*, departments(code)").order("code")).data ?? [] });
  const [d, setD] = useState({ name: "", code: "" });
  const [s, setS] = useState({ department_id: "", code: "", name: "", semester: "1", credits: "3" });
  const addD = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("departments").insert({ name: d.name, code: d.code.toUpperCase() }); if (error) throw error; },
    onSuccess: () => { toast.success("Department added"); setD({ name: "", code: "" }); qc.invalidateQueries({ queryKey: ["depts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addS = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("subjects").insert({ ...s, semester: Number(s.semester), credits: Number(s.credits) }); if (error) throw error; },
    onSuccess: () => { toast.success("Subject added"); setS({ ...s, code: "", name: "" }); qc.invalidateQueries({ queryKey: ["all-subjects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Add department</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
            <Input placeholder="Code (e.g. CIVIL)" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} />
            <Button disabled={!d.name || !d.code} onClick={() => addD.mutate()}>Add</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Add subject</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={s.department_id} onValueChange={(v) => setS({ ...s, department_id: v })}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent>{depts.map((x) => <SelectItem key={x.id} value={x.id}>{x.code}</SelectItem>)}</SelectContent></Select>
            <div className="grid grid-cols-3 gap-3"><Input placeholder="Code" value={s.code} onChange={(e) => setS({ ...s, code: e.target.value })} /><Input className="col-span-2" placeholder="Name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Semester</Label><Input type="number" value={s.semester} onChange={(e) => setS({ ...s, semester: e.target.value })} /></div><div className="space-y-1"><Label>Credits</Label><Input type="number" value={s.credits} onChange={(e) => setS({ ...s, credits: e.target.value })} /></div></div>
            <Button disabled={!s.department_id || !s.code || !s.name} onClick={() => addS.mutate()}>Add</Button>
          </CardContent>
        </Card>
      </div>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Departments & subjects</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">{depts.map((x) => <Badge key={x.id} variant="outline">{x.code} · {x.name}</Badge>)}</div>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Dept</TableHead><TableHead>Sem</TableHead><TableHead>Credits</TableHead></TableRow></TableHeader>
            <TableBody>{subjects.map((x) => <TableRow key={x.id}><TableCell>{x.code}</TableCell><TableCell>{x.name}</TableCell><TableCell>{(x.departments as { code: string } | null)?.code}</TableCell><TableCell>{x.semester}</TableCell><TableCell>{x.credits}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertsTab() {
  const { data = [] } = useAllocationStats();
  return <div className="grid gap-6 lg:grid-cols-2"><MissingAttendance allocs={data} showTeacher /><LowAttendanceAlerts allocs={data} showTeacher /></div>;
}
function TimetableTab() { const { data = [] } = useAllocationStats(); return <TimetableGrid allocs={data} showTeacher />; }
function LeaveTab() { const { data = [] } = useAllocationStats(); return <LeaveReview allocs={data} />; }
