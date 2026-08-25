import { prisma } from "@/lib/db";

/**
 * Programación vigente de un año, para todas las asignaciones contrato-serie
 * de una sola vez.
 *
 * Antes cada fila consultaba su propia versión aprobada. Con un PMD real eso
 * son cientos de consultas secuenciales por pantalla: imperceptible contra una
 * base local, varios segundos contra una remota.
 */

export function allocationKey(contractId: string, pmdSeriesId: string): string {
  return `${contractId}|${pmdSeriesId}`;
}

export function emptyMonths(): string[] {
  return Array.from({ length: 12 }, () => "0");
}

export interface PlannedAllocation {
  months: string[];
  hasImbalance: boolean;
}

export async function plannedMonthsByAllocation(
  pmdYearId: string,
  year: number,
): Promise<Map<string, PlannedAllocation>> {
  const versions = await prisma.scheduleVersion.findMany({
    where: { status: "APROBADO", pmdSeries: { pmdYearId } },
    select: {
      contractId: true,
      pmdSeriesId: true,
      monthlySchedules: {
        where: { periodYear: year },
        select: { periodMonth: true, plannedAmount: true, imbalanceFlag: true },
      },
    },
    // Se recorren de la más vieja a la más nueva y gana la última: la vigente
    // es la última versión aprobada de esa asignación.
    orderBy: { createdAt: "asc" },
  });

  const byAllocation = new Map<string, PlannedAllocation>();
  for (const version of versions) {
    if (!version.contractId || !version.pmdSeriesId) continue;
    const months = emptyMonths();
    for (const row of version.monthlySchedules) {
      months[row.periodMonth - 1] = row.plannedAmount.toString();
    }
    byAllocation.set(allocationKey(version.contractId, version.pmdSeriesId), {
      months,
      hasImbalance: version.monthlySchedules.some((row) => row.imbalanceFlag),
    });
  }
  return byAllocation;
}
