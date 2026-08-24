import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { formatPesos } from "@/lib/money";
import type {
  InvestmentStatus,
  InvestmentType,
} from "@/lib/domain/inversion-real";
import {
  InversionRealClient,
  type InversionRealRow,
} from "@/components/inversion-real/inversion-real-client";

export default async function InversionRealPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "INVERSION_REAL.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const [records, contracts] = await Promise.all([
    prisma.actualInvestment.findMany({
      where: { contract: { clientId: user.clientId } },
      include: {
        contract: true,
        pmdSeries: true,
        invoice: true,
        estimate: true,
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
    }),
    prisma.contract.findMany({
      where: { clientId: user.clientId },
      orderBy: { contractNumber: "asc" },
    }),
  ]);

  const rows: InversionRealRow[] = records.map((record) => ({
    id: record.id,
    contractNumber: record.contract.contractNumber,
    contractName: record.contract.name,
    seriesLabel: `${record.pmdSeries.code} — ${record.pmdSeries.name}`,
    periodYear: record.periodYear,
    periodMonth: record.periodMonth,
    investmentType: record.investmentType as InvestmentType,
    grossLabel: formatPesos(record.grossAmount),
    recognizableLabel: formatPesos(record.recognizablePmdAmount),
    status: record.status as InvestmentStatus,
    documentNumber:
      record.invoice?.invoiceNumber ?? record.estimate?.estimateNumber ?? null,
    supersedesId: record.supersedesId,
  }));

  return (
    <InversionRealClient
      rows={rows}
      contracts={contracts.map((c) => ({
        id: c.id,
        label: `${c.contractNumber} — ${c.name}`,
      }))}
      canCreate={hasPermission(user, "INVERSION_REAL.CREAR")}
      canApprove={hasPermission(user, "INVERSION_REAL.APROBAR")}
    />
  );
}
