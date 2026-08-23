import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

/**
 * Catálogos y datos mínimos para desarrollo local. Todo lo marcado como
 * "confirmado" proviene literalmente del Excel de ASUR / PPTX de GAP
 * (ver DATA_DICTIONARY.md §3); lo demás es de ejemplo para poder navegar
 * la aplicación durante el desarrollo del MVP.
 */

const ROLES = [
  { code: "ADMIN", name: "Administrador" },
  { code: "DIRECTOR_PMO", name: "Director PMO" },
  { code: "CONTROL_PRESUPUESTAL", name: "Control Presupuestal" },
  { code: "PLANIFICADOR", name: "Planificador" },
  { code: "CONTRATOS", name: "Contratos" },
  { code: "RIESGOS", name: "Riesgos" },
  { code: "CAPTURISTA", name: "Capturista" },
  { code: "REVISOR", name: "Revisor" },
  { code: "APROBADOR", name: "Aprobador" },
  { code: "CONSULTA_EJECUTIVA", name: "Consulta Ejecutiva" },
  { code: "AUDITOR", name: "Auditor" },
] as const;

const MODULES = [
  "SERIES",
  "CONTRATOS",
  "PROGRAMACION",
  "INVERSION_REAL",
  "RIESGOS",
  "HITOS",
  "AUTORIZACIONES",
  "AUDITORIA",
  "ADMINISTRACION",
  "CALIDAD",
] as const;

const ACTIONS = ["VER", "CREAR", "EDITAR", "APROBAR"] as const;

/** Matriz de permisos por defecto — ajustable luego desde Administración. */
const ROLE_PERMISSIONS: Record<(typeof ROLES)[number]["code"], string[]> = {
  ADMIN: MODULES.flatMap((m) => ACTIONS.map((a) => `${m}.${a}`)),
  DIRECTOR_PMO: MODULES.flatMap((m) => ACTIONS.map((a) => `${m}.${a}`)),
  CONTROL_PRESUPUESTAL: [
    "SERIES.VER", "SERIES.CREAR", "SERIES.EDITAR",
    "PROGRAMACION.VER", "PROGRAMACION.CREAR", "PROGRAMACION.EDITAR",
    "INVERSION_REAL.VER", "INVERSION_REAL.APROBAR",
    "CALIDAD.VER",
  ],
  PLANIFICADOR: [
    "SERIES.VER", "PROGRAMACION.VER", "PROGRAMACION.CREAR", "PROGRAMACION.EDITAR",
    "HITOS.VER", "HITOS.CREAR", "HITOS.EDITAR",
  ],
  CONTRATOS: [
    "CONTRATOS.VER", "CONTRATOS.CREAR", "CONTRATOS.EDITAR",
    "SERIES.VER",
  ],
  RIESGOS: [
    "RIESGOS.VER", "RIESGOS.CREAR", "RIESGOS.EDITAR",
    "HITOS.VER",
  ],
  CAPTURISTA: [
    "INVERSION_REAL.VER", "INVERSION_REAL.CREAR",
    "PROGRAMACION.VER", "PROGRAMACION.CREAR",
  ],
  REVISOR: [
    "INVERSION_REAL.VER", "PROGRAMACION.VER", "CALIDAD.VER",
  ],
  APROBADOR: [
    "INVERSION_REAL.VER", "INVERSION_REAL.APROBAR",
    "AUTORIZACIONES.VER", "AUTORIZACIONES.APROBAR",
  ],
  CONSULTA_EJECUTIVA: MODULES.map((m) => `${m}.VER`),
  AUDITOR: ["AUDITORIA.VER", "CALIDAD.VER"],
};

const INVESTMENT_GROUPS = [
  { code: "DISENO", name: "Diseño" },
  { code: "OBRA", name: "Obra" },
  { code: "PROCURA", name: "Procura" },
  { code: "DIR_PROYECTO_STE", name: "Dirección de Proyecto/STE" },
  { code: "OTROS", name: "Otros" },
] as const;

/** Catálogo "Categorías" — confirmado, `Listas desplegables!A3:A14` del Excel ASUR. */
const EXPENSE_CATEGORIES = [
  "Preliminares",
  "Obras Inducidas",
  "Obra Nueva",
  "Infraestructura",
  "Equip. Edificio",
  "Equip. IT",
  "Mobiliario",
  "Equip. Aeroportuario",
  "BHS",
  "Seguridad",
  "Diseño",
  "Dirección proyecto y STE",
];

/**
 * Catálogo "Origen del Costo" — confirmado, `Listas desplegables!B3:B11` del
 * Excel ASUR. Incluye el valor atípico "CERRADO" tal cual aparece en la
 * fuente (mezcla nivel de definición con estado contractual — ver
 * DESIGN_BASELINE.md, ambigüedad §3). Se conserva sin "corregir" el dato de
 * origen; la separación en dos catálogos queda para cuando el cliente lo
 * confirme.
 */
