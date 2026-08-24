/**
 * Etiquetas de etapa contractual. Viven en un módulo neutral (no
 * `"use client"`) porque los Server Components también las necesitan: al
 * importar un valor desde un módulo marcado como cliente, Next entrega una
 * referencia opaca en vez del objeto, y la búsqueda devuelve `undefined`.
 */
export const CONTRACT_STAGE_LABELS: Record<string, string> = {
  EN_DEFINICION: "En definición",
  DISENO: "Diseño",
  LISTO_PARA_LICITAR: "Listo para licitar",
  LICITACION: "Licitación",
  EVALUACION: "Evaluación",
  PENDIENTE_DE_FALLO: "Pendiente de fallo",
  CONTRATADO: "Contratado",
  EJECUCION: "Ejecución",
  SUSPENDIDO: "Suspendido",
  TERMINADO: "Terminado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};
