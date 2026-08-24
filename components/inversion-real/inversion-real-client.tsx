"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  INVESTMENT_STATUS_LABELS,
  INVESTMENT_TYPES,
  INVESTMENT_TYPE_LABELS,
  allowedTransitions,
  type InvestmentStatus,
  type InvestmentType,
} from "@/lib/domain/inversion-real";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface InversionRealRow {
  id: string;
  contractNumber: string;
  contractName: string;
  seriesLabel: string;
  periodYear: number;
  periodMonth: number;
  investmentType: InvestmentType;
  grossLabel: string;
  recognizableLabel: string;
  status: InvestmentStatus;
  documentNumber: string | null;
  supersedesId: string | null;
}

export interface ContractOption {
  id: string;
  label: string;
}

const STATUS_VARIANT: Record<
  InvestmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  BORRADOR: "outline",
  EN_REVISION: "secondary",
  OBSERVADO: "destructive",
  APROBADO: "default",
  CERRADO: "default",
  ANULADO: "outline",
  REVERTIDO: "outline",
};

const EMPTY_FORM = {
  contractId: "",
  periodYear: String(new Date().getFullYear()),
  periodMonth: String(new Date().getMonth() + 1),
  investmentType: "ESTIMACION" as InvestmentType,
  grossAmount: "",
  amortization: "0",
  retention: "0",
  penalty: "0",
  taxes: "0",
  recognizablePmdAmount: "",
  documentNumber: "",
  documentDate: "",
};

