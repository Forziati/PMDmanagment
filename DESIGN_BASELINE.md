# DESIGN BASELINE — PMD CONTROL HUB

> Fuente: `260803_CUN_CF_CashFlow_A_PMD2024_41.xlsx` (ASUR, Cancún) y `GAP_GDL - Cash flow - análisis de riesgos - 260820 Rev 04.pptx` (GAP, Guadalajara), analizados celda por celda y diapositiva por diapositiva. Este documento es la fuente oficial de entendimiento y alcance para v1/MVP. Ver `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`, `SYSTEM_ARCHITECTURE.md`, `MVP_BACKLOG.md` y `PMD_VERSIONING_RULES.md` para el detalle de cada dominio.

## 1. Interpretación del problema

Hoy, el control del Plan Maestro de Desarrollo (PMD) de cada aeropuerto vive en un libro de Excel monolítico con ~12 hojas interdependientes por fórmulas cruzadas (`CashFlow` alimenta `ASUR`, `Proyección x mes`, `Erogación x mes`, `DATOS`, y estos alimentan los `Resumen CashFlow AAAA`). Es una única fuente de verdad frágil: un cambio de fila desalinea referencias, no hay historial de quién cambió qué, y la reconciliación programado-vs-real depende de que nadie rompa una fórmula.

El PPTX de GAP muestra el consumo ejecutivo de esos datos: un tablero de control presupuestal con Curva S, KPIs de cumplimiento, desglose del faltante por naturaleza de gasto (OENE, anticipo, producción contratada/por licitar) y una sección de riesgos por contrato con restricciones y acciones en texto libre.

El encargo es reemplazar ambos artefactos por un sistema transaccional: la matriz de captura (Excel) se convierte en formularios/matrices con reglas de negocio y bitácora; el tablero (PPTX) se convierte en un dashboard vivo que se recalcula desde la base de datos, no desde una exportación manual congelada en una fecha.

**Ajuste de alcance v1 (sección 0 del prompt maestro, ya incorporado en todo este documento):**
1. No hay segregación de funciones/auto-aprobación en v1.
2. Los descuadres de programación mensual no bloquean el guardado; generan alerta + bitácora.
3. No hay importación/exportación de Excel ni versionado de archivo PMD en v1 — captura 100% manual. Ver `PMD_VERSIONING_RULES.md` como especificación de Fase 5.

## 2. Mapa de la lógica de los archivos

### 2.1 Excel — cadena de hojas y su rol

| Hoja | Rol | Relación |
|---|---|---|
| `Datos PMD` (oculta) | Fuente maestra de cantidades, precios unitarios y % de distribución anual por proyecto/subsector, con factor de escalación por año | Alimenta `PMD 24-28` (tabla dinámica) |
| `PMD 24-28` | Tabla dinámica de verificación: Serie/Sector → Subsector/Proyecto, PMD Anexo 6 vs. PMD actualizado, distribución 2024-2028 | Vista de control, no transaccional |
| `Listas desplegables` (oculta) | Catálogos: `Categorías` (Preliminares, Obras Inducidas, Obra Nueva, Infraestructura, Equip. Edificio, Equip. IT, Mobiliario, Equip. Aeroportuario, BHS, Seguridad, Diseño, Dirección proyecto y STE) y `Origen del Costo` (1-Contrato … 8-PMD, más el valor atípico `CERRADO`) | Data validation de `CashFlow` |
| `CashFlow` | **Hoja transaccional maestra** (155 columnas). Una fila = un proyecto/paquete dentro de una serie, con: PMD base dic-22, PMD actualizado por año (2024-2028) con % y factor de escalación, presupuesto/contrato original, OC/TNE, proveedor, responsable, origen del costo, y por cada año un bloque Original/mensual Programado/Actualizado/Diferencia + columna "Concepto" + Estimado MXN | Fuente de `ASUR`, `Proyección x mes`, `Erogación x mes` |
| `PROGvsREAL` | Espejo de `CashFlow` pero mensual con **Programado / Real / Variación** por cada uno de los 60 meses (2024-2028) más acumulados anuales por CAPEX | Fuente de `Resumen CashFlow AAAA` |
| `Resumen CashFlow 2024/2025/2026` | Vista ejecutiva anual: A. Programado, B. Real, C. Balance — cada uno desglosado en 4 grupos (i. Diseño, ii. Obra, iii. Procura, iv. Dirección Proyecto y STE), acumulados y variación, más tabla lateral "Montos más representativos" (Grupo/Partida, Empresa, Contrato, Monto MDP) | Consumida directamente por dirección |
| `ASUR` | Consolidado por contrato: Serie, Contrato, Contratista, Proyecto, Monto PMD, distribución PMD por año, monto proyectado y distribución, erogado por año — todo por fórmula (`=CashFlow!...`, `=PROGvsREAL!...`) | Reporte de lectura |
| `Proyeccion x mes` / `Erogacion x mes` / `DATOS` | Series de tiempo mes a mes por contrato de "lo que se planea gastar" vs. "lo efectivamente erogado", con acumulado anual calculado por `SUM()` | Insumo de análisis y de las hojas Resumen |

