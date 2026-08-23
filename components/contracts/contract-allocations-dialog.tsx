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

export interface AllocationRow {
  id: string;
  pmdSeriesId: string;
  seriesLabel: string;
  allocatedAmountLabel: string;
}

export interface SeriesOption {
  id: string;
  label: string;
}

export function ContractAllocationsDialog({
  open,
  onOpenChange,
  contractId,
  contractLabel,
  allocations,
  seriesOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  contractLabel: string;
  allocations: AllocationRow[];
  seriesOptions: SeriesOption[];
}) {
  const router = useRouter();
  const [pmdSeriesId, setPmdSeriesId] = useState("");
  const [amount, setAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setWarning(null);

    const response = await fetch(`/api/v1/contracts/${contractId}/allocations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pmdSeriesId, allocatedAmount: amount }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "No se pudo asignar la serie.");
      setLoading(false);
      return;
    }

    if (body?.warning) setWarning(body.warning);
    setPmdSeriesId("");
    setAmount("0");
    setLoading(false);
    router.refresh();
  }

  async function handleRemove(allocationId: string) {
    setLoading(true);
    await fetch(`/api/v1/contracts/${contractId}/allocations/${allocationId}`, {
      method: "DELETE",
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Series asignadas</DialogTitle>
          <DialogDescription>
            {contractLabel} — un contrato puede aportar a varias series (sección 6.2 del prompt
            maestro).
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serie</TableHead>
              <TableHead className="text-right">Monto asignado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  Sin series asignadas todavía.
                </TableCell>
              </TableRow>
            )}
            {allocations.map((allocation) => (
              <TableRow key={allocation.id}>
                <TableCell>{allocation.seriesLabel}</TableCell>
                <TableCell className="text-right">{allocation.allocatedAmountLabel}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleRemove(allocation.id)}
                  >
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form className="flex items-end gap-2 border-t pt-4" onSubmit={handleAdd}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="pmdSeriesId">Serie PMD</Label>
            <Select value={pmdSeriesId} onValueChange={setPmdSeriesId} required>
              <SelectTrigger id="pmdSeriesId" className="w-full">
                <SelectValue placeholder="Selecciona una serie" />
              </SelectTrigger>
              <SelectContent>
                {seriesOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-40 flex-col gap-2">
            <Label htmlFor="allocatedAmount">Monto</Label>
            <Input
              id="allocatedAmount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading || !pmdSeriesId}>
            Asignar
          </Button>
        </form>
        {warning && <p className="text-warning-foreground bg-warning rounded-md p-2 text-sm">{warning}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
