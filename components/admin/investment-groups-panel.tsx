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

export interface InvestmentGroupRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export function InvestmentGroupsPanel({
  groups,
  canEdit,
}: {
  groups: InvestmentGroupRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/v1/investment-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, sortOrder: groups.length }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "No se pudo crear el grupo.");
      setLoading(false);
      return;
    }

    setCode("");
    setName("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">{group.code}</TableCell>
                <TableCell>{group.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canEdit && (
        <form className="flex items-end gap-2" onSubmit={handleCreate}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-code">Código</Label>
            <Input id="group-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="group-name">Nombre</Label>
            <Input id="group-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading}>
            Agregar grupo
          </Button>
        </form>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
