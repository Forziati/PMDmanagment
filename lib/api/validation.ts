import { z } from "zod";

/** Acepta number o string y lo normaliza a string para los campos Decimal de Prisma. */
export const decimalInput = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => !Number.isNaN(Number(value)), { message: "Monto inválido." });

export const uuid = z.string().uuid();

/** Estados contractuales configurables — DATA_DICTIONARY.md §2.8 / sección 6.3 del prompt maestro. */
export const CONTRACT_STAGES = [
  "EN_DEFINICION",
  "DISENO",
  "LISTO_PARA_LICITAR",
  "LICITACION",
  "EVALUACION",
  "PENDIENTE_DE_FALLO",
  "CONTRATADO",
  "EJECUCION",
  "SUSPENDIDO",
  "TERMINADO",
  "CERRADO",
  "CANCELADO",
] as const;
