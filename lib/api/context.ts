import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/rbac";
import type { CurrentUser } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/api/respond";

/**
 * Combina requirePermission con la resolución del cliente activo del
 * usuario. v1 asume un cliente por usuario (users.client_id) — el alcance
 * fino por cliente/aeropuerto (user_scopes) se incorpora cuando un usuario
 * necesite operar sobre más de un cliente (fuera del alcance de este
 * módulo).
 */
export async function requireClientScopedPermission(
  permissionCode: string,
): Promise<
  | { user: CurrentUser; clientId: string; response: null }
  | { user: null; clientId: null; response: NextResponse }
> {
  const auth = await requirePermission(permissionCode);
  if (auth.response) {
    return { user: null, clientId: null, response: auth.response };
  }
  if (!auth.user.clientId) {
    return {
      user: null,
      clientId: null,
      response: jsonError(409, "El usuario no tiene un cliente asignado."),
    };
  }
  return { user: auth.user, clientId: auth.user.clientId, response: null };
}
