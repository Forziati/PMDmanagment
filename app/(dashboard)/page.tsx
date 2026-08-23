import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PMD Control Hub</h1>
          <p className="text-muted-foreground text-sm">
            Sistema de Control, Proyección y Protección de Inversión PMD
          </p>
        </div>
        <LogoutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Sesión activa</CardTitle>
          <CardDescription>
            Cimientos y autenticación del MVP verificados. Los módulos de
            series, contratos, programación, inversión real y dashboard
            ejecutivo se construyen a continuación, uno a la vez
            (MVP_BACKLOG.md, Fase 3).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Usuario: </span>
            {user.fullName} ({user.email})
          </div>
          <div className="flex flex-wrap gap-2">
            {user.permissionCodes.length === 0 ? (
              <span className="text-muted-foreground text-sm">
                Sin permisos asignados.
              </span>
            ) : (
              user.permissionCodes
                .slice(0, 12)
                .map((code) => <Badge key={code} variant="secondary">{code}</Badge>)
            )}
            {user.permissionCodes.length > 12 && (
              <Badge variant="outline">+{user.permissionCodes.length - 12} más</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
