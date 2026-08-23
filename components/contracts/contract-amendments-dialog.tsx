"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPesos } from "@/lib/money";

export interface AmendmentRow {
  id: string;
  amendmentNumber: number;
  amountDelta: string;
  effectiveDate: string;
  reason: string;
}

export function ContractAmendmentsDialog({
  open,
  onOpenChange,
  contractId,
  contractLabel,
  amendments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  contractLabel: string;
  amendments: AmendmentRow[];
}) {
  const router = useRouter();
  const nextNumber = (amendments.at(-1)?.amendmentNumber ?? 0) + 1;
  const [amountDelta, setAmountDelta] = useState("0");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/v1/contracts/${contractId}/amendments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amendmentNumber: nextNumber,
        amountDelta,
        effectiveDate,
        reason,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo registrar el convenio.");
      setLoading(false);
      return;
    }

    setAmountDelta("0");
    setReason("");
    setLoading(false);
    router.refresh();
  }

  const total = amendments.reduce((acc, a) => acc + Number(a.amountDelta), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convenios / monto adicional</DialogTitle>
          <DialogDescription>
            {contractLabel} — cada convenio queda como registro propio; no se edita el monto
            original (sección 4.5 del prompt maestro). Acumulado a la fecha:{" "}
            <strong>{formatPesos(total)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {amendments.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  Sin convenios registrados.
                </TableCell>
              </TableRow>
            )}
            {amendments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.amendmentNumber}</TableCell>
                <TableCell>{a.effectiveDate}</TableCell>
                <TableCell className="text-right">{formatPesos(a.amountDelta)}</TableCell>
                <TableCell className="max-w-48 truncate" title={a.reason}>
                  {a.reason}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form className="flex flex-col gap-3 border-t pt-4" onSubmit={handleAdd}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amountDelta">Monto del convenio No. {nextNumber}</Label>
              <Input
                id="amountDelta"
                type="number"
                step="0.01"
                required
                value={amountDelta}
                onChange={(e) => setAmountDelta(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="effectiveDate">Fecha de vigencia</Label>
              <Input
                id="effectiveDate"
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input
              id="reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ej. Ampliación de alcance por adicionales SEDENA"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={loading}>
            Registrar convenio
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
