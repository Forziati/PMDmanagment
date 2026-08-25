import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";
import type { Prisma } from "@prisma/client";

import type { ExecutionResult, ImportedContract } from "./excel-pmd";

/**
 * Vuelca la capa de ejecución del Excel (contratos, programación mensual y
 * erogación real) a la base.
 *
 * Todo se escribe en lote con identificadores generados acá: un contrato de
 * ASUR produce ~200 contratos × 3 años × 12 meses de programación, y hacerlo
 * fila por fila serían miles de viajes de ida y vuelta contra la base —
 * inviable contra una base remota dentro de una transacción.
 */

/** Marca las versiones de programación creadas por el importador, para poder rehacerlas sin tocar las cargadas a mano. */
const IMPORT_MARKER = "[import-excel]";

/**
 * Categoría del Excel → grupo de inversión del sistema. Es un valor por
 * defecto para que el Dashboard abra desglosado en vez de con todo en
 * "Sin grupo"; queda editable contrato por contrato desde Contratos.
 */
const CATEGORY_TO_GROUP: Record<string, string> = {
  "diseño": "Diseño",
  "obra": "Obra",
  "obra nueva": "Obra",
  "preliminares": "Obra",
  "obras inducidas": "Obra",
  "infraestructura": "Obra",
  "bhs": "Procura",
  "equip. aeroportuario": "Procura",
  "equip. edificio": "Procura",
  "equip. it": "Procura",
  "mobiliario": "Procura",
  "seguridad": "Procura",
  "gerencia y ste": "Dirección de Proyecto/STE",
};

export interface ExecutionWriteResult {
  companiesCreated: number;
  contractsCreated: number;
  contractsUpdated: number;
  allocationsWritten: number;
  scheduleRowsWritten: number;
  actualRowsWritten: number;
  /** Periodos que ya tenían inversión registrada: no se sobrescriben. */
  actualRowsPreserved: number;
  pendingAwardContracts: number;
  /** Años del Excel que no tienen serie cargada, así que no se pudo programar. */
  yearsWithoutSeries: number[];
  /** Categorías del Excel sin equivalencia en los grupos de inversión. */
  unmappedCategories: string[];
}

type Tx = Prisma.TransactionClient;

function sum(values: string[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), new Decimal(0));
}

/**
 * Los paquetes sin contrato adjudicado no se descartan: llevan obra
 * programada real. Se agrupan en un contrato marcador por serie, en etapa
 * "En definición" — que es como el sistema ya representa la producción por
 * licitar en el Dashboard.
 */
function buildPendingAwardContracts(execution: ExecutionResult): ImportedContract[] {
  const bySeries = new Map<string, ImportedContract>();
  for (const pending of execution.pendingAwards) {
    let entry = bySeries.get(pending.seriesCode);
    if (!entry) {
      entry = {
        contractNumber: `POR LICITAR ${pending.seriesCode}`,
        seriesCode: pending.seriesCode,
        contractorName: null,
        name: `Paquetes por licitar — serie ${pending.seriesCode}`,
        category: null,
        contractAmount: "0",
        scheduleByYear: Object.fromEntries(
          execution.years.map((y) => [y, Array.from({ length: 12 }, () => "0.00")]),
        ),
        actualByYear: Object.fromEntries(
          execution.years.map((y) => [y, Array.from({ length: 12 }, () => "0.00")]),
        ),
        rowNumbers: [],
      };
      bySeries.set(pending.seriesCode, entry);
    }
    entry.rowNumbers.push(pending.rowNumber);
    for (const year of execution.years) {
      const planned = pending.scheduleByYear[year] ?? [];
      entry.scheduleByYear[year] = entry.scheduleByYear[year].map((v, i) =>
        new Decimal(v).plus(planned[i] ?? "0").toFixed(2),
      );
    }
    entry.contractAmount = execution.years
      .reduce((acc, y) => acc.plus(sum(entry!.scheduleByYear[y])), new Decimal(0))
      .toFixed(2);
  }
  return [...bySeries.values()];
}

