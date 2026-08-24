import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { MainNav } from "@/components/nav/main-nav";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const links = [
    { href: "/", label: "Resumen" },
    { href: "/dashboard", label: "Dashboard" },
    ...(hasPermission(user, "SERIES.VER")
      ? [
          { href: "/series", label: "Series PMD" },
          { href: "/pmd-programado", label: "PMD Programado" },
        ]
      : []),
    ...(hasPermission(user, "CONTRATOS.VER") ? [{ href: "/contratos", label: "Contratos" }] : []),
    ...(hasPermission(user, "PROGRAMACION.VER")
      ? [{ href: "/programacion", label: "Programación" }]
      : []),
    ...(hasPermission(user, "ADMINISTRACION.VER")
      ? [{ href: "/administracion", label: "Administración" }]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight">PMD Control Hub</span>
          <MainNav links={links} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {user.fullName}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
