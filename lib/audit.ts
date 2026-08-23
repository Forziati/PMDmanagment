import { prisma } from "@/lib/db";

interface WriteAuditLogInput {
  userId: string | null;
  clientId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string;
}

/**
 * Bitácora inmutable (BUSINESS_RULES.md §9 / sección 12.3 del prompt
 * maestro): solo INSERT, nunca editable desde la interfaz. Cada Route
 * Handler que crea/modifica una entidad de negocio debe llamar esto.
 */
/** Normaliza a JSON plano (Decimal/Date -> string) para el campo Json de Prisma. */
function toJsonSafe(value: unknown): object | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
}

export function writeAuditLog(input: WriteAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      clientId: input.clientId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeValue: toJsonSafe(input.beforeValue),
      afterValue: toJsonSafe(input.afterValue),
      reason: input.reason,
    },
  });
}