export function InversionRealClient({
  rows,
  contracts,
  canCreate,
  canApprove,
}: {
  rows: InversionRealRow[];
  contracts: ContractOption[];
  canCreate: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [gapWarning, setGapWarning] = useState<{
    suggested: string;
    provided: string;
    gap: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(acknowledgeGap: boolean) {
    setLoading(true);
    setError(null);

    const payload = {
      contractId: form.contractId,
      periodYear: Number(form.periodYear),
      periodMonth: Number(form.periodMonth),
      investmentType: form.investmentType,
      grossAmount: form.grossAmount,
      amortization: form.amortization || "0",
      retention: form.retention || "0",
      penalty: form.penalty || "0",
      taxes: form.taxes || "0",
      ...(form.recognizablePmdAmount
        ? { recognizablePmdAmount: form.recognizablePmdAmount }
        : {}),
      ...(form.documentNumber ? { documentNumber: form.documentNumber } : {}),
      ...(form.documentDate
        ? { documentDate: new Date(form.documentDate).toISOString() }
        : {}),
      acknowledgeGap,
    };

    const response = await fetch("/api/v1/actual-investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.requiresAcknowledgement && body.warning) {
        setGapWarning({
          suggested: body.warning.suggestedRecognizable,
          provided: body.warning.providedRecognizable,
          gap: body.warning.gap,
        });
        setLoading(false);
        return;
      }
      setError(body?.error ?? "No se pudo registrar la inversión.");
      setLoading(false);
      return;
    }

    setForm(EMPTY_FORM);
    setGapWarning(null);
    setLoading(false);
    router.refresh();
  }

  async function changeStatus(id: string, status: InvestmentStatus) {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/v1/actual-investments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo cambiar el estado.");
      setLoading(false);
      return;
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inversión real</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Estimaciones, facturas, anticipos y OENE por contrato y mes. Solo lo{" "}
          <strong>aprobado o cerrado</strong> alimenta la curva real y el desvío contra lo
          programado. Un registro aprobado no se edita: se corrige creando otro que lo
          reemplaza.
        </p>
      </div>

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar inversión</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submit(false);
              }}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="contractId">Contrato</Label>
                  <Select
                    value={form.contractId}
                    onValueChange={(v) => set("contractId", v)}
                    required
                  >
                    <SelectTrigger id="contractId" className="w-full">
                      <SelectValue placeholder="Selecciona un contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="investmentType">Tipo</Label>
                  <Select
                    value={form.investmentType}
                    onValueChange={(v) => set("investmentType", v)}
                  >
                    <SelectTrigger id="investmentType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {INVESTMENT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="periodYear">Año</Label>
                  <Input
                    id="periodYear"
                    type="number"
                    required
                    value={form.periodYear}
                    onChange={(e) => set("periodYear", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="periodMonth">Mes</Label>
                  <Select
                    value={form.periodMonth}
                    onValueChange={(v) => set("periodMonth", v)}
                  >
                    <SelectTrigger id="periodMonth" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((label, i) => (
                        <SelectItem key={label} value={String(i + 1)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="documentNumber">N.º de documento</Label>
                  <Input
                    id="documentNumber"
                    value={form.documentNumber}
                    onChange={(e) => set("documentNumber", e.target.value)}
                    placeholder="ej. EST-004"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="documentDate">Fecha del documento</Label>
                  <Input
                    id="documentDate"
                    type="date"
                    value={form.documentDate}
                    onChange={(e) => set("documentDate", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="grossAmount">Bruto (MXN)</Label>
                  <Input
                    id="grossAmount"
                    type="number"
                    step="0.01"
                    required
                    value={form.grossAmount}
                    onChange={(e) => set("grossAmount", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="amortization">Amortización</Label>
                  <Input
                    id="amortization"
                    type="number"
                    step="0.01"
                    value={form.amortization}
                    onChange={(e) => set("amortization", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="retention">Retenciones</Label>
                  <Input
                    id="retention"
                    type="number"
                    step="0.01"
                    value={form.retention}
                    onChange={(e) => set("retention", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="penalty">Penas</Label>
                  <Input
                    id="penalty"
                    type="number"
                    step="0.01"
                    value={form.penalty}
                    onChange={(e) => set("penalty", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="taxes">Impuestos</Label>
                  <Input
                    id="taxes"
                    type="number"
                    step="0.01"
                    value={form.taxes}
                    onChange={(e) => set("taxes", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="recognizablePmdAmount">Reconocible PMD</Label>
                  <Input
                    id="recognizablePmdAmount"
                    type="number"
                    step="0.01"
                    value={form.recognizablePmdAmount}
                    onChange={(e) => set("recognizablePmdAmount", e.target.value)}
                    placeholder="Automático"
                  />
                </div>
              </div>

              {gapWarning && (
                <div className="border-destructive/50 bg-destructive/5 flex flex-col gap-2 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    El monto reconocible no coincide con bruto menos deducciones.
                  </p>
                  <p className="text-muted-foreground">
                    Sugerido: {gapWarning.suggested} · Capturado: {gapWarning.provided} ·
                    Diferencia: {gapWarning.gap}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Puede ser correcto si el criterio oficial de reconocimiento reconoce otro
                    monto. Al continuar, la diferencia queda registrada en bitácora.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading}
                      onClick={() => submit(true)}
                    >
                      Registrar de todos modos
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setGapWarning(null)}
                    >
                      Corregir
                    </Button>
                  </div>
                </div>
              )}

              {error && <p className="text-destructive text-sm">{error}</p>}

              <div className="flex justify-end">
                <Button type="submit" disabled={loading || !form.contractId}>
                  {loading ? "Guardando..." : "Registrar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Serie PMD</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Reconocible PMD</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                    Todavía no hay inversión real registrada.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const next = allowedTransitions(row.status).filter(
                    (s) => canApprove || (s !== "APROBADO" && s !== "CERRADO"),
                  );
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium whitespace-nowrap">
                          {row.contractNumber}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {row.contractName}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{row.seriesLabel}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {MONTHS[row.periodMonth - 1]} {row.periodYear}
                      </TableCell>
                      <TableCell className="text-sm">
                        {INVESTMENT_TYPE_LABELS[row.investmentType]}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.documentNumber ?? "—"}
                        {row.supersedesId && (
                          <Badge variant="outline" className="ml-2">
                            Corrección
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.grossLabel}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {row.recognizableLabel}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {INVESTMENT_STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {next.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {next.map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                variant="outline"
                                disabled={loading}
                                onClick={() => changeStatus(row.id, status)}
                              >
                                {INVESTMENT_STATUS_LABELS[status]}
                              </Button>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
