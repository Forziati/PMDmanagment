import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { writeAuditLog } from "@/lib/audit";

const bodySchema = z.object({
  action: z.enum(["lock", "unlock"]),
  reason: z.string().min(1).max(2000),
});

/**
 * Bloqueo/desbloqueo del hito anual (sección 4.4 del prompt maestro):
 * requiere autorización superior (ADMINISTRACION.APROBAR) y motivo
 * explícito, siempre auditado. El flujo formal de approval_requests
 * (módulo 10, Autorizaciones) es lo que en el futuro generará este cambio;
 * por ahora esta acción directa exige el permiso y deja constancia.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ pmdYearId: string }> },
) {
  const auth = await requireClientScopedPermission("ADMINISTRACION.APROBAR");
  if (auth.response) return auth.response;

  const { pmdYearId } = await params;
  const pmdYear = await prisma.pmdYear.findFirst({
    where: { id: pmdYearId, pmdCycle: { airport: { clientId: auth.clientId } } },
  });
  if (!pmdYear) return jsonError(404, "Año PMD no encontrado.");

  const parsed = await parseJsonBody(request, bodySchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.annualTarget.findUnique({ where: { pmdYearId } });
  if (!existing) {
    return jsonError(404, "El hito anual aún no ha sido creado para este año PMD.");
  }

  const locked = parsed.data.action === "lock";
  const updated = await prisma.annualTarget.update({
    where: { pmdYearId },
    data: {
      locked,
      approvedBy: locked ? auth.user.id : existing.approvedBy,
    },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: locked ? "LOCK" : "UNLOCK",
    entityType: "AnnualTarget",
    entityId: updated.id,
    beforeValue: existing,
    afterValue: updated,
    reason: parsed.data.reason,
  });

  return NextResponse.json(updated);
}
