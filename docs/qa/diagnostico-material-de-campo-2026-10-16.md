# Diagnóstico: material de campo, Ser Adolescente 2026 contra los módulos de la app

Fecha: 2026-10-16 · Rama 8 (Gobernar) · Decisión que sostiene: [ADR 0108](../adrs/0108-material-de-campo-catalogo-de-materiales-por-unidad.md) (Propuesto)
Checklist vivo: [checklist-material-de-campo-2026-10-16.md](checklist-material-de-campo-2026-10-16.md)

## Por qué existe este documento

Ser Adolescente en el Perú 2026 (12-2026, PULSO PUCP) fue un campo presencial, en papel, de puerta en puerta: 1.000
encuestas autoaplicadas a jóvenes de 18 a 25 años en Lima, Cusco y San Martín, por cuotas de sexo × estudios superiores.
Se organizó en 125 fichas de cuota de 8 encuestas, 2 por celda, todas exigibles y sin reemplazos. El estudio las rotula «UMP», pero no son unidades de muestreo: es un diseño no probabilístico con control de cuotas, y la app no debe tratarlas como conglomerados (sin `deff` ni margen de error). Todo el material de campo se hizo **fuera de la app**, con
scripts de Python y Node en `~/Documents/Pulso/01_Estudios/2026_Ser_Adolescente/Campo/Generadores/`, Word y un Google
Sheets. La app solo aportó, por ruta absoluta, la cartografía de Lima de `api/inst/hojas_ruta/cartografia/`.

La pregunta de Gonzalo: ¿es viable un módulo **Material de campo**, elegante y generalizable, que reemplace a
Recopiladores, y donde lo que hoy hace Recopiladores pase a ser un tipo de material para el campo de aulas universitarias?
Este diagnóstico responde con evidencia y alimenta el ADR 0108.

Regla de lectura: una capacidad cuenta solo si alguien la consume y se puede ver. Un campo en el estado o un builder que
solo llaman los tests no es capacidad.

## 1. Inventario de lo hecho fuera de la app

| # | Pieza | Formato | Cómo se hizo | Insumo |
|---|---|---|---|---|
| 1 | Cuestionario impreso (11 pp, consentimiento en p. 1) | DOCX → PDF | Diagramado a mano en Word, PDF con LibreOffice | bloques en `Instrumento/Insumos/` |
| 2 | Consentimiento en media A4, dos copias por hoja | PDF | HTML → Chrome sin script guardado | texto de la p. 1 del cuestionario |
| 3 | Hoja de ruta de dos caras, 125 fichas. Cara 1: datos, cuota de 2 por celda sexo × estudios, 8 casillas de encuesta, cierre. Cara 2: mapa del distrito o lista de centros poblados para marcar | PDF por sede | `hojaruta_v3.py` + `mapa.py` + `mapa_distrito.py` | diseño muestral escrito en el script (`SEDES`, `CCPP`, `TOPE_CCPP=10`) |
| 4 | Hoja de ruteo (cada vivienda visitada y su resultado) | PDF 2 pp | HTML → Chrome, sin script | ninguno |
| 5 | Hoja de consolidados (totales por resultado e incidencias) | PDF apaisado | HTML → Chrome, sin script | ninguno |
| 6 | Láminas de distribución muestral por sede y PNG para el PPT | PDF + PNG | `distribucion.py`, `tabla_png.py` | cifras tecleadas en el script |
| 7 | Muestra de hojas de ruta para el área de campo (reglas + una de cada tipo) | PDF 9 pp | `muestra_campo.py` | `hojaruta_v3.fichas()` |
| 8 | Seguimiento: pestaña por sede, metas por celda, alertas, supervisión por encuesta | XLSX y Sheets | `seguimiento_sedes.py` | `hojaruta_v3.fichas()`, la **misma** lista que las hojas de ruta |
| 9 | Capacitación (Lima; Cusco y San Martín) y lámina de estudios superiores | PPTX | `deck.js` (pptxgenjs) + `limpiar.py` | assets, tablas de distribución |