const COST_ORIGINS = [
  "8-PMD",
  "7-Pres. Diseñador",
  "6-Estimación In House",
  "5-Pres. ASUR",
  "4-Presupuesto DC",
  "3-Cotización",
  "2-Licitación",
  "1-Contrato",
  "CERRADO",
];

/** Niveles de riesgo — solo los observados en el PPTX de GAP (slides 7-8). */
const RISK_LEVELS = ["ALTO", "MEDIO"];

async function main() {
  console.log("Sembrando roles y permisos...");

  const permissionRecords = await Promise.all(
    MODULES.flatMap((module) =>
      ACTIONS.map((action) =>
        prisma.permission.upsert({
          where: { code: `${module}.${action}` },
          update: {},
          create: {
            code: `${module}.${action}`,
            module,
            action,
          },
        }),
      ),
    ),
  );
  const permissionByCode = new Map(permissionRecords.map((p) => [p.code, p.id]));

  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name },
      create: { code: roleDef.code, name: roleDef.name },
    });

    const grantedCodes = ROLE_PERMISSIONS[roleDef.code] ?? [];
    for (const code of grantedCodes) {
      const permissionId = permissionByCode.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  console.log("Sembrando cliente de ejemplo (ASUR / Cancún)...");

  const client = await prisma.client.upsert({
    where: { code: "ASUR" },
    update: {},
    create: {
      code: "ASUR",
      name: "Grupo Aeroportuario del Sureste",
      currencyDefault: "MXN",
    },
  });

  for (const group of INVESTMENT_GROUPS) {
    await prisma.investmentGroup.upsert({
      where: { clientId_code: { clientId: client.id, code: group.code } },
      update: { name: group.name },
      create: { clientId: client.id, code: group.code, name: group.name },
    });
  }

  for (const [i, label] of EXPENSE_CATEGORIES.entries()) {
    await prisma.catalogValue.upsert({
      where: {
        clientId_catalogType_code: {
          clientId: client.id,
          catalogType: "EXPENSE_CATEGORY",
          code: label,
        },
      },
      update: {},
      create: {
        clientId: client.id,
        catalogType: "EXPENSE_CATEGORY",
        code: label,
        label,
        sortOrder: i,
      },
    });
  }

  for (const [i, label] of COST_ORIGINS.entries()) {
    await prisma.catalogValue.upsert({
      where: {
        clientId_catalogType_code: {
          clientId: client.id,
          catalogType: "COST_ORIGIN",
          code: label,
        },
      },
      update: {},
      create: {
        clientId: client.id,
        catalogType: "COST_ORIGIN",
        code: label,
        label,
        sortOrder: i,
      },
    });
  }

  for (const [i, label] of RISK_LEVELS.entries()) {
    await prisma.catalogValue.upsert({
      where: {
        clientId_catalogType_code: {
          clientId: client.id,
          catalogType: "RISK_LEVEL",
          code: label,
        },
      },
      update: {},
      create: {
        clientId: client.id,
        catalogType: "RISK_LEVEL",
        code: label,
        label,
        sortOrder: i,
      },
    });
  }

  const airport = await prisma.airport.upsert({
    where: { clientId_iataCode: { clientId: client.id, iataCode: "CUN" } },
    update: {},
    create: {
      clientId: client.id,
      iataCode: "CUN",
      name: "Aeropuerto Internacional de Cancún",
    },
  });

  const cycle = await prisma.pmdCycle.upsert({
    where: { airportId_code: { airportId: airport.id, code: "PMD 2024-2028" } },
    update: {},
    create: {
      airportId: airport.id,
      code: "PMD 2024-2028",
      startYear: 2024,
      endYear: 2028,
    },
  });

  // Factores de escalación confirmados: CashFlow!I4,K4,M4,O4,Q4 del Excel ASUR.
  const escalationFactors: Record<number, string> = {
    2024: "1.0733085877599",
    2025: "1.11508599314582",
    2026: "1.155",
    2027: "1.21275",
    2028: "1.2733875000000001",
  };

  for (let year = 2024; year <= 2028; year++) {
    await prisma.pmdYear.upsert({
      where: { pmdCycleId_year: { pmdCycleId: cycle.id, year } },
      update: {},
      create: {
        pmdCycleId: cycle.id,
        year,
        escalationFactor: escalationFactors[year],
      },
    });
  }

  console.log("Sembrando usuario administrador de desarrollo...");

  const adminPasswordHash = await argon2.hash("ChangeMe123!");
  await prisma.user.upsert({
    where: { email: "admin@pmdcontrolhub.local" },
    update: {},
    create: {
      email: "admin@pmdcontrolhub.local",
      passwordHash: adminPasswordHash,
      fullName: "Administrador PMD Control Hub",
      clientId: client.id,
      roles: {
        create: [
          {
            role: { connect: { code: "ADMIN" } },
          },
        ],
      },
    },
  });

  console.log("Seed completado.");
  console.log("Usuario de desarrollo: admin@pmdcontrolhub.local / ChangeMe123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
