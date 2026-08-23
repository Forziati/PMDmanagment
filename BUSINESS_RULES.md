# BUSINESS RULES — PMD CONTROL HUB

> Reglas de negocio derivadas de las secciones 4, 6, 8, 9, 10, 12 y 22 del prompt maestro, ya incorporando los ajustes de alcance v1 de la sección 0. Toda regla marcada **(v1 suspendida)** se documenta íntegra pero no se implementa hasta Fase 5.

## 1. Principios no negociables (vigentes en v1)

1. **Fuente única de verdad:** todo acumulado/dashboard se calcula en backend desde `monthly_schedules` y `actual_investments`. Ningún total consolidado es editable manualmente.
2. **Inmutabilidad de la inversión real:** un registro `actual_investments` en estado `Aprobado`/`Cerrado` no se edita ni borra. Toda corrección crea un nuevo registro con `supersedes_id` apuntando al original, que permanece visible.
3. **Versionado de programación:** cambios a `monthly_schedules` solo mediante nueva `schedule_versions` (`BASELINE` nunca se sobrescribe; `APPROVED` y `FORECAST` son mutables mediante nueva versión, no update in place).
4. **Protección del hito anual:** `annual_targets.locked = true` por defecto tras aprobación inicial; su modificación exige un `approval_request` con evidencia y genera alerta de gobernanza.
5. **No borrado físico:** ninguna tabla transaccional permite `DELETE` desde la aplicación; los estados `Anulado`/`Revertido`/`Retirado` cumplen esa función.
6. **Segregación de funciones — (v1 suspendida):** no se valida que el aprobador sea distinto del solicitante. El resto de la sección 4.5 (no borrado, uso de estados) sigue vigente.

## 2. Programación mensual (sección 6.4, con el reemplazo de la sección 0.2)

- La matriz de captura valida en cliente y servidor: tipo monetario (`Decimal`, 2 formatos: pesos y MDP) y periodo válido (mes 1-12 dentro del año PMD vigente).
- **Comportamiento de descuadre (reemplaza el bloqueo estricto):**
  - Si `SUM(monthly_schedules por serie/contrato en el año) ≠ pmd_series.updated_amount` (o el contrato excede el disponible de la serie), el sistema **no bloquea el guardado**.
  - Se muestra una alerta con: monto de la diferencia, mes o serie/contrato afectado, y una opción de solución sugerida (ajustar automáticamente el mes que genera la diferencia, o aceptar el descuadre tal cual).
  - Al confirmar el guardado con la alerta presente, el backend crea automáticamente un registro en `audit_logs` con: descuadre, monto, serie/contrato/mes afectado y usuario que guardó — sin excepción, de forma transaccional junto con el guardado de `monthly_schedules`.
  - Las celdas modificadas se resaltan en la UI hasta que la versión se guarda.

## 3. Inversión real y facturación (sección 6.5)

- Tipos válidos: Estimación, Factura, Anticipo, OENE, Producción, Ajuste, Reversión, Otro.
- Estados válidos: Borrador → En revisión → Observado → Aprobado → Cerrado; o Anulado/Revertido desde cualquier estado previo a Cerrado.
- **Detección de duplicados** antes de guardar: mismo `contract_id` + mismo número de documento (factura/estimación) + misma fecha + mismo importe + mismo proveedor ⇒ bloquea el alta (a diferencia del descuadre de programación, este control sí es bloqueante porque protege contra doble registro de gasto real, consistente con la sección 6.7/Centro de Calidad).
- Ningún registro `Aprobado`/`Cerrado` se edita directamente: toda corrección pasa por `approval_requests` (motivo, evidencia, valor anterior/propuesto) y genera un nuevo `actual_investments` enlazado por `supersedes_id`.

## 4. Definición de inversión real PMD (sección 6.6)

- Cada cliente/aeropuerto/año (y opcionalmente tipo de inversión) configura **un único estado oficial de reconocimiento** entre: Producción ejecutada, Estimación presentada, Estimación validada, Prefactura aprobada, Factura emitida, Factura reconocida por el cliente, Factura pagada, Anticipo reconocido, OENE reconocida.
- Un registro puede tener varias fechas/estados asociados, pero solo el monto correspondiente al estado configurado alimenta `recognizable_pmd_amount` y, por tanto, la Curva S real.
- El dashboard siempre muestra: criterio utilizado, fecha de corte, fuente del dato, última conciliación (sección 6.6, último párrafo).
- **Hallazgo de las fuentes:** ni ASUR (que solo usa "Erogado") ni GAP (que distingue Producción/OENE/Anticipo pero no expone explícitamente "factura pagada" vs. "reconocida") usan las 9 categorías completas — se ofrecen todas como catálogo configurable, sembrando cada cliente solo con lo que su fuente evidencia.

