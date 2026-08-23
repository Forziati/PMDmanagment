import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatPesos } from "@/lib/money";
import { SeriesPageClient, type SeriesRow } from "@/components/series/series-page-client";

export default async function SeriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "SERIES.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const [series, pmdYears, investmentGroups] = await Promise.all([
    prisma.pmdSeries.findMany({
      where: { pmdYear: { pmdCycle: { airport: { clientId: user.clientId } } } },
      include: { investmentGroup: true, pmdYear: { include: { pmdCycle: { include: { airport: true } } } } },
      orderBy: [{ pmdYear: { year: "asc" } }, { code: "asc" }],
    }),
    prisma.pmdYear.findMany({
      where: { pmdCycle: { airport: { clientId: user.clientId } } },
      include: { pmdCycle: { include: { airport: true } } },
      orderBy: { year: "asc" },
    }),
    prisma.investmentGroup.findMany({
      where: { clientId: user.clientId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const seriesRows: SeriesRow[] = series.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    description: s.description,
    status: s.status,
    authorizedAmountLabel: formatPesos(s.authorizedAmount),
    updatedAmountLabel: formatPesos(s.updatedAmount),
    investmentGroupName: s.investmentGroup?.name ?? null,
    yearLabel: `${s.pmdYear.pmdCycle.airport.iataCode} ${s.pmdYear.year}`,
    raw: {
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description ?? "",
      investmentGroupId: s.investmentGroupId ?? "",
      pmdYearId: s.pmdYearId,
      authorizedAmount: s.authorizedAmount.toString(),
      updatedAmount: s.updatedAmount.toString(),
      sourceDocument: s.sourceDocument ?? "",
      status: s.status,
    },
  }));

  return (
    <SeriesPageClient
      series={seriesRows}
      pmdYears={pmdYears.map((py) => ({
        id: py.id,
        label: `${py.pmdCycle.airport.iataCode} — ${py.pmdCycle.code} — ${py.year}`,
      }))}
      investmentGroups={investmentGroups.map((g) => ({ id: g.id, label: g.name }))}
      canCreate={hasPermission(user, "SERIES.CREAR")}
      canEdit={hasPermission(user, "SERIES.EDITAR")}
    />
  );
}
