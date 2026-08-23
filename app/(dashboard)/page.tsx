import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>Bienvenido, {user.fullName}</CardTitle>
          <CardDescription>
            El dashboard ejecutivo (KPIs, Curva S, desglose del faltante) se
            construye en un módulo posterior una vez que existan datos de
            programación e inversión real que consolidar (MVP_BACKLOG.md,
            Fase 3). Por ahora, usa la navegación superior para gestionar
            Series PMD, Contratos y Administración.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {user.permissionCodes.slice(0, 12).map((code) => (
              <Badge key={code} variant="secondary">
                {code}
              </Badge>
            ))}
            {user.permissionCodes.length > 12 && (
              <Badge variant="outline">+{user.permissionCodes.length - 12} más</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
