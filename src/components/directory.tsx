import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Phone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/analytics";
import {
  PERSONAL_FIELDS,
  ageFrom,
  directoryQuery,
  filterDirectory,
  formatDate,
  missingPersonalFields,
  type DirectoryRow,
  type PersonalFieldKey,
} from "@/lib/directory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Draft = Record<PersonalFieldKey, string>;

const toDraft = (row: DirectoryRow): Draft =>
  Object.fromEntries(PERSONAL_FIELDS.map((f) => [f.key, String(row[f.key] ?? "")])) as Draft;

export function TeacherDirectory() {
  const qc = useQueryClient();
  const { data: rows = [], isPending } = useQuery(directoryQuery);
  const { data: depts = [] } = useQuery({
    queryKey: ["depts"],
    queryFn: async () => (await supabase.from("departments").select("*").order("code")).data ?? [],
  });
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const shown = useMemo(() => filterDirectory(rows, { q, dept }), [rows, q, dept]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const missing = selected ? missingPersonalFields(selected) : [];

  const save = useMutation({
    mutationFn: async () => {
      if (!selected || !draft) return;
      const val = (key: PersonalFieldKey) => {
        const v = draft[key].trim();
        return v === "" ? null : v;
      };
      const { error } = await supabase.from("profiles").update({
        phone: val("phone"),
        date_of_birth: val("date_of_birth"),
        gender: val("gender"),
        blood_group: val("blood_group"),
        personal_email: val("personal_email"),
        address: val("address"),
        emergency_contact_name: val("emergency_contact_name"),
        emergency_contact_phone: val("emergency_contact_phone"),
        date_of_joining: val("date_of_joining"),
      }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Personal details saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () =>
    downloadCsv("teacher-directory.csv", shown.map((r) => ({
      Name: r.full_name,
      Department: r.department ?? "",
      Designation: r.designation ?? "",
      Phone: r.phone ?? "",
      InstituteEmail: r.email ?? "",
      PersonalEmail: r.personal_email ?? "",
      DateOfBirth: r.date_of_birth ?? "",
      Gender: r.gender ?? "",
      BloodGroup: r.blood_group ?? "",
      Address: r.address ?? "",
      EmergencyContact: r.emergency_contact_name ?? "",
      EmergencyPhone: r.emergency_contact_phone ?? "",
      DateOfJoining: r.date_of_joining ?? "",
    })));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Teacher directory</CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!shown.length}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name, email or phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {depts.map((d) => <SelectItem key={d.id} value={d.code}>{d.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="max-h-[36rem] overflow-auto">
          {isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id} data-state={r.id === selectedId ? "selected" : undefined}>
                    <TableCell>
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.designation ?? r.email}</div>
                    </TableCell>
                    <TableCell>{r.department ?? "—"}</TableCell>
                    <TableCell>
                      {r.phone
                        ? <a className="inline-flex items-center gap-1.5 font-medium tabular-nums hover:underline" href={`tel:${r.phone}`}>
                            <Phone className="h-3.5 w-3.5 text-accent" /> {r.phone}
                          </a>
                        : <span className="text-muted-foreground">Not added</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={r.id === selectedId ? "secondary" : "ghost"} onClick={() => { setSelectedId(r.id); setDraft(null); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!shown.length && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No teachers match this search.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{selected ? selected.full_name : "Personal details"}</CardTitle>
          {selected && !draft && (
            <Button size="sm" variant="outline" onClick={() => setDraft(toDraft(selected))}>Edit</Button>
          )}
        </CardHeader>
        <CardContent>
          {!selected ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pick a teacher to see their personal details and contact numbers.
            </p>
          ) : draft ? (
            <div className="space-y-3">
              <Field label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date of birth</Label>
                  <Input type="date" value={draft.date_of_birth} onChange={(e) => setDraft({ ...draft, date_of_birth: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Gender</Label>
                  <Select value={draft.gender || "none"} onValueChange={(v) => setDraft({ ...draft, gender: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Blood group" value={draft.blood_group} onChange={(v) => setDraft({ ...draft, blood_group: v })} />
                <Field label="Date of joining" value={draft.date_of_joining} onChange={(v) => setDraft({ ...draft, date_of_joining: v })} type="date" />
              </div>
              <Field label="Personal email" value={draft.personal_email} onChange={(v) => setDraft({ ...draft, personal_email: v })} type="email" />
              <div className="space-y-1">
                <Label>Address</Label>
                <Textarea rows={3} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Emergency contact" value={draft.emergency_contact_name} onChange={(v) => setDraft({ ...draft, emergency_contact_name: v })} />
                <Field label="Emergency phone" value={draft.emergency_contact_phone} onChange={(v) => setDraft({ ...draft, emergency_contact_phone: v })} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save details"}</Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {missing.length > 0 && (
                <Badge variant="secondary">{missing.length} detail{missing.length > 1 ? "s" : ""} still to fill in</Badge>
              )}
              <Detail label="Designation" value={selected.designation} />
              <Detail label="Qualification" value={selected.qualification} />
              <Detail label="Department" value={selected.department} />
              <Detail label="Experience" value={selected.experience_years != null ? `${selected.experience_years} years` : null} />
              <Detail label="Institute email" value={selected.email} />
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Date of birth" value={selected.date_of_birth ? `${formatDate(selected.date_of_birth)}${ageFrom(selected.date_of_birth) != null ? ` (age ${ageFrom(selected.date_of_birth)})` : ""}` : null} />
              <Detail label="Gender" value={selected.gender} />
              <Detail label="Blood group" value={selected.blood_group} />
              <Detail label="Personal email" value={selected.personal_email} />
              <Detail label="Address" value={selected.address} />
              <Detail label="Emergency contact" value={selected.emergency_contact_name} />
              <Detail label="Emergency phone" value={selected.emergency_contact_phone} />
              <Detail label="Date of joining" value={selected.date_of_joining ? formatDate(selected.date_of_joining) : null} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm whitespace-pre-line">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
