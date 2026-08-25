"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiBarChart, type KpiBar } from "@/components/charts/kpi-bar-chart";
import { CashFlowSummary, type CashFlowGroupRow, type TopContractRow } from "@/components/dashboard/cashflow-summary";
import { FaltanteBreakdown, type DonutBreakdownRow } from "@/components/dashboard/faltante-breakdown";
import { DiagnosticoPanel } from "@/components/shared/diagnostico-panel";
import type { Diagnostico } from "@/lib/domain/diagnostico";

export type { CashFlowGroupRow, TopContractRow, DonutBreakdownRow };

export interface FilterOption {
  id: string;
  label: string;
}

const ALL = "__all__";

export function DashboardPageClient({
  years,
  series,
  companies,
  selected,
  monthLabels,
  cashflowGroups,
  totals,
  topContracts,
  kpiBars,
  donutSlices,
  donutBreakdown,
  remainingMonthLabels,
  diagnostico,
}: {
  years: FilterOption[];
  series: FilterOption[];
  companies: FilterOption[];
  diagnostico: Diagnostico | null;
  selected: { pmdYearId: string; seriesId: string; companyId: string };
  monthLabels: string[];
  cashflowGroups: CashFlowGroupRow[];
  totals: {
    programado: string[];
    real: string[];
    balance: string[];
    programadoAcumulado: string[];
    realAcumulado: string[];
    balanceAcumulado: string[];
  };
  topContracts: TopContractRow[];
  kpiBars: KpiBar[];
  donutSlices: { name: string; valueMdp: number }[];
  donutBreakdown: DonutBreakdownRow[];
  remainingMonthLabels: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL || !value) params.delete(key);
    else params.set(key, value);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Cumplimiento PMD del año seleccionado — equivalente a la hoja &quot;Resumen Cash
            Flow&quot; y a las gráficas de control presupuestal.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={selected.pmdYearId} onValueChange={(v) => setParam("pmdYearId", v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Año PMD" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selected.seriesId || ALL} onValueChange={(v) => setParam("seriesId", v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Serie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las series</SelectItem>
              {series.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selected.companyId || ALL} onValueChange={(v) => setParam("companyId", v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las empresas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {diagnostico && <DiagnosticoPanel diagnostico={diagnostico} />}

      <Card>
        <CardHeader>
          <CardTitle>Cumplimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <KpiBarChart bars={kpiBars} />
        </CardContent>
      </Card>

      <CashFlowSummary
        monthLabels={monthLabels}
        groups={cashflowGroups}
        totals={totals}
        topContracts={topContracts}
      />

      <FaltanteBreakdown
        slices={donutSlices}
        breakdown={donutBreakdown}
        monthLabels={remainingMonthLabels}
      />
    </div>
  );
}
