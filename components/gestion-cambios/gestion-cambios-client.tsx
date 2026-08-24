"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export interface CambioRow {
  id: string;
  occurredAtLabel: string;
  occurredAtSort: string;
  userName: string;
  entityType: string;
  entityLabel: string;
  actionLabel: string;
  title: string;
  detail: string | null;
}

export function GestionCambiosClient({
  rows,
  limited,
}: {
  rows: CambioRow[];
  limited: boolean;
}) {
  const [userFilter, setUserFilter] = useState("TODOS");
  const [entityFilter, setEntityFilter] = useState("TODOS");

  const users = useMemo(
    () => [...new Set(rows.map((r) => r.userName))].sort(),
    [rows],
  );
  const entities = useMemo(
    () => [...new Set(rows.map((r) => r.entityLabel))].sort(),
    [rows],
  );

  const visible = rows.filter(
    (r) =>
      (userFilter === "TODOS" || r.userName === userFilter) &&
      (entityFilter === "TODOS" || r.entityLabel === entityFilter),
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Gestión de cambios</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Bitácora de todo lo que se creó, editó o eliminó en el sistema: quién lo hizo, cuándo,
          y un resumen de qué cambió. Es de solo lectura — nada acá se puede borrar ni editar.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los usuarios</SelectItem>
            {users.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los tipos</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Qué cambió</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No hay cambios registrados que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {row.occurredAtLabel}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{row.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {row.entityLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap capitalize">
                      {row.actionLabel}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{row.title}</div>
                      {row.detail && (
                        <div className="text-muted-foreground mt-0.5 text-xs">{row.detail}</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {limited && (
        <p className="text-muted-foreground text-xs">
          Mostrando los últimos {rows.length} cambios.
        </p>
      )}
    </div>
  );
}
