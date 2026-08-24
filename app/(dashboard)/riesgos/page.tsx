import { redirect } from "next/navigation";
import { Decimal } from "decimal.js";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatPesos } from "@/lib/money";
import { cumulativeToDate } from "@/lib/domain/resumen";
import {
  riskLevelFor,
  suggestedStrategyFor,
  type RiskLevel,
  type RiskStatus,
} from "@/lib/domain/riesgo";
import { CONTRACT_STAGE_LABELS } from "@/lib/domain/contrato";
import { RiesgosPageClient, type RiesgoRow } from "@/components/riesgos/riesgos-page-client";

export default async function RiesgosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "RIESGOS.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const risks = await prisma.risk.findMany({
    where: { contract: { clientId: user.clientId } },
    include: {
      contract: {
        include: {
          company: true,
          allocations: { include: { pmdSeries: { include: { pmdYear: true } } } },
        },
      },
      assessments: { orderBy: { assessedAt: "desc" }, take: 1 },
      constraints: true,
      actions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const today = new Date();

  const rows: RiesgoRow[] = await Promise.all(
    risks.map(async (risk) => {
      // Un contrato pertenece a una sola serie PMD; si hay varias asignaciones
      // (dato heredado), manda la marcada como principal.
      const allocation =
        risk.contract.allocations.find((a) => a.isPrimary) ?? risk.contract.allocations[0] ?? null;

      let programmed = new Decimal(0);
      if (allocation) {
        const vigente = await prisma.scheduleVersion.findFirst({
          where: {
            contractId: risk.contractId,
            pmdSeriesId: allocation.pmdSeriesId,
            status: "APROBADO",
          },
          include: {
            monthlySchedules: { where: { periodYear: allocation.pmdSeries.pmdYear.year } },
          },
        });

        const months = Array.from({ length: 12 }, (_, i) => {
          const found = vigente?.monthlySchedules.find((ms) => ms.periodMonth === i + 1);
          return found?.plannedAmount.toString() ?? "0";
        });

        programmed = cumulativeToDate(allocation.pmdSeries.pmdYear.year, months, today);
      }

      // "Real a la fecha" queda en 0 hasta construir el módulo de Inversión
      // Real — no se inventa un dato que todavía no existe.
      const actual = new Decimal(0);
      const dev = actual.minus(programmed);

      const assessment = risk.assessments[0];
      const probability = assessment?.probability ?? 1;
      const impact = assessment?.impact ?? 1;
      const level = (risk.riskLevel as RiskLevel) ?? riskLevelFor(probability, impact);

      return {
        riskId: risk.id,
        contractId: risk.contractId,
        contractNumber: risk.contract.contractNumber,
        contractName: risk.contract.name,
        seriesCode: allocation?.pmdSeries.code ?? null,
        seriesName: allocation?.pmdSeries.name ?? null,
        companyName: risk.contract.company?.name ?? null,
        stageLabel: CONTRACT_STAGE_LABELS[risk.contract.stage] ?? risk.contract.stage,
        programmedLabel: formatPesos(programmed),
        actualLabel: formatPesos(actual),
        deviationLabel: formatPesos(dev),
        isNegative: dev.isNegative(),
        probability,
        impact,
        level,
        strategy: risk.responseStrategy ?? suggestedStrategyFor(level),
        status: risk.status as RiskStatus,
        constraintText: risk.constraints[0]?.description ?? "",
        actionText: risk.actions[0]?.description ?? "",
      };
    }),
  );

  return <RiesgosPageClient rows={rows} canEdit={hasPermission(user, "RIESGOS.EDITAR")} />;
}
