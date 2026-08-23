import { Decimal } from "decimal.js";

/**
 * Etapas ya adjudicadas ("Producción contratada") vs. aún no adjudicadas
 * ("Producción por licitar") — mapeo usado para el desglose del faltante
 * del PPTX de GAP (slide 6), ya que el sistema no captura hoy esas
 * categorías directamente (DESIGN_BASELINE.md, ambigüedad §6).
 */
export const AWARDED_STAGES = new Set([
  "CONTRATADO",
  "EJECUCION",
  "SUSPENDIDO",
  "TERMINADO",
  "CERRADO",
]);

export function isAwardedStage(stage: string): boolean {
  return AWARDED_STAGES.has(stage);
}

/** Meses restantes del año a partir de hoy (inclusive), para la sección "faltante". */
export function remainingMonths(year: number, now: Date = new Date()): number[] {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return [];
  if (year > currentYear) return Array.from({ length: 12 }, (_, i) => i + 1);
  const months: number[] = [];
  for (let m = currentMonth + 1; m <= 12; m++) months.push(m);
  return months;
}

/** Suma elemento a elemento de varios arreglos de 12 meses. */
export function sumMonthlyArrays(arrays: Decimal.Value[][]): Decimal[] {
  const totals = Array.from({ length: 12 }, () => new Decimal(0));
  for (const months of arrays) {
    months.forEach((m, i) => {
      totals[i] = totals[i].plus(new Decimal(m));
    });
  }
  return totals;
}

/** Acumulado corrido mes a mes (para "Acumulado programado/real/balance"). */
export function runningTotal(months: Decimal.Value[]): Decimal[] {
  let running = new Decimal(0);
  return months.map((m) => {
    running = running.plus(new Decimal(m));
    return running;
  });
}
