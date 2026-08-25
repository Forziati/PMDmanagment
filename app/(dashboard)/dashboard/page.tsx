import { redirect } from "next/navigation";
import { Decimal } from "decimal.js";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { formatMdp, formatPesos } from "@/lib/money";
import {
  isAwardedStage,
  remainingMonths,
  runningTotal,
  sumMonthlyArrays,
} from "@/lib/domain/dashboard";
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
import { sumMonths } from "@/lib/domain/monthly-schedule";
import {
  DashboardPageClient,
  type CashFlowGroupRow,
  type DonutBreakdownRow,
  type FilterOption,
  type TopContractRow,
} from "@/components/dashboard/dashboard-page-client";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function toMdp(value: Decimal.Value): number {
  return new Decimal(value).dividedBy(1_000_000).toNumber();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pmdYearId?: string; companyId?: string; seriesId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.clientId) redirect("/login");
  const clientId = user.clientId;

  const params = await searchParams;

  const [pmdYears, companies, investmentGroups] = await Promise.all([
    prisma.pmdYear.findMany({
      where: { pmdCycle: { airport: { clientId } } },
      include: { pmdCycle: { include: { airport: true } } },
      orderBy: { year: "asc" },
    }),
    prisma.company.findMany({ where: { clientId }, orderBy: { name: "asc" } }),
    prisma.investmentGroup.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } }),
  ]);

  const selectedYear = pmdYears.find((py) => py.id === params.pmdYearId) ?? pmdYears[0] ?? null;

  const series = selectedYear
    ? await prisma.pmdSeries.findMany({
        where: { pmdYearId: selectedYear.id },
        orderBy: { code: "asc" },
      })
    : [];

  let cashflowGroups: CashFlowGroupRow[] = [];
  let totalsProgramado = Array(12).fill("0");
  let totalsReal = Array(12).fill("0");
  let totalsBalance = Array(12).fill("0");
  let programadoAcumulado = Array(12).fill("0");
  let realAcumulado = Array(12).fill("0");
  let balanceAcumulado = Array(12).fill("0");
  let topContracts: TopContractRow[] = [];
  let kpiProgramadoAnual = 0;
  let kpiProgramadoAcumulado = 0;
  let kpiRealAcumulado = 0;
  let donutSlices: { name: string; valueMdp: number }[] = [];
  let donutBreakdown: DonutBreakdownRow[] = [];
  let remainingMonthLabels: string[] = [];

  if (selectedYear) {
    const allocations = await prisma.contractSeriesAllocation.findMany({
      where: {
        pmdSeries: {
          pmdYearId: selectedYear.id,
          ...(params.seriesId ? { id: params.seriesId } : {}),
        },
        contract: {
          clientId,
          ...(params.companyId ? { companyId: params.companyId } : {}),
        },
      },
      include: {
        contract: { include: { company: true, investmentGroup: true } },
        pmdSeries: { include: { investmentGroup: true } },
      },
    });

    const plannedByAllocation = await plannedMonthsByAllocation(selectedYear.id, selectedYear.year);

    const rows = allocations.map((allocation) => {
      const months =
        plannedByAllocation.get(allocationKey(allocation.contractId, allocation.pmdSeriesId))
          ?.months ?? emptyMonths();
      const group = allocation.pmdSeries.investmentGroup ?? allocation.contract.investmentGroup;
      return { allocation, months, group };
    });

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

    // ── A/B/C: Resumen Cash Flow por grupo de inversión (hoja "Resumen CashFlow AAAA") ──
    // Se listan siempre los grupos configurados (aunque no tengan filas este
    // año, como en el Excel: i.Diseño/ii.Obra/iii.Procura/iv.Dirección
    // aparecen igual en $0), más "Sin grupo" solo si hay filas sin asignar.
    const groupMap = new Map<
      string,
      { label: string; monthsArrays: string[][]; realArrays: string[][] }
    >();
    for (const group of investmentGroups) {
      groupMap.set(group.id, { label: group.name, monthsArrays: [], realArrays: [] });
    }
    for (const row of rows) {
      const key = row.group?.id ?? "sin-grupo";
      const label = row.group?.name ?? "Sin grupo";
      if (!groupMap.has(key)) {
        groupMap.set(key, { label, monthsArrays: [], realArrays: [] });
      }
      const entry = groupMap.get(key)!;
      entry.monthsArrays.push(row.months);
      const realMonths =
        realIndex.get(realKey(row.allocation.contractId, row.allocation.pmdSeriesId)) ??
        Array.from({ length: 12 }, () => new Decimal(0));
      entry.realArrays.push(realMonths.map((d) => d.toString()));
    }

    cashflowGroups = Array.from(groupMap.entries()).map(
      ([id, { label, monthsArrays, realArrays }]) => {
        const programado = sumMonthlyArrays(monthsArrays);
        const real = sumMonthlyArrays(realArrays);
        const balance = real.map((r, i) => r.minus(programado[i]));
        return {
          groupId: id,
          groupLabel: label,
          programado: programado.map((d) => d.toString()),
          real: real.map((d) => d.toString()),
          balance: balance.map((d) => d.toString()),
        };
      },
    );

    const programadoTotals = sumMonthlyArrays(cashflowGroups.map((g) => g.programado));
    const realTotals = sumMonthlyArrays(cashflowGroups.map((g) => g.real));
    const balanceTotals = realTotals.map((r, i) => r.minus(programadoTotals[i]));
    totalsProgramado = programadoTotals.map((d) => d.toString());
    totalsReal = realTotals.map((d) => d.toString());
    totalsBalance = balanceTotals.map((d) => d.toString());
    programadoAcumulado = runningTotal(totalsProgramado).map((d) => d.toString());
    realAcumulado = runningTotal(totalsReal).map((d) => d.toString());
    balanceAcumulado = runningTotal(totalsBalance).map((d) => d.toString());

    // ── Montos más representativos (lateral) ──
    topContracts = rows
      .map((row) => ({
        groupLabel: row.group?.name ?? "Sin grupo",
        companyName: row.allocation.contract.company?.name ?? "—",
        contractLabel: `${row.allocation.contract.contractNumber} — ${row.allocation.contract.name}`,
        montoMdp: toMdp(row.allocation.contract.currentAmount),
      }))
      .sort((a, b) => b.montoMdp - a.montoMdp)
      .slice(0, 8)
      .map((r) => ({ ...r, montoMdpLabel: formatMdp(new Decimal(r.montoMdp).times(1_000_000)) }));

    // ── KPI barras (PPTX slide 2) ──
    kpiProgramadoAnual = toMdp(sumMonths(totalsProgramado));
    kpiProgramadoAcumulado = toMdp(cumulativeToDate(selectedYear.year, totalsProgramado));
    kpiRealAcumulado = toMdp(cumulativeToDate(selectedYear.year, totalsReal));

    // ── Desglose del faltante (PPTX slide 6) ──
    const remaining = remainingMonths(selectedYear.year);
    remainingMonthLabels = remaining.map((m) => MONTH_LABELS[m - 1]);

    let produccionContratada = new Decimal(0);
    let produccionPorLicitar = new Decimal(0);
    const contractRemaining = new Map<
      string,
      { label: string; months: Decimal[]; awarded: boolean }
    >();

    for (const row of rows) {
      const awarded = isAwardedStage(row.allocation.contract.stage);
      for (const m of remaining) {
        const amount = new Decimal(row.months[m - 1]);
        if (awarded) produccionContratada = produccionContratada.plus(amount);
        else produccionPorLicitar = produccionPorLicitar.plus(amount);
      }
      if (awarded) {
        const key = row.allocation.contractId;
        if (!contractRemaining.has(key)) {
          contractRemaining.set(key, {
            label: `${row.allocation.contract.contractNumber} — ${row.allocation.contract.name}`,
            months: Array(remaining.length).fill(new Decimal(0)),
            awarded: true,
          });
        }
        const entry = contractRemaining.get(key)!;
        remaining.forEach((m, i) => {
          entry.months[i] = entry.months[i].plus(new Decimal(row.months[m - 1]));
        });
      }
    }

    const distinctContracts = new Map<
      string,
      { advanceOutstanding: Decimal; oeneToInvoice: Decimal }
    >();
    for (const row of rows) {
      if (!distinctContracts.has(row.allocation.contractId)) {
        const c = row.allocation.contract;
        distinctContracts.set(row.allocation.contractId, {
          advanceOutstanding: Decimal.max(
            0,
            new Decimal(c.advanceAmount).minus(new Decimal(c.advanceAmortized)),
          ),
          oeneToInvoice: new Decimal(c.oeneToInvoice),
        });
      }
    }
    const anticipoPendiente = Array.from(distinctContracts.values()).reduce(
      (acc, c) => acc.plus(c.advanceOutstanding),
      new Decimal(0),
    );
    const oenePorFacturar = Array.from(distinctContracts.values()).reduce(
      (acc, c) => acc.plus(c.oeneToInvoice),
      new Decimal(0),
    );

    donutSlices = [
      { name: "Producción contratada", valueMdp: toMdp(produccionContratada) },
      { name: "Producción por licitar", valueMdp: toMdp(produccionPorLicitar) },
      { name: "Anticipo pendiente", valueMdp: toMdp(anticipoPendiente) },
      { name: "OENE por facturar", valueMdp: toMdp(oenePorFacturar) },
    ].filter((s) => s.valueMdp > 0);

    const topAwarded = Array.from(contractRemaining.values())
      .sort((a, b) => {
        const totalA = a.months.reduce((acc, m) => acc.plus(m), new Decimal(0));
        const totalB = b.months.reduce((acc, m) => acc.plus(m), new Decimal(0));
        return totalB.minus(totalA).toNumber();
      })
      .slice(0, 6);

    donutBreakdown = topAwarded.map((c) => ({
      concept: c.label,
      months: c.months.map((m) => formatPesos(m)),
      total: formatPesos(c.months.reduce((acc, m) => acc.plus(m), new Decimal(0))),
    }));

    if (produccionPorLicitar.greaterThan(0)) {
      donutBreakdown.push({
        concept: "Producción en licitación",
        months: remaining.map(() => "—"),
        total: formatPesos(produccionPorLicitar),
      });
    }
    if (anticipoPendiente.greaterThan(0)) {
      donutBreakdown.push({
        concept: "Anticipo pendiente",
        months: remaining.map((_, i) => (i === 0 ? formatPesos(anticipoPendiente) : "—")),
        total: formatPesos(anticipoPendiente),
      });
    }
    if (oenePorFacturar.greaterThan(0)) {
      donutBreakdown.push({
        concept: "OENE por facturar",
        months: remaining.map((_, i) => (i === 0 ? formatPesos(oenePorFacturar) : "—")),
        total: formatPesos(oenePorFacturar),
      });
    }
  }

  const yearOptions: FilterOption[] = pmdYears.map((py) => ({
    id: py.id,
    label: `${py.pmdCycle.airport.iataCode} — ${py.pmdCycle.code} — ${py.year}`,
  }));

  // Un año sin programado ni real no tiene nada que graficar: en vez de
  // dibujar barras en cero, se explica qué falta cargar.
  const diagnostico =
    selectedYear && kpiProgramadoAnual === 0 && kpiRealAcumulado === 0
      ? await diagnosticarAnio({
          pmdYearId: selectedYear.id,
          year: selectedYear.year,
          yearLabel: yearOptions.find((y) => y.id === selectedYear.id)?.label ?? "",
        })
      : null;

  return (
    <DashboardPageClient
      diagnostico={diagnostico}
      years={yearOptions}
      series={series.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }))}
      companies={companies.map((c) => ({ id: c.id, label: c.name }))}
      selected={{
        pmdYearId: selectedYear?.id ?? "",
        seriesId: params.seriesId ?? "",
        companyId: params.companyId ?? "",
      }}
      monthLabels={MONTH_LABELS}
      cashflowGroups={cashflowGroups}
      totals={{
        programado: totalsProgramado,
        real: totalsReal,
        balance: totalsBalance,
        programadoAcumulado,
        realAcumulado,
        balanceAcumulado,
      }}
      topContracts={topContracts}
      kpiBars={[
        { label: `Programado ${selectedYear?.year ?? ""}`, valueMdp: kpiProgramadoAnual },
        { label: "Programado acumulado a la fecha", valueMdp: kpiProgramadoAcumulado },
        { label: "Real acumulado a la fecha", valueMdp: kpiRealAcumulado },
      ]}
      donutSlices={donutSlices}
      donutBreakdown={donutBreakdown}
      remainingMonthLabels={remainingMonthLabels}
    />
  );
}
