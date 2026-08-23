"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SeriesFormDialog,
  type SeriesFormOption,
  type SeriesFormValue,
} from "@/components/series/series-form-dialog";

export interface SeriesRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  authorizedAmountLabel: string;
  updatedAmountLabel: string;
  investmentGroupName: string | null;
  yearLabel: string;
  raw: SeriesFormValue;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVA: "default",
  CERRADA: "secondary",
  RETIRADA: "outline",
};

export function SeriesPageClient({
  series,
  pmdYears,
  investmentGroups,
  canCreate,
  canEdit,
}: {
  series: SeriesRow[];
  pmdYears: SeriesFormOption[];
  investmentGroups: SeriesFormOption[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SeriesFormValue | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: SeriesRow) {
    setEditing(row.raw);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Series PMD</h1>
          <p className="text-muted-foreground text-sm">
            Series/Sector del Plan Maestro de Desarrollo por año PMD.
          </p>
        </div>
        {canCreate && <Button onClick={openCreate}>Nueva serie</Button>}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Año PMD</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-right">Monto autorizado</TableHead>
              <TableHead className="text-right">Monto actualizado</TableHead>
              <TableHead>Estado</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  Aún no hay series PMD registradas.
                </TableCell>
              </TableRow>
            )}
            {series.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.yearLabel}</TableCell>
                <TableCell>{row.investmentGroupName ?? "—"}</TableCell>
                <TableCell className="text-right">{row.authorizedAmountLabel}</TableCell>
                <TableCell className="text-right">{row.updatedAmountLabel}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>{row.status}</Badge>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                      Editar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SeriesFormDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pmdYears={pmdYears}
        investmentGroups={investmentGroups}
        initialValue={editing}
      />
    </div>
  );
}
