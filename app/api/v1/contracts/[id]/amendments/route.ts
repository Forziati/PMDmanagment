import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";

/**
 * Convenios/ampliaciones del contrato (DATA_DICTIONARY.md §2.10). No editan
 * ni sustituyen el monto original: cada convenio queda como su propio
 * registro histórico (sección 4.5, no borrado ni edición retroactiva).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.VER");
  if (auth.response) return auth.response;

  const { id: contractId } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, clientId: auth.clientId },
  });
  if (!contract) return jsonError(404, "Contrato no encontrado.");

  const amendments = await prisma.contractAmendment.findMany({
    where: { contractId },
    orderBy: { amendmentNumber: "asc" },
  });
  return NextResponse.json(amendments);
}

const createSchema = z.object({
  amendmentNumber: z.number().int().positive(),
  amountDelta: decimalInput,
  effectiveDate: z.coerce.date(),
  reason: z.string().min(1).max(2000),
});

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

  const existing = await prisma.contractAmendment.findUnique({
    where: {
      contractId_amendmentNumber: {
        contractId,
        amendmentNumber: parsed.data.amendmentNumber,
      },
    },
  });
  if (existing) return jsonError(409, "Ya existe un convenio con ese número para este contrato.");

  const amendment = await prisma.contractAmendment.create({
    data: { ...parsed.data, contractId },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "CREATE",
    entityType: "ContractAmendment",
    entityId: amendment.id,
    afterValue: amendment,
    reason: parsed.data.reason,
  });

  return NextResponse.json(amendment, { status: 201 });
}
