import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatPesos } from "@/lib/money";
import { ContractsPageClient, type ContractRow } from "@/components/contracts/contracts-page-client";

export default async function ContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "CONTRATOS.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const [contracts, companies, investmentGroups, series] = await Promise.all([
    prisma.contract.findMany({
      where: { clientId: user.clientId },
      include: {
        company: true,
        allocations: { include: { pmdSeries: true } },
        amendments: { orderBy: { amendmentNumber: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findMany({ where: { clientId: user.clientId }, orderBy: { name: "asc" } }),
    prisma.investmentGroup.findMany({
      where: { clientId: user.clientId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.pmdSeries.findMany({
      where: { pmdYear: { pmdCycle: { airport: { clientId: user.clientId } } } },
      include: { pmdYear: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const contractRows: ContractRow[] = contracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    name: c.name,
    stage: c.stage,
    companyName: c.company?.name ?? null,
    currentAmountLabel: formatPesos(c.currentAmount),
    allocations: c.allocations.map((a) => ({
      id: a.id,
      pmdSeriesId: a.pmdSeriesId,
      seriesLabel: `${a.pmdSeries.code} — ${a.pmdSeries.name}`,
      allocatedAmountLabel: formatPesos(a.allocatedAmount),
    })),
    amendments: c.amendments.map((a) => ({
      id: a.id,
      amendmentNumber: a.amendmentNumber,
      amountDelta: a.amountDelta.toString(),
      effectiveDate: a.effectiveDate.toISOString().slice(0, 10),
      reason: a.reason,
    })),
    raw: {
      id: c.id,
      contractNumber: c.contractNumber,
      name: c.name,
      scope: c.scope ?? "",
      companyId: c.companyId ?? "",
      investmentGroupId: c.investmentGroupId ?? "",
      stage: c.stage,
      originalAmount: c.originalAmount.toString(),
      currentAmount: c.currentAmount.toString(),
      advanceAmount: c.advanceAmount.toString(),
      oeneContractedBudget: c.oeneContractedBudget.toString(),
      oeneTotal: c.oeneTotal.toString(),
      oeneContracted: c.oeneContracted.toString(),
      oeneToRegularize: c.oeneToRegularize.toString(),
      oeneToInvoice: c.oeneToInvoice.toString(),
      costOrigin: c.costOrigin ?? "",
    },
  }));

  return (
    <ContractsPageClient
      contracts={contractRows}
      companies={companies.map((co) => ({ id: co.id, label: co.name }))}
      investmentGroups={investmentGroups.map((g) => ({ id: g.id, label: g.name }))}
      seriesOptions={series.map((s) => ({ id: s.id, label: `${s.code} — ${s.name} (${s.pmdYear.year})` }))}
      canCreate={hasPermission(user, "CONTRATOS.CREAR")}
      canEdit={hasPermission(user, "CONTRATOS.EDITAR")}
    />
  );
}
