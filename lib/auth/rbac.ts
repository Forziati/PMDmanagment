import { NextResponse } from "next/server";

import { AUTH_DISABLED, getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";

export function hasPermission(user: CurrentUser, permissionCode: string): boolean {
  // En modo de un solo usuario no hay roles que evaluar: todo está permitido.
  if (AUTH_DISABLED) return true;
  return user.permissionCodes.includes(permissionCode);
}

/**
 * Para usar al inicio de un Route Handler:
 *
 *   const auth = await requirePermission("CONTRATOS.EDITAR");
 *   if (auth.response) return auth.response;
 *   const { user } = auth;
 *
 * Nota v1: valida rol/permiso; el techo monetario y el alcance por
 * cliente/aeropuerto (user_scopes) se aplican en el dominio de cada módulo
 * a medida que se construye (BUSINESS_RULES.md), no aquí de forma genérica.
 */
export async function requirePermission(
  permissionCode: string,
): Promise<{ user: CurrentUser; response: null } | { user: null; response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }
  if (!hasPermission(user, permissionCode)) {
    return {
      user: null,
      response: NextResponse.json({ error: "No autorizado." }, { status: 403 }),
    };
  }
  return { user, response: null };
}
