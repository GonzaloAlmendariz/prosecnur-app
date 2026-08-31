# Checklist — operativo de aulas 2026: cerrar el circuito y superar 2025

Estado: **en curso** · Abierto: 2026-08-31 · Solo Gonzalo lo cierra.

Nace del análisis forense del libro 2025 (`Hostigamiento PUCP 2025_BD Aulas
Agendadas-6.xlsx`) contra el estado del repo. Diagnóstico completo con los siete
mecanismos de comunicación del libro 2025 y las brechas S1–S7 en el artifact
«El cableado del libro de aulas» (sesión 2026-08-31); anatomía previa en
`anatomia-excels-aulas-2026-08-16.md`.

## Decisiones tomadas al abrir (2026-08-31, Gonzalo)

- **Canal del equipo**: publicar el libro a Google Sheets **en simultáneo**
  («publicar a sheets con hojas en simultáneo y tener más hojas profesionales
  de ser posible»). La app es la fuente; Sheets es la vista compartida del
  operativo, como en 2025 pero generada, no artesanal.
- **Canal del parte de campo**: **en la app** (pestaña «Registro de campo»).
  Eso convierte S1 en obligatoria y de prioridad 1.

## Lane A — Cerrar el circuito (paridad con 2025)

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| A1 | **El registro en-app escribe los partes de campo.** Hoy `cambiosDelRegistro()` va al plan (`POST /api/monitoreo/aulas/agenda` → `monitoreo_aulas_plan`) y el único escritor de `monitoreo_aulas_partes_campo` es importar un libro: un estudio operado 100 % desde la app genera la hoja «Aulas Aplicadas (Campo)» en blanco. Alias listos en `monitoreo_aulas_alias.R:38-42`. | `RegistroDeCampo.tsx` · `router_monitoreo.R:5241` · `carga_aulas_libro_generar.R:262` | ☑ `1f0d85b6` — rojo 6/6 → verde 24 PASS, verificador APROBADO; residuo declarado en A12 |
| A2 | **Sanear `AULAS_LIBRO_CAMPOS_PROPIOS`** antes de A1. Medido en el scope lock: el bloque «Parte de campo» entero es inalcanzable — la fusión solo procesa `out$plan` (hoja de agenda) y ese lector no emite campos de parte; además cuatro nombres (`attendees`/`applied_surveys`/`application_date`/`field_notes`) no los emite NINGÚN lector. La constante no tiene más consumidores que la propia fusión. Se retira el bloque completo. | `carga_aulas_libro_fusion.R:26-38` vs `carga_aulas_aplicadas.R:24-39` | ☑ `1f0d85b6` — bloque retirado; T5 lo pinnea |
| A3 | **`scheduled_moment` corregible desde Excel/Sheets.** El lector lo emite pero no está en campos propios: la fusión solo lo aplica si el plan lo tiene vacío. Regla dictada el 08-24: la app manda pero «tiene que ser robusta a actualizarse desde el Excel» en agendación y registro. | `carga_aulas_libro_fusion.R:95-97` | ☐ |
| A4 | **Limpieza declarada**: retirar la subida multipart rota del cliente (`apiMonitoreoAulasImportarLibro` tipo `File`) y los imports muertos de `AulasSeccionConsultas.tsx:4-5`. | `monitoreo.ts:4811` · `router_monitoreo.R:5064-5070` | ☐ |
| A5 | **«Leer del Sheets» por fuentes registradas**, no por `prompt` de enlace; darle consumidor real a `aulas_libro_desde_fuente()`. Se subsume en B1 si la publicación fija el Sheets del operativo como fuente. | `AulasOperationsPanel.tsx:240-247` · `carga_aulas_desde_sheets.R:103` | ☐ |
| A6 | **Corrida real de punta a punta con el marco vigente** — CORRIDA el 2026-08-31 sobre copia de trabajo de `HSVG26ULT.pulso` (runner en scratchpad `corrida_a6.R`, 8 eslabones, exit 0): selección real 1.512 filas (174 titulares + 1.259 chain_reserve + 79 extra_pool, run `sel_aulas_20260826092810`) → plan Recopiladores 1.512/1.512 **sin desfase** (A7 no aflora por esta vía) → deployment `aulas_v1` cobertura 1.512/1.512 → **handoff CON ENLACE 1.512/1.512** (vs 0/951 sin handoff el 08-20) y el handoff escribe él mismo el plan en sesión → **parte en-app 2/2 con espejo en cfg** (A1 a escala real) → libro 421 KB con el banco de 79 extras filtrado (1.433 = 174+1.259) y Base de control 174 filas → releído: enlaces 1.433/1.433, **partes en-app vuelven 2/2** (CH 1: asistentes=25, rechazos=2, efectivas=22, aplicador). **Hallazgo lateral que explica L4**: el seed del proyecto de referencia NO puede correr sobre hsvg2026 por diseño — el descuento secuencial necesita ids de alumno que el anonimizado no conserva (PII); las corridas con selección real van por el `.pulso` real o `--fixture`. | runner y salida en scratchpad de la sesión 2026-08-31 | ☑ verificada también en UI real (`monitoreo/aulas/calidad/registro`, `foco=aula:CH 1`): la ficha muestra el parte en-app completo (25/2/1/22, B-203, Equipo A) tras guardar y reabrir el `.pulso`, y la cabecera declara «1.433 cursos-horario · 1 con parte en el libro». **El hallazgo pasa a B6**: el enlace NO se muestra en esa superficie. |
| A7 | **Ítems 6+7 de sinergia**: re-sortear tras adaptar el plan de Recopiladores deja un desfase sin salida por la UI y sin anuncio; `pendiente_enlace` no distingue «no generado» de «generado contra otra selección». «Una puerta cerrada sin cartel.» | `checklist-sinergia-agendacion-2026-08-20.md:44-59` | ☐ |
| A8 | **`TASA_DE_CAIDA = 0.235` no se reproduce** (A7 del checklist de tres fuentes). El 23,5 % contaba 25 refuerzos (titular aplicado que además consumió reserva) como caídas; la caída real —titular sin aplicar cubierto por reemplazo— es 21/170 = 12,4 %. Constante corregida a `21/170` con derivación apuntada; el pin del test fija la definición nueva. | `alertaDeAnticipacion.ts:74` | ☑ `7c85524f` — vitest 27/27, tsc exit 0 |
| A9 | **Cara B de tres fuentes**: B5 el «hoy» del estudio es el corte de sync, no `generated_at`; B6 sin decimales sobre personas; B7 distinguir las cuatro cifras (asistentes → enviadas → válidas → efectivas); B8 «el parte contra la plataforma» descuenta lo que el filtro explica antes de acusar la atribución. | `checklist-tres-fuentes-monitoreo-2026-08-27.md:45-48,183-213` | ☐ |
| A10 | **La dirección inversa de A1**: los partes importados del libro no llegan al plan, así que la pestaña «Registro de campo» muestra formularios vacíos tras importar un libro llenado en Excel (la UI lee `row.observed_students` del plan; los partes viven aparte). Descubierto en el scope lock de A1 (2026-08-31); se dejó fuera a propósito para no pisar partes de Excel con valores viejos del plan. | `RegistroDeCampo.tsx:158-165` · `carga_aulas_libro.R:126-160` | ☐ |
| A11 | **El vocabulario es «efectiva», no «válida»** (dictado en D-L12: la respuesta que pasa los filtros se llama efectiva). Barrer la «enorme desconexión entre el vocabulario de la app y los encabezados de las tablas»: dónde la UI, el libro o los motores dicen «válidas» refiriéndose a efectivas, y viceversa. Emparenta con A9-B7 (las cuatro cifras) y con la veta «una palabra para dos cosas». | UI de Monitoreo · encabezados del libro · `BASE_CONTROL_CAMPOS` | ☐ |
| A12 | **La hora del parte en-app**: `hora_aplicacion → applied_time` está en la tabla de alias pero `applied_time` no entra al parte en-app (residuo declarado por backend-r en A1); la columna «HORA DE APLICACIÓN» queda vacía para registros hechos en la app. El formulario captura `applied_at` como «momento»: decidir si se separa fecha/hora o si el momento alimenta ambas columnas. | `monitoreo_aulas_parte_en_app.R` | ☐ |

