import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { CONTRACT_STAGES, decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireClientScopedPermission("CONTRATOS.VER");
  if (auth.response) return auth.response;

  const contracts = await prisma.contract.findMany({
    where: { clientId: auth.clientId },
    include: { company: true, investmentGroup: true, allocations: { include: { pmdSeries: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(contracts);
}

const createSchema = z.object({
  contractNumber: z.string().min(1).max(50),
  name: z.string().min(1).max(300),
  scope: z.string().max(2000).optional(),
  companyId: uuid.optional(),
  investmentGroupId: uuid.optional(),
  stage: z.enum(CONTRACT_STAGES).default("EN_DEFINICION"),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  originalAmount: decimalInput.default("0"),
  currentAmount: decimalInput.default("0"),
  advanceAmount: decimalInput.default("0"),
  oeneContractedBudget: decimalInput.default("0"),
  oeneTotal: decimalInput.default("0"),
  oeneContracted: decimalInput.default("0"),
  oeneToRegularize: decimalInput.default("0"),
  oeneToInvoice: decimalInput.default("0"),
  costOrigin: z.string().max(30).optional(),
  responsibleUserId: uuid.optional(),
});

export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("CONTRATOS.CREAR");
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.contract.findUnique({
    where: {
      clientId_contractNumber: {
        clientId: auth.clientId,
        contractNumber: parsed.data.contractNumber,
      },
    },
  });
  if (existing) return jsonError(409, "Ya existe un contrato con ese número para este cliente.");

  const contract = await prisma.contract.create({
    data: { ...parsed.data, clientId: auth.clientId },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "CREATE",
    entityType: "Contract",
    entityId: contract.id,
    afterValue: contract,
  });

  return NextResponse.json(contract, { status: 201 });
}
