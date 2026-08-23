"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AnnualTargetYearOption {
  pmdYearId: string;
  label: string;
  amount: string | null;
  locked: boolean | null;
}

export function AnnualTargetPanel({
  years,
  canEdit,
  canApprove,
}: {
  years: AnnualTargetYearOption[];
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(years[0]?.pmdYearId ?? "");
  const [amount, setAmount] = useState(years[0]?.amount ?? "0");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = years.find((y) => y.pmdYearId === selectedId) ?? years[0];
  const isLocked = Boolean(selected?.locked);

  function handleSelect(id: string) {
    setSelectedId(id);
    const year = years.find((y) => y.pmdYearId === id);
    setAmount(year?.amount ?? "0");
    setError(null);
  }

  async function handleSaveAmount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/v1/annual-targets/${selected.pmdYearId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo guardar el hito anual.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  async function handleToggleLock(action: "lock" | "unlock") {
    if (!selected) return;
    if (!reason.trim()) {
      setError("El motivo es obligatorio para bloquear o desbloquear el hito anual.");
      return;
    }
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/v1/annual-targets/${selected.pmdYearId}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo actualizar el bloqueo.");
      setLoading(false);
      return;
    }

    setReason("");
    setLoading(false);
    router.refresh();
  }

  if (!selected) {
    return <p className="text-muted-foreground text-sm">No hay años PMD configurados.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="target-year">Año PMD</Label>
        <Select value={selectedId} onValueChange={handleSelect}>
          <SelectTrigger id="target-year" className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year.pmdYearId} value={year.pmdYearId}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="max-w-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Hito anual</CardTitle>
          <Badge variant={isLocked ? "secondary" : "outline"}>
            {isLocked ? "Bloqueado" : "Desbloqueado"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex items-end gap-2" onSubmit={handleSaveAmount}>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="target-amount">Monto (MXN)</Label>
              <Input
                id="target-amount"
                type="number"
                step="0.01"
                disabled={!canEdit || isLocked}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {canEdit && (
              <Button type="submit" disabled={loading || isLocked}>
                Guardar
              </Button>
            )}
          </form>

          {canApprove && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <Label htmlFor="lock-reason">Motivo (bloqueo/desbloqueo)</Label>
              <Input
                id="lock-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ej. Aprobado por Dirección PMO en comité del..."
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || isLocked}
                  onClick={() => handleToggleLock("lock")}
                >
                  Bloquear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || !isLocked}
                  onClick={() => handleToggleLock("unlock")}
                >
                  Desbloquear
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
