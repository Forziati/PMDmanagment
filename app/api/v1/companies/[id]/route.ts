import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  taxId: z.string().max(20).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("CONTRATOS.EDITAR");
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await prisma.company.findFirst({
    where: { id, clientId: auth.clientId },
  });
  if (!existing) return jsonError(404, "Empresa no encontrada.");

  const parsed = await parseJsonBody(request, updateSchema);
  if (parsed.response) return parsed.response;

  const updated = await prisma.company.update({ where: { id }, data: parsed.data });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "UPDATE",
    entityType: "Company",
    entityId: id,
    beforeValue: existing,
    afterValue: updated,
  });

  return NextResponse.json(updated);
}
