import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { summarizeAuditLog } from "@/lib/domain/audit-summary";
import { GestionCambiosClient, type CambioRow } from "@/components/gestion-cambios/gestion-cambios-client";

const LIMIT = 500;

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function GestionCambiosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "AUDITORIA.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const entries = await prisma.auditLog.findMany({
    where: { clientId: user.clientId },
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    take: LIMIT,
  });

  const rows: CambioRow[] = entries.map((entry) => {
    const summary = summarizeAuditLog({
      action: entry.action,
      entityType: entry.entityType,
      beforeValue: entry.beforeValue,
      afterValue: entry.afterValue,
    });
    return {
      id: entry.id,
      occurredAtLabel: DATE_FORMATTER.format(entry.occurredAt),
      occurredAtSort: entry.occurredAt.toISOString(),
      userName: entry.user?.fullName ?? "Sistema",
      entityType: entry.entityType,
      entityLabel: summary.entityLabel,
      actionLabel: summary.actionLabel,
      title: summary.title,
      detail: summary.detail,
    };
  });

  return <GestionCambiosClient rows={rows} limited={entries.length === LIMIT} />;
}
