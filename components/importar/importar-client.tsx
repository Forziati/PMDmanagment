"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export interface AirportOption {
  id: string;
  iataCode: string;
  name: string;
}

const NEW_AIRPORT = "__nuevo__";

interface SeriesPreview {
  code: string;
  name: string;
  anexo6Amount: string;
  updatedAmount: string;
  amountByYear: Record<string, string>;
  lineCount: number;
}

interface Preview {
  series: SeriesPreview[];
  escalationFactors: Record<string, string>;
  skipped: { rowNumber: number; reason: string }[];
  totals: {
    anexo6Amount: string;
    updatedAmount: string;
    amountByYear: Record<string, string>;
  };
  lineCount: number;
  years: number[];
  imported?: boolean;
  seriesCreated?: number;
  seriesUpdated?: number;
  itemsWritten?: number;
}

const money = (v: string) =>
  `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ImportarClient({ airports }: { airports: AirportOption[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [projectId, setProjectId] = useState<string>(
    airports.length > 0 ? airports[0].id : NEW_AIRPORT,
  );
  const [newIataCode, setNewIataCode] = useState("");
  const [newAirportName, setNewAirportName] = useState("");
  const isNewProject = projectId === NEW_AIRPORT;

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setError(null);
    setDone(false);
  }

  async function send(confirm: boolean) {
    if (!file) return;
    if (isNewProject && (!newIataCode.trim() || !newAirportName.trim())) {
      setError("Completá el código IATA y el nombre del nuevo aeropuerto.");
      return;
    }
    setLoading(true);
    setError(null);

    const body = new FormData();
    body.set("file", file);
    if (confirm) body.set("confirm", "true");
    if (isNewProject) {
      body.set("airportIataCode", newIataCode.trim());
      body.set("airportName", newAirportName.trim());
    } else {
      body.set("airportId", projectId);
    }

    const response = await fetch("/api/v1/import/pmd", { method: "POST", body });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "No se pudo procesar el archivo.");
      return;
    }

    setPreview(payload);
    if (confirm) {
      setDone(true);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Carga inicial desde Excel</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Lee la hoja <strong>&quot;Datos PMD&quot;</strong> del Excel de Cash Flow y crea las
          series con sus líneas de proyecto, para no cargarlas una por una. Primero muestra
          qué va a importar; nada se guarda hasta que confirmes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proyecto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project">Aeropuerto / proyecto</Label>
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                setPreview(null);
                setDone(false);
              }}
            >
              <SelectTrigger id="project" className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {airports.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.iataCode} — {a.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_AIRPORT}>+ Nuevo aeropuerto / proyecto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNewProject && (
            <div className="grid max-w-md gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="iata">Código IATA</Label>
                <Input
                  id="iata"
                  value={newIataCode}
                  onChange={(e) => setNewIataCode(e.target.value.toUpperCase())}
                  placeholder="ej. MEX"
                  maxLength={4}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="airportName">Nombre</Label>
                <Input
                  id="airportName"
                  value={newAirportName}
                  onChange={(e) => setNewAirportName(e.target.value)}
                  placeholder="ej. Aeropuerto Internacional de la Ciudad de México"
                />
              </div>
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            Cada proyecto es independiente: sus series, contratos y programación no se mezclan
            con los de otro aeropuerto. Para controlar un nuevo PMD, elegí &quot;+ Nuevo
            aeropuerto&quot; e importá su Excel — no hace falta tocar nada más.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archivo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            type="file"
            accept=".xlsx"
            onChange={pickFile}
            className="file:bg-primary file:text-primary-foreground block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
          />
          {file && (
            <p className="text-muted-foreground text-sm">
              {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => send(false)} disabled={!file || loading}>
              {loading && !done ? "Analizando..." : "Analizar archivo"}
            </Button>
            {preview && !done && (
              <Button variant="outline" onClick={() => send(true)} disabled={loading}>
                Confirmar e importar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {done && preview && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <p className="font-medium">Importación completada.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {preview.seriesCreated} series creadas y {preview.seriesUpdated} actualizadas
              (una por cada año del ciclo), con {preview.itemsWritten} líneas de proyecto.
              Revisalo en Series PMD o en PMD Programado.
            </p>
          </CardContent>
        </Card>
      )}

      {preview && (
        <>
          {preview.skipped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Filas no importadas ({preview.skipped.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {preview.skipped.slice(0, 15).map((s) => (
                  <div key={s.rowNumber}>
                    <span className="text-muted-foreground">Fila {s.rowNumber}:</span>{" "}
                    {s.reason}
                  </div>
                ))}
                {preview.skipped.length > 15 && (
                  <p className="text-muted-foreground">
                    …y {preview.skipped.length - 15} más.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {preview.series.length} series · {preview.lineCount} líneas de proyecto
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {preview.years.map((year) => (
                  <Badge key={year} variant="secondary">
                    {year} · factor {Number(preview.escalationFactors[year] ?? 1).toFixed(6)}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serie</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right">Líneas</TableHead>
                    <TableHead className="text-right">Anexo 6</TableHead>
                    {preview.years.map((year) => (
                      <TableHead key={year} className="text-right">
                        {year}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.series.map((s) => (
                    <TableRow key={s.code}>
                      <TableCell className="font-medium">{s.code}</TableCell>
                      <TableCell className="max-w-[16rem] truncate" title={s.name}>
                        {s.name}
                      </TableCell>
                      <TableCell className="text-right">{s.lineCount}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {money(s.anexo6Amount)}
                      </TableCell>
                      {preview.years.map((year) => (
                        <TableCell key={year} className="text-right whitespace-nowrap">
                          {money(s.amountByYear[year] ?? "0")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted font-semibold">
                    <TableCell colSpan={2}>Total general</TableCell>
                    <TableCell className="text-right">{preview.lineCount}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {money(preview.totals.anexo6Amount)}
                    </TableCell>
                    {preview.years.map((year) => (
                      <TableCell key={year} className="text-right whitespace-nowrap">
                        {money(preview.totals.amountByYear[year] ?? "0")}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-muted-foreground max-w-3xl text-xs">
            Las líneas de proyecto (Cantidad × P.U.) describen el alcance del ciclo completo,
            no el de un año, así que se guardan en la serie de cada año. Reimportar el mismo
            archivo actualiza los montos y reemplaza las líneas, no duplica.
          </p>
        </>
      )}
    </div>
  );
}
