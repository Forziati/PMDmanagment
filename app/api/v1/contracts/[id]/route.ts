import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { CONTRACT_STAGES, decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.VER");
  if (auth.response) return auth.response;

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, clientId: auth.clientId },
    include: {
      company: true,
      investmentGroup: true,
      allocations: { include: { pmdSeries: true } },
      amendments: true,
    },
  });
  if (!contract) return jsonError(404, "Contrato no encontrado.");

  return NextResponse.json(contract);
}

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  scope: z.string().max(2000).optional(),
  companyId: uuid.nullable().optional(),
  investmentGroupId: uuid.nullable().optional(),
  stage: z.enum(CONTRACT_STAGES).optional(),
  plannedStartDate: z.coerce.date().nullable().optional(),
  plannedEndDate: z.coerce.date().nullable().optional(),
  actualStartDate: z.coerce.date().nullable().optional(),
  actualEndDate: z.coerce.date().nullable().optional(),
  currentAmount: decimalInput.optional(),
  advanceAmount: decimalInput.optional(),
  costOrigin: z.string().max(30).nullable().optional(),
  responsibleUserId: uuid.nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.EDITAR");
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await prisma.contract.findFirst({ where: { id, clientId: auth.clientId } });
  if (!existing) return jsonError(404, "Contrato no encontrado.");

  const parsed = await parseJsonBody(request, updateSchema);
  if (parsed.response) return parsed.response;

  const updated = await prisma.contract.update({ where: { id }, data: parsed.data });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "UPDATE",
    entityType: "Contract",
    entityId: id,
    beforeValue: existing,
    afterValue: updated,
  });

  return NextResponse.json(updated);
}
