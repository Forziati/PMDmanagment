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
import { CONTRACT_STAGE_LABELS } from "@/lib/domain/contrato";

export interface ContractFormOption {
  id: string;
  label: string;
}

export { CONTRACT_STAGE_LABELS };

export interface ContractFormValue {
  id?: string;
  contractNumber: string;
  name: string;
  scope: string;
  companyId: string;
  investmentGroupId: string;
  stage: string;
  originalAmount: string;
  currentAmount: string;
  advanceAmount: string;
  oeneContractedBudget: string;
  oeneTotal: string;
  oeneContracted: string;
  oeneToRegularize: string;
  oeneToInvoice: string;
  costOrigin: string;
}

const EMPTY_VALUE: ContractFormValue = {
  contractNumber: "",
  name: "",
  scope: "",
  companyId: "",
  investmentGroupId: "",
  stage: "EN_DEFINICION",
  originalAmount: "0",
  currentAmount: "0",
  advanceAmount: "0",
  oeneContractedBudget: "0",
  oeneTotal: "0",
  oeneContracted: "0",
  oeneToRegularize: "0",
  oeneToInvoice: "0",
  costOrigin: "",
};

export function ContractFormDialog({
  open,
  onOpenChange,
  companies,
  investmentGroups,
  initialValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: ContractFormOption[];
  investmentGroups: ContractFormOption[];
  initialValue: ContractFormValue | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(initialValue?.id);
  const [value, setValue] = useState<ContractFormValue>(initialValue ?? EMPTY_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const basePayload = {
      name: value.name,
      scope: value.scope || undefined,
      companyId: value.companyId || undefined,
      investmentGroupId: value.investmentGroupId || undefined,
      stage: value.stage,
      currentAmount: value.currentAmount,
      advanceAmount: value.advanceAmount,
      oeneContractedBudget: value.oeneContractedBudget,
      oeneTotal: value.oeneTotal,
      oeneContracted: value.oeneContracted,
      oeneToRegularize: value.oeneToRegularize,
      oeneToInvoice: value.oeneToInvoice,
      costOrigin: value.costOrigin || undefined,
    };
    const payload = isEditing
      ? basePayload
      : { ...basePayload, contractNumber: value.contractNumber, originalAmount: value.originalAmount };

    const response = await fetch(
      isEditing ? `/api/v1/contracts/${initialValue!.id}` : "/api/v1/contracts",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo guardar el contrato.");
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
          <DialogTitle>{isEditing ? "Editar contrato" : "Nuevo contrato"}</DialogTitle>
          <DialogDescription>
            Contrato o paquete (DATA_DICTIONARY.md §2.8). Las series se asignan por separado.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contractNumber">No. de contrato / OC</Label>
              <Input
                id="contractNumber"
                required
                disabled={isEditing}
                value={value.contractNumber}
                onChange={(e) => setValue((s) => ({ ...s, contractNumber: e.target.value }))}
                placeholder="ej. OC 79821"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stage">Etapa</Label>
              <Select value={value.stage} onValueChange={(v) => setValue((s) => ({ ...s, stage: v }))}>
                <SelectTrigger id="stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_STAGE_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Alcance / nombre</Label>
            <Input
              id="name"
              required
              value={value.name}
              onChange={(e) => setValue((s) => ({ ...s, name: e.target.value }))}
              placeholder="ej. Plataforma comercial y rodajes"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="companyId">Empresa</Label>
              <Select
                value={value.companyId}
                onValueChange={(v) => setValue((s) => ({ ...s, companyId: v }))}
              >
                <SelectTrigger id="companyId" className="w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-3 gap-4">
            {!isEditing && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="originalAmount">Monto original</Label>
                <Input
                  id="originalAmount"
                  type="number"
                  step="0.01"
                  required
                  value={value.originalAmount}
                  onChange={(e) => setValue((s) => ({ ...s, originalAmount: e.target.value }))}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentAmount">Monto vigente</Label>
              <Input
                id="currentAmount"
                type="number"
                step="0.01"
                required
                value={value.currentAmount}
                onChange={(e) => setValue((s) => ({ ...s, currentAmount: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="advanceAmount">Anticipo</Label>
              <Input
                id="advanceAmount"
                type="number"
                step="0.01"
                value={value.advanceAmount}
                onChange={(e) => setValue((s) => ({ ...s, advanceAmount: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="text-sm font-medium">OENE (Órdenes de Ejecución No Estimadas)</span>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="oeneContractedBudget">Ppto. contratado</Label>
                <Input
                  id="oeneContractedBudget"
                  type="number"
                  step="0.01"
                  value={value.oeneContractedBudget}
                  onChange={(e) => setValue((s) => ({ ...s, oeneContractedBudget: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oeneTotal">OENE total</Label>
                <Input
                  id="oeneTotal"
                  type="number"
                  step="0.01"
                  value={value.oeneTotal}
                  onChange={(e) => setValue((s) => ({ ...s, oeneTotal: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oeneContracted">OENE contratada</Label>
                <Input
                  id="oeneContracted"
                  type="number"
                  step="0.01"
                  value={value.oeneContracted}
                  onChange={(e) => setValue((s) => ({ ...s, oeneContracted: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oeneToRegularize">OENE por regularizar</Label>
                <Input
                  id="oeneToRegularize"
                  type="number"
                  step="0.01"
                  value={value.oeneToRegularize}
                  onChange={(e) => setValue((s) => ({ ...s, oeneToRegularize: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oeneToInvoice">OENE por facturar</Label>
                <Input
                  id="oeneToInvoice"
                  type="number"
                  step="0.01"
                  value={value.oeneToInvoice}
                  onChange={(e) => setValue((s) => ({ ...s, oeneToInvoice: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="costOrigin">Origen del costo</Label>
            <Input
              id="costOrigin"
              value={value.costOrigin}
              onChange={(e) => setValue((s) => ({ ...s, costOrigin: e.target.value }))}
              placeholder="ej. 1-Contrato"
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