**Jerarquía real observada:** `Serie PMD (código numérico, ej. 101, 104, 106…) → Sector → Subsector → Proyecto/Paquete (fila) → Contrato/OC (columna dentro de la misma fila) → Distribución mensual (Programado) → Erogado (Real)`. Es decir, en el Excel de origen **el contrato vive como atributo de la fila del proyecto**, no como entidad independiente con relación muchos-a-muchos — ver ambigüedad §4.1.

### 2.2 PowerPoint — lógica del tablero ejecutivo

| Slide | Contenido | Mapeo en la app |
|---|---|---|
| 2 | KPI de cumplimiento mensual: real acumulado vs. programado acumulado vs. programado anual (barras), narrativa de desfase en MDP y % | KPIs de Dashboard §7.2, gráfico de barras Hito/Programado/Real §7.5 |
| 3 | Curva S apilada por naturaleza: Real, OENE, Anticipo, Producción por licitar, Producción contratada, acumulada mes a mes | Curva S §7.3, con las mismas categorías como series apilables opcionales |
| 4 | Estatus de OENE por Orden de Compra: Contratista, Alcance, Ppto. Contratado, OENE, OENE Contratada, OENE por Regularizar, OENE por Facturar, % OENE | Módulo OENE (`oene_records`), tabla ejecutiva de excepciones |
| 5 | Hitos mensuales por cumplir (solo título, sin tabla explícita en el archivo fuente) | Módulo de Hitos §11 — **campo recomendado**: la estructura de esta vista no está en el archivo, se propone según lo pedido en la sección 11 del prompt maestro |
| 6 | Desglose del faltante ago-dic 2026: dona (Anticipo 51%, Producción por licitar 3%, OENE 4%, Producción contratada 42%) + tabla mensual por concepto/contrato | Desglose del faltante §7.4 (dona + drill-down) |
| 7-8 | "Principales exposiciones": tabla Contratista, Alcance, MDP, Mes, Riesgo (Alto/Medio), Restricciones (texto libre), Acción inmediata (texto libre) — separada en "en construcción" y "en licitación" | Riesgos y acciones §10, con Restricciones/Acciones como entidades vinculadas al contrato |
| 9 | Decisiones requeridas próximos 30 días (lista de compromisos con fecha límite) | Acciones de gobernanza / hitos de decisión §11 |

### 2.3 Análisis de estructura del Excel y estrategia de reconocimiento (para Fase 5)

Aunque la importación queda **suspendida en v1**, documentamos la estrategia de reconocimiento como diseño de referencia (ver `PMD_VERSIONING_RULES.md`):

- **Ancla de reconocimiento:** encabezados de dos filas (`fila 4` + `fila 5` en `CashFlow`) con etiquetas fijas (`serie`, `Categoría`, `Proyecto`, `PMD - ANEXO 6`, patrón repetido `Original/mes.../Actualizado/Diferencia/Concepto` por año).
- **Clave de negocio candidata por fila:** combinación `Serie (col A) + Proyecto (col C) + No. contrato (col W)`, ya que no existe un ID técnico explícito en el archivo de origen — ver ambigüedad §4.2.
- **Detección de plantilla:** contar bloques repetidos de 26 columnas (Original + 12 meses×2 sub-bloques + Actualizado + Diferencia + Concepto) por año PMD para inferir cuántos años cubre el archivo.
- **Catálogos embebidos:** `Listas desplegables` ya contiene los catálogos de Categoría y Origen del Costo — reconocerlos y ofrecerlos como candidatos de mapeo a los catálogos de la app, nunca inventar valores nuevos.

## 3. Ambigüedades detectadas

