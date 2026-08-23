# MVP BACKLOG — PMD CONTROL HUB

> Backlog ordenado por fase (sección 21 del prompt maestro, ya con los recortes de la sección 0). No se construye todo el sistema en una sola iteración; cada fase se cierra con validación antes de avanzar.

## Fase 1 — Descubrimiento (completada con este set de documentos)

- [x] Análisis exhaustivo del Excel (12 hojas, fórmulas, catálogos, jerarquía).
- [x] Análisis exhaustivo del PPTX (KPIs, Curva S, OENE, riesgos, decisiones).
- [x] Ambigüedades documentadas (`DESIGN_BASELINE.md §3`).
- [x] Reglas de negocio críticas (`BUSINESS_RULES.md`).

## Fase 2 — Diseño (entregado en este set de documentos)

- [x] Arquitectura preliminar (`SYSTEM_ARCHITECTURE.md`).
- [x] Modelo de datos preliminar (`DATA_DICTIONARY.md`).
- [x] Flujo de versionado PMD documentado como referencia de Fase 5 (`PMD_VERSIONING_RULES.md`).
- [x] Lista de pantallas, roles y permisos, APIs (`DESIGN_BASELINE.md §4-6`).
- [ ] **Pendiente de aprobación del usuario antes de construir:** validar este set de 6 documentos.

## Fase 3 — MVP (construcción, no inicia hasta aprobación de Fase 2)

Orden sugerido de construcción por módulos (no simultáneo):

1. **Cimientos:** proyecto Next.js + TypeScript + Tailwind + shadcn/ui, Docker Compose, Postgres + Prisma, migraciones iniciales de `clients`/`airports`/`pmd_cycles`/`pmd_years`/`users`/`roles`/`permissions`/`user_scopes`, seeds de catálogos confirmados.
2. **Autenticación y RBAC:** login, sesión, CSRF, matriz de permisos aplicada a rutas y API.
3. **Estructura PMD:** CRUD de `pmd_series` (+ `pmd_series_items`), `investment_groups`, `companies`, `contracts`, `contract_series_allocations`, `annual_targets` (con bloqueo/desbloqueo vía `approval_requests`).
4. **Programación mensual:** matriz de captura, `schedule_versions`/`monthly_schedules`, motor de alerta de descuadre no bloqueante + asiento automático en bitácora (sección 0.2).
5. **Inversión real y facturación:** `actual_investments`, `invoices`, `estimates`, `oene_records`, detección de duplicados, flujo de estados, inmutabilidad tras aprobación, configuración del criterio oficial de reconocimiento PMD (sección 6.6).
6. **Hito anual y cálculos:** motor de cálculo (`BUSINESS_RULES.md §5`) como módulo de dominio reutilizable por dashboard y reportes.
7. **Dashboard ejecutivo:** KPIs, Curva S, desglose del faltante (dona), barras Hito/Programado/Real, tabla ejecutiva de excepciones, filtros de contexto.
8. **Riesgos y protección de inversión:** `risks`, `risk_assessments`, `constraints`, `actions`, matriz configurable, alertas.
9. **Hitos de control:** `milestones` (anual/mensual/gestión), calendario de hitos.
10. **Autorizaciones:** `approval_requests`/`approval_steps`, bandeja por rol, vista antes/después.
11. **Auditoría:** `audit_logs` inmutable, filtros, drill-down desde KPIs.
12. **Centro de Calidad y conciliación:** `reconciliation_results`, panel de errores/advertencias/duplicados/incompletos/descuadres/periodos sin cerrar.
13. **Cierre mensual:** `accounting_periods`/`period_snapshots`, checklist de conciliación previa, congelamiento, reapertura controlada.
14. **Reportes base:** resumen ejecutivo, Curva S, cumplimiento, detalle por serie/contrato/empresa, programado vs. real, forecast, exposiciones, hitos, riesgos, OENE, anticipos — exportables a Excel/CSV/PDF (sin comparación de versiones PMD, que es Fase 5).
15. **Docker Compose completo** (app + db + healthchecks) y manuales iniciales de instalación/usuario/administrador.

**Explícitamente fuera de Fase 3:** importación/exportación de Excel, comparador y publicación de versiones PMD, segregación de funciones/no auto-aprobación.

## Fase 4 — Validación

- [ ] Pruebas unitarias de cada fórmula de `BUSINESS_RULES.md §5` (incluye casos límite: división por cero en % desviación, montos negativos por reversión).
- [ ] Pruebas de integración del flujo completo: alta de serie → contrato → programación con descuadre intencional → verificación de alerta + bitácora → inversión real → recálculo de dashboard.
- [ ] Pruebas end-to-end por rol (Capturista no puede aprobar, Consulta Ejecutiva no puede editar, Auditor solo lectura de bitácora).
- [ ] Pruebas de conciliación (los 7 cruces de `BUSINESS_RULES.md §10` con datos sintéticos que fuercen descuadre).
- [ ] Pruebas de concurrencia (dos usuarios editando la misma matriz de programación).
- [ ] Pruebas de contratos multiserie (`contract_series_allocations` con más de una fila).
- [ ] Pruebas de exceso de monto vigente (alerta + bitácora, sin bloqueo).
- [ ] Pruebas de cambios tras cierre (deben requerir reapertura autorizada).
- [ ] Responsive (matriz de programación en tablet, dashboard en pantalla ejecutiva).

## Fase 5 — Mejoras (backlog futuro, no v1)

- [ ] Importación/exportación de Excel y gestión de versiones PMD completa (`PMD_VERSIONING_RULES.md`).
- [ ] Segregación de funciones / no auto-aprobación (activar la validación suspendida en la sección 0.1).
- [ ] Forecast avanzado (modelos de proyección más allá de la carga manual de meses futuros).
- [ ] Integraciones externas (ERP/contabilidad del cliente).
- [ ] Notificaciones (email/push) para vencimientos y alertas.
- [ ] SSO productivo con Microsoft Entra ID.
- [ ] Reportes programados (envío automático periódico).
- [ ] Conectores adicionales (BI externo, Power BI live connection).
- [ ] Soporte multimoneda real (hoy solo se conserva el dato de TC USD/EUR observado en el Excel como referencia, sin operarlo).

## Riesgos técnicos identificados

- **Migración de terminología entre clientes:** si se codifican catálogos de ASUR como fijos, GAP/OMA quedarán mal representados. Mitigación: catálogos 100% configurables desde v1 (ya reflejado en el modelo).
- **Descuadres silenciosos acumulados:** al no bloquear el guardado, el volumen de bitácora de descuadres puede crecer sin control si no hay revisión periódica. Mitigación: el Centro de Calidad debe destacar descuadres no resueltos como parte del checklist de cierre mensual.
- **Ambigüedad de correspondencia contrato↔fila** (ver `DESIGN_BASELINE.md §3.1-3.2`) puede generar duplicados si en el futuro se activa la importación (Fase 5) sin una clave de negocio confiable. Mitigación: exigir número de contrato único por cliente desde v1 (`UNIQUE (client_id, contract_number)`).
