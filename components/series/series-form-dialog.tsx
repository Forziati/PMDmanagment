"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

export interface SeriesFormOption {
  id: string;
  label: string;
}

export interface SeriesFormValue {
  id?: string;
  code: string;
  name: string;
  description: string;
  investmentGroupId: string;
  pmdYearId: string;
  authorizedAmount: string;
  updatedAmount: string;
  sourceDocument: string;
  status: string;
}

const EMPTY_VALUE: SeriesFormValue = {
  code: "",
  name: "",
  description: "",
  investmentGroupId: "",
  pmdYearId: "",
  authorizedAmount: "0",
  updatedAmount: "0",
  sourceDocument: "",
  status: "ACTIVA",
};

export function SeriesFormDialog({
  open,
  onOpenChange,
  pmdYears,
  investmentGroups,
  initialValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pmdYears: SeriesFormOption[];
  investmentGroups: SeriesFormOption[];
  initialValue: SeriesFormValue | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(initialValue?.id);
  const [value, setValue] = useState<SeriesFormValue>(initialValue ?? EMPTY_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      code: value.code,
      name: value.name,
      description: value.description || undefined,
      investmentGroupId: value.investmentGroupId || undefined,
      sourceDocument: value.sourceDocument || undefined,
      authorizedAmount: value.authorizedAmount,
      updatedAmount: value.updatedAmount,
      ...(isEditing ? { status: value.status } : { pmdYearId: value.pmdYearId }),
    };

    const response = await fetch(
      isEditing ? `/api/v1/pmd-series/${initialValue!.id}` : "/api/v1/pmd-series",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo guardar la serie.");
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar serie PMD" : "Nueva serie PMD"}</DialogTitle>
          <DialogDescription>
            Serie/Sector del Plan Maestro de Desarrollo (DATA_DICTIONARY.md §2.6).
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {!isEditing && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pmdYearId">Año PMD</Label>
              <Select
                value={value.pmdYearId}
                onValueChange={(v) => setValue((s) => ({ ...s, pmdYearId: v }))}
                required
              >
                <SelectTrigger id="pmdYearId" className="w-full">
                  <SelectValue placeholder="Selecciona un año PMD" />
                </SelectTrigger>
                <SelectContent>
                  {pmdYears.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Código de serie</Label>
              <Input
                id="code"
                required
                disabled={isEditing}
                value={value.code}
                onChange={(e) => setValue((s) => ({ ...s, code: e.target.value }))}
                placeholder="ej. 101"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="investmentGroupId">Grupo de inversión</Label>
              <Select
                value={value.investmentGroupId}
                onValueChange={(v) => setValue((s) => ({ ...s, investmentGroupId: v }))}
              >
                <SelectTrigger id="investmentGroupId" className="w-full">
                  <SelectValue placeholder="Sin grupo" />
                </SelectTrigger>
                <SelectContent>
                  {investmentGroups.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre (Sector)</Label>
            <Input
              id="name"
              required
              value={value.name}
              onChange={(e) => setValue((s) => ({ ...s, name: e.target.value }))}
              placeholder="ej. Ampliación T1"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={value.description}
              onChange={(e) => setValue((s) => ({ ...s, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="authorizedAmount">Monto autorizado (Anexo 6)</Label>
              <Input
                id="authorizedAmount"
                type="number"
                step="0.01"
                required
                value={value.authorizedAmount}
                onChange={(e) => setValue((s) => ({ ...s, authorizedAmount: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="updatedAmount">Monto actualizado</Label>
              <Input
                id="updatedAmount"
                type="number"
                step="0.01"
                required
                value={value.updatedAmount}
                onChange={(e) => setValue((s) => ({ ...s, updatedAmount: e.target.value }))}
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={value.status}
                onValueChange={(v) => setValue((s) => ({ ...s, status: v }))}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVA">Activa</SelectItem>
                  <SelectItem value="CERRADA">Cerrada</SelectItem>
                  <SelectItem value="RETIRADA">Retirada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="sourceDocument">Fuente documental</Label>
            <Input
              id="sourceDocument"
              value={value.sourceDocument}
              onChange={(e) => setValue((s) => ({ ...s, sourceDocument: e.target.value }))}
              placeholder="ej. Anexo 6 Dic 2022"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
