import { Decimal } from "decimal.js";

/**
 * Avance programado acumulado "a la fecha" para un año PMD: si el año ya
 * terminó, es la suma de los 12 meses; si es el año en curso, la suma de
 * enero al mes actual; si es un año futuro, cero (todavía no arranca).
 */
export function cumulativeToDate(
  year: number,
  months: Decimal.Value[],
  now: Date = new Date(),
): Decimal {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let monthsToSum: Decimal.Value[];
  if (year < currentYear) {
    monthsToSum = months;
  } else if (year > currentYear) {
    monthsToSum = [];
  } else {
    monthsToSum = months.slice(0, currentMonth);
  }

  return monthsToSum.reduce((acc: Decimal, m) => acc.plus(new Decimal(m)), new Decimal(0));
}
