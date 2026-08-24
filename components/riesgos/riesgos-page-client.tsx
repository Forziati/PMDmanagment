"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  IMPACT_LABELS,
  PROBABILITY_LABELS,
  RESPONSE_STRATEGIES,
  RESPONSE_STRATEGY_LABELS,
  RISK_LEVEL_LABELS,
  RISK_STATUS_LABELS,
  type RiskLevel,
  type RiskStatus,
} from "@/lib/domain/riesgo";

export interface RiesgoRow {
  riskId: string;
  contractId: string;
  contractNumber: string;
  contractName: string;
  seriesCode: string | null;
  seriesName: string | null;
  companyName: string | null;
  stageLabel: string;
  programmedLabel: string;
  actualLabel: string;
  deviationLabel: string;
  isNegative: boolean;
  probability: number;
  impact: number;
  level: RiskLevel;
  strategy: string;
  status: RiskStatus;
  constraintText: string;
  actionText: string;
}

const LEVEL_VARIANT: Record<RiskLevel, "default" | "secondary" | "destructive" | "outline"> = {
  BAJO: "outline",
  MEDIO: "secondary",
  ALTO: "destructive",
  CRITICO: "destructive",
};

export function RiesgosPageClient({
  rows,
  canEdit,
}: {
  rows: RiesgoRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ constraintText: "", actionText: "" });
  const [levelFilter, setLevelFilter] = useState<string>("TODOS");
  const [seriesFilter, setSeriesFilter] = useState<string>("TODAS");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const seriesOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const r of rows) if (r.seriesCode) codes.add(r.seriesCode);
    return [...codes].sort();
  }, [rows]);

  const visible = rows.filter(
    (r) =>
      (levelFilter === "TODOS" || r.level === levelFilter) &&
      (seriesFilter === "TODAS" || r.seriesCode === seriesFilter),
  );

  async function patchRisk(riskId: string, body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/v1/risks/${riskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "No se pudo guardar el riesgo.");
      return false;
    }
    router.refresh();
    return true;
  }

  function startEdit(row: RiesgoRow) {
    setEditingId(row.riskId);
    setDraft({ constraintText: row.constraintText, actionText: row.actionText });
    setError(null);
  }

  async function saveEdit(riskId: string) {
    const ok = await patchRisk(riskId, {
      constraintDescription: draft.constraintText,
      actionDescription: draft.actionText,
    });
    if (ok) setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Riesgos y protección de inversión
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Un riesgo por contrato, indicando la serie PMD a la que pertenece. Probabilidad e
            Impacto se eligen por fila; el nivel y la estrategia de respuesta se calculan según
            la matriz PMI.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/riesgos/resumen">Resumen ejecutivo</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={seriesFilter} onValueChange={setSeriesFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas las series</SelectItem>
            {seriesOptions.map((code) => (
              <SelectItem key={code} value={code}>
                Serie {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los niveles</SelectItem>
            {(Object.keys(RISK_LEVEL_LABELS) as RiskLevel[]).map((level) => (
              <SelectItem key={level} value={level}>
                {RISK_LEVEL_LABELS[level]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Serie PMD</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">
                  Programado
                  <span className="text-muted-foreground block text-xs font-normal">
                    a la fecha
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  Real
                  <span className="text-muted-foreground block text-xs font-normal">
                    a la fecha
                  </span>
                </TableHead>
                <TableHead className="text-right">Desvío</TableHead>
                <TableHead>Probabilidad</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>
                  Nivel y acción
                  <span className="text-muted-foreground block text-xs font-normal">
                    (PMI)
                  </span>
                </TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-8 text-center">
                    No hay riesgos registrados que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((row) => (
                  <RiskRows
                    key={row.riskId}
                    row={row}
                    canEdit={canEdit}
                    loading={loading}
                    isEditing={editingId === row.riskId}
                    draft={draft}
                    setDraft={setDraft}
                    onStartEdit={() => startEdit(row)}
                    onCancel={() => setEditingId(null)}
                    onSave={() => saveEdit(row.riskId)}
                    onPatch={(body) => patchRisk(row.riskId, body)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskRows({
  row,
  canEdit,
  loading,
  isEditing,
  draft,
  setDraft,
  onStartEdit,
  onCancel,
  onSave,
  onPatch,
}: {
  row: RiesgoRow;
  canEdit: boolean;
  loading: boolean;
  isEditing: boolean;
  draft: { constraintText: string; actionText: string };
  setDraft: (d: { constraintText: string; actionText: string }) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const hasSavedText = Boolean(row.constraintText || row.actionText);

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="font-medium whitespace-nowrap">{row.contractNumber}</div>
          <div className="text-muted-foreground text-xs">{row.contractName}</div>
        </TableCell>
        <TableCell>
          {row.seriesCode ? (
            <Badge variant="secondary" className="whitespace-nowrap">
              {row.seriesCode} — {row.seriesName}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">Sin serie asignada</span>
          )}
        </TableCell>
        <TableCell className="max-w-[9rem] truncate text-sm" title={row.companyName ?? undefined}>
          {row.companyName ?? "—"}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="whitespace-nowrap">
            {row.stageLabel}
          </Badge>
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">{row.programmedLabel}</TableCell>
        <TableCell className="text-right whitespace-nowrap">{row.actualLabel}</TableCell>
        <TableCell
          className={`text-right whitespace-nowrap ${row.isNegative ? "text-destructive" : ""}`}
        >
          {row.deviationLabel}
        </TableCell>
        <TableCell>
          <Select
            value={String(row.probability)}
            disabled={!canEdit || loading}
            onValueChange={(v) => onPatch({ probability: Number(v) })}
          >
            <SelectTrigger className="w-[7.5rem]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROBABILITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select
            value={String(row.impact)}
            disabled={!canEdit || loading}
            onValueChange={(v) => onPatch({ impact: Number(v) })}
          >
            <SelectTrigger className="w-[7.5rem]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(IMPACT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex flex-col items-start gap-1.5">
            <Badge variant={LEVEL_VARIANT[row.level]}>{RISK_LEVEL_LABELS[row.level]}</Badge>
            <Select
              value={row.strategy}
              disabled={!canEdit || loading}
              onValueChange={(v) => onPatch({ responseStrategy: v })}
            >
              <SelectTrigger className="w-28" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_STRATEGIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESPONSE_STRATEGY_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="whitespace-nowrap">
            {RISK_STATUS_LABELS[row.status]}
          </Badge>
        </TableCell>
      </TableRow>

      {isEditing ? (
        <TableRow className="bg-accent/40 hover:bg-accent/40">
          <TableCell colSpan={11} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`constraint-${row.riskId}`}>Restricciones</Label>
                <Textarea
                  id={`constraint-${row.riskId}`}
                  rows={3}
                  value={draft.constraintText}
                  onChange={(e) => setDraft({ ...draft, constraintText: e.target.value })}
                  placeholder="¿Qué está impidiendo cumplir lo programado?"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`action-${row.riskId}`}>Acción inmediata</Label>
                <Textarea
                  id={`action-${row.riskId}`}
                  rows={3}
                  value={draft.actionText}
                  onChange={(e) => setDraft({ ...draft, actionText: e.target.value })}
                  placeholder="¿Qué se va a hacer para recuperar el avance?"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
                Cancelar
              </Button>
              <Button size="sm" onClick={onSave} disabled={loading}>
                Guardar
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ) : (
        (hasSavedText || canEdit) && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={11} className="pt-0 pb-3">
              {hasSavedText && (
                <div className="bg-muted grid gap-4 rounded-r-md border-l-2 px-3 py-2 text-sm md:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground font-medium">Restricción: </span>
                    {row.constraintText || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Acción: </span>
                    {row.actionText || "—"}
                  </div>
                </div>
              )}
              {canEdit && (
                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="text-primary text-xs underline underline-offset-2"
                  >
                    {hasSavedText ? "Editar" : "Agregar restricción y acción"}
                  </button>
                </div>
              )}
            </TableCell>
          </TableRow>
        )
      )}
    </>
  );
}
