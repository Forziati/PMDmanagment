import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatPesos, formatMdp } from "@/lib/money";
import {
  buildPmdProgramadoMatrix,
  buildYearPieSlices,
  OTROS_SLICE_CODE,
} from "@/lib/domain/pmd-programado";
import {
  PmdProgramadoClient,
  type PmdProgramadoTableRow,
} from "@/components/pmd-programado/pmd-programado-client";

export default async function PmdProgramadoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "SERIES.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const pmdYears = await prisma.pmdYear.findMany({
    where: { pmdCycle: { airport: { clientId: user.clientId } } },
    include: { pmdCycle: { include: { airport: true } }, pmdSeries: true },
    orderBy: { year: "asc" },
  });

  const years = pmdYears.map((py) => py.year);
  const matrix = buildPmdProgramadoMatrix(
    pmdYears.flatMap((py) =>
      py.pmdSeries.map((s) => ({
        code: s.code,
        name: s.name,
        year: py.year,
        authorizedAmount: s.authorizedAmount.toString(),
        updatedAmount: s.updatedAmount.toString(),
      })),
    ),
    years,
  );

  const rows: PmdProgramadoTableRow[] = matrix.rows.map((row) => ({
    code: row.code,
    name: row.name,
    authorizedLabel: formatPesos(row.authorizedAmount),
    updatedLabel: formatPesos(row.updatedAmount),
    byYearLabels: years.map((y) => formatPesos(row.byYear[y])),
  }));

  const pieByYear = years.map((year) => ({
    year,
    totalLabel: formatMdp(matrix.totalByYear[year]),
    slices: buildYearPieSlices(matrix, year).map((slice) => {
      const isOtros = slice.code === OTROS_SLICE_CODE;
      return {
        name: isOtros ? slice.name : `${slice.code} — ${slice.name}`,
        valueMdp: slice.amount.dividedBy(1_000_000).toNumber(),
        isOtros,
      };
    }),
  }));

  const firstCycle = pmdYears[0]?.pmdCycle;

  return (
    <PmdProgramadoClient
      years={years}
      rows={rows}
      totals={{
        authorizedLabel: formatPesos(matrix.totalAuthorized),
        updatedLabel: formatPesos(matrix.totalUpdated),
        byYearLabels: years.map((y) => formatPesos(matrix.totalByYear[y])),
      }}
      escalationFactors={pmdYears.map((py) => ({
        year: py.year,
        factor: py.escalationFactor.toString(),
      }))}
      pieByYear={pieByYear}
      cycleLabel={
        firstCycle ? `${firstCycle.code} · ${firstCycle.airport.name}` : ""
      }
    />
  );
}
