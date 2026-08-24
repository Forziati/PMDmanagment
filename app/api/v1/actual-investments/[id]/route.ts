import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";
import {
  INVESTMENT_STATUSES,
  allowedTransitions,
  canTransition,
  isImmutable,
  suggestedRecognizable,
  type InvestmentStatus,
} from "@/lib/domain/inversion-real";

async function findRecordForClient(id: string, clientId: string) {
  return prisma.actualInvestment.findFirst({
    where: { id, contract: { clientId } },
    include: { invoice: true, estimate: true },
  });
}

const patchSchema = z.object({
  status: z.enum(INVESTMENT_STATUSES).optional(),
  grossAmount: decimalInput.optional(),
  amortization: decimalInput.optional(),
  retention: decimalInput.optional(),
  penalty: decimalInput.optional(),
  taxes: decimalInput.optional(),
  recognizablePmdAmount: decimalInput.optional(),
});

/**
 * Cambia el estado o corrige montos. Un registro Aprobado o Cerrado es
 * INMUTABLE en sus montos (BUSINESS_RULES.md §1.2): solo admite avanzar de
 * estado; para corregir cifras hay que crear un registro que lo reemplace
 * (POST a este mismo recurso).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedBody = await parseJsonBody(request, patchSchema);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.data;

  // Aprobar o cerrar exige permiso de aprobación; el resto, el de creación.
  const needsApproval = body.status === "APROBADO" || body.status === "CERRADO";
  const auth = await requireClientScopedPermission(
    needsApproval ? "INVERSION_REAL.APROBAR" : "INVERSION_REAL.CREAR",
  );
  if (auth.response) return auth.response;

  const existing = await findRecordForClient(id, auth.clientId);
  if (!existing) return jsonError(404, "Registro de inversión real no encontrado.");

  const currentStatus = existing.status as InvestmentStatus;

  const touchesAmounts =
    body.grossAmount !== undefined ||
    body.amortization !== undefined ||
    body.retention !== undefined ||
    body.penalty !== undefined ||
    body.taxes !== undefined ||
    body.recognizablePmdAmount !== undefined;

  if (touchesAmounts && isImmutable(currentStatus)) {
    return jsonError(
      409,
      "Un registro aprobado o cerrado no se edita. Crea una corrección que lo reemplace (POST a este mismo recurso).",
    );
  }

  if (body.status && body.status !== currentStatus) {
    if (!canTransition(currentStatus, body.status)) {
      const allowed = allowedTransitions(currentStatus);
      return jsonError(
        409,
        allowed.length === 0
          ? `Un registro ${currentStatus} es terminal: no admite más cambios de estado.`
          : `No se puede pasar de ${currentStatus} a ${body.status}. Transiciones válidas: ${allowed.join(", ")}.`,
      );
    }
  }

  const updated = await prisma.actualInvestment.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.grossAmount !== undefined ? { grossAmount: body.grossAmount } : {}),
      ...(body.amortization !== undefined ? { amortization: body.amortization } : {}),
      ...(body.retention !== undefined ? { retention: body.retention } : {}),
      ...(body.penalty !== undefined ? { penalty: body.penalty } : {}),
      ...(body.taxes !== undefined ? { taxes: body.taxes } : {}),
      ...(body.recognizablePmdAmount !== undefined
        ? { recognizablePmdAmount: body.recognizablePmdAmount }
        : {}),
      ...(needsApproval ? { validatedBy: auth.user.id } : {}),
    },
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: body.status ? `STATUS_${body.status}` : "UPDATE",
    entityType: "ActualInvestment",
    entityId: id,
    beforeValue: existing,
    afterValue: updated,
  });

  return NextResponse.json(updated);
}

const correctionSchema = z.object({
  grossAmount: decimalInput,
  amortization: decimalInput.default("0"),
  retention: decimalInput.default("0"),
  penalty: decimalInput.default("0"),
  taxes: decimalInput.default("0"),
  recognizablePmdAmount: decimalInput.optional(),
  reason: z.string().min(1).max(2000),
});

/**
 * Corrección de un registro inmutable: crea uno NUEVO con `supersedesId`
 * apuntando al original, que queda visible e intacto. El original pasa a
 * REVERTIDO para que deje de sumar a la Curva S.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireClientScopedPermission("INVERSION_REAL.APROBAR");
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await findRecordForClient(id, auth.clientId);
  if (!existing) return jsonError(404, "Registro de inversión real no encontrado.");

  const alreadySuperseded = await prisma.actualInvestment.findFirst({
    where: { supersedesId: id },
  });
  if (alreadySuperseded) {
    return jsonError(409, "Este registro ya fue corregido por otro posterior.");
  }

  const parsed = await parseJsonBody(request, correctionSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const recognizable =
    body.recognizablePmdAmount ?? suggestedRecognizable(body).toString();

  const correction = await prisma.$transaction(async (tx) => {
    const created = await tx.actualInvestment.create({
      data: {
        contractId: existing.contractId,
        pmdSeriesId: existing.pmdSeriesId,
        periodYear: existing.periodYear,
        periodMonth: existing.periodMonth,
        investmentType: existing.investmentType,
        grossAmount: body.grossAmount,
        amortization: body.amortization,
        retention: body.retention,
        penalty: body.penalty,
        taxes: body.taxes,
        recognizablePmdAmount: recognizable,
        status: "BORRADOR",
        supersedesId: id,
        capturedBy: auth.user.id,
      },
    });

    await tx.actualInvestment.update({ where: { id }, data: { status: "REVERTIDO" } });

    return created;
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "CORRECTION",
    entityType: "ActualInvestment",
    entityId: correction.id,
    beforeValue: existing,
    afterValue: { ...correction, reason: body.reason },
  });

  return NextResponse.json(correction, { status: 201 });
}
