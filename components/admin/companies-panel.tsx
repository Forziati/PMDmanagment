"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
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

export interface CompanyRow {
  id: string;
  name: string;
  taxId: string | null;
}

export function CompaniesPanel({
  companies,
  canEdit,
}: {
  companies: CompanyRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/v1/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, taxId: taxId || undefined }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo crear la empresa.");
      setLoading(false);
      return;
    }

    setName("");
    setTaxId("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RFC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground text-center">
                  Sin empresas registradas.
                </TableCell>
              </TableRow>
            )}
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>{company.taxId ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canEdit && (
        <form className="flex items-end gap-2" onSubmit={handleCreate}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="company-name">Nombre</Label>
            <Input id="company-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="company-taxid">RFC (opcional)</Label>
            <Input id="company-taxid" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading}>
            Agregar empresa
          </Button>
        </form>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
