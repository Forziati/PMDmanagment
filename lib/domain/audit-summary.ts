/**
 * Traduce una fila de auditoría (acción + tipo de entidad + antes/después,
 * cada uno un JSON libre según lo que haya mandado el endpoint que la
 * escribió) a una frase legible para la pantalla de Gestión de Cambios.
 */

const ENTITY_LABELS: Record<string, string> = {
  PmdSeries: "Serie PMD",
  PmdSeriesItem: "Línea de proyecto",
  PmdYear: "Año PMD",
  PmdCycle: "Ciclo PMD",
  Contract: "Contrato",
  ContractSeriesAllocation: "Asignación contrato-serie",
  ContractAmendment: "Convenio modificatorio",
  AnnualTarget: "Hito anual",
  ActualInvestment: "Inversión real",
  Risk: "Riesgo",
  InvestmentGroup: "Grupo de inversión",
  Company: "Empresa",
  ScheduleVersion: "Versión de programación",
  MonthlySchedule: "Programación mensual",
};

const ACTION_VERBS: Record<string, string> = {
  CREATE: "creó",
  UPDATE: "editó",
  DELETE: "eliminó",
  IMPORT_PMD: "importó desde Excel",
  CORRECTION: "corrigió (con reemplazo)",
  CREATE_OVER_ALLOCATION_WARNING: "creó (con aviso de sobre-asignación)",
  CREATE_RECOGNIZABLE_GAP_ACKNOWLEDGED: "registró (con diferencia reconocida)",
  STATUS_EN_REVISION: "envió a revisión",
  STATUS_OBSERVADO: "marcó como observado",
  STATUS_APROBADO: "aprobó",
  STATUS_CERRADO: "cerró",
  STATUS_ANULADO: "anuló",
  STATUS_REVERTIDO: "revirtió",
  SAVE_SCHEDULE: "guardó",
  SAVE_SCHEDULE_WITH_IMBALANCE: "guardó (con descuadre reconocido)",
  LOCK: "bloqueó",
  UNLOCK: "desbloqueó",
};

/** Campos que nunca aportan al resumen (identificadores, timestamps). */
const IGNORED_KEYS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "capturedBy",
  "validatedBy",
  "supersedesId",
]);

export interface AuditSummary {
  entityLabel: string;
  actionLabel: string;
  title: string;
  detail: string | null;
}

function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

function actionLabel(action: string): string {
  return ACTION_VERBS[action] ?? action.replaceAll("_", " ").toLowerCase();
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
  const text = String(v);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/**
 * Diferencia campo a campo entre dos objetos planos, para el detalle. Los
 * endpoints suelen guardar el registro completo con sus relaciones (por
 * ejemplo un Riesgo con sus evaluaciones, o una Inversión con su factura) —
 * eso es ruido para un resumen, así que solo se comparan campos escalares
 * (texto, número, booleano), nunca objetos ni arreglos anidados.
 */
function diff(before: unknown, after: unknown): string[] {
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return [];
  }
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changes: string[] = [];
  for (const key of keys) {
    if (IGNORED_KEYS.has(key)) continue;
    const bv = b[key];
    const av = a[key];
    if ((bv !== null && typeof bv === "object") || (av !== null && typeof av === "object")) {
      continue;
    }
    if (bv === av) continue;
    changes.push(`${key}: ${formatValue(bv)} → ${formatValue(av)}`);
  }
  return changes.slice(0, 5);
}

export function summarizeAuditLog(entry: {
  action: string;
  entityType: string;
  beforeValue: unknown;
  afterValue: unknown;
}): AuditSummary {
  const label = entityLabel(entry.entityType);
  const verb = actionLabel(entry.action);

  if (entry.action === "IMPORT_PMD" && entry.afterValue && typeof entry.afterValue === "object") {
    const v = entry.afterValue as Record<string, unknown>;
    return {
      entityLabel: label,
      actionLabel: verb,
      title: `Importó ${v.fileName ?? "un archivo"} de Excel`,
      detail: `${v.seriesCreated ?? 0} series creadas, ${v.seriesUpdated ?? 0} actualizadas, ${v.itemsWritten ?? 0} líneas de proyecto.`,
    };
  }

  if (entry.action === "DELETE") {
    return {
      entityLabel: label,
      actionLabel: verb,
      title: `Eliminó ${label.toLowerCase()}`,
      detail: null,
    };
  }

  const changes = diff(entry.beforeValue, entry.afterValue);
  return {
    entityLabel: label,
    actionLabel: verb,
    title: `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${label.toLowerCase()}`,
    detail: changes.length > 0 ? changes.join(" · ") : null,
  };
}
