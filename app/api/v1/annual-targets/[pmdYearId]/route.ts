import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";

async function findPmdYearForClient(pmdYearId: string, clientId: string) {
  return prisma.pmdYear.findFirst({
    where: { id: pmdYearId, pmdCycle: { airport: { clientId } } },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pmdYearId: string }> },
) {
  const auth = await requireClientScopedPermission("ADMINISTRACION.VER");
  if (auth.response) return auth.response;

  const { pmdYearId } = await params;
  const pmdYear = await findPmdYearForClient(pmdYearId, auth.clientId);
  if (!pmdYear) return jsonError(404, "Año PMD no encontrado.");

  const target = await prisma.annualTarget.findUnique({ where: { pmdYearId } });
  return NextResponse.json(target);
}

const putSchema = z.object({ amount: decimalInput });

/**
 * Crea o actualiza el hito anual. Sección 4.4 del prompt maestro: el
 * compromiso anual debe estar bloqueado tras su aprobación inicial — una
 * vez que existe y `locked = true`, este endpoint rechaza el cambio y exige
 * desbloquear primero vía POST .../lock (ADMINISTRACION.APROBAR).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pmdYearId: string }> },
) {
  const auth = await requireClientScopedPermission("ADMINISTRACION.EDITAR");
  if (auth.response) return auth.response;

  const { pmdYearId } = await params;
  const pmdYear = await findPmdYearForClient(pmdYearId, auth.clientId);
  if (!pmdYear) return jsonError(404, "Año PMD no encontrado.");

  const parsed = await parseJsonBody(request, putSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.annualTarget.findUnique({ where: { pmdYearId } });
  if (existing?.locked) {
    return jsonError(
      409,
      "El hito anual está bloqueado. Desbloquéalo primero (requiere autorización superior).",
    );
  }

  const target = await prisma.annualTarget.upsert({
    where: { pmdYearId },
    update: { amount: parsed.data.amount },
    create: { pmdYearId, amount: parsed.data.amount, locked: false },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "AnnualTarget",
    entityId: target.id,
    beforeValue: existing,
    afterValue: target,
  });

  return NextResponse.json(target);
}
