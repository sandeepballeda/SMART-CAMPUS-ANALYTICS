import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { LogOut, Megaphone } from "lucide-react";
const logoSrc = "/icfaitech-logo.png";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type Role } from "@/lib/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PortalShell({ role, title, children }: { role: Role; title: string; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!me || !me.roles.includes(role))
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted-foreground">Your account doesn't have access to the {role} portal.</p>
          <Button asChild className="mt-6"><Link to="/dashboard">Go to my portal</Link></Button>
        </div>
      </div>
    );

  const links: { to: "/admin" | "/hod" | "/teacher"; label: string; r: Role }[] = [
    { to: "/admin", label: "Admin", r: "admin" },
    { to: "/hod", label: "HOD", r: "hod" },
    { to: "/teacher", label: "Teacher", r: "teacher" },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <Link to="/" className="flex items-center rounded-lg bg-white px-3 py-1.5" aria-label="Smart Campus home">
            <img src={logoSrc} alt="IcfaiTech — Faculty of Science & Technology (FST)" className="h-9 w-auto" />
          </Link>
          <nav className="flex gap-1">
            {links.filter((l) => me.roles.includes(l.r)).map((l) => (
              <Link key={l.to} to={l.to} className="rounded-md px-3 py-1.5 text-sm opacity-75 hover:opacity-100" activeProps={{ className: "bg-sidebar-accent opacity-100" }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-semibold">{me.full_name || me.email}</div>
              <div className="text-xs opacity-60">{me.department_name ?? "Institution"}</div>
            </div>
            <ThemeToggle className="hover:bg-sidebar-accent hover:text-ink-foreground" />
            <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sign out" className="hover:bg-sidebar-accent hover:text-ink-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <Badge variant="secondary" className="uppercase tracking-wider">{role} portal</Badge>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string | undefined; tone?: "warn" | "good" | undefined }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-2 font-display text-3xl font-semibold ${tone === "warn" ? "text-destructive" : tone === "good" ? "text-success" : ""}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function Insights({ items }: { items: string[] }) {
  return (
    <Card className="border-accent/50 bg-accent/10">
      <CardHeader className="pb-2"><CardTitle className="text-base">Insights</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Not enough data yet.</p> : (
          <ul className="space-y-2 text-sm">
            {items.map((t, i) => <li key={i} className="flex gap-2"><span className="text-accent-foreground">●</span>{t}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function Announcements({ canPost, departmentId }: { canPost?: boolean; departmentId?: string | null }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*, profiles(full_name), departments(code)").order("created_at", { ascending: false })).data ?? [],
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const post = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements").insert({ title, body, author_id: me!.id, department_id: departmentId ?? null });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setBody(""); toast.success("Announcement posted"); qc.invalidateQueries({ queryKey: ["announcements"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {canPost && (
        <Card>
          <CardHeader><CardTitle className="text-base">New announcement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label>Message</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Sent to: {departmentId ? "your department" : "everyone"}</p>
            <Button disabled={!title || !body || post.isPending} onClick={() => post.mutate()}>Post</Button>
          </CardContent>
        </Card>
      )}
      <div className={`space-y-3 ${canPost ? "lg:col-span-2" : "lg:col-span-3"}`}>
        {data.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
        {data.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex gap-4 p-5">
              <Megaphone className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  <Badge variant="outline">{(a.departments as { code: string } | null)?.code ?? "All"}</Badge>
                </div>
                <p className="mt-1 text-sm">{a.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{(a.profiles as { full_name: string } | null)?.full_name} · {new Date(a.created_at!).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function StatusBadge({ s }: { s: string }) {
  const v = s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";
  return <Badge variant={v as "default"} className="capitalize">{s}</Badge>;
}

export function pct(n: number) { return `${Math.round(n)}%`; }
