import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";
import {
  INVESTMENT_TYPES,
  recognizableGap,
  suggestedRecognizable,
} from "@/lib/domain/inversion-real";

export async function GET(request: Request) {
  const auth = await requireClientScopedPermission("INVERSION_REAL.VER");
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const contractId = url.searchParams.get("contractId");
  const periodYear = url.searchParams.get("periodYear");

  const records = await prisma.actualInvestment.findMany({
    where: {
      contract: { clientId: auth.clientId },
      ...(contractId ? { contractId } : {}),
      ...(periodYear ? { periodYear: Number(periodYear) } : {}),
    },
    include: {
      contract: { include: { company: true } },
      pmdSeries: true,
      invoice: true,
      estimate: true,
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(records);
}

const createSchema = z.object({
  contractId: uuid,
  pmdSeriesId: uuid.optional(),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  investmentType: z.enum(INVESTMENT_TYPES),
  grossAmount: decimalInput,
  amortization: decimalInput.default("0"),
  retention: decimalInput.default("0"),
  penalty: decimalInput.default("0"),
  taxes: decimalInput.default("0"),
  /** Si no viene, se calcula como bruto menos deducciones. */
  recognizablePmdAmount: decimalInput.optional(),
  documentNumber: z.string().max(100).optional(),
  documentDate: z.string().datetime().optional(),
  /** Reconoce explícitamente una diferencia contra el monto sugerido. */
  acknowledgeGap: z.boolean().default(false),
});

/**
 * Alta de inversión real. Nace siempre en BORRADOR — el monto solo alimenta
 * la Curva S al llegar a Aprobado.
 *
 * Dos controles, deliberadamente distintos:
 *  - Duplicados: BLOQUEA (BUSINESS_RULES.md §3), porque protege contra el
 *    doble registro de gasto real.
 *  - Diferencia entre el reconocible capturado y el sugerido por las
 *    deducciones: solo advierte y exige acuse, igual que el descuadre de
 *    programación (sección 0.2) — el criterio oficial de reconocimiento
 *    puede reconocer legítimamente otro monto.
 */
export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("INVERSION_REAL.CREAR");
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const contract = await prisma.contract.findFirst({
    where: { id: body.contractId, clientId: auth.clientId },
    include: { allocations: true },
  });
  if (!contract) return jsonError(400, "Contrato inválido para este cliente.");

  // Un contrato pertenece a una sola serie PMD: si no la mandan, se deduce.
  const pmdSeriesId =
    body.pmdSeriesId ??
    contract.allocations.find((a) => a.isPrimary)?.pmdSeriesId ??
    contract.allocations[0]?.pmdSeriesId;
  if (!pmdSeriesId) {
    return jsonError(400, "El contrato no tiene una serie PMD asignada.");
  }

  const series = await prisma.pmdSeries.findFirst({
    where: {
      id: pmdSeriesId,
      pmdYear: { pmdCycle: { airport: { clientId: auth.clientId } } },
    },
  });
  if (!series) return jsonError(400, "Serie PMD inválida para este cliente.");

  const documentDate = body.documentDate ? new Date(body.documentDate) : null;

  // Control BLOQUEANTE de duplicados.
  if (body.documentNumber && documentDate) {
    const sameDocument = await prisma.actualInvestment.findFirst({
      where: {
        contractId: body.contractId,
        grossAmount: body.grossAmount,
        status: { notIn: ["ANULADO", "REVERTIDO"] },
        OR: [
          { invoice: { invoiceNumber: body.documentNumber, issueDate: documentDate } },
          { estimate: { estimateNumber: body.documentNumber, periodEnd: documentDate } },
        ],
      },
      include: { invoice: true, estimate: true },
    });

    if (sameDocument) {
      return jsonError(
        409,
        `Ya existe un registro con el mismo contrato, documento (${body.documentNumber}), fecha e importe. Para corregirlo, usa el registro existente en vez de crear uno nuevo.`,
      );
    }
  }

  const suggested = suggestedRecognizable(body);
  const recognizable = body.recognizablePmdAmount ?? suggested.toString();
  const gap = recognizableGap(recognizable, body);

  if (!gap.isZero() && !body.acknowledgeGap) {
    return NextResponse.json(
      {
        error: "El monto reconocible no coincide con bruto menos deducciones.",
        warning: {
          suggestedRecognizable: suggested.toString(),
          providedRecognizable: recognizable.toString(),
          gap: gap.toString(),
        },
        requiresAcknowledgement: true,
      },
      { status: 409 },
    );
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.actualInvestment.create({
      data: {
        contractId: body.contractId,
        pmdSeriesId,
        periodYear: body.periodYear,
        periodMonth: body.periodMonth,
        investmentType: body.investmentType,
        grossAmount: body.grossAmount,
        amortization: body.amortization,
        retention: body.retention,
        penalty: body.penalty,
        taxes: body.taxes,
        recognizablePmdAmount: recognizable,
        status: "BORRADOR",
        capturedBy: auth.user.id,
      },
    });

    if (body.documentNumber && documentDate) {
      if (body.investmentType === "FACTURA") {
        await tx.invoice.create({
          data: {
            actualInvestmentId: created.id,
            contractId: body.contractId,
            invoiceNumber: body.documentNumber,
            issueDate: documentDate,
          },
        });
      } else if (body.investmentType === "ESTIMACION") {
        await tx.estimate.create({
          data: {
            actualInvestmentId: created.id,
            contractId: body.contractId,
            estimateNumber: body.documentNumber,
            periodStart: documentDate,
            periodEnd: documentDate,
          },
        });
      }
    }

    return created;
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: gap.isZero() ? "CREATE" : "CREATE_RECOGNIZABLE_GAP_ACKNOWLEDGED",
    entityType: "ActualInvestment",
    entityId: record.id,
    afterValue: { ...record, recognizableGap: gap.toString() },
  });

  return NextResponse.json(record, { status: 201 });
}
