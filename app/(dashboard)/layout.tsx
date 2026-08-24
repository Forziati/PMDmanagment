import { redirect } from "next/navigation";

import { AUTH_DISABLED, getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { MainNav } from "@/components/nav/main-nav";
import { LogoutButton } from "@/components/auth/logout-button";

/**
 * Todas las pantallas leen datos por petición, así que nunca se prerenderizan
 * en el build. Marcarlo explícito importa porque en modo de un solo usuario no
 * se leen cookies, y sin esa señal Next intentaría prerenderizarlas y fallaría
 * al no tener base de datos disponible durante el build.
 */
export const dynamic = "force-dynamic";

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
    ...(hasPermission(user, "INVERSION_REAL.VER")
      ? [{ href: "/inversion-real", label: "Inversión real" }]
      : []),
    ...(hasPermission(user, "SERIES.CREAR") ? [{ href: "/importar", label: "Importar" }] : []),
    ...(hasPermission(user, "RIESGOS.VER") ? [{ href: "/riesgos", label: "Riesgos" }] : []),
    ...(hasPermission(user, "ADMINISTRACION.VER")
      ? [{ href: "/administracion", label: "Administración" }]
      : []),
    ...(hasPermission(user, "AUDITORIA.VER")
      ? [{ href: "/gestion-cambios", label: "Gestión de cambios" }]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight">PMD Control Hub</span>
          <MainNav links={links} />
        </div>
        {!AUTH_DISABLED && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user.fullName}
            </span>
            <LogoutButton />
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
