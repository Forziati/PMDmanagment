import ExcelJS from "exceljs";
import { Decimal } from "decimal.js";

/**
 * Importación inicial desde el Excel de Cash Flow (hoja "Datos PMD").
 *
 * Estructura esperada, verificada contra el archivo real de ASUR:
 *   fila 3      encabezados
 *   filas 4+    una línea de proyecto por fila
 *   A Serie PMD · B Sector · C Sub-sector · D Proyecto · E Unidad
 *   F Cantidad · G P.U. · H Total PMD anexo 6 · I Total PMD actualizado
 *   J-N % programado por año (2024-2028)
 *   O-S monto programado por año (2024-2028)
 *   fila con "FACTOR" en la columna N: factores de escalación en O-S
 *
 * Los montos H e I del Excel están expresados en MILLONES de pesos; se
 * convierten a pesos para guardarlos, porque todo el sistema trabaja en pesos.
 */

export const IMPORT_SHEET_NAME = "Datos PMD";
export const IMPORT_YEARS = [2024, 2025, 2026, 2027, 2028] as const;

const MILLION = new Decimal(1_000_000);

export interface ImportedLine {
  rowNumber: number;
  seriesCode: string;
  seriesName: string;
  subsector: string | null;
  projectName: string;
  unit: string | null;
  quantity: string | null;
  unitPrice: string | null;
  /** "Total PMD anexo 6", ya en pesos. */
  anexo6Amount: string;
  /** "Total PMD actualizado", ya en pesos. */
  updatedAmount: string;
  /** Monto por año (2024-2028), ya en pesos. */
  amountByYear: Record<number, string>;
}

export interface ImportedSeries {
  code: string;
  name: string;
  anexo6Amount: string;
  updatedAmount: string;
  amountByYear: Record<number, string>;
  lineCount: number;
}

export interface ParseResult {
  lines: ImportedLine[];
  series: ImportedSeries[];
  escalationFactors: Record<number, string>;
  /** Filas descartadas y por qué — se muestran al usuario antes de confirmar. */
  skipped: { rowNumber: number; reason: string }[];
  totals: {
    anexo6Amount: string;
    updatedAmount: string;
    amountByYear: Record<number, string>;
  };
}

export class ImportError extends Error {}

function cellText(row: ExcelJS.Row, col: number): string | null {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && "result" in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    return result === null || result === undefined ? null : String(result).trim() || null;
  }
  if (typeof value === "object" && "richText" in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("").trim() || null;
  }
  const text = String(value).trim();
  return text || null;
}

/**
 * Lee un número tolerando fórmulas (usa el resultado cacheado) y celdas
 * vacías. Devuelve null si no hay un número utilizable, para poder
 * distinguir "no había dato" de "el dato era cero".
 */
function cellNumber(row: ExcelJS.Row, col: number): Decimal | null {
  const value = row.getCell(col).value;
  if (value === null || value === undefined || value === "") return null;

  let raw: unknown = value;
  if (typeof value === "object" && "result" in value) {
    raw = (value as ExcelJS.CellFormulaValue).result;
  }
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) return null;
  if (typeof raw === "object") return null;

  const text = String(raw).replace(/[$,\s]/g, "");
  if (!text || Number.isNaN(Number(text))) return null;
  return new Decimal(text);
}