## Lane B — Superar 2025

Lo que el Sheet de 2025 hacía bien era la simultaneidad y la Base de control
viva; lo que hacía mal: veredicto plano del 70 % conocido al final (149/194
NO CUMPLE), identidad copiada que diverge, seis hojas del día y planilla
tecleadas, versionado por copias («-6», «Copia de Aulas Agendadas») y fichas
de Google Docs a mano.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| B1 | **Publicar el libro a Google Sheets en simultáneo** (decisión de hoy). Las tres hojas de trabajo + «Cómo va el campo», releyendo de ahí con la fusión existente. La lectura ya existe (`aulas_libro_leer_de_sheets`); la escritura está retirada a propósito: los 99 nombres de pestaña controlados no incluyen aulas. Medirlo contra el norte de efectividad: el ciclo sync→dashboard→sheets proporcional al delta. | `carga_aulas_desde_sheets.R:8-12` · `monitoreo_engine.R:4778` | ☐ |
| B2 | **Hojas profesionales adicionales**, alcance dictado por D-S2: (1) **avance por facultad** con lo que aporta cálculo de muestra — elegibles H/M por facultad, efectividad agregada, «si vamos por buen camino» con márgenes; (2) **plan del día** — reemplaza las seis hojas «aplicación del día N» tecleadas de 2025; (3) **planilla de aplicadores** por rango horario; más las «tablas dinámicas que aún no están». Orden final: ◐ propuesta D-B2. | motor: `carga_aulas_libro_indicadores.R` como patrón | ☐ |
| B3 | **Dos tasas en paralelo con márgenes, no un umbral que descarta** (redefinida por D-L34): la tasa de efectividad del **aula** (granular) y la de la **facultad** (agregada), ambas contra su esperado con margen de tolerancia; un aula fuera de margen se SEÑALA, no se descarta ni cataloga. La respuesta que cuenta es la **efectiva** (pasa filtros — D-L12). Base ya construida: `efectivas_esperadas = eligible_n × rendimiento_ref × factor_facultad` (calibrado en 6/15 facultades), `monitoreo_aulas_criterio_aula(cfg)` con `modo = "esperado"` y tolerancia `alfa` (commit `74b968e9`), y `calc_muestra_aulas_tasas_facultad` para la agregada. | `monitoreo_aulas_criterio_aula.R` · `monitoreo_aulas_universitarias` | ☐ desbloqueada |
| B4 | **QR: el aula se recoge sola.** Vara 11/14 del GOAL; costura simulada 12 etapas exit 0. La decodificación en-app queda aparcada (D-L10); el H/M manual, en propuesta de derivarse de plataforma (D-L46). | `goal-campo-aulas-qr-registro-2026-08-16.md` | ◐ |
| B5 | **Ya superior a 2025 — mantener, no regresionar**: descuadre parte-sin-agenda alerta y no bloquea (`42f9f117`); procedencia «De dónde salió este libro» en vez de copias numeradas; sync Kobo automático en vez de pegado manual; banco de extras filtrado del libro. | tests de roundtrip y `test-carga-aulas-libro-sin-banco.R` | ☑ vigilancia |
| B6 | **Los enlaces del operativo** (dictado en D-L10): (a) la cadena Recopiladores → `row$link` **verificada a escala real**: 1.512/1.512 enlaces en el plan (A6). **Pero la pestaña Registro de campo NO los muestra** — medido en UI el 2026-08-31: cero anchors http y cero rótulos «Enlace/ficha/QR» en `monitoreo/aulas/calidad/registro` con el enlace presente en `row.link`. Mostrarlo en la ficha del registro es la subunidad frontend pendiente; (b) la ficha QR en PDF conectada al Drive; (c) columna **manual** nueva —en el libro y en la app— para el enlace de la **ficha escaneada** que se sube al Drive tras el campo. | `collection_engine.R:973` · `RegistroDeCampo.tsx` | ◐ (a) engine ✓ / UI ✗ · (b)(c) ☐ |

