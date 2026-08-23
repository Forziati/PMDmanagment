# DATA DICTIONARY — PMD CONTROL HUB

> Modelo normalizado derivado del modelo mínimo de la sección 17 del prompt maestro, contrastado contra la estructura real de `CashFlow`, `PROGvsREAL`, `Datos PMD`, `ASUR` y el PPTX de riesgos. Todo campo que no proviene directamente de una de las dos fuentes está marcado **[Recomendado]**. Todos los importes son `NUMERIC(18,2)` (Decimal), nunca `float`.

## 1. Diagrama ER (vista lógica)

```
clients 1─* airports 1─* pmd_cycles 1─* pmd_years 1─* pmd_series *─* contracts
                                            │                         │
                                            │                    contract_series_allocations (tabla puente)
                                            │                         │
                                            1                    contract_amendments
                                            │                         │
                                       annual_targets            schedule_versions 1─* monthly_schedules
                                                                       │
                                                                 actual_investments ─┬─ invoices
                                                                                     ├─ estimates
                                                                                     └─ oene_records
pmd_series/contracts 1─* milestones
pmd_series/contracts 1─* risks 1─* risk_assessments
risks 1─* constraints
risks 1─* actions
* * approval_requests 1─* approval_steps
* * attachments (polimórfico)
* * audit_logs (polimórfico)
accounting_periods 1─* period_snapshots
users *─* roles *─* permissions; users 1─* user_scopes
```

`import_batches`, `import_mappings`, `pmd_versions`, `pmd_version_files`, `pmd_version_comparisons`, `pmd_version_changes`, `pmd_publication_events` se documentan en `PMD_VERSIONING_RULES.md` (Fase 5); sus tablas existen en el esquema desde v1 solo como estructura reservada, sin UI ni lógica activa.

## 2. Diccionario de entidades

### 2.1 `clients`
Origen: implícito (ASUR/GAP como clientes distintos, confirmado por nombre de archivo/aeropuerto).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| code | VARCHAR(20) UNIQUE | ej. `ASUR`, `GAP`, `OMA` |
| name | VARCHAR(200) | |
| currency_default | VARCHAR(3) | `MXN` |
| active | BOOLEAN | |
| created_at/updated_at | TIMESTAMPTZ | |

### 2.2 `airports`
Origen: `CashFlow!A2` (`AEROPUERTO INTERNACIONAL DE CANCÚN`), título GAP (`GDL`).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| client_id | FK clients | |
| iata_code | VARCHAR(3) | ej. `CUN`, `GDL` |
| name | VARCHAR(200) | |
| active | BOOLEAN | |

### 2.3 `pmd_cycles`
Origen: `PMD 2024-2028` (título `CashFlow!J2`).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| airport_id | FK airports | |
| code | VARCHAR(20) | ej. `PMD 2024-2028` |
| start_year / end_year | INT | 2024 / 2028 |
| status | VARCHAR(20) | Activo/Cerrado **[Recomendado]** |

### 2.4 `pmd_years`
Origen: columnas por año en `CashFlow` (`PMD 2024`…`PMD 2028`), factor de escalación `Fact. 24`…`Fact. 28`.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| pmd_cycle_id | FK pmd_cycles | |
| year | INT | |
| escalation_factor | NUMERIC(10,6) | ej. `1.0733085877599` para 2024 — de `CashFlow!I4` |
| annual_target_locked | BOOLEAN | soporta sección 4.4 (protección del hito) |

### 2.5 `investment_groups`
Origen: `Resumen CashFlow 2026!B6:B9` (`i. Diseño`, `ii. Obra`, `iii. Procura`, `iv. Dirección Proyecto y STE`) — coincide con los 4 grupos configurables del prompt maestro (+"Otros" **[Recomendado]**, no observado en la fuente).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| client_id | FK clients | catálogo configurable por cliente |
| code | VARCHAR(20) | `DISENO`, `OBRA`, `PROCURA`, `DIR_PROYECTO_STE`, `OTROS` |
| name | VARCHAR(100) | |
| sort_order | INT | |

