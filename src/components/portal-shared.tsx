import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/session";
import { StatusBadge } from "@/components/campus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ProfileTab() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: p } = useQuery({
    queryKey: ["profile", me?.id], enabled: !!me,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", me!.id).single()).data,
  });
  const [f, setF] = useState({ full_name: "", phone: "", qualification: "", designation: "", experience_years: "0" });
  useEffect(() => { if (p) setF({ full_name: p.full_name, phone: p.phone ?? "", qualification: p.qualification ?? "", designation: p.designation ?? "", experience_years: String(p.experience_years ?? 0) }); }, [p]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ ...f, experience_years: Number(f.experience_years) || 0 }).eq("id", me!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle className="text-base">My profile</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{me?.email} · {me?.department_name ?? "Institution"}</p>
        {(["full_name", "designation", "qualification", "phone", "experience_years"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <Label className="capitalize">{k.replace("_", " ")}</Label>
            <Input value={f[k]} type={k === "experience_years" ? "number" : "text"} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save changes</Button>
      </CardContent>
    </Card>
  );
}

export function RequestsReview() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data = [] } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => (await supabase.from("dept_requests").select("*, profiles!dept_requests_teacher_id_fkey(full_name), departments(code)").order("created_at", { ascending: false })).data ?? [],
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("dept_requests").update({ status, review_note: notes[id] ?? null, reviewed_by: me!.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request updated"); qc.invalidateQueries({ queryKey: ["requests"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      {data.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
      {data.map((r) => (
        <Card key={r.id}><CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-semibold">{r.title}</h3><p className="text-xs text-muted-foreground">{(r.profiles as { full_name: string } | null)?.full_name} · {(r.departments as { code: string } | null)?.code} · {new Date(r.created_at!).toLocaleDateString()}</p></div>
            <StatusBadge s={r.status} />
          </div>
          <p className="mt-2 text-sm">{r.body}</p>
          {r.status === "pending" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Input className="max-w-sm" placeholder="Note (optional)" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              <Button size="sm" onClick={() => review.mutate({ id: r.id, status: "approved" })}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => review.mutate({ id: r.id, status: "rejected" })}>Reject</Button>
            </div>
          ) : r.review_note && <p className="mt-2 text-xs text-muted-foreground">Note: {r.review_note}</p>}
        </CardContent></Card>
      ))}
    </div>
  );
}