No se produjo: credencial, carta de presentación, asentimiento aparte, manual del encuestador como documento, tarjetas
de respuesta, QR ni listado de muestra por dirección.

**Hallazgo estructural.** Las piezas 3, 7 y 8 salen de una sola función, `hojaruta_v3.fichas()`. Cambiar el diseño
obliga a regenerar fichas y seguimiento juntos. El material y el seguimiento comparten **la lista de unidades**: esa es la
pieza que la app debería poseer, no cada PDF suelto.

## 2. Lo que la app tiene hoy

### 2.1 Recopiladores (`/recopiladores`, ADR 0046)

El sustrato es genérico; lo que llega al usuario es de aulas.

**Genérico y reutilizable**

- Contratos `collection_state/v1`, `collection_plan/v1`, `collection_deployment/v1` (`api/R/collection_contracts.R:20-22`),
  con revisión optimista, fingerprints y `stale`.
- Registro cerrado de bloques `COLLECTION_MATERIAL_BLOCK_TYPES` (`api/R/collection_materials.R:11`), presets con
  `material_kind` (`:22-52`) y allowlist de bindings (`:65-77`).
- Registro de adapters con hooks `prepare_material_instances`, `render_artifacts`, `handoff_to_monitoring`
  (`api/R/collection_adapters.R:567`).
- Un solo compilador `grid` para preview PNG y PDF, por job, con recibo SHA-256, `file_id` y conteo de páginas
  (`collection_materials_job.R`). Ningún binario entra al `.pulso`.

**Atado a aulas**

- El seed solo lee `monitoreo_aulas_plan` o `calc_muestra_aulas_*` y fija `adapter aulas_v1` y
  `unit_type classroom_course_schedule` (`collection_engine.R:169`, `:315-444`).
- Bindings `unit.faculty`, `teacher`, `venue`, `eligible_n` en la allowlist global (`collection_materials.R:65-77`).
- ZIP organizado por facultad y rol (`collection_materials_job.R:57-136`). Croquis solo de la PUCP
  (`collection_render_croquis.R`).
- Un solo template activo por proyecto (`material_template`), sin catálogo ni endpoint de catálogo.
- `ficha_campo_qr_a4_v1` y `afiche_qr_a4_v1` existen pero **solo los llaman los tests**: la UI no los ofrece.
- Deriva front/back: `frontend/src/api/recopiladores.ts:186` lista 9 tipos de bloque; el backend acepta 13
  (falta `brand_strip`, `status_tag`, `form_lines`, `campus_map`).

### 2.2 Hojas de ruta (`/hojas-ruta`)

Tiene un **segundo motor de fichas**, aislado del de Recopiladores.

- La UMP no es un objeto: es una manzana seleccionada que carga una ruta de `route_size` encuestas
  (`api/R/hojas_ruta_engine.R:5509-5530`; campos en `:5593-5620`; espejo TS `SelectedBlock` en
  `frontend/src/api/hojasRuta.ts:451`).
- Ficha de dos caras: `.hojas_ruta_draw_integrated_pdf_page1` (`:8875`) y mapa de contexto (`:7804`); hoja de zona
  (`:8691`); ZIP (`:10043`) y XLSX operativo (`:9642`). Todo en `grid` + `qpdf`, sin el kit `pulso_pdf_*` ni el registro
  de bloques.
- Cuotas en la ficha: solo los márgenes sexo × edad (`.hojas_ruta_reference_quota_data`, `:7507`). Las celdas internas
  quedan en blanco y no hay casillas de efectivas.
- Encuestador: no se guarda; la ficha imprime la línea en blanco (`:8962`).
- Código muerto: `hojas_ruta_generar_zip` y `.hojas_ruta_draw_pdf_base` (`:266`, `:362`) sin llamadores.
- El motor está congelado a crecimiento en 10.305 líneas (`agentic/manifest.json`): cualquier tipo de ficha nuevo **no
  cabe ahí**.
