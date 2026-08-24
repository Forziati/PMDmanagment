import { Decimal } from "decimal.js";

/**
 * Matriz de riesgo PMI — sección 10 del prompt maestro. Probabilidad e
 * Impacto se capturan de 1 a 5; el nivel sale del producto y la estrategia
 * de respuesta se sugiere a partir del nivel (el usuario puede cambiarla).
 */

export const RISK_LEVELS = ["BAJO", "MEDIO", "ALTO", "CRITICO"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RESPONSE_STRATEGIES = ["EVITAR", "TRANSFERIR", "MITIGAR", "ACEPTAR"] as const;
export type ResponseStrategy = (typeof RESPONSE_STRATEGIES)[number];

export const RISK_STATUSES = [
  "IDENTIFICADO",
  "EN_EVALUACION",
  "EN_MITIGACION",
  "ACCION_REQUERIDA",
  "CERRADO",
] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const PROBABILITY_LABELS: Record<number, string> = {
  1: "1 — Muy baja",
  2: "2 — Baja",
  3: "3 — Media",
  4: "4 — Alta",
  5: "5 — Muy alta",
};

export const IMPACT_LABELS: Record<number, string> = {
  1: "1 — Muy bajo",
  2: "2 — Bajo",
  3: "3 — Medio",
  4: "4 — Alto",
  5: "5 — Muy alto",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

export const RESPONSE_STRATEGY_LABELS: Record<ResponseStrategy, string> = {
  EVITAR: "Evitar",
  TRANSFERIR: "Transferir",
  MITIGAR: "Mitigar",
  ACEPTAR: "Aceptar",
};

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  IDENTIFICADO: "Identificado",
  EN_EVALUACION: "En evaluación",
  EN_MITIGACION: "En mitigación",
  ACCION_REQUERIDA: "Acción requerida",
  CERRADO: "Cerrado",
};

/**
 * Nivel según el producto Probabilidad × Impacto (rango 1-25), con los
 * cortes clásicos de la matriz 5×5: hasta 4 bajo, 5-9 medio, 10-14 alto,
 * 15 o más crítico.
 */
export function riskLevelFor(probability: number, impact: number): RiskLevel {
  const score = probability * impact;
  if (score >= 15) return "CRITICO";
  if (score >= 10) return "ALTO";
  if (score >= 5) return "MEDIO";
  return "BAJO";
}

/** Estrategia sugerida por nivel — es una sugerencia, no una imposición. */
export function suggestedStrategyFor(level: RiskLevel): ResponseStrategy {
  switch (level) {
    case "CRITICO":
      return "EVITAR";
    case "ALTO":
      return "TRANSFERIR";
    case "MEDIO":
      return "MITIGAR";
    case "BAJO":
      return "ACEPTAR";
  }
}

export function riskScore(probability: number, impact: number): number {
  return probability * impact;
}

/**
 * Desvío = real − programado, ambos acumulados a la fecha. Negativo
 * significa que la inversión real va por debajo de lo programado, que es
 * justamente lo que esta pantalla vigila.
 */
export function deviation(
  programmed: Decimal.Value,
  actual: Decimal.Value,
): Decimal {
  return new Decimal(actual).minus(programmed);
}
