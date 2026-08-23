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
  ContractFormDialog,
  CONTRACT_STAGE_LABELS,
  type ContractFormOption,
  type ContractFormValue,
} from "@/components/contracts/contract-form-dialog";
import {
  ContractAllocationsDialog,
  type AllocationRow,
  type SeriesOption,
} from "@/components/contracts/contract-allocations-dialog";

export interface ContractRow {
  id: string;
  contractNumber: string;
  name: string;
  stage: string;
  companyName: string | null;
  currentAmountLabel: string;
  allocations: AllocationRow[];
  raw: ContractFormValue;
}

export function ContractsPageClient({
  contracts,
  companies,
  investmentGroups,
  seriesOptions,
  canCreate,
  canEdit,
}: {
  contracts: ContractRow[];
  companies: ContractFormOption[];
  investmentGroups: ContractFormOption[];
  seriesOptions: SeriesOption[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContractFormValue | null>(null);
  const [allocationsFor, setAllocationsFor] = useState<ContractRow | null>(null);

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground text-sm">
            Contratos y paquetes vinculados a una o varias series PMD.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Nuevo contrato
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. contrato</TableHead>
              <TableHead>Alcance</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Monto vigente</TableHead>
              <TableHead>Series</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center">
                  Aún no hay contratos registrados.
                </TableCell>
              </TableRow>
            )}
            {contracts.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.contractNumber}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.companyName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {CONTRACT_STAGE_LABELS[row.stage] ?? row.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{row.currentAmountLabel}</TableCell>
                <TableCell>
                  <Button variant="link" size="sm" onClick={() => setAllocationsFor(row)}>
                    {row.allocations.length} serie(s)
                  </Button>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(row.raw);
                        setFormOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ContractFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        companies={companies}
        investmentGroups={investmentGroups}
        initialValue={editing}
      />

      {allocationsFor && (
        <ContractAllocationsDialog
          key={allocationsFor.id}
          open={Boolean(allocationsFor)}
          onOpenChange={(open) => !open && setAllocationsFor(null)}
          contractId={allocationsFor.id}
          contractLabel={`${allocationsFor.contractNumber} — ${allocationsFor.name}`}
          allocations={allocationsFor.allocations}
          seriesOptions={seriesOptions}
        />
      )}
    </div>
  );
}