export async function parsePmdWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ImportError(
      "No se pudo leer el archivo. Verifica que sea un .xlsx válido (no un .xls antiguo ni un CSV).",
    );
  }

  const sheet = workbook.getWorksheet(IMPORT_SHEET_NAME);
  if (!sheet) {
    const available = workbook.worksheets.map((w) => w.name).join(", ");
    throw new ImportError(
      `El archivo no tiene una hoja llamada "${IMPORT_SHEET_NAME}". Hojas encontradas: ${available || "ninguna"}.`,
    );
  }

  const lines: ImportedLine[] = [];
  const skipped: { rowNumber: number; reason: string }[] = [];
  const escalationFactors: Record<number, string> = {};

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 3) return;

    // Fila de factores: "FACTOR" en la columna N, valores en O-S.
    if ((cellText(row, 14) ?? "").toUpperCase() === "FACTOR") {
      IMPORT_YEARS.forEach((year, i) => {
        const factor = cellNumber(row, 15 + i);
        if (factor && factor.greaterThan(0)) escalationFactors[year] = factor.toString();
      });
      return;
    }

    const seriesCode = cellText(row, 1);
    const seriesName = cellText(row, 2);
    const projectName = cellText(row, 4);

    // Filas vacías o de subtotal: no hay serie que las ancle.
    if (!seriesCode) return;
    if (!seriesName) {
      skipped.push({ rowNumber, reason: "Sin sector (columna B), no se puede nombrar la serie." });
      return;
    }
    if (!projectName) {
      skipped.push({ rowNumber, reason: "Sin proyecto (columna D)." });
      return;
    }

    const anexo6 = cellNumber(row, 8);
    const updated = cellNumber(row, 9);
    if (!anexo6 && !updated) {
      skipped.push({
        rowNumber,
        reason: "Sin montos en Anexo 6 (H) ni actualizado (I).",
      });
      return;
    }

    const amountByYear: Record<number, string> = {};
    IMPORT_YEARS.forEach((year, i) => {
      const amount = cellNumber(row, 15 + i);
      amountByYear[year] = (amount ?? new Decimal(0)).times(MILLION).toFixed(2);
    });

    const quantity = cellNumber(row, 6);
    const unitPrice = cellNumber(row, 7);

    lines.push({
      rowNumber,
      seriesCode: String(seriesCode).trim(),
      seriesName,
      subsector: cellText(row, 3),
      projectName,
      unit: cellText(row, 5),
      quantity: quantity ? quantity.toString() : null,
      unitPrice: unitPrice ? unitPrice.toString() : null,
      anexo6Amount: (anexo6 ?? new Decimal(0)).times(MILLION).toFixed(2),
      updatedAmount: (updated ?? new Decimal(0)).times(MILLION).toFixed(2),
      amountByYear,
    });
  });

  if (lines.length === 0) {
    throw new ImportError(
      `La hoja "${IMPORT_SHEET_NAME}" no tiene filas de datos utilizables a partir de la fila 4.`,
    );
  }

  // Agrupa por serie: los montos se suman, el nombre lo fija la primera fila.
  const seriesMap = new Map<string, ImportedSeries>();
  for (const line of lines) {
    let entry = seriesMap.get(line.seriesCode);
    if (!entry) {
      entry = {
        code: line.seriesCode,
        name: line.seriesName,
        anexo6Amount: "0",
        updatedAmount: "0",
        amountByYear: Object.fromEntries(IMPORT_YEARS.map((y) => [y, "0"])),
        lineCount: 0,
      };
      seriesMap.set(line.seriesCode, entry);
    }
    entry.anexo6Amount = new Decimal(entry.anexo6Amount).plus(line.anexo6Amount).toFixed(2);
    entry.updatedAmount = new Decimal(entry.updatedAmount).plus(line.updatedAmount).toFixed(2);
    for (const year of IMPORT_YEARS) {
      entry.amountByYear[year] = new Decimal(entry.amountByYear[year])
        .plus(line.amountByYear[year])
        .toFixed(2);
    }
    entry.lineCount += 1;
  }

  const series = [...seriesMap.values()].sort((a, b) => a.code.localeCompare(b.code));

  const totals = {
    anexo6Amount: series
      .reduce((acc, s) => acc.plus(s.anexo6Amount), new Decimal(0))
      .toFixed(2),
    updatedAmount: series
      .reduce((acc, s) => acc.plus(s.updatedAmount), new Decimal(0))
      .toFixed(2),
    amountByYear: Object.fromEntries(
      IMPORT_YEARS.map((year) => [
        year,
        series.reduce((acc, s) => acc.plus(s.amountByYear[year]), new Decimal(0)).toFixed(2),
      ]),
    ),
  };

  return { lines, series, escalationFactors, skipped, totals };
}
