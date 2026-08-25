import { Decimal } from "decimal.js";

import { prisma } from "@/lib/db";
import { percentageDeviation } from "@/lib/money";
import { cumulativeToDate } from "@/lib/domain/resumen";
import { REAL_STATUSES, indexRealByContractSeries, realKey } from "@/lib/domain/inversion-real";
import { allocationKey, emptyMonths, plannedMonthsByAllocation } from "@/lib/domain/programado";

/**
 * Detección automática de contratos desfasados.
 *
 * Un contrato que a la fecha se aparta más del umbral de lo que tenía
 * programado es un riesgo aunque nadie lo haya cargado a mano: o va atrasado
 * (no se está ejecutando la inversión comprometida) o va sobregirado. Estos
 * desvíos se calculan cada vez que se abre la pantalla, así que siguen a los
 * datos en lugar de quedar congelados en un registro.
 */

/** Umbral de desvío a partir del cual el contrato entra a Riesgos. */
export const DESVIO_UMBRAL = new Decimal("0.05");

export const DESVIO_UMBRAL_LABEL = "5%";

export interface DesvioDetectado {
  contractId: string;
  pmdSeriesId: string;
  year: number;
  programmed: Decimal;
  actual: Decimal;
  /** Real − programado: negativo es atraso, positivo es sobregiro. */
  deviation: Decimal;
  /** null cuando no había nada programado contra qué medir. */
  deviationPercent: Decimal | null;
  exceedsThreshold: boolean;
}

/**
 * Impacto sugerido para la matriz PMI, según cuánto se aparta el contrato.
 * Es un punto de partida editable, no una imposición.
 */
export function impactoSugerido(percent: Decimal | null): number {
  if (!percent) return 3;
  const abs = percent.abs();
  if (abs.greaterThanOrEqualTo("0.50")) return 5;
  if (abs.greaterThanOrEqualTo("0.30")) return 4;
  if (abs.greaterThanOrEqualTo("0.15")) return 3;
  return 2;
}

/**
 * El año contra el que se mide: el PMD del año en curso si existe, y si no
 * el último ya empezado. Un año futuro no tiene nada programado "a la fecha",
 * así que compararlo no diría nada.
 */
export function anioDeControl<T extends { id: string; year: number }>(
  pmdYears: T[],
  today: Date = new Date(),
): T | null {
  if (pmdYears.length === 0) return null;
  const currentYear = today.getFullYear();
  const exact = pmdYears.find((y) => y.year === currentYear);
  if (exact) return exact;
  const started = pmdYears.filter((y) => y.year < currentYear).sort((a, b) => b.year - a.year);
  return started[0] ?? pmdYears[0];
}

/** Desvío a la fecha de cada asignación contrato-serie de un año PMD. */
export async function desviosDelAnio(
  clientId: string,
  pmdYear: { id: string; year: number },
  today: Date = new Date(),
): Promise<Map<string, DesvioDetectado>> {
  const [allocations, plannedByAllocation, realRecords] = await Promise.all([
    prisma.contractSeriesAllocation.findMany({
      where: { pmdSeries: { pmdYearId: pmdYear.id }, contract: { clientId } },
      select: { contractId: true, pmdSeriesId: true },
    }),
    plannedMonthsByAllocation(pmdYear.id, pmdYear.year),
    prisma.actualInvestment.findMany({
      where: {
        contract: { clientId },
        pmdSeries: { pmdYearId: pmdYear.id },
        periodYear: pmdYear.year,
        status: { in: REAL_STATUSES },
      },
      select: {
        contractId: true,
        pmdSeriesId: true,
        periodMonth: true,
        recognizablePmdAmount: true,
      },
    }),
  ]);

  const realIndex = indexRealByContractSeries(
    realRecords.map((r) => ({
      contractId: r.contractId,
      pmdSeriesId: r.pmdSeriesId,
      periodMonth: r.periodMonth,
      recognizablePmdAmount: r.recognizablePmdAmount.toString(),
    })),
  );

  const byContract = new Map<string, DesvioDetectado>();
  for (const allocation of allocations) {
    const key = allocationKey(allocation.contractId, allocation.pmdSeriesId);
    const months = plannedByAllocation.get(key)?.months ?? emptyMonths();
    const programmed = cumulativeToDate(pmdYear.year, months, today);

    const realMonths =
      realIndex.get(realKey(allocation.contractId, allocation.pmdSeriesId)) ??
      Array.from({ length: 12 }, () => new Decimal(0));
    const actual = cumulativeToDate(pmdYear.year, realMonths, today);

    const deviation = actual.minus(programmed);
    const deviationPercent = percentageDeviation(deviation, programmed);

    byContract.set(allocation.contractId, {
      contractId: allocation.contractId,
      pmdSeriesId: allocation.pmdSeriesId,
      year: pmdYear.year,
      programmed,
      actual,
      deviation,
      deviationPercent,
      // Sin nada programado no hay porcentaje posible: se toma como desvío
      // solo si igual se erogó plata, que es un desfase por sí mismo.
      exceedsThreshold: deviationPercent
        ? deviationPercent.abs().greaterThan(DESVIO_UMBRAL)
        : !actual.isZero(),
    });
  }

  return byContract;
}