### 2.6 `pmd_series`
Origen: `Datos PMD!A` (código, ej. `101`), `Datos PMD!B` (Sector, ej. "Ampliación T1"), `PMD 24-28` (pivote de verificación).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| pmd_year_id | FK pmd_years | una serie vive dentro de un año/ciclo PMD vigente |
| code | VARCHAR(20) | ej. `101` (numérico en origen, se guarda como texto) |
| name | VARCHAR(200) | Sector, ej. "Ampliación T1" |
| description | TEXT | Subsector/Proyecto concatenado como referencia — **[Recomendado]** separar en `pmd_series_items` si se requiere el nivel Subsector/Proyecto como entidad propia (ver §2.6.1) |
| investment_group_id | FK investment_groups | |
| authorized_amount | NUMERIC(18,2) | "PMD Anexo 6" — `Datos PMD!H` |
| updated_amount | NUMERIC(18,2) | "PMD actualizado" — `Datos PMD!I` |
| responsible_user_id | FK users | **[Recomendado]** no está en el Excel a nivel serie |
| status | VARCHAR(20) | Activa/Cerrada/Retirada |
| source_document | VARCHAR(200) | ej. "Anexo 6 Dic 2022" |
| tags | TEXT[] | **[Recomendado]** |

#### 2.6.1 `pmd_series_items` **[Recomendado — no es tabla mínima del prompt maestro, pero necesaria para no perder granularidad]**
Origen: `Datos PMD` filas (Subsector, Proyecto, Unidad, Cantidad, P.U.).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| pmd_series_id | FK pmd_series | |
| subsector | VARCHAR(200) | |
| project_name | VARCHAR(300) | ej. "obra nueva", "cubierta andenes" |
| unit | VARCHAR(20) | `m2`, `pieza` |
| quantity | NUMERIC(18,4) | |
| unit_price | NUMERIC(18,4) | |

### 2.7 `companies`
Origen: `CashFlow!X` (Prov.), `ASUR!C` (Contratista), tabla OENE del PPTX (Contratista).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(300) | |
| tax_id | VARCHAR(20) | **[Recomendado]**, no presente en fuentes |
| active | BOOLEAN | |

