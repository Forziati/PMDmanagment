import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";
import {
  RISK_STATUSES,
  RESPONSE_STRATEGIES,
  riskLevelFor,
  suggestedStrategyFor,
} from "@/lib/domain/riesgo";

async function findRiskForClient(id: string, clientId: string) {
  return prisma.risk.findFirst({
    where: { id, contract: { clientId } },
    include: {
      assessments: { orderBy: { assessedAt: "desc" }, take: 1 },
      constraints: true,
      actions: true,
    },
  });
}

const patchSchema = z.object({
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  responseStrategy: z.enum(RESPONSE_STRATEGIES).optional(),
  status: z.enum(RISK_STATUSES).optional(),
  exposedAmount: decimalInput.optional(),
  constraintDescription: z.string().max(4000).optional(),
  actionDescription: z.string().max(4000).optional(),
});

/**
 * Al cambiar Probabilidad o Impacto se registra una NUEVA evaluación (el
 * histórico de RiskAssessment no se pisa) y se recalcula el nivel. La
 * estrategia solo se re-sugiere si el usuario no mandó una explícita.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("RIESGOS.EDITAR");
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await findRiskForClient(id, auth.clientId);
  if (!existing) return jsonError(404, "Riesgo no encontrado.");

  const parsed = await parseJsonBody(request, patchSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const lastAssessment = existing.assessments[0];
  const probability = body.probability ?? lastAssessment?.probability ?? 1;
  const impact = body.impact ?? lastAssessment?.impact ?? 1;
  const scoreChanged =
    (body.probability !== undefined && body.probability !== lastAssessment?.probability) ||
    (body.impact !== undefined && body.impact !== lastAssessment?.impact);

  const level = riskLevelFor(probability, impact);

  const updated = await prisma.$transaction(async (tx) => {
    if (scoreChanged) {
      await tx.riskAssessment.create({ data: { riskId: id, probability, impact } });
    }

    if (body.constraintDescription !== undefined) {
      const text = body.constraintDescription.trim();
      const current = existing.constraints[0];
      if (current) {
        if (text) {
          await tx.constraint.update({ where: { id: current.id }, data: { description: text } });
        } else {
          await tx.constraint.delete({ where: { id: current.id } });
        }
      } else if (text) {
        await tx.constraint.create({ data: { riskId: id, description: text } });
      }
    }

    if (body.actionDescription !== undefined) {
      const text = body.actionDescription.trim();
      const current = existing.actions[0];
      if (current) {
        if (text) {
          await tx.action.update({ where: { id: current.id }, data: { description: text } });
        } else {
          await tx.action.delete({ where: { id: current.id } });
        }
      } else if (text) {
        await tx.action.create({ data: { riskId: id, description: text } });
      }
    }

    return tx.risk.update({
      where: { id },
      data: {
        riskLevel: level,
        responseStrategy:
          body.responseStrategy ?? (scoreChanged ? suggestedStrategyFor(level) : undefined),
        ...(body.status ? { status: body.status } : {}),
        ...(body.exposedAmount !== undefined ? { exposedAmount: body.exposedAmount } : {}),
      },
    });
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "UPDATE",
    entityType: "Risk",
    entityId: id,
    beforeValue: existing,
    afterValue: updated,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("RIESGOS.EDITAR");
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await findRiskForClient(id, auth.clientId);
  if (!existing) return jsonError(404, "Riesgo no encontrado.");

  await prisma.$transaction(async (tx) => {
    await tx.constraint.deleteMany({ where: { riskId: id } });
    await tx.action.deleteMany({ where: { riskId: id } });
    await tx.riskAssessment.deleteMany({ where: { riskId: id } });
    await tx.risk.delete({ where: { id } });
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "DELETE",
    entityType: "Risk",
    entityId: id,
    beforeValue: existing,
  });

  return NextResponse.json({ ok: true });
}