- Monitoreo territorial reusa el mismo objetivo de cuota (`monitoreo_engine.R:9602-9674` llama a
  `.hojas_ruta_reference_quota_marginals`) y empareja UMP por clave normalizada (`monitoreo_router_ump.R:20`).

### 2.3 Otros módulos

- **Formularios** ya tiene motor de formulario en papel con valores medidos de este mismo cuestionario
  (`api/R/reporte_formulario_paleta.R`, `reporte_formulario_word.R`; `output_kind = "formulario_pdf"` en
  `router_xlsform_editor.R:1572`). Fuente: `docs/qa/goal-formulario-replica-ser-adolescente-2026-09-24.md`.
- **Cálculo de muestra** en modo `territorial-handoff` solo muestra una tarjeta que abre Hojas de ruta; no transfiere
  datos (`TerritorialHandoff.tsx`). No produce láminas de distribución para capacitación.
- **Monitoreo** posee agenda, cuotas, supervisión y cierre. Su exportación por UMP (`monitoreo_router_ump.R`) es lo más
  cercano al seguimiento de la pieza 8.
- **Motor PPT**: `docs/qa/checklist-motor-ppt-diagnostico-2026-10-06.md` comparó la salida de la app con `deck.js` y
  explica por qué no se adoptó JavaScript.

## 3. Matriz: cada pieza contra cada módulo

Clave: **Sí** ya lo hace (dónde) · **Medias** lo hace a medias (qué falta) · **No** · **N/C** no le corresponde.

| Pieza | Recopiladores | Hojas de ruta | Formularios | Cálculo de muestra | Monitoreo | Destino propuesto |
|---|---|---|---|---|---|---|
| 1 Cuestionario impreso | N/C | N/C | **Medias**: motor de formulario en papel calibrado con este cuestionario; el instrumento real no salió de XLSForm | N/C | N/C | Formularios (sin cambio) |
| 2 Consentimiento media A4 | **No**: no hay bloque de texto largo con N copias por hoja | No | **Medias**: el texto vive en el instrumento | N/C | N/C | Material de campo, bloque `consent_text` |
| 3 Hoja de ruta dos caras con cuota por celda | **No**: preset y bindings de aula | **Medias**: ficha de dos caras existe, pero solo márgenes sexo × edad, ejes fijos, sin casillas por encuesta ni lista de centros poblados; unidad = manzana INEI | N/C | N/C | N/C | Material de campo, modos `territorial` y `cuotas` |
| 3b Tope por centro poblado compartido entre fichas | No | **No** | N/C | **No** | **No** | Diseño (dueño de la asignación) lo declara; Material lo imprime; Monitoreo lo valida (§5.2) |
| 4 Hoja de ruteo | **No** | **No** | N/C | N/C | N/C (Monitoreo usa sus códigos, no los imprime) | Material de campo, bloque `visit_log` |
| 5 Hoja de consolidados | **No** | **No** | N/C | N/C | **Medias**: consolida en digital, no imprime | Material de campo |
| 6 Láminas de distribución muestral | N/C | **Medias**: XLSX `Cuotas` y reporte Quarto `reporte_muestra_territorial.R` | N/C | **N/C**: `territorial_hogares` es `fuera_calculador` | N/C | Hojas de ruta > Selección > Cuotas, emitida por el motor de entregables; Material la incluye por referencia (§5.3) |
| 7 Muestra de fichas para el área de campo | **Medias**: fichas de prueba `PRUEBA_2026`/`CAPACITACION` (`collection_material_prueba.R`), solo aulas | **Medias**: PDF de prueba aleatorio (`:9946`) | N/C | N/C | N/C | Material de campo, pestaña Paquetes > Prueba |
| 8 Seguimiento por ficha con supervisión | N/C | **Medias**: XLSX con Estado y Encuesta 1..n (`:9642`) | N/C | N/C | **Medias**: avance por UMP; no hay supervisión por encuesta dentro de celda | Monitoreo (E5 del ADR, opcional) |
| 9 Capacitación PPTX | N/C | N/C | N/C | N/C | N/C | Fuera de alcance (motor PPT es otro GOAL) |
| Accesos Kobo/SurveyMonkey + QR | **Sí**: `recopiladores/accesos` | N/C | N/C | N/C | consume | Material de campo, modo `aulas`, pestaña Unidades > Accesos |
| Ficha de aula con QR | **Sí**: `recopiladores/materiales` | N/C | N/C | N/C | N/C | Material de campo, modo `aulas` |