## 5. Cálculos obligatorios (sección 8) — ejecutados en backend, `Decimal`

```
Programado_mensual(serie|contrato, año, mes) = Σ monthly_schedules.planned_amount (versión vigente aprobada)
Programado_acumulado(corte) = Σ Programado_mensual desde enero del año hasta el mes de corte
Real_mensual(serie|contrato, año, mes) = Σ actual_investments.recognizable_pmd_amount del mes
Real_acumulado(corte) = Σ Real_mensual desde enero hasta el corte
Desviación_monetaria = Real_acumulado - Programado_acumulado
Desviación_porcentual = Desviación_monetaria / Programado_acumulado   (si Programado_acumulado = 0 ⇒ null, no división por cero)
Faltante_al_hito = MAX(0, annual_targets.amount - Real_acumulado)
Saldo_contractual = contracts.current_amount - Σ actual_investments.recognizable_pmd_amount (acumulado histórico del contrato)
Forecast_de_cierre = Real_acumulado + Σ FORECAST aprobado de meses futuros del año
Riesgo_de_incumplimiento = MAX(0, annual_targets.amount - Forecast_de_cierre)
```

- Convención de signos: todos los montos se almacenan positivos; "Diferencia"/"Variación" siguen la fórmula `Real - Programado` (positivo = superávit de ejecución, negativo = atraso), configurable por cliente si se requiere invertir el signo.
- Presentación: pesos como `$1,234,567.89`; millones como `$1,234.57 MDP` (factor 1,000,000, redondeo solo en presentación, nunca en el dato almacenado).

## 6. Detección automática de retrasos (sección 9)

Reglas configurables (umbral por cliente), evaluadas en batch o al consultar el dashboard:

1. Real mensual < Programado mensual.
2. Desviación porcentual > umbral configurado.
3. Forecast de cierre < hito anual.
4. Contrato activo sin `actual_investments` en N meses consecutivos (configurable).
5. Paquete en etapa "Listo para licitar" por más de N días sin pasar a "Licitación"/"Contratado".
6. Anticipo pagado (`contracts.advance_amount > 0`) sin amortización registrada tras N meses.
7. Concentración: > X% del programado anual restante cae en los últimos 2 meses del año (patrón observado directamente en GAP: 51% del faltante ago-dic es Anticipo, concentrado en diciembre).
8. `constraints`/`actions` con `decision_deadline` vencida sin cierre.
9. `milestones` con `forecast_date` pasada y `status ≠ Cumplido`.
10. `monthly_schedules.planned_amount` acumulado > `contracts.current_amount` (saldo contractual excedido).
11. `pmd_series` sin ningún `contract_series_allocations` activo (serie sin cobertura contractual).

Una reprogramación (nueva `schedule_versions`) nunca reemplaza visualmente a la anterior: el dashboard siempre puede mostrar línea base + vigente + forecast + real superpuestos, y el historial de reprogramaciones queda listado.

## 7. Riesgos y protección de inversión (sección 10)

- Matriz configurable Probabilidad(1-5) × Impacto(1-5) ⇒ Bajo/Medio/Alto/Crítico, sembrada inicialmente solo con los niveles evidenciados en las fuentes (Alto, Medio) y editable por cliente.
- Alertas automáticas cuando: un riesgo `Alto`/`Crítico` no tiene acción, responsable o fecha; una acción/decisión vence; la exposición (`exposed_amount`) aumenta respecto a la evaluación anterior; el forecast cae; un paquete permanece sin contratar más allá del umbral; hay concentración excesiva de programado en los últimos meses del año.
- Flujo de estados: Identificado → En evaluación → Acción requerida → En mitigación → Escalado → Materializado → Cerrado / Aceptado.

## 8. Hitos de control (sección 11)

