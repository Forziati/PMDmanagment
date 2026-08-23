import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvestmentGroupsPanel } from "@/components/admin/investment-groups-panel";
import { CompaniesPanel } from "@/components/admin/companies-panel";
import { AnnualTargetPanel } from "@/components/admin/annual-target-panel";

export default async function AdministracionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "ADMINISTRACION.VER")) redirect("/");
  if (!user.clientId) redirect("/");

  const [groups, companies, pmdYears] = await Promise.all([
    prisma.investmentGroup.findMany({
      where: { clientId: user.clientId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.company.findMany({ where: { clientId: user.clientId }, orderBy: { name: "asc" } }),
    prisma.pmdYear.findMany({
      where: { pmdCycle: { airport: { clientId: user.clientId } } },
      include: { pmdCycle: { include: { airport: true } }, annualTarget: true },
      orderBy: { year: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Administración</h1>
        <p className="text-muted-foreground text-sm">
          Catálogos configurables por cliente y protección del hito anual.
        </p>
      </div>

      <Tabs defaultValue="grupos">
        <TabsList>
          <TabsTrigger value="grupos">Grupos de inversión</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="hito">Hito anual</TabsTrigger>
        </TabsList>
        <TabsContent value="grupos" className="pt-4">
          <InvestmentGroupsPanel
            groups={groups.map((g) => ({ id: g.id, code: g.code, name: g.name, sortOrder: g.sortOrder }))}
            canEdit={hasPermission(user, "ADMINISTRACION.CREAR")}
          />
        </TabsContent>
        <TabsContent value="empresas" className="pt-4">
          <CompaniesPanel
            companies={companies.map((c) => ({ id: c.id, name: c.name, taxId: c.taxId }))}
            canEdit={hasPermission(user, "CONTRATOS.CREAR")}
          />
        </TabsContent>
        <TabsContent value="hito" className="pt-4">
          <AnnualTargetPanel
            years={pmdYears.map((py) => ({
              pmdYearId: py.id,
              label: `${py.pmdCycle.airport.iataCode} — ${py.pmdCycle.code} — ${py.year}`,
              amount: py.annualTarget?.amount.toString() ?? null,
              locked: py.annualTarget?.locked ?? null,
            }))}
            canEdit={hasPermission(user, "ADMINISTRACION.EDITAR")}
            canApprove={hasPermission(user, "ADMINISTRACION.APROBAR")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
