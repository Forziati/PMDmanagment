import { Decimal } from "decimal.js";

/**
 * Motor de descuadre de la programación mensual (BUSINESS_RULES.md §2 /
 * sección 6.4 y 0.2 del prompt maestro). No decide bloquear ni permitir —
 * solo calcula la diferencia y una sugerencia de ajuste; quien llama decide
 * si exige confirmación antes de persistir.
 */

export interface MonthlyImbalance {
  sum: string;
  target: string;
  difference: string;
}

export interface MonthlyAdjustmentSuggestion {
  month: number; // 1-12
  currentAmount: string;
  suggestedAmount: string;
}

export function sumMonths(months: Decimal.Value[]): Decimal {
  return months.reduce((acc: Decimal, m) => acc.plus(new Decimal(m)), new Decimal(0));
}

export function computeImbalance(
  months: Decimal.Value[],
  target: Decimal.Value,
): MonthlyImbalance | null {
  const sum = sumMonths(months);
  const targetDecimal = new Decimal(target);
  const difference = sum.minus(targetDecimal);
  if (difference.isZero()) return null;
  return {
    sum: sum.toString(),
    target: targetDecimal.toString(),
    difference: difference.toString(),
  };
}

/**
 * Sugerencia de ajuste automático: corrige el último mes con monto distinto
 * de cero (o diciembre si los 12 están en cero) para que la suma cuadre
 * exactamente con el objetivo anual.
 */
export function suggestAdjustment(
  months: Decimal.Value[],
  imbalance: MonthlyImbalance,
): MonthlyAdjustmentSuggestion {
  const decimals = months.map((m) => new Decimal(m));
  let targetMonthIndex = decimals.findLastIndex((m) => !m.isZero());
  if (targetMonthIndex === -1) targetMonthIndex = 11;

  const current = decimals[targetMonthIndex];
  const suggested = current.minus(new Decimal(imbalance.difference));

  return {
    month: targetMonthIndex + 1,
    currentAmount: current.toString(),
    suggestedAmount: suggested.toString(),
  };
}
