import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireClientScopedPermission("SERIES.VER");
  if (auth.response) return auth.response;

  const pmdYearId = new URL(request.url).searchParams.get("pmdYearId");

  const series = await prisma.pmdSeries.findMany({
    where: {
      pmdYear: { pmdCycle: { airport: { clientId: auth.clientId } } },
      ...(pmdYearId ? { pmdYearId } : {}),
    },
    include: { investmentGroup: true, pmdYear: true },
    orderBy: [{ pmdYear: { year: "asc" } }, { code: "asc" }],
  });

  return NextResponse.json(series);
}

const createSchema = z.object({
  pmdYearId: uuid,
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  investmentGroupId: uuid.optional(),
  authorizedAmount: decimalInput.default("0"),
  updatedAmount: decimalInput.default("0"),
  responsibleUserId: uuid.optional(),
  sourceDocument: z.string().max(200).optional(),
  tags: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("SERIES.CREAR");
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.response) return parsed.response;

  const pmdYear = await prisma.pmdYear.findFirst({
    where: { id: parsed.data.pmdYearId, pmdCycle: { airport: { clientId: auth.clientId } } },
  });
  if (!pmdYear) return jsonError(400, "Año PMD inválido para este cliente.");

  const existing = await prisma.pmdSeries.findUnique({
    where: { pmdYearId_code: { pmdYearId: parsed.data.pmdYearId, code: parsed.data.code } },
  });
  if (existing) return jsonError(409, "Ya existe una serie con ese código en ese año PMD.");

  const series = await prisma.pmdSeries.create({ data: parsed.data });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "CREATE",
    entityType: "PmdSeries",
    entityId: series.id,
    afterValue: series,
  });

  return NextResponse.json(series, { status: 201 });
}
