import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import {
  ProgramacionPageClient,
  type ProgramacionRow,
} from "@/components/programacion/programacion-page-client";

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

    rows = await Promise.all(
      allocations.map(async (allocation) => {
        const vigente = await prisma.scheduleVersion.findFirst({
          where: {
            contractId: allocation.contractId,
            pmdSeriesId: allocation.pmdSeriesId,
            status: "APROBADO",
          },
          include: { monthlySchedules: { where: { periodYear: selectedYear.year } } },
        });

        const months = Array.from({ length: 12 }, (_, i) => {
          const found = vigente?.monthlySchedules.find((ms) => ms.periodMonth === i + 1);
          return found?.plannedAmount.toString() ?? "0";
        });

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
          months,
          hasImbalance: vigente?.monthlySchedules.some((ms) => ms.imbalanceFlag) ?? false,
        };
      }),
    );
  }

  return (
    <ProgramacionPageClient
      key={selectedYear?.id ?? "none"}
      years={pmdYears.map((py) => ({
        id: py.id,
        label: `${py.pmdCycle.airport.iataCode} — ${py.pmdCycle.code} — ${py.year}`,
      }))}
      selectedYearId={selectedYear?.id ?? ""}
      rows={rows}
      canEdit={hasPermission(user, "PROGRAMACION.CREAR")}
    />
  );
}
