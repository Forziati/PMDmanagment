import { Decimal } from "decimal.js";

/**
 * Inversión real y facturación — BUSINESS_RULES.md §3 y §4 (secciones 6.5 y
 * 6.6 del prompt maestro).
 */

export const INVESTMENT_TYPES = [
  "ESTIMACION",
  "FACTURA",
  "ANTICIPO",
  "OENE",
  "PRODUCCION",
  "AJUSTE",
  "REVERSION",
  "OTRO",
] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  ESTIMACION: "Estimación",
  FACTURA: "Factura",
  ANTICIPO: "Anticipo",
  OENE: "OENE",
  PRODUCCION: "Producción",
  AJUSTE: "Ajuste",
  REVERSION: "Reversión",
  OTRO: "Otro",
};

export const INVESTMENT_STATUSES = [
  "BORRADOR",
  "EN_REVISION",
  "OBSERVADO",
  "APROBADO",
  "CERRADO",
  "ANULADO",
  "REVERTIDO",
] as const;
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number];

export const INVESTMENT_STATUS_LABELS: Record<InvestmentStatus, string> = {
  BORRADOR: "Borrador",
  EN_REVISION: "En revisión",
  OBSERVADO: "Observado",
  APROBADO: "Aprobado",
  CERRADO: "Cerrado",
  ANULADO: "Anulado",
  REVERTIDO: "Revertido",
};

/**
 * Flujo de estados: Borrador → En revisión → Observado → Aprobado → Cerrado;
 * o Anulado/Revertido desde cualquier estado previo a Cerrado. Un registro
 * Cerrado es terminal.
 */
const TRANSITIONS: Record<InvestmentStatus, InvestmentStatus[]> = {
  BORRADOR: ["EN_REVISION", "ANULADO", "REVERTIDO"],
  EN_REVISION: ["OBSERVADO", "APROBADO", "ANULADO", "REVERTIDO"],
  OBSERVADO: ["EN_REVISION", "ANULADO", "REVERTIDO"],
  APROBADO: ["CERRADO", "ANULADO", "REVERTIDO"],
  CERRADO: [],
  ANULADO: [],
  REVERTIDO: [],
};

export function canTransition(from: InvestmentStatus, to: InvestmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: InvestmentStatus): InvestmentStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Estados en los que el registro es inmutable: no se edita ni se borra, toda
 * corrección crea un registro nuevo enlazado por `supersedesId`
 * (BUSINESS_RULES.md §1.2).
 */
export function isImmutable(status: InvestmentStatus): boolean {
  return status === "APROBADO" || status === "CERRADO";
}

/**
 * Solo lo aprobado o cerrado alimenta la Curva S real. Un registro en
 * borrador o anulado no cuenta como inversión reconocida.
 */
export function countsTowardReal(status: InvestmentStatus): boolean {
  return status === "APROBADO" || status === "CERRADO";
}

export const REAL_STATUSES: InvestmentStatus[] = ["APROBADO", "CERRADO"];

export interface DeductionInput {
  grossAmount: Decimal.Value;
  amortization?: Decimal.Value;
  retention?: Decimal.Value;
  penalty?: Decimal.Value;
  taxes?: Decimal.Value;
}

/**
 * Monto reconocible sugerido = bruto menos amortización, retenciones, penas
 * e impuestos. Es una SUGERENCIA: el criterio oficial de reconocimiento
 * (`PmdRecognitionConfig`) puede reconocer otro monto, así que el valor
 * capturado manda y solo se advierte la diferencia, sin bloquear.
 */
export function suggestedRecognizable(input: DeductionInput): Decimal {
  return new Decimal(input.grossAmount)
    .minus(input.amortization ?? 0)
    .minus(input.retention ?? 0)
    .minus(input.penalty ?? 0)
    .minus(input.taxes ?? 0);
}

/** Diferencia entre lo capturado como reconocible y lo que sugieren las deducciones. */
export function recognizableGap(
  recognizable: Decimal.Value,
  input: DeductionInput,
): Decimal {
  return new Decimal(recognizable).minus(suggestedRecognizable(input));
}

export interface DuplicateCandidate {
  contractId: string;
  documentNumber: string | null;
  documentDate: Date | null;
  grossAmount: Decimal.Value;
  companyId: string | null;
}

/**
 * Detección de duplicados (BUSINESS_RULES.md §3): mismo contrato + mismo
 * número de documento + misma fecha + mismo importe + mismo proveedor. A
 * diferencia del descuadre de programación, este control SÍ es bloqueante:
 * protege contra el doble registro de gasto real.
 */
export function isDuplicate(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  if (a.contractId !== b.contractId) return false;
  if (!a.documentNumber || !b.documentNumber) return false;
  if (a.documentNumber.trim().toLowerCase() !== b.documentNumber.trim().toLowerCase()) {
    return false;
  }
  if (!a.documentDate || !b.documentDate) return false;
  if (a.documentDate.getTime() !== b.documentDate.getTime()) return false;
  if (!new Decimal(a.grossAmount).equals(new Decimal(b.grossAmount))) return false;
  return a.companyId === b.companyId;
}

export interface MonthlyRealInput {
  periodMonth: number;
  recognizablePmdAmount: Decimal.Value;
}

/** Real por mes (1-12) a partir de los registros que cuentan para la Curva S. */
export function monthlyRealSeries(records: MonthlyRealInput[]): Decimal[] {
  const months = Array.from({ length: 12 }, () => new Decimal(0));
  for (const record of records) {
    const index = record.periodMonth - 1;
    if (index < 0 || index > 11) continue;
    months[index] = months[index].plus(record.recognizablePmdAmount);
  }
  return months;
}

/** Saldo contractual = monto vigente del contrato − real reconocido acumulado. */
export function contractBalance(
  currentAmount: Decimal.Value,
  recognizedTotal: Decimal.Value,
): Decimal {
  return new Decimal(currentAmount).minus(recognizedTotal);
}

/**
 * Clave de agrupación contrato+serie, para repartir el real reconocido entre
 * las filas de las pantallas de control.
 */
export function realKey(contractId: string, pmdSeriesId: string): string {
  return `${contractId}::${pmdSeriesId}`;
}

export interface RealRecord {
  contractId: string;
  pmdSeriesId: string;
  periodMonth: number;
  recognizablePmdAmount: Decimal.Value;
}

/**
 * Indexa el real reconocido por contrato+serie, devolviendo los 12 meses de
 * cada combinación. Quien consulta ya filtró por año y por estados que
 * cuentan (`REAL_STATUSES`).
 */
export function indexRealByContractSeries(
  records: RealRecord[],
): Map<string, Decimal[]> {
  const index = new Map<string, Decimal[]>();
  for (const record of records) {
    const key = realKey(record.contractId, record.pmdSeriesId);
    let months = index.get(key);
    if (!months) {
      months = Array.from({ length: 12 }, () => new Decimal(0));
      index.set(key, months);
    }
    const i = record.periodMonth - 1;
    if (i < 0 || i > 11) continue;
    months[i] = months[i].plus(record.recognizablePmdAmount);
  }
  return index;
}
