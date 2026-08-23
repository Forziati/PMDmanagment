import { NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";
import { sumMoney } from "@/lib/money";

async function findAllocation(contractId: string, allocationId: string, clientId: string) {
  return prisma.contractSeriesAllocation.findFirst({
    where: { id: allocationId, contractId, contract: { clientId } },
    include: { contract: true },
  });
}

const updateSchema = z.object({
  allocatedAmount: decimalInput.optional(),
  isPrimary: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; allocationId: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.EDITAR");
  if (auth.response) return auth.response;

  const { id: contractId, allocationId } = await params;
  const existing = await findAllocation(contractId, allocationId, auth.clientId);
  if (!existing) return jsonError(404, "Asignación no encontrada.");

  const parsed = await parseJsonBody(request, updateSchema);
  if (parsed.response) return parsed.response;

  const updated = await prisma.contractSeriesAllocation.update({
    where: { id: allocationId },
    data: parsed.data,
    include: { pmdSeries: true },
  });

  const siblings = await prisma.contractSeriesAllocation.findMany({ where: { contractId } });
  const totalAllocated = sumMoney(siblings.map((a) => a.allocatedAmount));
  const overAllocated = totalAllocated.greaterThan(
    new Decimal(existing.contract.currentAmount.toString()),
  );

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: overAllocated ? "UPDATE_OVER_ALLOCATION_WARNING" : "UPDATE",
    entityType: "ContractSeriesAllocation",
    entityId: allocationId,
    beforeValue: existing,
    afterValue: updated,
    reason: overAllocated
      ? `Suma de asignaciones (${totalAllocated.toString()}) excede el monto vigente del contrato (${existing.contract.currentAmount.toString()}).`
      : undefined,
  });

  return NextResponse.json({
    ...updated,
    warning: overAllocated ? "La suma de asignaciones excede el monto vigente del contrato." : null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; allocationId: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.EDITAR");
  if (auth.response) return auth.response;

  const { id: contractId, allocationId } = await params;
  const existing = await findAllocation(contractId, allocationId, auth.clientId);
  if (!existing) return jsonError(404, "Asignación no encontrada.");

  await prisma.contractSeriesAllocation.delete({ where: { id: allocationId } });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "DELETE",
    entityType: "ContractSeriesAllocation",
    entityId: allocationId,
    beforeValue: existing,
  });

  return NextResponse.json({ ok: true });
}
