# PMD VERSIONING RULES — Especificación de referencia para Fase 5

> **Este documento describe funcionalidad suspendida para v1** (sección 0, punto 3, y secciones 13/13.1 completas del prompt maestro). Se conserva íntegro como especificación de diseño para cuando el proyecto llegue a Fase 5 (`MVP_BACKLOG.md`). Ninguna de las reglas aquí descritas se implementa en el MVP: en v1 toda captura de datos es manual dentro de la aplicación.

## 1. Concepto

El archivo Excel PMD (ej. `260803_CUN_CF_CashFlow_A_PMD2024_41.xlsx`) es, hoy, el documento oficial de referencia entregado o validado por el cliente. En Fase 5, cada archivo completo cargado se tratará como una versión del plan (`PMD 2027 Rev00`, `Rev01`, `Rev02`, …), gestionada mediante las tablas reservadas `pmd_versions`, `pmd_version_files`, `pmd_version_comparisons`, `pmd_version_changes`, `pmd_publication_events`, `import_batches`, `import_mappings` (ver `DATA_DICTIONARY.md §2.23`).

## 2. Registro de cada versión PMD

Cada versión registra: ID, cliente, aeropuerto, ciclo PMD, año PMD, número de revisión, fecha de emisión, fecha de carga, usuario que cargó el archivo, nombre del archivo, hash del archivo, archivo original, versión de plantilla reconocida, estado, motivo/comentario, documento de aprobación del cliente.

Estados: Borrador, En validación, En revisión, Pendiente de aprobación, Vigente, Histórica, Rechazada, Anulada. Solo puede existir una versión **Vigente** por cliente/aeropuerto/ciclo/año.

## 3. Primera carga (reconocimiento automático)

1. Analizar la estructura del libro (basado en el ancla de reconocimiento documentada en `DESIGN_BASELINE.md §2.3`: encabezados de dos filas en `CashFlow`, bloques repetidos de 26 columnas por año).
2. Reconocer hojas relevantes (`CashFlow`, `PROGvsREAL`, `Datos PMD`) y descartar hojas derivadas (`ASUR`, `Proyeccion x mes`, `Erogacion x mes`, `DATOS`, `Resumen CashFlow AAAA`) que son vistas calculadas, no fuente.
3. Reconocer encabezados, columnas, filas y celdas configuradas.
4. Identificar series PMD (columna `serie`/código numérico).
5. Identificar contratos y empresas (columnas `No. contrato`, `Prov.`).
6. Identificar grupos y etapas de inversión (catálogo `Listas desplegables`).
7. Identificar distribución mensual (bloques Original/mes/Actualizado/Diferencia).
8. Identificar montos anuales (columnas `PMD AAAA`).
9. Identificar hitos (si el archivo del cliente los incluye; no presentes en el Excel de referencia analizado — requerirá mapeo manual la primera vez).
10. Identificar programado, real, forecast y demás categorías disponibles (`PROGvsREAL`: Monto Programado/Monto Real/Variación).
11. Validar fórmulas, formatos y consistencia.
12. Mostrar previsualización del mapeo antes de confirmar.
13. Permitir corrección manual de campos no reconocidos.
14. Poblar la base de datos solo tras aprobación explícita del usuario.
15. Guardar el archivo original completo (`pmd_version_files`).
16. Crear la versión inicial del PMD (`pmd_versions.status = Vigente`).

Si la estructura no coincide completamente con una plantilla conocida, el sistema debe explicar qué reconoció y qué requiere mapeo manual — nunca inventar correspondencias silenciosamente (regla general del prompt maestro, reafirmada aquí).

## 4. Trabajo dentro del sistema (post-publicación)

Una vez vigente una versión, el trabajo normal (avances reales, facturación, estimaciones, riesgos, restricciones, acciones, forecast, reportes) ocurre igual que en v1 — la diferencia de Fase 5 es que la programación y los montos del plan quedan asociados formalmente a `pmd_versions.id`, y toda la inversión real/evidencias se vincula a series y contratos por identificadores estables para poder reconciliarse cuando se publique una nueva versión.

## 5. Exportación para revisión con el cliente

Excel editable que mantenga estructura reconocible, incluya identificadores técnicos estables en columnas protegidas/ocultas, número de versión, fecha de exportación, cliente/aeropuerto/ciclo/año, y marque claramente las celdas editables vs. protegidas (identificadores técnicos no editables por accidente).

## 6. Carga del Excel ajustado → versión candidata

Una nueva carga se trata como revisión completa, **nunca se aplica de inmediato**: crea una `pmd_versions.status = En validación` y ejecuta el comparador (§7) contra la versión vigente antes de cualquier publicación.

## 7. Correspondencia de registros (orden de prioridad)

