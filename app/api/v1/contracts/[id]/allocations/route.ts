import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";
import { sumMoney } from "@/lib/money";
import { Decimal } from "decimal.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.VER");
  if (auth.response) return auth.response;

  const { id } = await params;
  const contract = await prisma.contract.findFirst({ where: { id, clientId: auth.clientId } });
  if (!contract) return jsonError(404, "Contrato no encontrado.");

  const allocations = await prisma.contractSeriesAllocation.findMany({
    where: { contractId: id },
    include: { pmdSeries: true },
  });
  return NextResponse.json(allocations);
}

const createSchema = z.object({
  pmdSeriesId: uuid,
  allocatedAmount: decimalInput,
  isPrimary: z.boolean().default(false),
});

/**
 * El Excel de origen modela contrato↔serie 1:1 (el contrato vive en la fila
 * de la serie); aquí se permite M:N (DESIGN_BASELINE.md, ambigüedad §1). Si
 * la suma de asignaciones excede el monto vigente del contrato no se
 * bloquea — se advierte y se deja constancia en bitácora, igual que el
 * descuadre de programación mensual (sección 0.2 del prompt maestro).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.EDITAR");
  if (auth.response) return auth.response;

  const { id: contractId } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, clientId: auth.clientId },
  });
  if (!contract) return jsonError(404, "Contrato no encontrado.");

  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.response) return parsed.response;

  const series = await prisma.pmdSeries.findFirst({
    where: {
      id: parsed.data.pmdSeriesId,
      pmdYear: { pmdCycle: { airport: { clientId: auth.clientId } } },
    },
  });
  if (!series) return jsonError(400, "Serie PMD inválida para este cliente.");

  const existing = await prisma.contractSeriesAllocation.findUnique({
    where: {
      contractId_pmdSeriesId: { contractId, pmdSeriesId: parsed.data.pmdSeriesId },
    },
  });
  if (existing) return jsonError(409, "Este contrato ya está asignado a esa serie.");

  const allocation = await prisma.contractSeriesAllocation.create({
    data: { ...parsed.data, contractId },
    include: { pmdSeries: true },
  });

  const siblings = await prisma.contractSeriesAllocation.findMany({ where: { contractId } });
  const totalAllocated = sumMoney(siblings.map((a) => a.allocatedAmount));
  const overAllocated = totalAllocated.greaterThan(new Decimal(contract.currentAmount.toString()));

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: overAllocated ? "CREATE_OVER_ALLOCATION_WARNING" : "CREATE",
    entityType: "ContractSeriesAllocation",
    entityId: allocation.id,
    afterValue: allocation,
    reason: overAllocated
      ? `Suma de asignaciones (${totalAllocated.toString()}) excede el monto vigente del contrato (${contract.currentAmount.toString()}).`
      : undefined,
  });

  return NextResponse.json(
    { ...allocation, warning: overAllocated ? "La suma de asignaciones excede el monto vigente del contrato." : null },
    { status: 201 },
  );
}
