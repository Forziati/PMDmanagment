import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Modo de un solo usuario: con AUTH_DISABLED=true no hay login ni permisos —
 * toda petición se resuelve como el usuario administrador del seed, con todos
 * los permisos. Pensado para uso personal mientras el sistema no se comparte.
 *
 * IMPORTANTE: en este modo cualquiera que llegue a la URL entra y puede
 * modificar datos. No usarlo en un despliegue accesible por terceros sin
 * poner algo delante (red privada, contraseña del hosting, etc.).
 *
 * Para reactivar la autenticación: quitar la variable o ponerla en false.
 */
export const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

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
  let userId: string;

  if (AUTH_DISABLED) {
    // Sin login: se opera siempre como el primer usuario activo (el admin
    // que crea el seed). Si la base todavía no está sembrada, no hay usuario
    // y las pantallas responden como si no hubiera sesión.
    const soleUser = await prisma.user.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!soleUser) return null;
    userId = soleUser.id;
  } else {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    if (!session) return null;
    userId = session.userId;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId, active: true },
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
