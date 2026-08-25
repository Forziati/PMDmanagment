"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { DiagnosticoPanel } from "@/components/shared/diagnostico-panel";
import type { Diagnostico } from "@/lib/domain/diagnostico";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CONTRACT_STAGE_LABELS } from "@/components/contracts/contract-form-dialog";

export interface FilterOption {
  id: string;
  label: string;
}

export interface ResumenRow {
  allocationId: string;
  seriesCode: string;
  seriesName: string;
  contractNumber: string;
  contractName: string;
  companyName: string | null;
  stage: string;
  allocatedAmountLabel: string;
  currentAmountLabel: string;
  programadoLabel: string;
  realLabel: string;
  desvioMoneyLabel: string;
  desvioPercentLabel: string;
  desvioIsNegative: boolean;
  oeneLabel: string;
  additionalLabel: string;
}

const ALL = "__all__";

export function ResumenPageClient({
  years,
  series,
  investmentGroups,
  companies,
  rows,
  selected,
  diagnostico,
}: {
  years: FilterOption[];
  series: FilterOption[];
  investmentGroups: FilterOption[];
  companies: FilterOption[];
  rows: ResumenRow[];
  diagnostico: Diagnostico | null;
  selected: {
    pmdYearId: string;
    seriesId: string;
    investmentGroupId: string;
    companyId: string;
    stage: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Resumen PMD</h1>
        <p className="text-muted-foreground text-sm">
          Vista consolidada por serie y contrato, con filtros — equivalente al Cash Flow en
          Excel. &quot;Avance real&quot; suma la inversión aprobada o cerrada del año hasta el
          mes en curso.
        </p>
      </div>

      {diagnostico && <DiagnosticoPanel diagnostico={diagnostico} />}

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

        <Select
          value={selected.seriesId || ALL}
          onValueChange={(v) => setParam("seriesId", v)}
        >
          <SelectTrigger className="w-52">
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

        <Select
          value={selected.investmentGroupId || ALL}
          onValueChange={(v) => setParam("investmentGroupId", v)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Grupo de inversión" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los grupos</SelectItem>
            {investmentGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selected.companyId || ALL} onValueChange={(v) => setParam("companyId", v)}>
          <SelectTrigger className="w-52">
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

        <Select value={selected.stage || ALL} onValueChange={(v) => setParam("stage", v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las etapas</SelectItem>
            {Object.entries(CONTRACT_STAGE_LABELS).map(([code, label]) => (
              <SelectItem key={code} value={code}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serie</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Previsto en serie</TableHead>
              <TableHead className="text-right">Contratado</TableHead>
              <TableHead className="text-right">Avance programado</TableHead>
              <TableHead className="text-right">Avance real</TableHead>
              <TableHead className="text-right">Desvío</TableHead>
              <TableHead className="text-right">Desvío %</TableHead>
              <TableHead className="text-right">OENE</TableHead>
              <TableHead className="text-right">Adicional a la fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-muted-foreground text-center">
                  No hay filas para los filtros seleccionados.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.allocationId}>
                <TableCell>
                  <div className="font-medium">{row.seriesCode}</div>
                  <div className="text-muted-foreground text-xs">{row.seriesName}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{row.contractNumber}</div>
                  <div className="text-muted-foreground text-xs">{row.contractName}</div>
                </TableCell>
                <TableCell>{row.companyName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{CONTRACT_STAGE_LABELS[row.stage] ?? row.stage}</Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {row.allocatedAmountLabel}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {row.currentAmountLabel}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {row.programadoLabel}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{row.realLabel}</TableCell>
                <TableCell
                  className={`text-right whitespace-nowrap ${row.desvioIsNegative ? "text-destructive" : ""}`}
                >
                  {row.desvioMoneyLabel}
                </TableCell>
                <TableCell
                  className={`text-right whitespace-nowrap ${row.desvioIsNegative ? "text-destructive" : ""}`}
                >
                  {row.desvioPercentLabel}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{row.oeneLabel}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {row.additionalLabel}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
