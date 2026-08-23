import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  clientId: string | null;
  permissionCodes: string[];
  scopes: {
    clientId: string | null;
    airportId: string | null;
    module: string | null;
    action: string | null;
    monetaryCeiling: string | null;
  }[];
}

/**
 * Resuelve el usuario autenticado a partir de la cookie de sesión.
 * Devuelve null si no hay sesión válida — cada Route Handler/Server
 * Component decide si eso implica 401/redirect a /login.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId, active: true },
    include: {
      roles: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
      scopes: true,
    },
  });
  if (!user) return null;

  const permissionCodes = Array.from(
    new Set(
      user.roles.flatMap((userRole) =>
        userRole.role.permissions.map((rp) => rp.permission.code),
      ),
    ),
  );

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    clientId: user.clientId,
    permissionCodes,
    scopes: user.scopes.map((scope) => ({
      clientId: scope.clientId,
      airportId: scope.airportId,
      module: scope.module,
      action: scope.action,
      monetaryCeiling: scope.monetaryCeiling?.toString() ?? null,
    })),
  };
}