### 2.8 `contracts`
Origen: `CashFlow!W` (No. contrato / "OC 79821"), `!V` (Resp.), `!Y` (Origen del costo), `!S` (Presupuesto/Contrato Original), `!T` (OC's/TNE), `!U` (Ppto. Actual/Proyección), estados contractuales GAP ("En espera de fallo", "entregado", "en construcción/en licitación" como agrupador de las tablas 7/8), campos OENE (slide 4: Ppto. Contratado, OENE, OENE Contratada, OENE por Regularizar, OENE por Facturar).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| client_id | FK clients | |
| contract_number | VARCHAR(50) | ej. `GDL-OC-0007238`, `OC 79821` |
| name / scope | TEXT | "Alcance" — ej. "Plataforma comercial y rodajes" |
| company_id | FK companies | |
| investment_group_id | FK investment_groups | |
| stage | VARCHAR(30) | En definición/Diseño/Listo para licitar/Licitación/Evaluación/Pendiente de fallo/Contratado/Ejecución/Suspendido/Terminado/Cerrado/Cancelado |
| planned_start_date / planned_end_date | DATE | **[Recomendado]**, solo "Mes" aparece en el PPTX |
| actual_start_date / actual_end_date | DATE | **[Recomendado]** |
| original_amount | NUMERIC(18,2) | `CashFlow!S` |
| current_amount | NUMERIC(18,2) | `CashFlow!U` tras convenios |
| advance_amount | NUMERIC(18,2) | Anticipo — slide 3/6 |
| advance_amortized | NUMERIC(18,2) | Amortización — **[Recomendado]**, no desglosado explícitamente |
| oene_contracted_budget | NUMERIC(18,2) | "$ Ppto. Contratado" — slide 4 |
| oene_total | NUMERIC(18,2) | "$ OENE" |
| oene_contracted | NUMERIC(18,2) | "$ OENE Contratada" |
| oene_to_regularize | NUMERIC(18,2) | "$ OENE por Regularizar" |
| oene_to_invoice | NUMERIC(18,2) | "$ OENE Por Facturar" |
| retentions | NUMERIC(18,2) | **[Recomendado]**, no observado en fuentes |
| penalties | NUMERIC(18,2) | **[Recomendado]** |
| cost_origin | VARCHAR(30) | catálogo `Origen del Costo` (`1-Contrato`…`8-PMD`) |
| responsible_user_id | FK users | `CashFlow!V` |
| status | VARCHAR(20) | flujo de aprobación, sección 12.2 |

### 2.9 `contract_series_allocations`
Origen: en el Excel es 1:1 implícito (contrato vive en la fila de la serie); modelado como M:N para soportar sección 6.2/6.3 del prompt maestro.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| contract_id | FK contracts | |
| pmd_series_id | FK pmd_series | |
| allocated_amount | NUMERIC(18,2) | porción del contrato asignada a esta serie |
| is_primary | BOOLEAN | true en el caso 1:1 heredado del Excel |

### 2.10 `contract_amendments`
Origen: "Convenios" (sección 6.3 del prompt maestro; no hay ejemplo explícito en el Excel adjunto, pero `CashFlow!U` sugiere ajustes posteriores al original).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| contract_id | FK contracts | |
| amendment_number | INT | |
| amount_delta | NUMERIC(18,2) | |
| effective_date | DATE | |
| reason | TEXT | |
| evidence_attachment_id | FK attachments | |

### 2.11 `annual_targets`
Origen: total PMD por año (`Datos PMD!O110:S110`, `CashFlow` fila `TOTALES PMD ==>`).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| pmd_year_id | FK pmd_years | |
| amount | NUMERIC(18,2) | hito anual del cliente |
| locked | BOOLEAN | protección sección 4.4 |
| approved_by | FK users | |
| approval_evidence_attachment_id | FK attachments | |

### 2.12 `schedule_versions`
Origen: no existe versionado explícito en el Excel (una sola distribución "vigente" por celda), pero es requisito no negociable (sección 4.3).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| pmd_series_id / contract_id | FK | ámbito de la versión |
| version_type | VARCHAR(20) | `BASELINE`, `APPROVED`, `FORECAST` |
| cutoff_date | DATE | |
| reason | TEXT | |
| requested_by / approved_by | FK users | |
| status | VARCHAR(20) | Borrador/Aprobado |
| created_at | TIMESTAMPTZ | |

### 2.13 `monthly_schedules`
Origen: `CashFlow` bloques "Original/ene…dic/Actualizado/Diferencia" por año; `PROGvsREAL` columnas "Monto Programado" por mes.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| schedule_version_id | FK schedule_versions | |
| contract_id | FK contracts | |
| pmd_series_id | FK pmd_series | |
| period_year | INT | |
| period_month | INT (1-12) | |
| planned_amount | NUMERIC(18,2) | "Monto Programado" |
| imbalance_flag | BOOLEAN | true si al guardar hubo descuadre (sección 0.2) |
| imbalance_detail | JSONB | monto de la diferencia, mes/serie afectada |

### 2.14 `actual_investments`
Origen: `PROGvsREAL` columna "Monto Real"; slide 3 (Real, OENE, Anticipo, Producción contratada, Producción por licitar).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| contract_id | FK contracts | |
| pmd_series_id | FK pmd_series | |
| period_year / period_month | INT | |
| investment_type | VARCHAR(20) | Estimación/Factura/Anticipo/OENE/Producción/Ajuste/Reversión/Otro |
| gross_amount | NUMERIC(18,2) | |
| amortization | NUMERIC(18,2) | |
| retention | NUMERIC(18,2) | |
| penalty | NUMERIC(18,2) | |
| taxes | NUMERIC(18,2) | |
| recognizable_pmd_amount | NUMERIC(18,2) | monto que sí cuenta para la Curva S real, según criterio de reconocimiento configurado (sección 6.6) |
| status | VARCHAR(20) | Borrador/En revisión/Observado/Aprobado/Cerrado/Anulado/Revertido |
| supersedes_id | FK actual_investments (nullable) | encadena corrección→original (inmutabilidad, sección 4.2) |
| evidence_attachment_id | FK attachments | |
| captured_by / validated_by | FK users | |

### 2.15 `invoices` / `estimates` / `oene_records`
Sub-tipos especializados de `actual_investments` con campos propios de trazabilidad documental.

`invoices`: `invoice_number`, `issue_date`, `due_date`, `contract_id`, `actual_investment_id`.
`estimates`: `estimate_number`, `period_start`, `period_end`, `contract_id`, `actual_investment_id`.
`oene_records` — origen directo del slide 4 (`Estatus OENEs`):

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| contract_id | FK contracts | |
| purchase_order | VARCHAR(50) | ej. `GDL-OC-0007238` |
| contracted_budget | NUMERIC(18,2) | "$ Ppto. Contratado" |
| oene_total | NUMERIC(18,2) | "$ OENE" |
| oene_contracted | NUMERIC(18,2) | "$ OENE Contratada" |
| oene_to_regularize | NUMERIC(18,2) | "$ OENE por Regularizar" |
| oene_to_invoice | NUMERIC(18,2) | "$ OENE Por Facturar" |
| oene_percentage | NUMERIC(7,4) | "% OENE" |
| period | DATE | corte del reporte |

### 2.16 `milestones`
Origen: título "Hitos mensuales por cumplir" (slide 5, sin tabla en el archivo) + sección 11 del prompt maestro.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| scope_type | VARCHAR(20) | `ANNUAL`, `MONTHLY`, `MANAGEMENT` |
| pmd_series_id / contract_id | FK (nullable) | |
| name | VARCHAR(300) | ej. "Diseño terminado", "Fallo", "Anticipo" |
| baseline_date | DATE | |
| forecast_date | DATE | |
| actual_date | DATE | |
| responsible_user_id | FK users | |
| status | VARCHAR(20) | |
| decision_deadline | DATE | slide 9 ("30/sep", "15/oct") |
| protected_amount | NUMERIC(18,2) | **[Recomendado]** |

### 2.17 `risks`
Origen: slides 7-8 (Contratista, Alcance, MDP, Mes, Riesgo, Restricciones, Acción inmediata).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| contract_id | FK contracts | |
| exposed_amount | NUMERIC(18,2) | columna "MDP" |
| exposure_period | VARCHAR(20) | "Ago-dic", "Dic" — texto libre de origen |
| risk_level | VARCHAR(20) | `ALTO`/`MEDIO` observados; `BAJO`/`CRITICO` **[Recomendado]** para completar la matriz |
| stage_group | VARCHAR(30) | "en construcción" / "en licitación" (agrupador de slides 7/8) |
| status | VARCHAR(20) | Identificado/En evaluación/Acción requerida/En mitigación/Escalado/Materializado/Cerrado/Aceptado |
| trend | VARCHAR(10) | **[Recomendado]** |
| evidence_attachment_id | FK attachments | |

### 2.18 `risk_assessments`
Origen: matriz Probabilidad×Impacto — **[Recomendado en su totalidad]**, no observada en las fuentes; se implementa configurable, sembrada solo con los niveles vistos.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| risk_id | FK risks | |
| probability | INT (1-5) | |
| impact | INT (1-5) | |
| impact_dimension | VARCHAR(20) | PMD/Costo/Plazo/Alcance/Calidad/Operación/Reputación/Contrato |
| assessed_at | TIMESTAMPTZ | |

### 2.19 `constraints`
Origen: columna "Restricciones" del slide 7/8 (texto extenso, ej. reubicación pendiente de SEDENA).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| risk_id | FK risks | |
| description | TEXT | texto original íntegro |
| cause | TEXT | **[Recomendado]** desglose estructurado |
| consequence | TEXT | **[Recomendado]** |

### 2.20 `actions`
Origen: columna "Acción inmediata" (ej. "Validar frentes, recursos y curva de recuperación...") y slide 9 (Decisiones requeridas).

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| risk_id | FK risks (nullable) | |
| milestone_id | FK milestones (nullable) | |
| description | TEXT | |
| responsible_user_id | FK users | **[Recomendado]**, no explícito en el PPTX |
| commitment_date | DATE | |
| decision_deadline | DATE | slide 9 |
| status | VARCHAR(20) | |

### 2.21 `approval_requests` / `approval_steps`
Sección 12.2. Sin equivalente directo en las fuentes; requerido por los principios no negociables.

`approval_requests`: `id`, `entity_type`, `entity_id`, `request_type` (corrección/reversión/hito/etc.), `status` (Borrador/Enviado/En revisión/Observado/Aprobado/Rechazado/Aplicado/Cancelado), `requested_by`, `reason`, `before_value` JSONB, `after_value` JSONB, `monthly_impact` JSONB, `annual_impact` NUMERIC.
`approval_steps`: `id`, `approval_request_id`, `step_order`, `approver_user_id`, `decision`, `decided_at`, `comments`.

### 2.22 `attachments`
Polimórfico: `id`, `entity_type`, `entity_id`, `file_name`, `file_hash`, `storage_path`, `uploaded_by`, `uploaded_at`.

### 2.23 `import_batches` / `import_mappings`
Reservadas para Fase 5 — ver `PMD_VERSIONING_RULES.md`. Estructura documentada ahí; no se crean migraciones activas en v1 más allá de la tabla vacía si se desea reservar el nombre.

### 2.24 `reconciliation_results`
Origen: sección 6.7/8.

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| scope_type | VARCHAR(30) | mes-vs-año, contrato-vs-serie, serie-vs-aeropuerto, aeropuerto-vs-hito, programado-vs-saldo, facturado-vs-vigente |
| scope_ref_id | UUID | entidad evaluada |
| expected_value / actual_value / difference | NUMERIC(18,2) | |
| tolerance | NUMERIC(18,2) | |
| severity | VARCHAR(20) | Error/Advertencia/Informativo |
| generated_at | TIMESTAMPTZ | |
| resolved | BOOLEAN | |

### 2.25 `accounting_periods` / `period_snapshots`
Sección 12.4. `accounting_periods`: `id`, `pmd_year_id`, `period_month`, `status` (Abierto/Cerrado), `closed_by`, `closed_at`, `reopened_reason`.
`period_snapshots`: `id`, `accounting_period_id`, `snapshot_data` JSONB, `created_at`.

### 2.26 `users` / `roles` / `permissions` / `user_scopes`
Estándar RBAC. `user_scopes`: `id`, `user_id`, `client_id`, `airport_id`, `module`, `action`, `monetary_ceiling`.

### 2.27 `audit_logs`
Sección 12.3. `id`, `user_id`, `action`, `entity_type`, `entity_id`, `before_value` JSONB, `after_value` JSONB, `reason`, `occurred_at`, `ip_address`, `session_id`, `related_approval_id`. Inmutable desde la interfaz (solo INSERT vía backend).

### 2.28 `notifications`
`id`, `user_id`, `type`, `payload` JSONB, `read_at`, `created_at`.

## 3. Catálogos iniciales confirmados (no inventados)

- **Grupos de inversión:** Diseño, Obra, Procura, Dirección de Proyecto/STE (+ Otros [Recomendado]).
- **Categorías de gasto (ASUR):** Preliminares, Obras Inducidas, Obra Nueva, Infraestructura, Equip. Edificio, Equip. IT, Mobiliario, Equip. Aeroportuario, BHS, Seguridad, Diseño, Dirección proyecto y STE.
- **Origen del costo (ASUR):** 1-Contrato, 2-Licitación, 3-Cotización, 4-Presupuesto DC, 5-Pres. ASUR, 6-Estimación In House, 7-Pres. Diseñador, 8-PMD (más el valor atípico `CERRADO`, a reclasificar como estado, ver ambigüedad §3.3 en `DESIGN_BASELINE.md`).
- **Niveles de riesgo observados (GAP):** ALTO, MEDIO.
- **Componentes del faltante (GAP):** Anticipo, Producción por licitar, OENE, Producción contratada.

## 4. Índices y restricciones críticas

- `UNIQUE (pmd_series.pmd_year_id, pmd_series.code)`.
- `UNIQUE (contracts.client_id, contracts.contract_number)`.
- `UNIQUE (monthly_schedules.schedule_version_id, contract_id, period_year, period_month)`.
- `CHECK` de rango en `risk_assessments.probability/impact` (1-5).
- `FOREIGN KEY ... ON DELETE RESTRICT` en toda tabla transaccional (no borrado físico, sección 4.5).
- Índices por `(client_id, airport_id, pmd_year_id)` en las tablas de alto volumen de lectura (`monthly_schedules`, `actual_investments`, `audit_logs`).
