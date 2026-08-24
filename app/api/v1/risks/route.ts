import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";
import {
  RISK_STATUSES,
  RESPONSE_STRATEGIES,
  riskLevelFor,
  suggestedStrategyFor,
} from "@/lib/domain/riesgo";

export async function GET(request: Request) {
  const auth = await requireClientScopedPermission("RIESGOS.VER");
  if (auth.response) return auth.response;

  const contractId = new URL(request.url).searchParams.get("contractId");

  const risks = await prisma.risk.findMany({
    where: {
      contract: { clientId: auth.clientId },
      ...(contractId ? { contractId } : {}),
    },
    include: {
      contract: { include: { company: true } },
      assessments: { orderBy: { assessedAt: "desc" }, take: 1 },
      constraints: true,
      actions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(risks);
}

const createSchema = z.object({
  contractId: uuid,
  exposedAmount: decimalInput.default("0"),
  exposurePeriod: z.string().max(50).optional(),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  responseStrategy: z.enum(RESPONSE_STRATEGIES).optional(),
  status: z.enum(RISK_STATUSES).default("IDENTIFICADO"),
  constraintDescription: z.string().max(4000).optional(),
  actionDescription: z.string().max(4000).optional(),
});

/**
 * Un riesgo pertenece a UN contrato (y el contrato, a una sola serie PMD).
 * El nivel se deriva de Probabilidad × Impacto — nunca se recibe del
 * cliente — y la estrategia se sugiere si no viene explícita.
 */
export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("RIESGOS.CREAR");
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.response) return parsed.response;

  const contract = await prisma.contract.findFirst({
    where: { id: parsed.data.contractId, clientId: auth.clientId },
  });
  if (!contract) return jsonError(400, "Contrato inválido para este cliente.");

  const level = riskLevelFor(parsed.data.probability, parsed.data.impact);
  const strategy = parsed.data.responseStrategy ?? suggestedStrategyFor(level);

  const risk = await prisma.$transaction(async (tx) => {
    const created = await tx.risk.create({
      data: {
        contractId: parsed.data.contractId,
        exposedAmount: parsed.data.exposedAmount,
        exposurePeriod: parsed.data.exposurePeriod,
        riskLevel: level,
        responseStrategy: strategy,
        status: parsed.data.status,
      },
    });

    await tx.riskAssessment.create({
      data: {
        riskId: created.id,
        probability: parsed.data.probability,
        impact: parsed.data.impact,
      },
    });

    if (parsed.data.constraintDescription?.trim()) {
      await tx.constraint.create({
        data: { riskId: created.id, description: parsed.data.constraintDescription.trim() },
      });
    }

    if (parsed.data.actionDescription?.trim()) {
      await tx.action.create({
        data: { riskId: created.id, description: parsed.data.actionDescription.trim() },
      });
    }

    return created;
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "CREATE",
    entityType: "Risk",
    entityId: risk.id,
    afterValue: risk,
  });

  return NextResponse.json(risk, { status: 201 });
}