1. **Cardinalidad contrato↔serie/proyecto.** El prompt maestro (§6.3) exige que un contrato pueda aportar a varias series mediante distribución explícita. El Excel de origen no modela esto: el número de contrato es una columna de la fila del proyecto (1:1 fila↔contrato). **Propuesta:** modelar `contract_series_allocations` como tabla M:N desde v1 (aunque la UI de captura por defecto asuma 1:1, replicando el hábito del Excel), sin bloquear el caso M:N cuando se requiera.
2. **Ausencia de ID técnico estable en el Excel.** No hay UUID ni clave numérica de fila; la única clave utilizable es la combinación Serie+Proyecto+Contrato, que puede repetirse en encabezados/subtotales (ej. fila `TOTALES PMD ==>`). **Propuesta:** la app genera sus propios IDs (PK autonumérica/UUID) desde el alta manual en v1; la reconciliación por clave de negocio queda para Fase 5.
3. **Catálogo `Origen del Costo` contiene un valor de estado (`CERRADO`) mezclado con niveles de definición contractual (1-Contrato…8-PMD).** Es una inconsistencia de datos de origen, no un error de lectura. **Propuesta:** separar en dos catálogos independientes en la app — `origen_costo` (nivel de definición/madurez del monto) y `estado_contractual` (incluye Cerrado) — y señalar la mezcla como hallazgo típico para el Centro de Calidad.
4. **Terminología y granularidad de "Serie PMD" difiere entre ASUR y GAP.** ASUR usa códigos numéricos de sector (101, 104, 106…) como "Serie"; el PPTX de GAP no expone una columna de Serie en sus tablas de OENE/riesgo, solo Contratista/Alcance/OC. **Propuesta:** todo mapeo Serie↔Grupo↔Etapa debe ser configurable por cliente (confirmando lo indicado en la sección 2 del prompt maestro), sin asumir que la codificación de ASUR aplica a GAP.
5. **Criterio de "inversión real" no es uniforme.** El Excel de ASUR reconoce como real lo "Erogado" (columna única, sin distinguir estimación/factura/pago). El PPTX de GAP distingue Producción, OENE y Anticipo como componentes separados del faltante, y en las diapositivas de riesgo aparecen niveles de reconocimiento (Producción, OENE reconocida, Anticipo reconocido) más cercanos a la lista de la sección 6.6 del prompt maestro. **Propuesta:** el criterio oficial de reconocimiento PMD (sección 6.6) debe configurarse por cliente; ninguno de los dos archivos usa el catálogo completo de 9 estados del prompt maestro — se marcan como **campos recomendados** los estados no observados directamente (Prefactura aprobada, Factura reconocida por el cliente, Factura pagada).
6. **Matriz de riesgo Probabilidad×Impacto (1-5) del prompt maestro no aparece en las fuentes.** El PPTX solo usa dos niveles observados (`ALTO`, `MEDIO`); no hay evidencia de `BAJO` ni `CRÍTICO` ni de una matriz numérica. **Propuesta:** mantener la matriz configurable de la sección 10.1 como diseño (campo recomendado), pero sembrar el catálogo inicial únicamente con los niveles observados y permitir ampliarlo por cliente.
7. **Restricciones y acciones son texto libre extenso en el PPTX**, no campos estructurados (no hay responsable explícito, ni fecha límite de decisión como campo — "Mes" es el único dato temporal). **Propuesta:** capturar el texto original íntegro en un campo `descripcion` y ofrecer campos estructurados adicionales (`responsable`, `fecha_compromiso`, `fecha_limite_decision`) como **campos recomendados**, nunca derivados automáticamente del texto libre.
8. **Factor de escalación (`Fact. 24`…`Fact. 28`) y tipos de cambio USD/EUR** aparecen en `CashFlow!S3:T3` pero el prompt maestro fija MXN como moneda inicial. **Propuesta:** modelar el factor de escalación como configuración por año/cliente (afecta el cálculo de PMD actualizado a partir del PMD base), y dejar el soporte multimoneda fuera de v1, documentado como riesgo/backlog futuro — no se ignora el dato, se conserva en el diccionario como campo de solo lectura/futuro.
9. **Duplicidad de "Programado" en dos niveles de firmeza.** `CashFlow` tiene un "Programado" implícito en el PMD actualizado (nivel serie/año) y `PROGvsREAL` tiene un "Programado" mensual por contrato — no siempre suman exactamente igual entre sí en el archivo de origen (ligeras diferencias de redondeo/factor). Esto es precisamente el tipo de descuadre que la sección 6.4/0.2 pide **no bloquear pero sí alertar y auditar**.