1. Identificador técnico estable incluido en el Excel exportado por el sistema.
2. Identificador de negocio único validado (código de serie, número de contrato/OC).
3. Regla de correspondencia configurada y revisada por el usuario.
4. Mapeo manual cuando exista ambigüedad.

Nunca relacionar automáticamente por similitud de nombres únicamente.

## 8. Comparador de versiones PMD

Compara automáticamente: series nuevas/modificadas/retiradas (nombre, código, grupo, etapa, monto, hito); contratos nuevos/modificados/retirados (empresa, alcance, serie, monto, fechas, estado); distribuciones mensuales (por mes, acumulado, concentración, fecha prevista); montos e hitos (monto anual, por serie, por contrato, hito anual, hitos mensuales, forecast).

## 9. Reporte de diferencias

Resumen ejecutivo antes de publicar: versión vigente vs. candidata, conteo de series/contratos nuevos/modificados/retirados, monto incrementado/reducido/variación neta, meses impactados, cambios al hito anual, cambios que afectan inversión real existente, inconsistencias críticas. Detalle por entidad/campo/valor anterior/valor nuevo/diferencia/impacto/estado de validación/observación, filtrable por cliente/aeropuerto/serie/contrato/empresa/mes/tipo de cambio/impacto.

## 10. Validación contra información real e histórica (bloqueante antes de publicar)

Verificar: contratos cuyo monto nuevo es menor que la inversión real registrada; series cuya inversión reconocida supera el monto actualizado; contratos/series retirados con inversión real vinculada; hitos cerrados incompatibles con la nueva versión; distribuciones mensuales que dejan inversión real fuera de periodo; contratos sin correspondencia inequívoca; cambios al hito anual sin autorización; descuadres entre contrato/serie/aeropuerto/total anual.

Clasificación: Error bloqueante / Advertencia que requiere aprobación / Cambio informativo. Una versión con errores bloqueantes no puede publicarse.

## 11. Publicación de la nueva versión

1. Congela la versión vigente anterior → `Histórica`.
2. Publica la candidata → `Vigente`.
3. Registra usuario, fecha, hora, motivo, aprobación (`pmd_publication_events`).
4. Actualiza dashboards a la nueva versión vigente.
5. Recalcula programado/forecast/desviaciones/faltante/riesgos.
6. Conserva íntegramente la información histórica.
7. Genera snapshot de publicación.
8. Permite descargar reporte de diferencias y archivo publicado.

El reemplazo es funcional (única programación vigente usada por el sistema), nunca borra físicamente la versión anterior.

## 12. Elementos retirados

No se eliminan; se marcan `Retirado de la versión vigente`, conservan relaciones históricas, facturas/estimaciones/riesgos/acciones/evidencias, se excluyen de la programación vigente salvo regla autorizada en contrario, y aparecen en el reporte de diferencias. Si poseen inversión real, requieren revisión y aprobación antes de publicar.

## 13. Conservación histórica

Consultar cualquier versión histórica, comparar dos versiones, descargar cada Excel original, reconstruir dashboard histórico y estado del PMD en una fecha de corte, consultar quién publicó cada versión y qué diferencias la originaron. Nunca se eliminan físicamente.

## 14. Protección de información histórica

La publicación de una revisión no elimina: facturas, estimaciones, inversión real, riesgos, restricciones, acciones, evidencias, bitácoras, auditoría, snapshots, archivos originales. Cambios de series/contratos requieren mapeo o decisión explícita si no puede conservarse la correspondencia automáticamente.

## 15. Reversión de publicación

Requiere autorización especial. Mantiene la versión revertida en el historial, registra motivo/solicitante/aprobador, crea nuevo evento de publicación/reversión, restaura de forma controlada la versión anterior como vigente, recalcula dashboards/conciliaciones, no altera cierres históricos ya emitidos.

## 16. Archivo original y trazabilidad

Conservar archivo original cargado y archivo exportado que originó la revisión, asociados a la versión, para auditorías, reclamos, comparaciones, recuperación, evidencia documental y reproducción del proceso de revisión con el cliente.

## 17. Criterios de aceptación del versionado PMD (Fase 5)

- La primera carga autocompleta la aplicación tras validación.
- El Excel exportado puede reimportarse manteniendo correspondencia de registros.
- Una nueva carga crea versión candidata, no modifica de inmediato la vigente.
- El usuario ve todos los cambios antes de publicar.
- Tras publicar, la nueva programación reemplaza funcionalmente la anterior.
- La versión previa permanece consultable y descargable.
- La inversión real histórica no se pierde.
- Series y contratos retirados permanecen en el historial.
- Errores bloqueantes impiden la publicación.
- Solo existe una versión vigente por alcance PMD.
- Toda publicación y reversión queda auditada.
- Los dashboards muestran claramente versión y fecha de corte utilizadas.
