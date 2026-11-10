import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, Users } from "lucide-react";
const logoSrc = "/icfaitech-logo.png";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Campus Analytics — Institutional dashboard" },
      { name: "description", content: "Manage faculty, attendance, marks and department analytics with Teacher, HOD and Admin portals." },
      { property: "og:title", content: "Smart Campus Analytics" },
      { property: "og:description", content: "Teacher, HOD and Admin portals for academic management and analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const portals = [
    { icon: GraduationCap, t: "Teacher", d: "Schedules, attendance, internal marks, class analytics and requests." },
    { icon: Users, t: "HOD", d: "Faculty workload, department performance, approvals and announcements." },
    { icon: ShieldCheck, t: "Admin", d: "Accounts, departments, subjects and institution-wide insight." },
  ];
  return (
    <div className="min-h-screen bg-hero text-ink-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center rounded-lg bg-white px-3 py-1.5">
          <img src={logoSrc} alt="IcfaiTech — Faculty of Science & Technology (FST)" className="h-10 w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground" />
          <Button asChild variant="secondary"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Institutional analytics</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
          One clear view of your campus — from classroom to principal's office.
        </h1>
        <p className="mt-6 max-w-xl text-lg opacity-80">
          Attendance, marks, workload and departmental performance, with strict role-based access for teachers, HODs and administrators.
        </p>
        <Button asChild size="lg" className="mt-10 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/auth">Open your portal</Link>
        </Button>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {portals.map((p) => (
            <div key={p.t} className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-6 backdrop-blur">
              <p.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 text-xl font-semibold">{p.t} portal</h3>
              <p className="mt-2 text-sm opacity-75">{p.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
