# SYSTEM ARCHITECTURE — PMD CONTROL HUB

## 1. Arquitectura preliminar

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui │
│  ECharts (Curva S, dona, waterfall, heatmap) + TanStack Table│
└───────────────────────────┬───────────────────────────────────┘
                            │ REST/JSON (/api/v1), auth cookie httpOnly
┌───────────────────────────▼───────────────────────────────────┐
│  API Layer (Next.js route handlers o FastAPI, a decidir en    │
│  arranque de Fase 3): RBAC, validación server-side, motor de  │
│  cálculo (Decimal), motor de conciliación, bitácora           │
└───────────────────────────┬───────────────────────────────────┘
                            │ Prisma / SQLAlchemy, transacciones ACID
┌───────────────────────────▼───────────────────────────────────┐
│  PostgreSQL 15+  (esquema en DATA_DICTIONARY.md)               │
│  - Tipos NUMERIC para importes, nunca float/double             │
│  - Triggers/constraints para no-borrado físico                 │
└─────────────────────────────────────────────────────────────┘
        │
        ├── Object storage (adjuntos/evidencias) — local en dev, Azure Blob en prod
        └── Logging estructurado + health checks
```

**Decisión de arranque recomendada:** un único servicio Next.js full-stack (App Router + route handlers) para v1, evitando la complejidad operativa de dos repos/despliegues. FastAPI queda como alternativa si el equipo de backend financiero prefiere Python por las librerías de cálculo/Excel de Fase 5 — se revalida al inicio de Fase 3, no se decide unilateralmente aquí.

## 2. Frontend

- **Next.js + TypeScript** — App Router, Server Components para pantallas de solo lectura (dashboard, reportes), Client Components para la matriz de programación mensual (edición por celda).
- **Tailwind CSS + shadcn/ui** — sobrio, ejecutivo, fondos claros, azul oscuro primario / turquesa secundario, semáforo verde/amarillo/rojo para estados (sección 15).
- **ECharts** — Curva S (líneas + banda de riesgo), barras Hito/Programado/Real, dona del faltante, waterfall de variación, heatmap mensual.
- **TanStack Table** — matriz de programación mensual y tablas ejecutivas de excepciones: columnas fijas, agrupación, búsqueda, copiar/pegar interno (no importación de archivo en v1).

## 3. Backend

- Autenticación por sesión (cookie httpOnly + CSRF token), preparado para migrar a Microsoft Entra ID (OIDC) sin rediseño de esquema (`users.external_idp_id` reservado).
- RBAC evaluado en cada request: rol + `user_scopes` (cliente/aeropuerto/módulo/acción/techo monetario).
- Motor de cálculo centralizado (un solo módulo de dominio, sin duplicar fórmulas en frontend): implementa las fórmulas de `BUSINESS_RULES.md §5` sobre `Decimal`.
- Motor de conciliación como job programado + ejecutable bajo demanda al guardar programación/inversión real.
- Rate limiting en endpoints de autenticación y de escritura masiva.
- Toda escritura relevante ocurre dentro de una transacción que también inserta el `audit_logs` correspondiente (atomicidad guardado+bitácora, crítico para la regla de descuadre no bloqueante de la sección 0.2).

## 4. Base de datos

- PostgreSQL con Prisma (si el stack es Next.js) o SQLAlchemy + Alembic (si FastAPI). Migraciones versionadas desde el primer commit.
- Todos los importes `NUMERIC(18,2)`; factores de escalación y porcentajes `NUMERIC(10,6)`.
- Índices y restricciones descritos en `DATA_DICTIONARY.md §4`.
- Sin `ON DELETE CASCADE` en tablas financieras — únicamente `RESTRICT`, forzando el uso de estados de anulación.

## 5. Seguridad

- Autenticación propia en v1 (email + password con hash `argon2`/`bcrypt`), con estructura lista para Entra ID (sección 16).
- CSRF en todo formulario de escritura; validación server-side espejo de la validación de cliente (nunca confiar solo en el frontend).
- Gestión de secretos vía variables de entorno + `.env` fuera de control de versiones; ejemplo `.env.example` versionado.
- HTTPS obligatorio en todo ambiente distinto de desarrollo local.

## 6. Infraestructura

- `docker-compose.yml` con servicios: `app` (Next.js/FastAPI), `db` (Postgres), opcional `adminer`/`pgadmin` para desarrollo.
- Seeds: catálogos confirmados (grupos, categorías de gasto, origen del costo, roles, permisos) + datos de ejemplo derivados (anonimizados/agregados) del Excel de ASUR para pruebas de UI, nunca los montos reales de producción sin autorización.
- Backups: `pg_dump` programado, retenido según política del cliente (a definir en manual de administrador).
- Health checks: `/api/health` (DB reachable, migraciones al día).
- Logging estructurado (JSON) con nivel configurable; correlación por `request_id`.
- Preparación para Azure: contenedor compatible con Azure Container Apps / App Service, secretos vía Azure Key Vault (Fase 5).

## 7. Estructura de carpetas propuesta

```
pmd-control-hub/
├── docker-compose.yml
├── .env.example
├── DESIGN_BASELINE.md
├── DATA_DICTIONARY.md
├── BUSINESS_RULES.md
├── SYSTEM_ARCHITECTURE.md
├── MVP_BACKLOG.md
├── PMD_VERSIONING_RULES.md
├── app/                        # Next.js App Router
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── page.tsx            # Dashboard ejecutivo
│   │   ├── series/
│   │   ├── contratos/
│   │   ├── programacion/
│   │   ├── inversion-real/
│   │   ├── riesgos/
│   │   ├── hitos/
│   │   ├── autorizaciones/
│   │   ├── auditoria/
│   │   ├── calidad/
│   │   └── administracion/
│   └── api/v1/
│       ├── clients/
│       ├── airports/
│       ├── pmd-series/
│       ├── contracts/
│       ├── monthly-schedules/
│       ├── actual-investments/
│       ├── risks/
│       ├── milestones/
│       ├── approvals/
│       ├── audit-logs/
│       └── reconciliation/
├── domain/                     # lógica de negocio pura (cálculos, reglas)
│   ├── calculations/
│   ├── reconciliation/
│   └── validation/
├── db/
│   ├── prisma/ (schema.prisma, migrations/, seed.ts)
│   └── ...
├── components/
│   ├── charts/                 # Curva S, dona, waterfall, heatmap
│   ├── tables/
│   └── ui/                     # shadcn primitives
├── lib/
│   ├── auth/
│   ├── rbac/
│   └── money.ts                # helpers Decimal, formato $ / MDP
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    └── manuales/ (instalación, usuario, administrador)
```

## 8. Notas de despliegue multi-cliente

- Un solo despliegue multi-tenant lógico (no una instancia por cliente): aislamiento por `client_id` en cada tabla y en cada consulta (row-level filtering aplicado por el backend, reforzable luego con RLS de Postgres si el volumen lo justifica).
- Catálogos (`investment_groups`, categorías, orígenes de costo, niveles de riesgo) son configurables por cliente desde el día uno, evitando hardcodear la terminología de ASUR como si fuera universal.
