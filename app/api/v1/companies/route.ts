import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody } from "@/lib/api/respond";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireClientScopedPermission("CONTRATOS.VER");
  if (auth.response) return auth.response;

  const companies = await prisma.company.findMany({
    where: { clientId: auth.clientId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(companies);
}

const createSchema = z.object({
  name: z.string().min(1).max(300),
  taxId: z.string().max(20).optional(),
});

export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("CONTRATOS.CREAR");
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.response) return parsed.response;

  const company = await prisma.company.create({
    data: { ...parsed.data, clientId: auth.clientId },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "CREATE",
    entityType: "Company",
    entityId: company.id,
    afterValue: company,
  });

  return NextResponse.json(company, { status: 201 });
}