## Decisiones — estado tras las respuestas de Gonzalo (2026-08-31, mismo día)

| # | Decisión | Respuesta | Estado |
|---|---|---|---|
| D-L12 | Qué respuesta cuenta para el veredicto | «Se define en Monitoreo: la respuesta que pasa los filtros, y no se llama *válida* sino **efectiva**». Trae indicación nueva: hay «una enorme desconexión entre el vocabulario de la app y los encabezados de las tablas» → nace A11. | ✔ resuelta |
| D-L34 | Qué hacer con NO CUMPLE masivo | «Esta vez no va a pasar»: control fino con **dos tasas en paralelo — la del aula (granular) y la de la facultad (agregada) — con márgenes sobre lo esperado**, sin descartar ni catalogar un aula solo porque la tasa de efectividad no es la esperada. → redefine B3. | ✔ resuelta |
| D-L46 | Para qué sirve el conteo H/M del parte | No entendió la pregunta (viene del libro 2025: N° MUJERES / N° HOMBRES por aula en CONTROL-CUOTAS, contados a mano). **Propuesta del lead**: derivar H/M de las respuestas de plataforma —las cuotas sexo×facultad ya viven en la app— y NO pedir conteo manual en el parte. | ◐ propuesta enviada |
| D-L10 | Decodificar el QR en la app | Se aparca la decodificación. Lo que dictó como fundamental: los **enlaces** que crea Recopiladores deben funcionar y estar a la mano en el registro de campo; la ficha QR en PDF conectada al Drive; y una **columna manual para el enlace de la ficha escaneada** (también sube al Drive). → nace B6. | ✔ reformulada |
| D-S2 | ¿Las metas viajan en el bloque de agenda? | No: «este es un excel para campo». Lo que sí suma de cálculo de muestra va **agregado por facultad**: elegibles H/M, efectividad agregada, «si vamos por buen camino», más las tablas dinámicas que aún no están. → alimenta B2. | ✔ resuelta |
| D-S3 | Botón «generar libro» desde Entrega de calc-muestra (ítem 9) | Sin respuesta aún. | ⛔ |
| D-B2 | Cuáles hojas profesionales y en qué orden | La pregunta era qué hojas nuevas lleva el libro además de las cinco actuales. Con la respuesta a D-S2, **propuesta del lead**: (1) avance por facultad con metas de calc-muestra y márgenes; (2) plan del día; (3) planilla de aplicadores. | ◐ propuesta enviada |

## Orden propuesto

1. **A2 → A1** (el parte en-app llega al libro; es el mandato del canal).
2. **B1** (publicación a Sheets; convierte A5 en configuración).
3. **A6** (corrida de punta a punta con hsvg2026 — gate del ciclo; arrastra A7 si el desfase aparece).
4. **B2** hoja «plan del día» primero; **B3** en cuanto caigan D-L12/D-L34.
5. A3, A4, A8, A9 entran como unidades sueltas entre oleadas.

## Aprendido en los que aún no se tocan

- El bloque de agenda hoy tiene **21** títulos (`scheduled_moment`), no los 20
  de 2025: los docs que digan «12 bloques de 20 = 241 columnas» describen el
  libro histórico, no el generado.
- Un campo nuevo del bloque vive en cuatro sitios que nadie ata
  (`AULAS_AGENDADAS_BLOQUE`, generador agenda, generador campo, lector); lo
  único que lo caza es el barrido de `test-carga-aulas-libro-roundtrip.R:299`.
- En el libro 2025, `Collector ID` = CURSO-HORARIO es la única llave que
  atraviesa todo; 194 collectors = 194 aplicaciones, cuadre exacto.
