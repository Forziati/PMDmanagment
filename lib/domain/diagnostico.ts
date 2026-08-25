import { prisma } from "@/lib/db";

/**
 * Por qué una pantalla de control no tiene cifras.
 *
 * El control encadena cuatro capas: series → contratos → asignación de cada
 * contrato a su serie → programación mensual aprobada. Si falta cualquiera,
 * las pantallas quedan en cero. Mostrar "$0.00" en ese caso hace pensar que
 * el PMD no tiene plata, cuando lo que pasa es que falta cargar un eslabón:
 * este diagnóstico dice cuál.
 */

export interface Diagnostico {
  /** Frase corta que encabeza el aviso. */
  titulo: string;
  /** Qué falta, en orden de lo que hay que hacer primero. */
  detalles: string[];
  /** A dónde ir a resolverlo. */
  accion: { href: string; label: string } | null;
}

export interface DiagnosticoInput {
  pmdYearId: string;
  year: number;
  /** Etiqueta del año elegido, para nombrarlo en el mensaje. */
  yearLabel: string;
}

export async function diagnosticarAnio({
  pmdYearId,
  year,
  yearLabel,
}: DiagnosticoInput): Promise<Diagnostico | null> {
  const [seriesCount, allocationCount, scheduleCount, otherYearsWithAllocations] = await Promise.all(
    [
      prisma.pmdSeries.count({ where: { pmdYearId } }),
      prisma.contractSeriesAllocation.count({ where: { pmdSeries: { pmdYearId } } }),
      prisma.monthlySchedule.count({
        where: { pmdSeries: { pmdYearId }, periodYear: year, scheduleVersion: { status: "APROBADO" } },
      }),
      prisma.pmdSeries.findMany({
        where: { pmdYearId: { not: pmdYearId }, allocations: { some: {} } },
        select: { pmdYear: { select: { year: true } } },
        distinct: ["pmdYearId"],
      }),
    ],
  );

  if (seriesCount === 0) {
    return {
      titulo: `No hay series PMD cargadas para ${yearLabel}.`,
      detalles: [
        "Sin series no hay presupuesto contra el cual comparar nada.",
        "Importá el Excel de Cash Flow: de ahí salen las series, los contratos y la programación mensual.",
      ],
      accion: { href: "/importar", label: "Ir a Importar" },
    };
  }

  if (allocationCount === 0) {
    const disponibles = [...new Set(otherYearsWithAllocations.map((s) => s.pmdYear.year))].sort();
    const detalles = [
      `Hay ${seriesCount} serie${seriesCount === 1 ? "" : "s"} con su presupuesto, pero ningún contrato asignado a ${yearLabel}.`,
      "Estas pantallas comparan contrato por contrato: sin contratos no hay nada que sumar, por eso figura en cero y no porque el PMD esté vacío.",
    ];
    if (disponibles.length > 0) {
      detalles.push(`Los años con contratos cargados son: ${disponibles.join(", ")}.`);
    } else {
      detalles.push(
        'Si el Excel tiene la hoja "Proyeccion x mes", volvé a importarlo: esa hoja es la que trae los contratos y su programación.',
      );
    }
    return {
      titulo: `Faltan contratos para ${yearLabel}.`,
      detalles,
      accion:
        disponibles.length > 0
          ? { href: "/contratos", label: "Ver contratos" }
          : { href: "/importar", label: "Ir a Importar" },
    };
  }

  if (scheduleCount === 0) {
    return {
      titulo: `Los contratos de ${yearLabel} no tienen programación mensual aprobada.`,
      detalles: [
        `Hay ${allocationCount} contrato${allocationCount === 1 ? "" : "s"} asignado${allocationCount === 1 ? "" : "s"} a una serie, pero ninguno con meses cargados y aprobados.`,
        "El avance programado sale de esa distribución mensual; sin ella la curva no se puede calcular.",
      ],
      accion: { href: "/programacion", label: "Ir a Programación" },
    };
  }

  return null;
}
