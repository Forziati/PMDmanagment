import { redirect } from "next/navigation";
import { Decimal } from "decimal.js";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatPesos, formatMdp } from "@/lib/money";
import {
  RISK_LEVEL_LABELS,
  RESPONSE_STRATEGY_LABELS,
  suggestedStrategyFor,
  type ResponseStrategy,
  type RiskLevel,
} from "@/lib/domain/riesgo";
import {
  ResumenEjecutivoClient,
  type ResumenEjecutivoRow,
} from "@/components/riesgos/resumen-ejecutivo-client";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function ResumenEjecutivoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "RIESGOS.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const [risks, airport] = await Promise.all([
    prisma.risk.findMany({
      where: { contract: { clientId: user.clientId }, status: { not: "CERRADO" } },
      include: {
        contract: {
          include: {
            company: true,
            allocations: { include: { pmdSeries: true } },
          },
        },
        constraints: true,
        actions: true,
      },
    }),
    prisma.airport.findFirst({ where: { clientId: user.clientId } }),
  ]);

  const rows: ResumenEjecutivoRow[] = risks
    .map((risk) => {
      const allocation =
        risk.contract.allocations.find((a) => a.isPrimary) ?? risk.contract.allocations[0] ?? null;
      const level = risk.riskLevel as RiskLevel;

      return {
        riskId: risk.id,
        contractNumber: risk.contract.contractNumber,
        contractName: risk.contract.name,
        seriesLabel: allocation
          ? `${allocation.pmdSeries.code} — ${allocation.pmdSeries.name}`
          : "Sin serie asignada",
        companyName: risk.contract.company?.name ?? "—",
        exposedLabel: formatPesos(risk.exposedAmount),
        level,
        levelLabel: RISK_LEVEL_LABELS[level] ?? level,
        strategyLabel:
          RESPONSE_STRATEGY_LABELS[
            (risk.responseStrategy as ResponseStrategy) ?? suggestedStrategyFor(level)
          ],
        constraintText: risk.constraints[0]?.description ?? "—",
        actionText: risk.actions[0]?.description ?? "—",
        hasAction: risk.actions.length > 0,
      };
    })
    .sort((a, b) => {
      const order: RiskLevel[] = ["CRITICO", "ALTO", "MEDIO", "BAJO"];
      return order.indexOf(a.level) - order.indexOf(b.level);
    });

  const totalExposed = risks.reduce(
    (acc, r) => acc.plus(r.exposedAmount.toString()),
    new Decimal(0),
  );

  return (
    <ResumenEjecutivoClient
      rows={rows}
      airportName={airport?.name ?? ""}
      cutoffLabel={DATE_FORMATTER.format(new Date())}
      kpis={{
        totalExposedLabel: formatMdp(totalExposed),
        active: rows.length,
        critical: rows.filter((r) => r.level === "CRITICO").length,
        high: rows.filter((r) => r.level === "ALTO").length,
        withoutAction: rows.filter((r) => !r.hasAction).length,
      }}
    />
  );
}
