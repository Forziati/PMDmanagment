import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";
import { jsonError } from "@/lib/api/respond";
import { writeAuditLog } from "@/lib/audit";
import {
  IMPORT_YEARS,
  ImportError,
  parsePmdWorkbook,
  type ParseResult,
} from "@/lib/import/excel-pmd";

/** 15 MB: el Excel de origen ronda 1 MB, así que sobra de margen. */
const MAX_BYTES = 15 * 1024 * 1024;

function summarize(parsed: ParseResult) {
  return {
    series: parsed.series,
    escalationFactors: parsed.escalationFactors,
    skipped: parsed.skipped,
    totals: parsed.totals,
    lineCount: parsed.lines.length,
    years: [...IMPORT_YEARS],
  };
}

/**
 * Carga inicial desde el Excel de Cash Flow.
 *
 * Sin `confirm=true` solo analiza y devuelve la vista previa: nada se
 * escribe. Con `confirm=true` siembra series y líneas de proyecto.
 *
 * Las series se crean por año (el modelo es año-scoped: `updatedAmount` es
 * el hito de esa serie para ese año). Las líneas de proyecto describen el
 * alcance del ciclo completo, no el de un año, así que se replican en cada
 * año para que "Detalle de serie" funcione desde cualquiera.
 *
 * Es idempotente: reimportar el mismo archivo actualiza en vez de duplicar.
 */
export async function POST(request: Request) {
  const auth = await requireClientScopedPermission("SERIES.CREAR");
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Se esperaba un envío de archivo (multipart/form-data).");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "Falta el archivo (campo 'file').");
  }
  if (file.size === 0) return jsonError(400, "El archivo está vacío.");
  if (file.size > MAX_BYTES) {
    return jsonError(413, "El archivo supera el límite de 15 MB.");
  }

  let parsed: ParseResult;
  try {
    parsed = await parsePmdWorkbook(await file.arrayBuffer());
  } catch (error) {
    if (error instanceof ImportError) return jsonError(422, error.message);
    throw error;
  }

  const confirm = formData.get("confirm") === "true";
  if (!confirm) {
    return NextResponse.json({ preview: true, ...summarize(parsed) });
  }

  // Cada importación pertenece a un aeropuerto/proyecto: uno ya existente
  // (airportId) o uno nuevo (airportIataCode + airportName). Sin ninguno de
  // los dos, se usa el primero del cliente para no romper compatibilidad
  // con integraciones previas.
  const airportId = formData.get("airportId");
  const airportIataCode = formData.get("airportIataCode");
  const airportName = formData.get("airportName");

  let airport;
  if (typeof airportId === "string" && airportId) {
    airport = await prisma.airport.findFirst({
      where: { id: airportId, clientId: auth.clientId },
    });
    if (!airport) return jsonError(400, "Aeropuerto inválido para este cliente.");
  } else if (typeof airportIataCode === "string" && airportIataCode.trim()) {
    const code = airportIataCode.trim().toUpperCase();
    if (!/^[A-Z]{3,4}$/.test(code)) {
      return jsonError(400, "El código IATA debe tener 3 o 4 letras (ej. CUN, MEX).");
    }
    const name = typeof airportName === "string" ? airportName.trim() : "";
    if (!name) return jsonError(400, "Falta el nombre del aeropuerto.");

    airport = await prisma.airport.upsert({
      where: { clientId_iataCode: { clientId: auth.clientId, iataCode: code } },
      update: {},
      create: { clientId: auth.clientId, iataCode: code, name },
    });
  } else {
    airport = await prisma.airport.findFirst({
      where: { clientId: auth.clientId },
      orderBy: { iataCode: "asc" },
    });
    if (!airport) {
      return jsonError(
        400,
        "Elegí un aeropuerto o creá uno nuevo (código IATA y nombre) antes de importar.",
      );
    }
  }

  const startYear = IMPORT_YEARS[0];
  const endYear = IMPORT_YEARS[IMPORT_YEARS.length - 1];
  const cycleCode = `PMD ${startYear}-${endYear}`;

  const result = await prisma.$transaction(
    async (tx) => {
      const cycle = await tx.pmdCycle.upsert({
        where: { airportId_code: { airportId: airport.id, code: cycleCode } },
        update: {},
        create: { airportId: airport.id, code: cycleCode, startYear, endYear },
      });

      let seriesCreated = 0;
      let seriesUpdated = 0;
      let itemsWritten = 0;

      for (const year of IMPORT_YEARS) {
        const factor = parsed.escalationFactors[year];
        const pmdYear = await tx.pmdYear.upsert({
          where: { pmdCycleId_year: { pmdCycleId: cycle.id, year } },
          update: factor ? { escalationFactor: factor } : {},
          create: {
            pmdCycleId: cycle.id,
            year,
            escalationFactor: factor ?? "1",
          },
        });

        for (const series of parsed.series) {
          const existing = await tx.pmdSeries.findUnique({
            where: { pmdYearId_code: { pmdYearId: pmdYear.id, code: series.code } },
          });

          const data = {
            name: series.name,
            authorizedAmount: series.anexo6Amount,
            updatedAmount: series.amountByYear[year],
            sourceDocument: `Importado de ${file.name}`,
          };

          const saved = existing
            ? await tx.pmdSeries.update({ where: { id: existing.id }, data })
            : await tx.pmdSeries.create({
                data: { ...data, pmdYearId: pmdYear.id, code: series.code },
              });

          if (existing) seriesUpdated += 1;
          else seriesCreated += 1;

          // Se reemplazan las líneas para que reimportar no acumule.
          await tx.pmdSeriesItem.deleteMany({ where: { pmdSeriesId: saved.id } });
          const lines = parsed.lines.filter((l) => l.seriesCode === series.code);
          if (lines.length > 0) {
            await tx.pmdSeriesItem.createMany({
              data: lines.map((line) => ({
                pmdSeriesId: saved.id,
                subsector: line.subsector,
                projectName: line.projectName,
                unit: line.unit,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
              })),
            });
            itemsWritten += lines.length;
          }
        }
      }

      return { seriesCreated, seriesUpdated, itemsWritten, cycleCode };
    },
    { timeout: 120_000 },
  );

  await writeAuditLog({
    userId: auth.user.id,
    clientId: auth.clientId,
    action: "IMPORT_PMD",
    entityType: "PmdCycle",
    entityId: airport.id,
    afterValue: {
      fileName: file.name,
      ...result,
      totals: parsed.totals,
      skippedRows: parsed.skipped.length,
    },
  });

  return NextResponse.json({ imported: true, ...result, ...summarize(parsed) });
}
