import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Parsea y valida el body JSON de un Request; responde 400 si falla. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T; response: null } | { data: null; response: NextResponse }> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return { data: null, response: jsonError(415, "Content-Type inválido.") };
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "Datos inválidos.", details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data, response: null };
}