## 4. Conceptos que el modelo de la app no tiene

| Concepto | ¿General o propio? | Dónde se modelaría |
|---|---|---|
| **Unidad de campo** como lista tipada, independiente de su origen (aula, UMP, ficha de cuota) | General: es lo que comparten las tres familias de campo | contrato `field_unit/v1` del ADR 0108, alimentado por adapters |
| **Cuota exigible por celda conjunta** (sexo × estudios = 2 por celda) | General para estudios por cuotas (`salida_principal = cuotas_por_celda_y_meta_efectiva`, `catalogo_metodologias.json:445`). Hoy la ficha territorial imprime márgenes y Monitoreo valida márgenes: con celdas impresas y márgenes validados, una ficha 4/0/0/4 queda «cumplida» en el avance y abierta en el papel | el grano lo declara la fuente; `quota_grid` lo imprime y Monitoreo valida ese mismo grano |
| **Ejes de cuota declarados por el estudio** (no fijos en sexo × edad) | General; el ADR 0086 ya hace declarable el eje, pero solo para Monitoreo de aulas: ni Hojas de ruta ni la ficha lo leen | bindings `unit.quota.*` por `unit_type` |
| **Tipo de ficha atado a un requisito** (urbana o periurbana define lugar de nacimiento exigido) | General como patrón: es un **eje de cuota fijado a nivel de unidad** que sostiene la meta 38/12, no una variante de impresión. En Lima el eje está ausente, que no es cero | en la meta de la fuente; Monitoreo verifica por encuesta que coincida con su ficha |
| **Tope por centro poblado compartido entre fichas** | General: restricción del **diseño** al grano sede × lugar, que cruza fichas; no cabe en una unidad | la declara la fuente con la asignación; Material la imprime con `place_checklist`; Monitoreo la valida como contador compartido |
| **Encuestador asignado a la ficha** | General | binding opcional `unit.operator`; la asignación sigue en Monitoreo |
| **Supervisión por encuesta dentro de la celda** | General para campo en papel | Monitoreo, no material |
| **Material en papel para autoaplicada** (ruteo, consolidados, consentimiento) | General | tipos de material del catálogo |

## 5. Respuestas de la revisión metodológica (2026-10-16)

1. **¿`fichas_cuota_v1` es general?** El patrón sí: una unidad de trabajo que lleva una meta por celda, sin marco ni
   selección, como en ACR-*, ECHO y SER. Lo propio de este estudio es el contenido (los ejes, el eje fijado por ficha y
   el tope). La evidencia de que el esquema se repite es solo la lista de centros poblados de 2024
   (`hojaruta_v3.py:27`); el catálogo clasifica SER-ADOLESCENTE-2024 a la vez en conglomerados y en cuotas
   (`catalogo_metodologias.json:169` y `:447`). **La lista de fichas no puede nacer en Material de campo**: necesita un
   dueño de diseño (ADR 0108 §6, bloqueado).
2. **El tope por centro poblado** es del diseño muestral. El material lo imprime (`hojaruta_v3.py:134-135`) y Monitoreo
   lo vigila (`seguimiento_sedes.py:137-140`, `:215-223`).