> Regla ante contradicciones (aplicada): cuando el Excel, el PPTX y el prompt maestro difieren, se conserva el dato original de cada fuente, se documenta la diferencia arriba, y se propone una regla configurable — no se decide silenciosamente.

## 4. Roles y permisos

Basado en la sección 12.1 del prompt maestro, sin cambios para v1 (matriz de permisos vive en `BUSINESS_RULES.md`):

Administrador, Director PMO, Control Presupuestal, Planificador, Contratos, Riesgos, Capturista, Revisor, Aprobador, Consulta Ejecutiva, Auditor.

Permisos configurables por cliente × aeropuerto × módulo × dato × acción × nivel monetario (tabla `user_scopes` + `permissions`, ver `DATA_DICTIONARY.md`).

## 5. Lista de pantallas (v1/MVP)

1. Login / selector de contexto (cliente, aeropuerto, ciclo, año).
2. Dashboard ejecutivo (KPIs, Curva S, desglose del faltante, barras Hito/Programado/Real, tabla de excepciones).
3. Administración: clientes, aeropuertos, ciclos, años, catálogos (grupos, categorías, origen del costo, estados), usuarios/roles/permisos, umbrales de alerta.
4. Series PMD: alta/edición/listado, vínculo a hito anual.
5. Contratos y paquetes: alta/edición/listado, estados contractuales, vínculo a series (`contract_series_allocations`).
6. Programación mensual: matriz serie/contrato × mes, con alertas de descuadre y sugerencia de ajuste (sección 0.2).
7. Inversión real y facturación: captura de estimación/factura/anticipo/OENE/producción/ajuste/reversión, con flujo de estados.
8. Configuración de criterio de reconocimiento PMD (sección 6.6) por cliente/aeropuerto/año.
9. Centro de Calidad: errores, advertencias, duplicados, incompletos, descuadres, cambios pendientes, periodos sin cerrar.
10. Riesgos y protección de inversión: listado de exposición, matriz de riesgo, restricciones, acciones, responsables.
11. Hitos de control: anual, mensuales, de gestión.
12. Autorizaciones: bandeja de solicitudes (borrador→enviado→revisión→aprobado/rechazado→aplicado).
13. Auditoría: bitácora de cambios, filtros por usuario/entidad/fecha.
14. Cierre mensual: checklist de conciliación, snapshot, congelamiento.
15. Reportes: exportación Excel/CSV/PDF por los formatos de la sección 14 (excluyendo comparación de versiones PMD, que es Fase 5).

## 6. APIs (resumen — detalle de contratos en `SYSTEM_ARCHITECTURE.md`)

REST/JSON versionado (`/api/v1`), paginado y filtrable, por recurso: `clients`, `airports`, `pmd-cycles`, `pmd-years`, `pmd-series`, `companies`, `contracts`, `contract-series-allocations`, `annual-targets`, `schedule-versions`, `monthly-schedules` (incluye endpoint de validación de descuadre no bloqueante), `actual-investments`, `invoices`, `estimates`, `oene-records`, `milestones`, `risks`, `risk-assessments`, `constraints`, `actions`, `approval-requests`, `reconciliation-results`, `accounting-periods`, `audit-logs`, `users`, `roles`, `permissions`. Todos con autorización RBAC + scope por cliente/aeropuerto, validación server-side y transacciones ACID en escritura.

## 7. Plan del MVP

Ver `MVP_BACKLOG.md` para el backlog detallado por fase. Resumen:

- **Fase 3 (MVP):** autenticación, estructura PMD (cliente→año→serie→contrato), programación mensual con captura manual + alertas + bitácora, inversión real, hito anual, dashboard ejecutivo, riesgos/acciones, autorizaciones, auditoría, Docker Compose.
- **Excluido de v1:** importación/exportación Excel, comparación y publicación de versiones PMD, segregación de funciones estricta (todo documentado en `PMD_VERSIONING_RULES.md` y retomado en Fase 5).

## 8. Estructura de carpetas propuesta

Ver detalle completo en `SYSTEM_ARCHITECTURE.md §7`.

## 9. Criterios de aceptación

Ver lista completa y verificable en `BUSINESS_RULES.md §6` (deriva literalmente de la sección 22 del prompt maestro, ya ajustada por la sección 0).

## 10. Flujo de importación/exportación y versionado PMD

Diseñado en su totalidad como especificación de referencia para Fase 5 — ver `PMD_VERSIONING_RULES.md`. No forma parte de la construcción del MVP.
