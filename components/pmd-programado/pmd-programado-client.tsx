"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SeriesPieChart, type SeriesPieSlice } from "@/components/charts/series-pie-chart";

export interface PmdProgramadoTableRow {
  code: string;
  name: string;
  authorizedLabel: string;
  updatedLabel: string;
  byYearLabels: string[];
}

export interface PmdProgramadoPieYear {
  year: number;
  slices: SeriesPieSlice[];
  totalLabel: string;
}

export function PmdProgramadoClient({
  years,
  rows,
  totals,
  escalationFactors,
  pieByYear,
  cycleLabel,
}: {
  years: number[];
  rows: PmdProgramadoTableRow[];
  totals: { authorizedLabel: string; updatedLabel: string; byYearLabels: string[] };
  escalationFactors: { year: number; factor: string }[];
  pieByYear: PmdProgramadoPieYear[];
  cycleLabel: string;
}) {
  const currentYear = new Date().getFullYear();
  const [showChart, setShowChart] = useState(false);
  const [pieYear, setPieYear] = useState(
    years.includes(currentYear) ? currentYear : (years[years.length - 1] ?? 0),
  );

  const activePie = pieByYear.find((p) => p.year === pieYear);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            PMD Programado — Vista de control
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Resumen de solo lectura: hitos por serie, distribuidos año a año. Serie,
            sector y montos se cargan en{" "}
            <Link href="/series" className="underline underline-offset-2">
              Series PMD
            </Link>
            . {cycleLabel}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowChart((v) => !v)}>
          {showChart ? "Ocultar gráfico" : "Graficar por serie"}
        </Button>
      </div>

      {escalationFactors.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Factor de escalación por año
            </span>
            {escalationFactors.map((f) => (
              <span
                key={f.year}
                className="bg-accent text-accent-foreground rounded-md px-2 py-1 text-xs font-semibold"
              >
                {f.year} · {f.factor}
              </span>
            ))}
            <Link
              href="/administracion"
              className="text-muted-foreground ml-auto text-xs underline underline-offset-2"
            >
              Editable en Administración
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serie</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Anexo 6</TableHead>
                <TableHead className="text-right">PMD actualizado</TableHead>
                {years.map((y) => (
                  <TableHead key={y} className="text-right">
                    {y}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4 + years.length}
                    className="text-muted-foreground py-8 text-center"
                  >
                    No hay series cargadas para este ciclo.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell className="font-medium">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.authorizedLabel}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.updatedLabel}
                      </TableCell>
                      {row.byYearLabels.map((label, i) => (
                        <TableCell key={years[i]} className="text-right whitespace-nowrap">
                          {label}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>Total general</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {totals.authorizedLabel}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {totals.updatedLabel}
                    </TableCell>
                    {totals.byYearLabels.map((label, i) => (
                      <TableCell key={years[i]} className="text-right whitespace-nowrap">
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showChart && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">
              Distribución PMD Programado por serie
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Año</span>
              <Select
                value={String(pieYear)}
                onValueChange={(v) => setPieYear(Number(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {activePie && activePie.slices.length > 0 ? (
              <>
                <p className="text-muted-foreground mb-2 text-sm">
                  Total {pieYear}: {activePie.totalLabel}
                </p>
                <SeriesPieChart slices={activePie.slices} />
              </>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No hay monto programado en {pieYear}.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
