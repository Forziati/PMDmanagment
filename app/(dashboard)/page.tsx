import { redirect } from "next/navigation";
import { Decimal } from "decimal.js";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatPesos, formatPercentage, percentageDeviation } from "@/lib/money";
import { cumulativeToDate } from "@/lib/domain/resumen";
import {
  allocationKey,
  emptyMonths,
  plannedMonthsByAllocation,
} from "@/lib/domain/programado";
import { diagnosticarAnio } from "@/lib/domain/diagnostico";
import {
  REAL_STATUSES,
  indexRealByContractSeries,
  realKey,
} from "@/lib/domain/inversion-real";
import { ResumenPageClient, type ResumenRow } from "@/components/resumen/resumen-page-client";

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{
    pmdYearId?: string;
    seriesId?: string;
    investmentGroupId?: string;
    companyId?: string;
    stage?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.clientId) redirect("/login");

  const clientId = user.clientId;
  const params = await searchParams;

  const [pmdYears, investmentGroups, companies] = await Promise.all([
    prisma.pmdYear.findMany({
      where: { pmdCycle: { airport: { clientId } } },
      include: { pmdCycle: { include: { airport: true } } },
      orderBy: { year: "asc" },
    }),
    prisma.investmentGroup.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } }),
    prisma.company.findMany({ where: { clientId }, orderBy: { name: "asc" } }),
  ]);

  const selectedYear =
    pmdYears.find((py) => py.id === params.pmdYearId) ?? pmdYears[0] ?? null;

  const series = selectedYear
    ? await prisma.pmdSeries.findMany({
        where: { pmdYearId: selectedYear.id },
        orderBy: { code: "asc" },
      })
    : [];

  let rows: ResumenRow[] = [];
  if (selectedYear) {
    const allocations = await prisma.contractSeriesAllocation.findMany({
      where: {
        pmdSeries: {
          pmdYearId: selectedYear.id,
          ...(params.seriesId ? { id: params.seriesId } : {}),
          ...(params.investmentGroupId ? { investmentGroupId: params.investmentGroupId } : {}),
        },
        contract: {
          clientId,
          ...(params.companyId ? { companyId: params.companyId } : {}),
          ...(params.stage ? { stage: params.stage } : {}),
        },
      },
      include: {
        contract: { include: { company: true, amendments: true } },
        pmdSeries: true,
      },
      orderBy: [{ contract: { contractNumber: "asc" } }],
    });

    const today = new Date();

    const realRecords = await prisma.actualInvestment.findMany({
      where: {
        contract: { clientId },
        pmdSeries: { pmdYearId: selectedYear.id },
        periodYear: selectedYear.year,
        status: { in: REAL_STATUSES },
      },
      select: {
        contractId: true,
        pmdSeriesId: true,
        periodMonth: true,
        recognizablePmdAmount: true,
      },
    });
    const realIndex = indexRealByContractSeries(
      realRecords.map((r) => ({
        contractId: r.contractId,
        pmdSeriesId: r.pmdSeriesId,
        periodMonth: r.periodMonth,
        recognizablePmdAmount: r.recognizablePmdAmount.toString(),
      })),
    );

    const plannedByAllocation = await plannedMonthsByAllocation(selectedYear.id, selectedYear.year);

    rows = await Promise.all(
      allocations.map(async (allocation) => {
        const months =
          plannedByAllocation.get(allocationKey(allocation.contractId, allocation.pmdSeriesId))
            ?.months ?? emptyMonths();

        const programado = cumulativeToDate(selectedYear.year, months, today);
        const realMonths =
          realIndex.get(realKey(allocation.contractId, allocation.pmdSeriesId)) ??
          Array.from({ length: 12 }, () => new Decimal(0));
        const real = cumulativeToDate(selectedYear.year, realMonths, today);
        const desvio = real.minus(programado);
        const desvioPercent = percentageDeviation(desvio, programado);

        const additional = allocation.contract.amendments
          .filter((a) => a.effectiveDate <= today)
          .reduce((acc, a) => acc.plus(a.amountDelta.toString()), new Decimal(0));

        return {
          allocationId: allocation.id,
          seriesCode: allocation.pmdSeries.code,
          seriesName: allocation.pmdSeries.name,
          contractNumber: allocation.contract.contractNumber,
          contractName: allocation.contract.name,
          companyName: allocation.contract.company?.name ?? null,
          stage: allocation.contract.stage,
          allocatedAmountLabel: formatPesos(allocation.allocatedAmount),
          currentAmountLabel: formatPesos(allocation.contract.currentAmount),
          programadoLabel: formatPesos(programado),
          realLabel: formatPesos(real),
          desvioMoneyLabel: formatPesos(desvio),
          desvioPercentLabel: formatPercentage(desvioPercent),
          desvioIsNegative: desvio.isNegative(),
          oeneLabel: formatPesos(allocation.contract.oeneTotal),
          additionalLabel: formatPesos(additional),
        };
      }),
    );
  }

  const yearLabel = selectedYear
    ? `${selectedYear.pmdCycle.airport.iataCode} — ${selectedYear.pmdCycle.code} — ${selectedYear.year}`
    : "";
  // Solo se diagnostica cuando no hay nada que mostrar: si la tabla trae
  // filas, un aviso encima sería ruido.
  const diagnostico =
    selectedYear && rows.length === 0
      ? await diagnosticarAnio({ pmdYearId: selectedYear.id, year: selectedYear.year, yearLabel })
      : null;

  return (
    <ResumenPageClient
      diagnostico={diagnostico}
      years={pmdYears.map((py) => ({
        id: py.id,
        label: `${py.pmdCycle.airport.iataCode} — ${py.pmdCycle.code} — ${py.year}`,
      }))}
      series={series.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }))}
      investmentGroups={investmentGroups.map((g) => ({ id: g.id, label: g.name }))}
      companies={companies.map((c) => ({ id: c.id, label: c.name }))}
      rows={rows}
      selected={{
        pmdYearId: selectedYear?.id ?? "",
        seriesId: params.seriesId ?? "",
        investmentGroupId: params.investmentGroupId ?? "",
        companyId: params.companyId ?? "",
        stage: params.stage ?? "",
      }}
    />
  );
}
