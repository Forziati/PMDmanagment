import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";

async function findPmdYearForClient(id: string, clientId: string) {
  return prisma.pmdYear.findFirst({
    where: { id, pmdCycle: { airport: { clientId } } },
  });
}

const patchSchema = z.object({ escalationFactor: decimalInput });

/**
 * Actualiza el factor de escalación anual (hoja "PMD 24-28", celdas E5:I5 del
 * Excel — mismo valor que la fila 111 de "Datos PMD"). No afecta el hito
 * anual bloqueado; es un dato independiente de PmdYear.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("ADMINISTRACION.EDITAR");
  if (auth.response) return auth.response;

  const { id } = await params;
  const pmdYear = await findPmdYearForClient(id, auth.clientId);
  if (!pmdYear) return jsonError(404, "Año PMD no encontrado.");

  const parsed = await parseJsonBody(request, patchSchema);
  if (parsed.response) return parsed.response;

  const updated = await prisma.pmdYear.update({
    where: { id },
    data: { escalationFactor: parsed.data.escalationFactor },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "UPDATE",
    entityType: "PmdYear",
    entityId: updated.id,
    beforeValue: pmdYear,
    afterValue: updated,
  });

  return NextResponse.json({
    id: updated.id,
    year: updated.year,
    escalationFactor: updated.escalationFactor,
  });
}
