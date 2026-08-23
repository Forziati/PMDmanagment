"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Decimal } from "decimal.js";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatPesos } from "@/lib/money";
import type { MonthlyImbalance, MonthlyAdjustmentSuggestion } from "@/lib/domain/monthly-schedule";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export interface ProgramacionYearOption {
  id: string;
  label: string;
}

export interface ProgramacionRow {
  allocationId: string;
  contractId: string;
  contractNumber: string;
  contractName: string;
  pmdSeriesId: string;
  seriesCode: string;
  seriesName: string;
  allocatedAmount: string;
  periodYear: number;
  months: string[];
  hasImbalance: boolean;
}

interface PendingImbalance {
  allocationId: string;
  months: string[];
  imbalance: MonthlyImbalance;
  suggestion: MonthlyAdjustmentSuggestion;
}

export function ProgramacionPageClient({
  years,
  selectedYearId,
  rows,
  canEdit,
}: {
  years: ProgramacionYearOption[];
  selectedYearId: string;
  rows: ProgramacionRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [months, setMonths] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(rows.map((r) => [r.allocationId, [...r.months]])),
  );
  const [reason, setReason] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImbalance | null>(null);

  const rowsByAllocation = useMemo(
    () => new Map(rows.map((r) => [r.allocationId, r])),
    [rows],
  );

  function updateMonth(allocationId: string, index: number, value: string) {
    setMonths((prev) => {
      const next = [...(prev[allocationId] ?? [])];
      next[index] = value;
      return { ...prev, [allocationId]: next };
    });
  }

  function total(allocationId: string): Decimal {
    return (months[allocationId] ?? []).reduce(
      (acc, m) => acc.plus(new Decimal(m || 0)),
      new Decimal(0),
    );
  }

  async function save(allocationId: string, monthsOverride?: string[], acknowledgeImbalance = false) {
    const row = rowsByAllocation.get(allocationId);
    if (!row) return;
    const monthsToSave = monthsOverride ?? months[allocationId] ?? row.months;

    setSavingId(allocationId);
    setError(null);

    const response = await fetch("/api/v1/monthly-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId: row.contractId,
        pmdSeriesId: row.pmdSeriesId,
        periodYear: row.periodYear,
        months: monthsToSave,
        reason,
        acknowledgeImbalance,
      }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "No se pudo guardar la programación.");
      setSavingId(null);
      return;
    }

    if (body.requiresConfirmation) {
      setPending({
        allocationId,
        months: monthsToSave,
        imbalance: body.imbalance,
        suggestion: body.suggestion,
      });
      setSavingId(null);
      return;
    }

    setSavingId(null);
    setPending(null);
    router.refresh();
  }

  function handleSaveClick(allocationId: string) {
    if (!reason.trim()) {
      setError("Indica el motivo de esta actualización antes de guardar.");
      return;
    }
    void save(allocationId);
  }

  function handleAcceptImbalance() {
    if (!pending) return;
    void save(pending.allocationId, pending.months, true);
  }

  function handleAutoAdjust() {
    if (!pending) return;
    const adjusted = [...pending.months];
    adjusted[pending.suggestion.month - 1] = pending.suggestion.suggestedAmount;
    setMonths((prev) => ({ ...prev, [pending.allocationId]: adjusted }));
    void save(pending.allocationId, adjusted, true);
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Programación mensual</h1>
          <p className="text-muted-foreground text-sm">
            Distribución mensual por contrato y serie. Un descuadre frente al monto asignado no
            bloquea el guardado — se advierte y queda registrado en bitácora (sección 0.2 del
            prompt maestro).
          </p>
        </div>
        <Select
          value={selectedYearId}
          onValueChange={(id) => router.push(`/programacion?pmdYearId=${id}`)}
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canEdit && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Motivo de la actualización (obligatorio para guardar)</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ej. Reprogramación por retraso en fallo de licitación"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">Contrato / Serie</TableHead>
              <TableHead className="text-right">Asignado</TableHead>
              {MONTH_LABELS.map((label) => (
                <TableHead key={label} className="text-right">
                  {label}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={16} className="text-muted-foreground text-center">
                  No hay contratos asignados a series para este año PMD.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const rowMonths = months[row.allocationId] ?? row.months;
              const rowTotal = total(row.allocationId);
              return (
                <TableRow key={row.allocationId}>
                  <TableCell className="sticky left-0 bg-background">
                    <div className="font-medium">{row.contractNumber}</div>
                    <div className="text-muted-foreground text-xs">
                      {row.seriesCode} — {row.seriesName}
                    </div>
                    {row.hasImbalance && (
                      <Badge variant="warning" className="mt-1">
                        Descuadre registrado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatPesos(row.allocatedAmount)}
                  </TableCell>
                  {rowMonths.map((value, index) => {
                    const modified = value !== row.months[index];
                    return (
                      <TableCell key={index} className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!canEdit}
                          value={value}
                          onChange={(e) => updateMonth(row.allocationId, index, e.target.value)}
                          className={`w-28 text-right ${modified ? "border-primary bg-accent/40" : ""}`}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {formatPesos(rowTotal)}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="sm"
                        disabled={savingId === row.allocationId}
                        onClick={() => handleSaveClick(row.allocationId)}
                      >
                        {savingId === row.allocationId ? "Guardando..." : "Guardar"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descuadre en la programación</DialogTitle>
            <DialogDescription>
              La suma de los 12 meses no coincide con el monto asignado a esta fila.
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <div className="flex flex-col gap-2 text-sm">
              <div>
                Suma capturada: <strong>{formatPesos(pending.imbalance.sum)}</strong>
              </div>
              <div>
                Monto asignado (objetivo): <strong>{formatPesos(pending.imbalance.target)}</strong>
              </div>
              <div>
                Diferencia: <strong>{formatPesos(pending.imbalance.difference)}</strong>
              </div>
              <div className="text-muted-foreground pt-2">
                Solución sugerida: ajustar {MONTH_LABELS[pending.suggestion.month - 1]} de{" "}
                {formatPesos(pending.suggestion.currentAmount)} a{" "}
                {formatPesos(pending.suggestion.suggestedAmount)}.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleAcceptImbalance}>
              Guardar con descuadre
            </Button>
            <Button onClick={handleAutoAdjust}>Ajustar automáticamente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
