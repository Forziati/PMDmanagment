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

/**
 * Capa de ejecución: qué se contrató y cómo se reparte mes a mes. "Datos PMD"
 * solo trae el presupuesto anual por serie, así que sin estas dos hojas el
 * sistema se queda sin contratos y las pantallas de control quedan en cero.
 *
 * Ambas comparten estructura (verificado contra el archivo real de ASUR):
 *   fila 3      encabezados; las columnas de mes son fechas reales
 *   filas 4+    una fila por paquete
 *   A Serie PMD · B Contrato · C Contratista · D Proyecto/Paquete
 *   E Monto contrato · luego bloques por año: 12 meses + una columna total
 *
 * A diferencia de "Datos PMD", acá los montos ya vienen en pesos.
 */
export const SCHEDULE_SHEET_NAME = "Proyeccion x mes";
export const ACTUAL_SHEET_NAME = "Erogacion x mes";

/**
 * Hoja maestra del Excel. Solo se usa para recuperar la "Categoría" de cada
 * contrato (Obra Nueva, Diseño, Mobiliario, …), que es lo que permite
 * desglosar el Dashboard por grupo de inversión; sin esto todo cae en
 * "Sin grupo". Su ausencia no impide importar.
 */
const CATEGORY_SHEET_NAME = "CashFlow";
const CATEGORY_HEADER_ROWS = 7;
const CATEGORY_COL_CATEGORY = 2;
const CATEGORY_COL_CONTRACT = 23;

/**
 * Valores de la columna "Contrato" que significan "todavía no hay contrato".
 * En el archivo real conviven "0" (línea de alcance PMD, no un paquete) y
 * "por definir" (paquete aún por licitar): ninguno es un número de contrato.
 */
const NO_CONTRACT_VALUES = new Set(["0", "-", "n/a", "na", "por definir", "pordefinir"]);

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

/** Un paquete con contrato adjudicado, ya consolidado por número de contrato. */
export interface ImportedContract {
  contractNumber: string;
  seriesCode: string;
  contractorName: string | null;
  /** Nombre del paquete; si el contrato agrupa varios, el del primero. */
  name: string;
  /** Categoría del Excel (Obra Nueva, Diseño, …); null si no se encontró. */
  category: string | null;
  contractAmount: string;
  /** Año → 12 montos programados (pesos), índice 0 = enero. */
  scheduleByYear: Record<number, string[]>;
  /** Año → 12 montos realmente erogados (pesos). */
  actualByYear: Record<number, string[]>;
  /** Filas del Excel que se consolidaron en este contrato. */
  rowNumbers: number[];
}

/** Paquete previsto pero todavía sin contrato adjudicado ("por definir"). */
export interface PendingAward {
  rowNumber: number;
  seriesCode: string;
  packageName: string;
  scheduleByYear: Record<number, string[]>;
}

export interface ExecutionResult {
  /** Años con columnas mensuales encontradas en las hojas. */
  years: number[];
  contracts: ImportedContract[];
  pendingAwards: PendingAward[];
  skipped: { rowNumber: number; reason: string }[];
  totals: {
    scheduleByYear: Record<number, string>;
    actualByYear: Record<number, string>;
  };
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
  /** null si el archivo no trae las hojas de ejecución. */
  execution: ExecutionResult | null;
  /**
   * Problemas que no impiden importar pero dejan al sistema sin parte del
   * control (por ejemplo, faltan las hojas de ejecución). Se muestran tal
   * cual al usuario en vez de dejar las pantallas en cero sin explicación.
   */
  warnings: string[];
}

export class ImportError extends Error {}

/**
 * Reduce el valor de una celda a un escalar.
 *
 * ExcelJS devuelve objetos para fórmulas, texto enriquecido, hipervínculos y
 * errores. Una fórmula sin resultado cacheado llega como `{ formula }` **sin**
 * la clave `result`, así que detectarla por `result` no alcanza: esas celdas
 * caían a `String(value)` y se leían como el literal "[object Object]".
 */
function cellScalar(row: ExcelJS.Row, col: number): unknown {
  const value = row.getCell(col).value;
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (value instanceof Date) return value;

  if ("error" in value) return null; // #REF!, #N/A, …
  if ("formula" in value || "sharedFormula" in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    if (result === null || result === undefined) return null;
    return typeof result === "object" && result !== null && "error" in result ? null : result;
  }
  if ("richText" in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
  }
  if ("text" in value) return (value as ExcelJS.CellHyperlinkValue).text;
  return null;
}

function cellText(row: ExcelJS.Row, col: number): string | null {
  const value = cellScalar(row, col);
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null;
  return String(value).trim() || null;
}

/**
 * Lee un número tolerando fórmulas (usa el resultado cacheado) y celdas
 * vacías. Devuelve null si no hay un número utilizable, para poder
 * distinguir "no había dato" de "el dato era cero".
 */
function cellNumber(row: ExcelJS.Row, col: number): Decimal | null {
  const raw = cellScalar(row, col);
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) return null;
  if (typeof raw === "object") return null;

  const text = String(raw).replace(/[$,\s]/g, "");
  if (!text || Number.isNaN(Number(text))) return null;
  return new Decimal(text);
}

