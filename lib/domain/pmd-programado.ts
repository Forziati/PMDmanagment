import { Decimal } from "decimal.js";

/**
 * Agregación de la vista "PMD Programado" — espejo de la hoja "PMD 24-28"
 * del Excel: una fila por código de serie, con el desglose por año del ciclo.
 */

export interface PmdProgramadoInputSeries {
  code: string;
  name: string;
  year: number;
  authorizedAmount: Decimal.Value;
  updatedAmount: Decimal.Value;
}

export interface PmdProgramadoRow {
  code: string;
  name: string;
  authorizedAmount: Decimal;
  updatedAmount: Decimal;
  byYear: Record<number, Decimal>;
}

export interface PmdProgramadoMatrix {
  years: number[];
  rows: PmdProgramadoRow[];
  totalAuthorized: Decimal;
  totalUpdated: Decimal;
  totalByYear: Record<number, Decimal>;
}

/**
 * Una serie existe una vez por año (PmdSeries es year-scoped), así que la
 * fila del código agrupa esas instancias: `updatedAmount` de cada año va a
 * su columna, y "Anexo 6" / "PMD actualizado" son la suma de todos los años.
 */
export function buildPmdProgramadoMatrix(
  series: PmdProgramadoInputSeries[],
  years: number[],
): PmdProgramadoMatrix {
  const byCode = new Map<string, PmdProgramadoRow>();

  for (const item of series) {
    let row = byCode.get(item.code);
    if (!row) {
      row = {
        code: item.code,
        name: item.name,
        authorizedAmount: new Decimal(0),
        updatedAmount: new Decimal(0),
        byYear: Object.fromEntries(years.map((y) => [y, new Decimal(0)])),
      };
      byCode.set(item.code, row);
    }

    row.authorizedAmount = row.authorizedAmount.plus(item.authorizedAmount);
    row.updatedAmount = row.updatedAmount.plus(item.updatedAmount);
    if (item.year in row.byYear) {
      row.byYear[item.year] = row.byYear[item.year].plus(item.updatedAmount);
    }
  }

  const rows = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, "es"));

  return {
    years,
    rows,
    totalAuthorized: rows.reduce((acc, r) => acc.plus(r.authorizedAmount), new Decimal(0)),
    totalUpdated: rows.reduce((acc, r) => acc.plus(r.updatedAmount), new Decimal(0)),
    totalByYear: Object.fromEntries(
      years.map((y) => [y, rows.reduce((acc, r) => acc.plus(r.byYear[y]), new Decimal(0))]),
    ),
  };
}

export interface PmdProgramadoSlice {
  code: string;
  name: string;
  amount: Decimal;
}

export const OTROS_SLICE_CODE = "OTROS";

/**
 * Reparto por serie para el gráfico de pastel de un año. Se agrupan en
 * "Otros" las series por debajo de `minShare` y las que excedan `maxMajor`
 * rebanadas — ese tope es el largo de la paleta categórica validada, para
 * que ECharts nunca la recicle y dos rebanadas terminen del mismo color.
 */
export function buildYearPieSlices(
  matrix: PmdProgramadoMatrix,
  year: number,
  minShare = 0.03,
  maxMajor = 4,
): PmdProgramadoSlice[] {
  const total = matrix.totalByYear[year];
  if (!total || total.isZero()) return [];

  const sorted = matrix.rows
    .map((r) => ({ code: r.code, name: r.name, amount: r.byYear[year] }))
    .filter((s) => s.amount.greaterThan(0))
    .sort((a, b) => b.amount.comparedTo(a.amount));

  const significant = sorted.filter((s) =>
    s.amount.dividedBy(total).greaterThanOrEqualTo(minShare),
  );

  const major = significant.slice(0, maxMajor);
  const minor = sorted.slice(major.length);

  if (minor.length === 0) return major;

  return [
    ...major,
    {
      code: OTROS_SLICE_CODE,
      name: `Otros (${minor.map((s) => s.code).join(", ")})`,
      amount: minor.reduce((acc, s) => acc.plus(s.amount), new Decimal(0)),
    },
  ];
}