- Tres tipos: `ANNUAL` (hito del cliente), `MONTHLY` (hitos mensuales de inversión), `MANAGEMENT` (diseño terminado, listo para licitar, publicación, fallo, contrato, anticipo, inicio de producción, estimación, prefactura, factura reconocida).
- Cada hito registra `baseline_date`, `forecast_date`, `actual_date`, desviación calculada, responsable, prerrequisitos (**[Recomendado]**, no evidenciado en fuentes), evidencia, estado, monto protegido, `decision_deadline` (evidenciado en slide 9: "30/sep", "15/oct" como fechas límite de decisión).

## 9. Autorizaciones, auditoría y cierres (sección 12)

- Flujo estándar: Borrador → Enviado → En revisión → Observado → Aprobado / Rechazado → Aplicado → Cancelado.
- El aprobador siempre visualiza antes/después, impacto mensual y anual, elementos afectados y evidencia antes de decidir.
- `audit_logs` registra usuario, acción, entidad, valor anterior/nuevo, motivo, fecha/hora, IP, sesión, autorización relacionada, estado — nunca editable desde la interfaz (solo insertable por el backend).
- **Cierre mensual:** ejecuta el motor de conciliación (sección 6.7), revisa incompletos/duplicados/flujos/descuadres pendientes, genera `period_snapshots`, marca `accounting_periods.status = Cerrado`. Reapertura requiere `approval_request` de tipo especial. Los dashboards que consultan un periodo cerrado deben reproducir exactamente los valores del snapshot correspondiente, no recalcular contra datos posteriores.

## 10. Motor de conciliación y Centro de Calidad (sección 6.7)

Comparaciones ejecutadas de forma continua o al cierre, cada una genera un `reconciliation_results`:

1. Suma mensual vs. total anual (serie/contrato).
2. Contratos vs. series (vía `contract_series_allocations`).
3. Series vs. aeropuerto.
4. Aeropuerto vs. hito.
5. Programado vs. saldo contractual.
6. Facturado vs. monto vigente.
7. Distribución entre series (cuando un contrato se reparte en varias).
8. Versión aprobada vs. publicada — **(v1 suspendida)**, aplica solo cuando exista versionado de Excel (Fase 5); en v1 se reduce a "versión aprobada vs. versión vigente interna".

Fuera de tolerancia ⇒ alerta roja con origen, diferencia y detalle. Solo los "Errores bloqueantes" (definidos por cliente, ej. facturado > monto vigente en más de X%) impiden el cierre; el resto queda como advertencia visible en el Centro de Calidad (Errores, Advertencias, Duplicados, Datos incompletos, Descuadres, Cambios pendientes, Importaciones fallidas [vacío en v1, reservado para Fase 5], Periodos sin cerrar).

## 11. Criterios de aceptación críticos (sección 22, ajustados por sección 0)

- [ ] No se puede modificar inversión cerrada sin autorización.
- [ ] Si se corrige un registro, el valor original permanece visible y vinculado con la corrección (`supersedes_id`).
- [ ] **(v1 suspendido)** Nadie aprueba su propia solicitud.
- [ ] El hito anual no se edita libremente (requiere `approval_request`).
- [ ] La línea base (`schedule_versions.version_type = BASELINE`) nunca se sobrescribe.
- [ ] Los acumulados se reconstruyen desde transacciones (`monthly_schedules`/`actual_investments`), nunca desde un campo editable.
- [ ] Un contrato que supera su monto vigente muestra alerta con opción de solución y genera asiento en bitácora (no bloquea el guardado).
- [ ] Contratos, series, aeropuerto y total anual concilian, o el descuadre queda advertido y registrado en bitácora si el usuario decide guardarlo igual.
- [ ] El dashboard advierte datos no conciliados (badge visible, no oculto).
- [ ] No existe borrado irreversible ni edición directa de montos aprobados de facturas.
- [ ] Existe historial de versiones, usuario responsable y motivo del cambio.
- [ ] Los montos no usan `float` (tipo `Decimal`/`NUMERIC` en toda la cadena, incluido el ORM).
- [ ] Los cierres históricos permanecen inmutables (snapshot congelado).
- [ ] Cada KPI permite drill-down al origen transaccional.
- [ ] Los riesgos altos/críticos sin acción, responsable o fecha generan alerta.
- [ ] La aplicación no depende de fórmulas en un Excel externo para operar.
- [ ] **(v1 suspendidos, Fase 5)** Importación repetida no duplica registros; reconocimiento automático de plantilla; exportación/reimportación con correspondencia; versión candidata + comparación antes de publicar; versión anterior histórica consultable; inversión real y auditoría no se pierden al publicar una revisión.
