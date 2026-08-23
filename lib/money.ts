import { Decimal } from "decimal.js";

/**
 * Utilidades de presentación monetaria (BUSINESS_RULES.md §5). El dato se
 * almacena y calcula siempre en Decimal/NUMERIC; estas funciones solo
 * formatean para mostrar — nunca redondean el valor persistido.
 */

export type MoneyInput = Decimal | Decimal.Value | null | undefined;

function toDecimal(value: MoneyInput): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return value instanceof Decimal ? value : new Decimal(value);
}

const PESOS_FORMATTER = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MDP_FORMATTER = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `$1,234,567.89` */
export function formatPesos(value: MoneyInput): string {
  const decimal = toDecimal(value);
  return PESOS_FORMATTER.format(decimal.toNumber());
}

/** `$1,234.57 MDP` (millones de pesos, factor 1,000,000) */
export function formatMdp(value: MoneyInput): string {
  const decimal = toDecimal(value).dividedBy(1_000_000);
  return `$${MDP_FORMATTER.format(decimal.toNumber())} MDP`;
}

/** Suma segura en Decimal de una lista de montos posiblemente nulos. */
export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce((acc: Decimal, v) => acc.plus(toDecimal(v)), new Decimal(0));
}

/** Desviación porcentual = desviación monetaria / programado acumulado. */
export function percentageDeviation(
  deviation: MoneyInput,
  base: MoneyInput,
): Decimal | null {
  const baseDecimal = toDecimal(base);
  if (baseDecimal.isZero()) return null;
  return toDecimal(deviation).dividedBy(baseDecimal);
}

export function formatPercentage(value: Decimal | null): string {
  if (value === null) return "N/A";
  return `${value.times(100).toFixed(1)}%`;
}
