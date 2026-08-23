import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireClientScopedPermission } from "@/lib/api/context";

/** Solo lectura — se usa para poblar selectores de año PMD en los formularios. */
export async function GET() {
  const auth = await requireClientScopedPermission("SERIES.VER");
  if (auth.response) return auth.response;

  const pmdYears = await prisma.pmdYear.findMany({
    where: { pmdCycle: { airport: { clientId: auth.clientId } } },
    include: { pmdCycle: { include: { airport: true } }, annualTarget: true },
    orderBy: { year: "asc" },
  });

  return NextResponse.json(
    pmdYears.map((py) => ({
      id: py.id,
      year: py.year,
      escalationFactor: py.escalationFactor,
      annualTargetLocked: py.annualTarget?.locked ?? null,
      cycleCode: py.pmdCycle.code,
      airportName: py.pmdCycle.airport.name,
      airportIataCode: py.pmdCycle.airport.iataCode,
    })),
  );
}
