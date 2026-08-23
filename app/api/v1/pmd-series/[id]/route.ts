import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";

async function findSeriesForClient(id: string, clientId: string) {
  return prisma.pmdSeries.findFirst({
    where: { id, pmdYear: { pmdCycle: { airport: { clientId } } } },
    include: { investmentGroup: true, pmdYear: true, items: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("SERIES.VER");
  if (auth.response) return auth.response;

  const { id } = await params;
  const series = await findSeriesForClient(id, auth.clientId);
  if (!series) return jsonError(404, "Serie PMD no encontrada.");

  return NextResponse.json(series);
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  investmentGroupId: uuid.nullable().optional(),
  authorizedAmount: decimalInput.optional(),
  updatedAmount: decimalInput.optional(),
  responsibleUserId: uuid.nullable().optional(),
  status: z.enum(["ACTIVA", "CERRADA", "RETIRADA"]).optional(),
  sourceDocument: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("SERIES.EDITAR");
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await findSeriesForClient(id, auth.clientId);
  if (!existing) return jsonError(404, "Serie PMD no encontrada.");

  const parsed = await parseJsonBody(request, updateSchema);
  if (parsed.response) return parsed.response;

  const updated = await prisma.pmdSeries.update({ where: { id }, data: parsed.data });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "UPDATE",
    entityType: "PmdSeries",
    entityId: id,
    beforeValue: existing,
    afterValue: updated,
  });

  return NextResponse.json(updated);
}