3. **Las láminas de distribución** no son de Cálculo de muestra, que para `territorial_hogares` solo permite
   `fuera_calculador` (`catalogo_tipos_estudio.json:136-138`) y no recibe cifras en el handoff. Son del diseño operativo
   (Hojas de ruta > Selección > Cuotas) y se emiten con el motor de entregables.
4. **Riesgo encontrado en el código:** Monitoreo territorial salta en silencio una unidad sin márgenes de cuota
   (`monitoreo_engine.R:9642`, `next`). Una ficha de cuota desaparecería del avance sin aviso: verde por ausencia.

## 6. Veredicto de viabilidad

**Viable, con una condición de orden y una decisión pendiente (dónde nace la lista de fichas de cuota).** Alrededor de dos tercios de lo necesario ya existe en Recopiladores: contratos,
registro cerrado, adapters, job, recibos y compilador único. Lo que falta es **separar la unidad del aula**: hoy la lista
de unidades, los bindings y la estructura del paquete suponen curso-horario.

Los riesgos reales son tres:

1. **El motor de Hojas de ruta está congelado.** Por eso la ficha de manzana (UMP) entra primero envuelta tal cual (layout legacy,
   paridad visual) y solo después se porta al registro de bloques. Nunca se agrega un tipo nuevo dentro de
   `hojas_ruta_engine.R`.
2. **El renombre no es solo de navegación**: el slug `recopiladores` vive persistido en `project_modules` y en la
   bitácora, y dos listas cerradas lo descartarían en silencio (`project_overview.R:14-24`,
   `router_diseno_estudio.R:89-100`). Además `collection_state/v1` admite un solo plan con un solo `unit_type`. Ambas
   cosas exigen migración en lectura, declarada en el ADR.
3. **Grano de la meta**: si la ficha imprime celdas y Monitoreo valida márgenes, divergen. El ADR fija que el grano lo
   declara la fuente y se valida ese mismo grano.

La propuesta completa, con navegación, identidad visual y etapas, está en el ADR 0108.

## Evidencia de UI (2026-10-16)

Capturas en `tmp/qa-material-campo-2026-10-16/` (no versionadas), con `ui-quick-check` en 1440x1000 y 1024x600; 8
capturas distintas por md5.

- **Recopiladores > Materiales (hsvg2026).** Editor semántico de 8 bloques (cabecera, título `unit.operational_code`,
  curso, QR, campos Docente · Escuela · Aula · Horario · Estudiantes, separador, registro, pie). **No hay selector de
  preset ni de tipo de material**: el frontend fija `preset_id: "ficha_aplicacion_a4_v1"`
  (`MaterialsSection.tsx:172`) y `GET /api/recopiladores/material-template` no devuelve una lista. Confirma §2.1.
- **Plan, Accesos y Paquetes (hsvg2026)** salen vacíos porque el fixture no tiene estado de Recopiladores
  (`seeded:false`, `seed_available:false`). Es deuda del fixture, no desconexión: ningún proyecto de referencia prueba
  hoy un plan con accesos.
- **Hojas de ruta > Entrega (acnur_acg, el único proyecto de referencia con muestra territorial poblada: 150 manzanas y
  150 reemplazos).** La ficha de dos caras no tiene botón propio: sale dentro de «Generar ZIP» como «PDF titular por
  manzana», junto con el PDF de reemplazos, la hoja por zona, el Excel operativo y los metadatos. Aparte están «Generar
  PDF unificado» (reemplazos puntuales) y «PDF aleatorio de prueba». Coincide con la tabla de endpoints del ADR §5.
- **Menores vistos de paso:** en 1024x600 dos ítems del outline de Materiales desbordan unos píxeles; en Entrega >
  Reemplazos la tabla esconde 250 px a la derecha sin indicio de scroll y el runner reporta `desplazamientoH=0`
  (el detector se queda corto). C1: el outline sale `geometry-undeclared` y Entrega no tiene grupos geométricos; cobertura
  pendiente, no un pase.
