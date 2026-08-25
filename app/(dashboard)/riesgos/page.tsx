import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatPesos, formatPercentage } from "@/lib/money";
import {
  DESVIO_UMBRAL_LABEL,
  anioDeControl,
  desviosDelAnio,
  impactoSugerido,
  type DesvioDetectado,
} from "@/lib/domain/desvio";
import {
  riskLevelFor,
  suggestedStrategyFor,
  type RiskLevel,
  type RiskStatus,
} from "@/lib/domain/riesgo";
import { CONTRACT_STAGE_LABELS } from "@/lib/domain/contrato";
import { RiesgosPageClient, type RiesgoRow } from "@/components/riesgos/riesgos-page-client";

/** Valores de desvío comunes a una fila, ya formateados para la tabla. */
function desvioLabels(desvio: DesvioDetectado | undefined) {
  if (!desvio) {
    return {
      programmedLabel: formatPesos(0),
      actualLabel: formatPesos(0),
      deviationLabel: formatPesos(0),
      deviationPercentLabel: "N/A",
      isNegative: false,
      exceedsThreshold: false,
    };
  }
  return {
    programmedLabel: formatPesos(desvio.programmed),
    actualLabel: formatPesos(desvio.actual),
    deviationLabel: formatPesos(desvio.deviation),
    deviationPercentLabel: formatPercentage(desvio.deviationPercent),
    isNegative: desvio.deviation.isNegative(),
    exceedsThreshold: desvio.exceedsThreshold,
  };
}

export default async function RiesgosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "RIESGOS.VER")) redirect("/");
  if (!user.clientId) redirect("/");
  const clientId = user.clientId;

  const pmdYears = await prisma.pmdYear.findMany({
    where: { pmdCycle: { airport: { clientId } } },
    include: { pmdCycle: { include: { airport: true } } },
    orderBy: { year: "asc" },
  });
  const controlYear = anioDeControl(pmdYears);

  // Un solo cálculo de desvíos alimenta las dos mitades de la pantalla: los
  // riesgos ya cargados y los que se detectan solos por apartarse del plan.
  const desvios = controlYear ? await desviosDelAnio(clientId, controlYear) : new Map();

  const risks = await prisma.risk.findMany({
    where: { contract: { clientId } },
    include: {
      contract: {
        include: {
          company: true,
          allocations: { include: { pmdSeries: true } },
        },
      },
      assessments: { orderBy: { assessedAt: "desc" }, take: 1 },
      constraints: true,
      actions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const registeredRows: RiesgoRow[] = risks.map((risk) => {
    const desvio = desvios.get(risk.contractId);
    // Un contrato pertenece a una sola serie PMD; si hay varias asignaciones
    // (una por año del ciclo), manda la del año que se está controlando.
    const allocation =
      risk.contract.allocations.find((a) => a.pmdSeriesId === desvio?.pmdSeriesId) ??
      risk.contract.allocations.find((a) => a.isPrimary) ??
      risk.contract.allocations[0] ??
      null;

    const assessment = risk.assessments[0];
    const probability = assessment?.probability ?? 1;
    const impact = assessment?.impact ?? 1;
    const level = (risk.riskLevel as RiskLevel) ?? riskLevelFor(probability, impact);

    return {
      key: risk.id,
      riskId: risk.id,
      detected: false,
      contractId: risk.contractId,
      contractNumber: risk.contract.contractNumber,
      contractName: risk.contract.name,
      seriesCode: allocation?.pmdSeries.code ?? null,
      seriesName: allocation?.pmdSeries.name ?? null,
      companyName: risk.contract.company?.name ?? null,
      stageLabel: CONTRACT_STAGE_LABELS[risk.contract.stage] ?? risk.contract.stage,
      ...desvioLabels(desvio),
      probability,
      impact,
      level,
      strategy: risk.responseStrategy ?? suggestedStrategyFor(level),
      status: risk.status as RiskStatus,
      constraintText: risk.constraints[0]?.description ?? "",
      actionText: risk.actions[0]?.description ?? "",
      suggestedImpact: impactoSugerido(desvio?.deviationPercent ?? null),
    };
  });

  // Los contratos desfasados que todavía no tienen riesgo cargado aparecen
  // igual: son exactamente los que hay que mirar.
  const withRisk = new Set(risks.map((r) => r.contractId));
  const pendientes = [...desvios.values()].filter(
    (d): d is DesvioDetectado => d.exceedsThreshold && !withRisk.has(d.contractId),
  );

  const contracts = pendientes.length
    ? await prisma.contract.findMany({
        where: { id: { in: pendientes.map((d) => d.contractId) } },
        include: { company: true, allocations: { include: { pmdSeries: true } } },
      })
    : [];
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  const detectedRows: RiesgoRow[] = pendientes.flatMap((desvio) => {
    const contract = contractById.get(desvio.contractId);
    if (!contract) return [];
    const allocation =
      contract.allocations.find((a) => a.pmdSeriesId === desvio.pmdSeriesId) ?? null;
    const suggestedImpact = impactoSugerido(desvio.deviationPercent);

    return [
      {
        key: `detected-${desvio.contractId}`,
        riskId: null,
        detected: true,
        contractId: desvio.contractId,
        contractNumber: contract.contractNumber,
        contractName: contract.name,
        seriesCode: allocation?.pmdSeries.code ?? null,
        seriesName: allocation?.pmdSeries.name ?? null,
        companyName: contract.company?.name ?? null,
        stageLabel: CONTRACT_STAGE_LABELS[contract.stage] ?? contract.stage,
        ...desvioLabels(desvio),
        // Todavía nadie evaluó este riesgo: se muestra la sugerencia derivada
        // del tamaño del desvío, y el nivel que le correspondería.
        probability: 3,
        impact: suggestedImpact,
        level: riskLevelFor(3, suggestedImpact),
        strategy: suggestedStrategyFor(riskLevelFor(3, suggestedImpact)),
        status: "IDENTIFICADO" as RiskStatus,
        constraintText: "",
        actionText: "",
        suggestedImpact,
      },
    ];
  });

  // Primero lo detectado y sin atender, ordenado por tamaño del desvío.
  detectedRows.sort((a, b) => {
    const pa = pendientes.find((d) => d.contractId === a.contractId)!.deviation.abs();
    const pb = pendientes.find((d) => d.contractId === b.contractId)!.deviation.abs();
    return pb.comparedTo(pa);
  });

  return (
    <RiesgosPageClient
      rows={[...detectedRows, ...registeredRows]}
      canEdit={hasPermission(user, "RIESGOS.EDITAR")}
      canCreate={hasPermission(user, "RIESGOS.CREAR")}
      umbralLabel={DESVIO_UMBRAL_LABEL}
      controlYearLabel={
        controlYear
          ? `${controlYear.pmdCycle.airport.iataCode} — ${controlYear.pmdCycle.code} — ${controlYear.year}`
          : null
      }
      detectedCount={detectedRows.length}
    />
  );
}
