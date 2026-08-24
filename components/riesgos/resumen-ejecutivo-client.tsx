"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RiskLevel } from "@/lib/domain/riesgo";

export interface ResumenEjecutivoRow {
  riskId: string;
  contractNumber: string;
  contractName: string;
  seriesLabel: string;
  companyName: string;
  exposedLabel: string;
  level: RiskLevel;
  levelLabel: string;
  strategyLabel: string;
  constraintText: string;
  actionText: string;
  hasAction: boolean;
}

const LEVEL_VARIANT: Record<RiskLevel, "default" | "secondary" | "destructive" | "outline"> = {
  BAJO: "outline",
  MEDIO: "secondary",
  ALTO: "destructive",
  CRITICO: "destructive",
};

export function ResumenEjecutivoClient({
  rows,
  airportName,
  cutoffLabel,
  kpis,
}: {
  rows: ResumenEjecutivoRow[];
  airportName: string;
  cutoffLabel: string;
  kpis: {
    totalExposedLabel: string;
    active: number;
    critical: number;
    high: number;
    withoutAction: number;
  };
}) {
  return (
    <div className="flex flex-col gap-6 p-8 print:p-0">
      <div className="border-primary flex flex-wrap items-start justify-between gap-4 border-b-2 pb-5">
        <div>
          <div className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            PMD Control Hub — Reporte ejecutivo
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Riesgos y protección de inversión
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {airportName ? `${airportName} — ` : ""}corte al {cutoffLabel}
          </p>
        </div>
        <div className="flex items-start gap-6">
          <div className="text-right">
            <div className="text-muted-foreground text-xs">Exposición total en riesgo</div>
            <div className="text-destructive text-2xl font-bold">{kpis.totalExposedLabel}</div>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Imprimir / PDF
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/riesgos">Volver</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Riesgos activos" value={kpis.active} />
        <KpiCard label="Críticos" value={kpis.critical} tone="destructive" />
        <KpiCard label="Altos" value={kpis.high} tone="destructive" />
        <KpiCard label="Sin acción asignada" value={kpis.withoutAction} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Serie PMD</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Exposición</TableHead>
                <TableHead>Nivel (PMI)</TableHead>
                <TableHead>Estrategia</TableHead>
                <TableHead>Restricción</TableHead>
                <TableHead>Acción inmediata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    No hay riesgos activos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.riskId} className="align-top">
                    <TableCell>
                      <div className="font-medium whitespace-nowrap">{row.contractNumber}</div>
                      <div className="text-muted-foreground text-xs">{row.contractName}</div>
                    </TableCell>
                    <TableCell className="text-sm">{row.seriesLabel}</TableCell>
                    <TableCell className="text-sm">{row.companyName}</TableCell>
                    <TableCell className="text-destructive text-right font-medium whitespace-nowrap">
                      {row.exposedLabel}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEVEL_VARIANT[row.level]}>{row.levelLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{row.strategyLabel}</TableCell>
                    <TableCell className="text-sm">
                      <div className="w-64 wrap-break-word whitespace-normal">
                        {row.constraintText}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="w-64 wrap-break-word whitespace-normal">
                        {row.actionText}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground border-t pt-3 text-xs">
        Generado desde PMD Control Hub — corte al {cutoffLabel}.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div
          className={`mt-1 text-2xl font-bold ${tone === "destructive" && value > 0 ? "text-destructive" : ""}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
