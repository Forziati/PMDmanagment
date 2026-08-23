# PMD Control Hub

Sistema de Control, Proyección y Protección de Inversión PMD (Plan Maestro de
Desarrollo) para clientes aeroportuarios (ASUR, GAP, OMA y futuros).

La documentación de diseño es la fuente oficial del alcance y las reglas de
negocio — léela antes de tocar código:

- [`DESIGN_BASELINE.md`](./DESIGN_BASELINE.md) — entendimiento, ambigüedades, pantallas, roles, APIs.
- [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md) — modelo de datos, origen de cada campo.
- [`BUSINESS_RULES.md`](./BUSINESS_RULES.md) — cálculos, reglas de negocio, criterios de aceptación.
- [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) — stack y estructura de carpetas.
- [`MVP_BACKLOG.md`](./MVP_BACKLOG.md) — backlog por fase.
- [`PMD_VERSIONING_RULES.md`](./PMD_VERSIONING_RULES.md) — versionado/importación de Excel (Fase 5, no implementado aún).

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (componentes
copiados en `components/ui`, sin dependencia del CLI) + Prisma 6 + PostgreSQL
16 + ECharts + TanStack Table. Ver `SYSTEM_ARCHITECTURE.md` para el detalle.

## Requisitos

- Node.js 22+
- Docker y Docker Compose (para levantar Postgres localmente)

## Arranque local

```bash
cp .env.example .env      # ajustar SESSION_SECRET en un entorno real
npm install

# Base de datos (Postgres vía Docker)
docker compose up -d db

npm run prisma:migrate    # aplica las migraciones (db/prisma/migrations)
npm run db:seed           # catálogos confirmados + roles/permisos + usuario de prueba

npm run dev                # http://localhost:3000
```

Usuario de desarrollo creado por el seed:

```
admin@pmdcontrolhub.local / ChangeMe123!
```

**Cambiar esta contraseña antes de usar cualquier ambiente compartido.**

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Build y arranque en modo producción |
| `npm run lint` | ESLint |
| `npm run prisma:generate` | Regenera el cliente de Prisma |
| `npm run prisma:migrate` | Crea/aplica migraciones en desarrollo |
| `npm run prisma:deploy` | Aplica migraciones pendientes (CI/producción) |
| `npm run prisma:studio` | Explorador visual de la base de datos |
| `npm run db:seed` | Ejecuta `db/prisma/seed.ts` |

## Docker Compose (stack completo)

```bash
docker compose up -d --build
```

Levanta `db` (Postgres 16) y `app` (Next.js standalone). La app expone
`/api/health` para verificar conectividad a base de datos.

## Estado del proyecto

En construcción por módulos (ver `MVP_BACKLOG.md`, Fase 3). Completado hasta
ahora: cimientos (proyecto, esquema completo de base de datos, Docker
Compose, seeds) y autenticación + RBAC base. El dashboard ejecutivo, series,
contratos, programación mensual e inversión real se construyen a
continuación, uno a la vez.