/**
 * Ubica las columnas de mes leyendo los encabezados: en estas hojas cada mes
 * es una fecha real (2024-01-01, 2024-02-01, …), así que el rango de años se
 * deduce del archivo en lugar de quedar fijo en el código. Un archivo que
 * cubra otros años se importa igual, sin tocar nada acá.
 */
function findMonthColumns(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
): Map<number, (number | null)[]> {
  const byYear = new Map<number, (number | null)[]>();
  sheet.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, col) => {
    let value: unknown = cell.value;
    if (value && typeof value === "object" && "result" in value) {
      value = (value as ExcelJS.CellFormulaValue).result;
    }
    if (!(value instanceof Date)) return;
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth();
    if (!byYear.has(year)) byYear.set(year, Array(12).fill(null));
    byYear.get(year)![month] = col;
  });
  return byYear;
}

interface ExecutionRow {
  rowNumber: number;
  seriesCode: string;
  /** null cuando el paquete todavía no tiene contrato adjudicado. */
  contractNumber: string | null;
  contractorName: string | null;
  packageName: string;
  contractAmount: Decimal;
  byYear: Record<number, Decimal[]>;
}

/** Clave estable de un paquete, para cruzar la hoja de real contra la de programado. */
function packageKey(row: { seriesCode: string; contractNumber: string | null; packageName: string }) {
  return `${row.seriesCode}||${row.contractNumber ?? ""}||${row.packageName}`;
}

function parseExecutionSheet(
  sheet: ExcelJS.Worksheet,
  months: Map<number, (number | null)[]>,
): { rows: ExecutionRow[]; skipped: { rowNumber: number; reason: string }[] } {
  const rows: ExecutionRow[] = [];
  const skipped: { rowNumber: number; reason: string }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 3) return;

    const seriesCode = cellText(row, 1);
    if (!seriesCode) return; // fila vacía o de subtotal

    const packageName = cellText(row, 4);
    if (!packageName) {
      skipped.push({ rowNumber, reason: "Sin proyecto/paquete (columna D)." });
      return;
    }

    const rawContract = cellText(row, 2);
    const contractNumber =
      rawContract && !NO_CONTRACT_VALUES.has(rawContract.toLowerCase()) ? rawContract : null;

    const byYear: Record<number, Decimal[]> = {};
    for (const [year, cols] of months) {
      byYear[year] = cols.map((col) => (col ? (cellNumber(row, col) ?? new Decimal(0)) : new Decimal(0)));
    }

    rows.push({
      rowNumber,
      seriesCode: String(seriesCode).trim(),
      contractNumber,
      contractorName: (() => {
        const name = cellText(row, 3);
        return name && !NO_CONTRACT_VALUES.has(name.toLowerCase()) ? name : null;
      })(),
      packageName,
      contractAmount: cellNumber(row, 5) ?? new Decimal(0),
      byYear,
    });
  });

  return { rows, skipped };
}

function zeroMonths(): Decimal[] {
  return Array.from({ length: 12 }, () => new Decimal(0));
}

/**
 * Cruza programado contra real y consolida por número de contrato: un mismo
 * contrato puede aparecer en varias filas (paquetes de alcance distinto), y
 * ahí los montos se suman.
 *
 * Las filas sin contrato adjudicado no se descartan: llevan obra programada
 * real (en el archivo de ASUR, ~1.000 M de 2026) y se devuelven aparte para
 * que el importador las represente como producción por licitar.
 */
/** Mapa número de contrato → categoría, leído de la hoja maestra. */
function readCategories(sheet: ExcelJS.Worksheet | undefined): Map<string, string> {
  const byContract = new Map<string, string>();
  if (!sheet) return byContract;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= CATEGORY_HEADER_ROWS) return;
    const contract = cellText(row, CATEGORY_COL_CONTRACT);
    const category = cellText(row, CATEGORY_COL_CATEGORY);
    if (!contract || !category) return;
    if (NO_CONTRACT_VALUES.has(contract.toLowerCase())) return;
    if (!byContract.has(contract)) byContract.set(contract, category);
  });
  return byContract;
}

