import Link from "next/link";

import type { Diagnostico } from "@/lib/domain/diagnostico";

/**
 * Aviso que reemplaza a los ceros silenciosos: dice qué eslabón falta y a
 * dónde ir a cargarlo.
 */
export function DiagnosticoPanel({ diagnostico }: { diagnostico: Diagnostico }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {diagnostico.titulo}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-amber-900/90 dark:text-amber-200/90">
        {diagnostico.detalles.map((detalle) => (
          <li key={detalle}>{detalle}</li>
        ))}
      </ul>
      {diagnostico.accion && (
        <Link
          href={diagnostico.accion.href}
          className="mt-3 inline-flex items-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
        >
          {diagnostico.accion.label}
        </Link>
      )}
    </div>
  );
}
