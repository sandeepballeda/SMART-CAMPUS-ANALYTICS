import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Smart Campus Analytics" },
      { name: "description", content: "Sign in to the Teacher, HOD or Admin portal." },
      { property: "og:title", content: "Sign in — Smart Campus Analytics" },
      { property: "og:description", content: "Access your campus portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-3xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use the email and password from your administrator.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          <div className="rounded-lg border bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Demo accounts (password: Campus@123)</p>
            <p>admin@campus.edu · hod.cse@campus.edu · priya@campus.edu</p>
          </div>
        </form>
      </div>
    </div>
  );
}
