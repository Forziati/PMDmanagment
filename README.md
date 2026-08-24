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

## Docker Compose (stack completo, un solo comando)

Es la forma más rápida de tener el sistema andando: no hace falta Node ni
Postgres instalados, solo Docker.

```bash
git clone https://github.com/Forziati/PMDmanagment.git
cd PMDmanagment
docker compose up -d --build      # la primera vez tarda unos minutos
```

Levanta tres servicios en orden: `db` (Postgres 16), `migrate` (aplica las
migraciones y siembra catálogos, roles y el usuario inicial; corre una vez y
termina) y `app` (Next.js), que arranca recién cuando `migrate` terminó bien.

Cuando `docker compose ps` muestre `app` como *healthy*, entra a
<http://localhost:3000> con el usuario del seed. Para ver el avance:

```bash
docker compose logs -f app
```

El seed es idempotente, así que repetir `up` no duplica nada, y los datos
viven en el volumen `pmd_db_data` (sobreviven a `down`; se borran con
`docker compose down -v`).

Antes de que esto lo use alguien más, definí un `SESSION_SECRET` propio — es
lo que firma las sesiones:

```bash
echo "SESSION_SECRET=$(openssl rand -base64 48)" >> .env
docker compose up -d
```

## Pantallas

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Resumen | `/` | Grilla consolidada por serie y contrato, con filtros — equivalente al Cash Flow del Excel. Programado, real, desvío en dinero y %, OENE y monto adicional. |
| Dashboard | `/dashboard` | Cumplimiento del año, Resumen Cash Flow (programado / real / balance por grupo de inversión y mes) y dona del faltante. |
| Series PMD | `/series` | Alta y edición de series (Anexo 6 y monto actualizado). |
| PMD Programado | `/pmd-programado` | Vista de control de solo lectura, espejo de la hoja "PMD 24-28": hitos por serie con desglose por año, factores de escalación y gráfico de pastel por año. |
| Contratos | `/contratos` | Contratos, su empresa y etapa, asignación a serie, OENE y convenios. |
| Programación | `/programacion` | Matriz mensual por contrato/serie, versionada (línea base → aprobadas). Advierte descuadres sin bloquear. |
| Inversión real | `/inversion-real` | Estimaciones, facturas, anticipos y OENE por mes, con flujo de estados. Solo lo aprobado o cerrado alimenta la curva real. |
| Riesgos | `/riesgos` | Un riesgo por contrato con su serie; probabilidad e impacto (matriz PMI), restricciones y acciones. |
| Resumen ejecutivo | `/riesgos/resumen` | Hoja lista para imprimir o proyectar: KPIs, exposición total y detalle por riesgo. |
| Administración | `/administracion` | Grupos de inversión, empresas, hito anual (con bloqueo) y factor de escalación. |

## Estado del proyecto

Operativo de punta a punta para el ciclo principal: cargar series y
contratos → programar el año → registrar la inversión real → ver el desvío y
gestionar los riesgos. Ver `MVP_BACKLOG.md` para el detalle por fase.

Pendiente: detalle de serie por línea de proyecto, criterio configurable de
reconocimiento PMD (hoy cuenta todo lo aprobado o cerrado), forecast y curva
S, e importación desde Excel (`PMD_VERSIONING_RULES.md`, Fase 5).
