# ADR 0037: Reporte metodologico de Validacion basado en el plan efectivo

Estado: Aceptado

Fecha: 2026-07-14

## Contexto

Validacion ya puede construir reglas desde XLSForm, reglas personalizadas y
controles operativos, compilarlas al AST y evaluarlas contra una base. Sin
embargo, sus salidas actuales reparten la evidencia entre el plan XLSX, el
resultado interactivo y un HTML resumido. Ninguna de ellas constituye por si
sola un inventario exhaustivo y presentable para explicar a un cliente como se
validaron los datos.

Ademas, no toda expresion visible tiene la misma naturaleza: unas reglas se
compilan a R y se evaluan directamente, otras usan un runtime especializado y
otras conservan una expresion ODK que puede no haberse ejecutado. Presentarlas
todas como "formula ejecutada" produciria una trazabilidad falsa.

## Decision

Validacion incorpora un **reporte metodologico PDF** y un **script R** derivados
del mismo modelo canonico del plan efectivo de la base activa y de la evaluacion
disponible en el mismo scope. Ambos se pueden descargar juntos en un paquete ZIP;
el endpoint PDF individual se conserva por compatibilidad.

- El inventario no usa previews ni limites de la UI: incluye todas las reglas
  del plan y explicita reglas no evaluadas o no compilables cuando esa
  informacion esta disponible.
- Cada regla describe su procedencia, familia, variables, condicion de
  aplicacion, expectativa valida, infraccion, accion sugerida, estado y
  conteos disponibles.
- La evidencia tecnica distingue `exact_r`, `specialized_runtime`,
  `source_odk` y `not_executed`. Una expresion fuente o un stub nunca se rotula
  como R ejecutado.
- Los controles de periodo de campo, `today()` y duplicados documentan su zona,
  ventana, politica de faltantes y bindings solo cuando el runtime los conoce;
  el reporte no los infiere retrospectivamente.
- Si existe un plan pero no una corrida correlacionable, el documento declara
  "plan configurado, aun no ejecutado". Hasta que Validacion persista un
  `run_id` con hashes de datos, instrumento, plan y bindings, el PDF no se
  presenta como certificado reproducible de una corrida historica.
- El reporte contiene metadatos agregados, nunca filas, identificadores de
  casos, telefonos, correos ni otras variables de respuesta.
- El PDF y el script R son entregables regenerables y descargables. El paquete
  se registra como resultado de un job local y ninguno de sus artefactos se
  guarda dentro del `.pulso` por defecto.

El XLSX editable del plan conserva su responsabilidad operativa. El PDF es la
salida explicativa para revision metodologica y cliente, mientras el script R
expone la evidencia tecnica disponible sin convertir runtimes especializados o
expresiones fuente en codigo R ficticio. Ninguno sustituye el plan ni las
decisiones de Limpieza.

## Consecuencias

- Un analista puede entregar una explicacion completa y legible de los
  controles configurados junto con sus expresiones tecnicas.
- El reporte debe mantener una taxonomia honesta aunque aumenten las familias
  de reglas o los runtimes especializados.
- Una certificacion historica fuerte requerira una evolucion posterior del
  estado de corrida; este ADR evita simularla con el "ultimo resultado" mutable.
- Las reglas numerosas y formulas largas aumentan el costo de render, por lo
  que la generacion se ejecuta como job local.

## Cumplimiento

- Endpoints de Validacion para generar el PDF individual o el paquete ZIP con
  PDF + R y descargarlos mediante el contrato comun de jobs.
- Pruebas con mas de 500 reglas verifican ausencia de truncamiento.
- Pruebas distinguen formulas R, runtimes especializados, expresiones fuente y
  reglas no ejecutadas.
- Pruebas y QA visual verifican saltos de pagina, formulas largas y ausencia de
  datos individuales.
- La UI ofrece el reporte junto al plan de Validacion y comunica si describe
  solo un plan o tambien resultados disponibles.

## Notas

Relacionado: [0002](0002-formato-pulso.md),
[0003](0003-motor-r-integrado.md),
[0006](0006-modulos-por-dominio.md) y
[0036](0036-filtro-universo-manual-en-carga.md).
