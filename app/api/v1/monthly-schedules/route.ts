import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { parseJsonBody, jsonError } from "@/lib/api/respond";
import { decimalInput, uuid } from "@/lib/api/validation";
import { writeAuditLog } from "@/lib/audit";
import { computeImbalance, suggestAdjustment } from "@/lib/domain/monthly-schedule";

/**
 * Matriz de programación mensual: una fila por asignación contrato↔serie
 * (contract_series_allocations) para el año PMD solicitado — la serie ya
 * está acotada a un único año (pmd_series.pmd_year_id), así que la
 * asignación es, en efecto, el objetivo anual de esa fila (sección 6.4).
 */
export async function GET(request: Request) {
  const auth = await requireClientScopedPermission("PROGRAMACION.VER");
  if (auth.response) return auth.response;

  const pmdYearId = new URL(request.url).searchParams.get("pmdYearId");
  if (!pmdYearId) return jsonError(400, "Falta pmdYearId.");

  const pmdYear = await prisma.pmdYear.findFirst({
    where: { id: pmdYearId, pmdCycle: { airport: { clientId: auth.clientId } } },
  });
  if (!pmdYear) return jsonError(404, "Año PMD no encontrado.");

  const allocations = await prisma.contractSeriesAllocation.findMany({
    where: { pmdSeries: { pmdYearId }, contract: { clientId: auth.clientId } },
    include: { contract: true, pmdSeries: true },
    orderBy: [{ contract: { contractNumber: "asc" } }],
  });

  const rows = await Promise.all(
    allocations.map(async (allocation) => {
      const vigente = await prisma.scheduleVersion.findFirst({
        where: {
          contractId: allocation.contractId,
          pmdSeriesId: allocation.pmdSeriesId,
          status: "APROBADO",
        },
        include: {
          monthlySchedules: { where: { periodYear: pmdYear.year } },
        },
      });

      const months = Array.from({ length: 12 }, (_, i) => {
        const found = vigente?.monthlySchedules.find((ms) => ms.periodMonth === i + 1);
        return found?.plannedAmount.toString() ?? "0";
      });
      const hasImbalance = vigente?.monthlySchedules.some((ms) => ms.imbalanceFlag) ?? false;

      return {
        allocationId: allocation.id,
        contractId: allocation.contractId,
        contractNumber: allocation.contract.contractNumber,
        contractName: allocation.contract.name,
        pmdSeriesId: allocation.pmdSeriesId,
        seriesCode: allocation.pmdSeries.code,
        seriesName: allocation.pmdSeries.name,
        allocatedAmount: allocation.allocatedAmount.toString(),
        periodYear: pmdYear.year,
        scheduleVersionId: vigente?.id ?? null,
        months,
        hasImbalance,
      };
    }),
  );

  return NextResponse.json(rows);
}

const saveSchema = z.object({
  contractId: uuid,
  pmdSeriesId: uuid,
  periodYear: z.number().int(),
  months: z.array(decimalInput).length(12),
  reason: z.string().min(1).max(2000),
  acknowledgeImbalance: z.boolean().default(false),
});

export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("PROGRAMACION.CREAR");
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, saveSchema);
  if (parsed.response) return parsed.response;
  const { contractId, pmdSeriesId, periodYear, months, reason, acknowledgeImbalance } = parsed.data;

  const allocation = await prisma.contractSeriesAllocation.findFirst({
    where: {
      contractId,
      pmdSeriesId,
      contract: { clientId: auth.clientId },
      pmdSeries: { pmdYear: { pmdCycle: { airport: { clientId: auth.clientId } } } },
    },
    include: { contract: true, pmdSeries: { include: { pmdYear: true } } },
  });
  if (!allocation) return jsonError(404, "Asignación contrato-serie no encontrada.");

  if (allocation.pmdSeries.pmdYear.year !== periodYear) {
    return jsonError(400, "El año no corresponde al año PMD de la serie.");
  }

  const imbalance = computeImbalance(months, allocation.allocatedAmount);

  if (imbalance && !acknowledgeImbalance) {
    return NextResponse.json({
      requiresConfirmation: true,
      imbalance,
      suggestion: suggestAdjustment(months, imbalance),
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const priorCount = await tx.scheduleVersion.count({ where: { contractId, pmdSeriesId } });

    await tx.scheduleVersion.updateMany({
      where: { contractId, pmdSeriesId, status: "APROBADO" },
      data: { status: "HISTORICA" },
    });

    const version = await tx.scheduleVersion.create({
      data: {
        contractId,
        pmdSeriesId,
        versionType: priorCount === 0 ? "BASELINE" : "APPROVED",
        cutoffDate: new Date(),
        reason,
        requestedBy: auth.user.id,
        approvedBy: auth.user.id,
        status: "APROBADO",
      },
    });

    await tx.monthlySchedule.createMany({
      data: months.map((amount, index) => ({
        scheduleVersionId: version.id,
        contractId,
        pmdSeriesId,
        periodYear,
        periodMonth: index + 1,
        plannedAmount: amount,
        imbalanceFlag: Boolean(imbalance),
        imbalanceDetail: imbalance ? (JSON.parse(JSON.stringify(imbalance)) as object) : undefined,
      })),
    });

    return version;
  });

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: imbalance ? "SAVE_SCHEDULE_WITH_IMBALANCE" : "SAVE_SCHEDULE",
    entityType: "ScheduleVersion",
    entityId: result.id,
    afterValue: { contractId, pmdSeriesId, periodYear, months, imbalance },
    reason: imbalance
      ? `Descuadre al guardar programación: suma ${imbalance.sum} vs objetivo ${imbalance.target} (diferencia ${imbalance.difference}). Contrato ${allocation.contract.contractNumber}, serie ${allocation.pmdSeries.code}, año ${periodYear}. Motivo del usuario: ${reason}`
      : reason,
  });

  return NextResponse.json({
    requiresConfirmation: false,
    scheduleVersionId: result.id,
    months,
    imbalance,
  });
}
