import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Verificación ligera de acceso: solo valida la firma/expiración del JWT
 * de sesión (sin tocar la base de datos). La resolución de permisos por
 * rol/alcance (RBAC completo) ocurre en cada Route Handler vía
 * lib/auth/rbac.ts, que sí consulta la base de datos.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protege solo páginas (redirige a /login). Las rutas /api/** aplican su
     * propia verificación por Route Handler (requirePermission /
     * getCurrentUser) y deben responder JSON 401/403, nunca un redirect
     * HTML — por eso toda la familia /api queda excluida aquí.
     */
    "/((?!api|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
