import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import {
  ProgramacionPageClient,
  type ProgramacionRow,
} from "@/components/programacion/programacion-page-client";
import {
  allocationKey,
  emptyMonths,
  plannedMonthsByAllocation,
} from "@/lib/domain/programado";
import { diagnosticarAnio } from "@/lib/domain/diagnostico";

export default async function ProgramacionPage({
  searchParams,
}: {
  searchParams: Promise<{ pmdYearId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "PROGRAMACION.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const pmdYears = await prisma.pmdYear.findMany({
    where: { pmdCycle: { airport: { clientId: user.clientId } } },
    include: { pmdCycle: { include: { airport: true } } },
    orderBy: { year: "asc" },
  });

  const { pmdYearId: requestedYearId } = await searchParams;
  const selectedYear =
    pmdYears.find((py) => py.id === requestedYearId) ?? pmdYears[0] ?? null;

  let rows: ProgramacionRow[] = [];
  if (selectedYear) {
    const allocations = await prisma.contractSeriesAllocation.findMany({
      where: {
        pmdSeries: { pmdYearId: selectedYear.id },
        contract: { clientId: user.clientId },
      },
      include: { contract: true, pmdSeries: true },
      orderBy: [{ contract: { contractNumber: "asc" } }],
    });

    const plannedByAllocation = await plannedMonthsByAllocation(selectedYear.id, selectedYear.year);

    rows = allocations.map((allocation) => {
      const planned = plannedByAllocation.get(
        allocationKey(allocation.contractId, allocation.pmdSeriesId),
      );

      return {
        allocationId: allocation.id,
        contractId: allocation.contractId,
        contractNumber: allocation.contract.contractNumber,
        contractName: allocation.contract.name,
        pmdSeriesId: allocation.pmdSeriesId,
        seriesCode: allocation.pmdSeries.code,
        seriesName: allocation.pmdSeries.name,
        allocatedAmount: allocation.allocatedAmount.toString(),
        periodYear: selectedYear.year,
        months: planned?.months ?? emptyMonths(),
        hasImbalance: planned?.hasImbalance ?? false,
      };
    });
  }

  const yearLabel = selectedYear
    ? `${selectedYear.pmdCycle.airport.iataCode} — ${selectedYear.pmdCycle.code} — ${selectedYear.year}`
    : "";
  const diagnostico =
    selectedYear && rows.length === 0
      ? await diagnosticarAnio({ pmdYearId: selectedYear.id, year: selectedYear.year, yearLabel })
      : null;

  return (
    <ProgramacionPageClient
      key={selectedYear?.id ?? "none"}
      years={pmdYears.map((py) => ({
        id: py.id,
        label: `${py.pmdCycle.airport.iataCode} — ${py.pmdCycle.code} — ${py.year}`,
      }))}
      selectedYearId={selectedYear?.id ?? ""}
      rows={rows}
      diagnostico={diagnostico}
      canEdit={hasPermission(user, "PROGRAMACION.CREAR")}
    />
  );
}