function buildExecution(
  scheduleSheet: ExcelJS.Worksheet,
  actualSheet: ExcelJS.Worksheet | undefined,
  categorySheet: ExcelJS.Worksheet | undefined,
  warnings: string[],
): ExecutionResult {
  const months = findMonthColumns(scheduleSheet, 3);
  if (months.size === 0) {
    throw new ImportError(
      `La hoja "${SCHEDULE_SHEET_NAME}" no tiene columnas de mes reconocibles en la fila 3 (se esperaban fechas).`,
    );
  }

  const incomplete = [...months.entries()]
    .filter(([, cols]) => cols.some((c) => c === null))
    .map(([year]) => year);
  if (incomplete.length > 0) {
    warnings.push(
      `En "${SCHEDULE_SHEET_NAME}" los años ${incomplete.join(", ")} no tienen los 12 meses; los faltantes se toman como cero.`,
    );
  }

  const { rows: scheduleRows, skipped } = parseExecutionSheet(scheduleSheet, months);

  const actualByKey = new Map<string, Record<number, Decimal[]>>();
  if (actualSheet) {
    const actualMonths = findMonthColumns(actualSheet, 3);
    const { rows: actualRows } = parseExecutionSheet(actualSheet, actualMonths);
    for (const row of actualRows) {
      const key = packageKey(row);
      const existing = actualByKey.get(key);
      if (!existing) {
        actualByKey.set(key, row.byYear);
        continue;
      }
      for (const [year, values] of Object.entries(row.byYear)) {
        const y = Number(year);
        existing[y] = (existing[y] ?? zeroMonths()).map((v, i) => v.plus(values[i]));
      }
    }
  } else {
    warnings.push(
      `El archivo no trae la hoja "${ACTUAL_SHEET_NAME}": se importa lo programado, pero la curva real queda vacía hasta que se registre la inversión.`,
    );
  }

  const categories = readCategories(categorySheet);
  const years = [...months.keys()].sort((a, b) => a - b);
  const contractMap = new Map<string, ImportedContract>();
  const pendingAwards: PendingAward[] = [];

  for (const row of scheduleRows) {
    const actual = actualByKey.get(packageKey(row));

    if (!row.contractNumber) {
      const hasSchedule = years.some((y) => row.byYear[y]?.some((v) => !v.isZero()));
      if (!hasSchedule) continue; // línea de alcance PMD sin programación: ya vino de "Datos PMD"
      pendingAwards.push({
        rowNumber: row.rowNumber,
        seriesCode: row.seriesCode,
        packageName: row.packageName,
        scheduleByYear: Object.fromEntries(
          years.map((y) => [y, (row.byYear[y] ?? zeroMonths()).map((v) => v.toFixed(2))]),
        ),
      });
      continue;
    }

    let entry = contractMap.get(row.contractNumber);
    if (!entry) {
      entry = {
        contractNumber: row.contractNumber,
        seriesCode: row.seriesCode,
        contractorName: row.contractorName,
        name: row.packageName,
        category: categories.get(row.contractNumber) ?? null,
        contractAmount: "0",
        scheduleByYear: Object.fromEntries(years.map((y) => [y, zeroMonths().map((v) => v.toFixed(2))])),
        actualByYear: Object.fromEntries(years.map((y) => [y, zeroMonths().map((v) => v.toFixed(2))])),
        rowNumbers: [],
      };
      contractMap.set(row.contractNumber, entry);
    }

    if (entry.seriesCode !== row.seriesCode) {
      skipped.push({
        rowNumber: row.rowNumber,
        reason: `El contrato ${row.contractNumber} aparece en las series ${entry.seriesCode} y ${row.seriesCode}; un contrato pertenece a una sola serie. Se mantuvo ${entry.seriesCode}.`,
      });
      continue;
    }

    entry.contractAmount = new Decimal(entry.contractAmount).plus(row.contractAmount).toFixed(2);
    entry.rowNumbers.push(row.rowNumber);
    entry.contractorName ??= row.contractorName;
    for (const year of years) {
      const planned = row.byYear[year] ?? zeroMonths();
      entry.scheduleByYear[year] = entry.scheduleByYear[year].map((v, i) =>
        new Decimal(v).plus(planned[i]).toFixed(2),
      );
      const spent = actual?.[year] ?? zeroMonths();
      entry.actualByYear[year] = entry.actualByYear[year].map((v, i) =>
        new Decimal(v).plus(spent[i]).toFixed(2),
      );
    }
  }

  const contracts = [...contractMap.values()].sort((a, b) =>
    a.contractNumber.localeCompare(b.contractNumber),
  );

  const sumYear = (pick: (c: ImportedContract) => Record<number, string[]>) =>
    Object.fromEntries(
      years.map((year) => [
        year,
        contracts
          .reduce(
            (acc, c) => acc.plus(pick(c)[year].reduce((s, v) => s.plus(v), new Decimal(0))),
            new Decimal(0),
          )
          .toFixed(2),
      ]),
    );

  return {
    years,
    contracts,
    pendingAwards,
    skipped,
    totals: {
      scheduleByYear: sumYear((c) => c.scheduleByYear),
      actualByYear: sumYear((c) => c.actualByYear),
    },
  };
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

  const warnings: string[] = [];
  const scheduleSheet = workbook.getWorksheet(SCHEDULE_SHEET_NAME);
  const execution = scheduleSheet
    ? buildExecution(
        scheduleSheet,
        workbook.getWorksheet(ACTUAL_SHEET_NAME),
        workbook.getWorksheet(CATEGORY_SHEET_NAME),
        warnings,
      )
    : null;

  if (!execution) {
    warnings.push(
      `El archivo no trae la hoja "${SCHEDULE_SHEET_NAME}", que es la que aporta contratos y programación mensual. Se importan las series, pero Resumen, Dashboard y Programación quedarán sin datos hasta cargar los contratos.`,
    );
  }

  return { lines, series, escalationFactors, skipped, totals, execution, warnings };
}
