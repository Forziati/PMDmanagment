import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody } from "@/lib/api/respond";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireClientScopedPermission("ADMINISTRACION.VER");
  if (auth.response) return auth.response;

  const groups = await prisma.investmentGroup.findMany({
    where: { clientId: auth.clientId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(groups);
}

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
});

export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("ADMINISTRACION.CREAR");
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.response) return parsed.response;

  const group = await prisma.investmentGroup.create({
    data: { ...parsed.data, clientId: auth.clientId },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "CREATE",
    entityType: "InvestmentGroup",
    entityId: group.id,
    afterValue: group,
  });

  return NextResponse.json(group, { status: 201 });
}