export async function writeExecution(
  tx: Tx,
  options: {
    clientId: string;
    execution: ExecutionResult;
    /** `${year}||${seriesCode}` → id de la serie de ese año. */
    seriesIdByYearCode: Map<string, string>;
    fileName: string;
    userId: string;
  },
): Promise<ExecutionWriteResult> {
  const { clientId, execution, seriesIdByYearCode, fileName, userId } = options;

  const pendingContracts = buildPendingAwardContracts(execution);
  const allContracts = [...execution.contracts, ...pendingContracts];
  const awardedNumbers = new Set(execution.contracts.map((c) => c.contractNumber));

  // ── Empresas ──────────────────────────────────────────────────────────
  const contractorNames = [
    ...new Set(execution.contracts.map((c) => c.contractorName).filter((n): n is string => !!n)),
  ];
  const existingCompanies = await tx.company.findMany({
    where: { clientId, name: { in: contractorNames } },
    select: { id: true, name: true },
  });
  const companyIdByName = new Map(existingCompanies.map((c) => [c.name, c.id]));
  const newCompanies = contractorNames
    .filter((name) => !companyIdByName.has(name))
    .map((name) => ({ id: randomUUID(), clientId, name }));
  if (newCompanies.length > 0) {
    await tx.company.createMany({ data: newCompanies, skipDuplicates: true });
    for (const company of newCompanies) companyIdByName.set(company.name, company.id);
  }

  // ── Grupos de inversión ───────────────────────────────────────────────
  const groups = await tx.investmentGroup.findMany({
    where: { clientId },
    select: { id: true, name: true },
  });
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));
  const unmappedCategories = new Set<string>();
  const groupIdFor = (category: string | null): string | null => {
    if (!category) return null;
    const groupName = CATEGORY_TO_GROUP[category.trim().toLowerCase()];
    if (!groupName) {
      unmappedCategories.add(category);
      return null;
    }
    return groupIdByName.get(groupName) ?? null;
  };

  // ── Contratos ─────────────────────────────────────────────────────────
  const numbers = allContracts.map((c) => c.contractNumber);
  const existingContracts = await tx.contract.findMany({
    where: { clientId, contractNumber: { in: numbers } },
    select: { id: true, contractNumber: true },
  });
  const contractIdByNumber = new Map(existingContracts.map((c) => [c.contractNumber, c.id]));

  const toCreate: Prisma.ContractCreateManyInput[] = [];
  const toUpdate: { id: string; source: ImportedContract }[] = [];
  for (const source of allContracts) {
    const fields = {
      name: source.name,
      companyId: source.contractorName
        ? (companyIdByName.get(source.contractorName) ?? null)
        : null,
      investmentGroupId: groupIdFor(source.category),
      stage: awardedNumbers.has(source.contractNumber) ? "EJECUCION" : "EN_DEFINICION",
      originalAmount: source.contractAmount,
      currentAmount: source.contractAmount,
      status: "VIGENTE",
      costOrigin: `Importado de ${fileName}`,
    };
    const existingId = contractIdByNumber.get(source.contractNumber);
    if (existingId) {
      toUpdate.push({ id: existingId, source });
      continue;
    }
    const id = randomUUID();
    contractIdByNumber.set(source.contractNumber, id);
    toCreate.push({ id, clientId, contractNumber: source.contractNumber, ...fields });
  }

  if (toCreate.length > 0) {
    await tx.contract.createMany({ data: toCreate, skipDuplicates: true });
  }
  for (const { id, source } of toUpdate) {
    await tx.contract.update({
      where: { id },
      data: {
        name: source.name,
        companyId: source.contractorName
          ? (companyIdByName.get(source.contractorName) ?? null)
          : null,
        investmentGroupId: groupIdFor(source.category),
        stage: awardedNumbers.has(source.contractNumber) ? "EJECUCION" : "EN_DEFINICION",
        originalAmount: source.contractAmount,
        currentAmount: source.contractAmount,
        costOrigin: `Importado de ${fileName}`,
      },
    });
  }

  // ── Asignación contrato-serie, programación y real, año por año ───────
  const contractIds = [...contractIdByNumber.values()];
  const targetSeriesIds = [...seriesIdByYearCode.values()];
  const yearsWithoutSeries: number[] = [];

  const allocations: Prisma.ContractSeriesAllocationCreateManyInput[] = [];
  const versions: Prisma.ScheduleVersionCreateManyInput[] = [];
  const scheduleRows: Prisma.MonthlyScheduleCreateManyInput[] = [];
  const actualRows: Prisma.ActualInvestmentCreateManyInput[] = [];

  // Lo ya registrado como inversión real no se pisa: un registro aprobado es
  // inmutable por diseño (se corrige creando otro que lo reemplaza).
  const existingActuals = await tx.actualInvestment.findMany({
    where: { contractId: { in: contractIds }, pmdSeriesId: { in: targetSeriesIds } },
    select: { contractId: true, pmdSeriesId: true, periodYear: true, periodMonth: true },
  });
  const takenActuals = new Set(
    existingActuals.map((a) => `${a.contractId}|${a.pmdSeriesId}|${a.periodYear}|${a.periodMonth}`),
  );
  let actualRowsPreserved = 0;

  for (const year of execution.years) {
    const hasSeriesForYear = allContracts.some((c) =>
      seriesIdByYearCode.has(`${year}||${c.seriesCode}`),
    );
    if (!hasSeriesForYear) {
      yearsWithoutSeries.push(year);
      continue;
    }

    for (const source of allContracts) {
      const pmdSeriesId = seriesIdByYearCode.get(`${year}||${source.seriesCode}`);
      const contractId = contractIdByNumber.get(source.contractNumber);
      if (!pmdSeriesId || !contractId) continue;

      const planned = source.scheduleByYear[year] ?? [];
      const spent = source.actualByYear[year] ?? [];
      const plannedTotal = sum(planned);
      const spentTotal = sum(spent);
      // Un contrato sin movimiento en el año no genera filas: dejarlas en
      // cero solo infla la matriz de programación con ruido.
      if (plannedTotal.isZero() && spentTotal.isZero()) continue;

      allocations.push({
        id: randomUUID(),
        contractId,
        pmdSeriesId,
        allocatedAmount: plannedTotal.toFixed(2),
        isPrimary: true,
      });

      const versionId = randomUUID();
      versions.push({
        id: versionId,
        contractId,
        pmdSeriesId,
        versionType: "BASELINE",
        cutoffDate: new Date(),
        reason: `${IMPORT_MARKER} ${fileName}`,
        requestedBy: userId,
        approvedBy: userId,
        status: "APROBADO",
      });

      for (let i = 0; i < 12; i++) {
        scheduleRows.push({
          id: randomUUID(),
          scheduleVersionId: versionId,
          contractId,
          pmdSeriesId,
          periodYear: year,
          periodMonth: i + 1,
          plannedAmount: planned[i] ?? "0",
        });

        const amount = new Decimal(spent[i] ?? "0");
        if (amount.isZero()) continue;
        if (takenActuals.has(`${contractId}|${pmdSeriesId}|${year}|${i + 1}`)) {
          actualRowsPreserved += 1;
          continue;
        }
        actualRows.push({
          id: randomUUID(),
          contractId,
          pmdSeriesId,
          periodYear: year,
          periodMonth: i + 1,
          investmentType: "Estimación",
          grossAmount: amount.toFixed(2),
          recognizablePmdAmount: amount.toFixed(2),
          status: "APROBADO",
          capturedBy: userId,
          validatedBy: userId,
        });
      }
    }
  }

  // Se rehace lo que puso el importador antes; lo cargado a mano no lleva la
  // marca y sobrevive.
  const previousVersions = await tx.scheduleVersion.findMany({
    where: {
      pmdSeriesId: { in: targetSeriesIds },
      reason: { startsWith: IMPORT_MARKER },
    },
    select: { id: true },
  });
  if (previousVersions.length > 0) {
    const ids = previousVersions.map((v) => v.id);
    await tx.monthlySchedule.deleteMany({ where: { scheduleVersionId: { in: ids } } });
    await tx.scheduleVersion.deleteMany({ where: { id: { in: ids } } });
  }
  await tx.contractSeriesAllocation.deleteMany({
    where: { contractId: { in: contractIds }, pmdSeriesId: { in: targetSeriesIds } },
  });

  if (allocations.length > 0) {
    await tx.contractSeriesAllocation.createMany({ data: allocations, skipDuplicates: true });
  }
  if (versions.length > 0) await tx.scheduleVersion.createMany({ data: versions });
  if (scheduleRows.length > 0) {
    await tx.monthlySchedule.createMany({ data: scheduleRows, skipDuplicates: true });
  }
  if (actualRows.length > 0) await tx.actualInvestment.createMany({ data: actualRows });

  return {
    companiesCreated: newCompanies.length,
    contractsCreated: toCreate.length,
    contractsUpdated: toUpdate.length,
    allocationsWritten: allocations.length,
    scheduleRowsWritten: scheduleRows.length,
    actualRowsWritten: actualRows.length,
    actualRowsPreserved,
    pendingAwardContracts: pendingContracts.length,
    yearsWithoutSeries,
    unmappedCategories: [...unmappedCategories],
  };
}
