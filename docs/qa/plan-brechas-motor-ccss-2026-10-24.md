# Plan — lo que CCSS Perfil 2026-II resolvió fuera del motor (2026-10-24)

- **Origen**: el 2026-10-24, al procesar CCSS Perfil del Estudiante 2026-II, la sesión resolvió fuera de la
  app, o con rodeos, cosas que el motor debería cubrir. Gonzalo pidió listarlas y planificarlas en otra sesión.
- **Rama**: 8 (gobernar) para lo que pide decisión; 1 (construir) para el resto, todavía en fase de scope.
  **Nada de esto se implementa sin el visto bueno de Gonzalo.**
- **Material del caso** (carpeta `~/Documents/Pulso/01_Estudios/2026_PUCP_CCSS_Perfil_Estudiante/`):
  - `8. Procesamiento/CCSS2026_filtros_base.R` (filtros, correcciones, anonimización, lista del sorteo);
  - `8. Procesamiento/CCSS PUCP 2026_Script de selección de la muestra 400.R` (selección por cuotas y factor);
  - `8. Procesamiento/CCSS PUCP 2026_Codificacion Otros detallada.xlsx` (decisiones por caso);
  - `4. Seleccion/CCSS2026_procesamiento_codificado_24-10.pulso`.
- **Precedente**: HSyVbG 2026 (`checklist-entregables-hsyvbg-2026-10-13.md`, ADR 0100,
  `api/R/carga_reemplazar_respuestas.R`).
- **Método**: cada brecha se verificó leyendo el código en `claude/keen-diffie-8fc654` (base `50cdabdfe`).
  Lo que no se ejecutó se marca como *lectura de código*. Las líneas son de ese commit.

## Checklist vivo

Estados: **pendiente** (falta implementar) · **bloqueado** (falta una decisión de Gonzalo) ·
**medir** (falta medir antes de decidir) · **hecho** (verificado). Solo Gonzalo da un ítem por cerrado.

| # | Brecha | ¿Se confirma? | Dónde vive | Capacidad parcial que ya existe | Severidad | Estado |
|---|---|---|---|---|---|---|
| B1 | Codificación vuelve a adaptar desde el origen viejo sin avisar | Sí, y alcanza más rutas que `default` | Motor: `router_codificacion.R` + `session_store.R` | Analítica ya resuelve el mismo caso (`.analitica_original_member_id`); SurveyMonkey reasigna `original_*` | **Alta**: N equivocado (467 en vez de 397) y en silencio | pendiente |
| B2 | «Nueva versión» no actualiza las bases hijas de repeat | Sí | Motor: `carga_reemplazar_respuestas.R` | Las hijas xlsx se regeneran al reabrir el `.pulso`; `estudio_init_default_base` y el refresco de Kobo sí las regeneran | **Alta**: hija con filas de otra versión | pendiente |
| B3 | Selección aleatoria por cuotas y factor fuera de la app | Sí; el redondeo es del script | Motor nuevo + ADR | `ponderacion_engine.R` calcula el peso de diseño por estrato (normalizado a media 1) | Media (cada estudio por cuotas lo repite: HSyVbG y CCSS) | **bloqueado** (D1, D2) |
| B4 | Filtros de depuración, reatribución, correcciones y anonimización fuera de la app | Sí, aunque Monitoreo cursos-horario ya aplica casi los mismos filtros | Motor (Monitoreo → Carga) + ADR | Criterio de validez, padrón y deduplicación «la primera» en Monitoreo aulas; `origen_externo` (ADR 0100 P2) | Media-alta | **bloqueado** (D3, D4) |
| B5 | Peso por columna: la columna tiene que estar en el XLSForm | En parte: el motor no lo exige; el selector de la UI sí, y Cruces excluye antes de ponderar | Motor (`router_analitica.R` Cruces) + front (`PesoPorColumna.tsx`) | Declarar la columna como variable propia `decimal` (ADR 0106) ya funciona | Media | pendiente (reproducir antes) |
| B6 | Variables del marco (nivel, carrera, sexo) como cruce | En gran parte ya existe (ADR 0106/0107, anexar columnas); hay tres huecos | Motor (`base_variables_servicio.R`, `segmentos_cruce.R`) + front (Carga y Cruces) | Declarar `select_one` con etiquetas, anexar columnas por clave, segmentos de cruce | Media | pendiente |
| B7a | Codificación: no hay «anular texto» | Sí | Motor (`router_codificacion.R` bridge) + front (`RespuestasCodificador.tsx`) | En SM, asignar una opción ya marcada desmarca Otro; «No categorizar» y «Dejar en Otro» son por pregunta | Media | **bloqueado** (D5) |
| B7b | Codificación por caso e importación de matriz por caso | Sí en SO/SM; el override por caso existe y solo actúa en `text`; el import está atado a otro estudio | Motor (`router_codificacion.R`, `codificacion_config_excel.R`, `codificacion_config_json.R`) + ADR (choca con ADR 0100 D3) | `matrix_cases` y `POST /matrices/caso`; formato `case_code_matrix` casi genérico | Media-alta | **bloqueado** (D6) |
| B7c | Codificación no conoce los valores especiales (98/99) | Sí; el front además tiene su propia convención (88/99) | Motor + front + estándar de la casa | El estándar existe (`reporte_plan_opciones.R:625`, `analitica_codigos_especiales.R`) y no se consume | Media | **bloqueado** (D7) |
| B7d | «Ya marcada» sin acción explícita | Hay aviso y no hay acción | Front (`RespuestasCodificador.tsx`, `marcasPrevias.ts`) + `codificacion_decisiones.R` | El chip «ya marcada» y el bridge, que ya desmarca Otro al asignar una opción marcada | Baja-media | pendiente (sigue a D5) |
| B8 | Texto que detalla una opción que no es «Otro» | Sí; el motor lee el `relevant` pero no guarda el disparador | Motor (`codificacion_flujo_hibrido.R`, bridge SO-padre/SM) + ADR | `.codif_extract_trigger_code` ya extrae el código disparador | Media | **bloqueado** (D8) |
| B9 | Analítica lista original y `_recod`/`_agrup`; secciones con markdown | Sí, las dos cosas; además entran `note`/`calculate` | Motor (`.detect_secciones_analitica`, copiado en dashboard y codificación) | `.analitica_filter_sections` cambia a `_recod` solo como respaldo; `.form_rt_a_plano` limpia markdown | Media | markdown y tipos: pendiente · preferencia: **bloqueado** (D9) |
| B10 | `detect-secciones` tarda más de 120 s | Causa plausible por código; **no medido** | Motor (`.load_rp_data` → reparadores de `project_pulso.R`) | Memo del reparador de recodificadas, caché de lectura, warmup | Media | **medir** |
| B11 | No hay vía headless para el pipeline | Sí | Herramienta nueva (`api/scripts/` + Makefile) | `load_pulso`, `build_pulso`, `.codif_apply_complete`, bootstrap `PULSO_BOOTSTRAP_SID` | Baja-media | **bloqueado** (D10) |
| B12 | Jobs callr con el paquete instalado | En parte: con `make dev-api` los workers ya hacen `load_all`; el riesgo está en un Plumber lanzado a mano y en closures sin marcar | Motor (`jobs.R`) | `PULSO_REPO_ROOT` → `load_all`; reinstalación por mtime en `launch.R`; sello de código del warmup | Media (recurrente) | pendiente |
| B13 | *(hallazgo lateral)* La sugerencia de parejas nunca empareja | Sí, verificado en código y en Rscript | Motor (`router_codificacion.R:963`) | El motor de `relevant` y de sufijos existe; solo le falta el `name_map` | **Alta**: apaga en silencio el emparejado automático y es la vía del síntoma de B8 | pendiente |

## Decisiones que necesita Gonzalo

| # | Decisión | Afecta a | Recomendación |
|---|---|---|---|
| D1 | ¿Dónde vive la **selección final por cuotas**? (a) un modo nuevo de Cálculo de muestra («selección de casos») que lee la base y escribe `seleccionado` y el factor; (b) una acción de Procesamiento › Carga sobre la base | B3 | (a): la meta y las cuotas ya son del diseño muestral; Carga solo recibe la base marcada |
| D2 | **Normalización del factor**: ¿suma la meta (400, como el script) o el n (397, como hoy `ponderacion_engine`)? ¿Se guarda sin redondear? | B3, B5 | Guardar el factor con precisión completa (el 399,99997 sale de `round(…, 6)`, script l.286) y declarar la normalización en la ficha. La suma = meta conserva el N del diseño |
| D3 | **Depuración del operativo de aulas**: (a) promover las efectivas de Monitoreo cursos-horario como base de Procesamiento (como ya pasa con territorial y general); (b) reglas de Limpieza dentro de Procesamiento; (c) dejarla en el script y declararla con `origen_externo` | B4 | (a) para los filtros 1 a 6 y la reatribución, porque Monitoreo ya los calcula; las correcciones por caso, en Limpieza (`set_value`), que las traza |
| D4 | **Anonimización y lista del sorteo dentro de la app**: la llave código ↔ id_anon es PII. ¿Puede vivir en el `.pulso` o se exporta solo al lado, como los entregables? | B4 | Solo exportarla al lado (confidencial) y nunca guardarla en el `.pulso`, en la línea del ADR 0005 |
| D5 | **Semántica de «anular texto»**: en SM, ¿desmarcar Otro sin marcar otra opción? En SO, ¿NA, 90 o conservar el código del padre? | B7a, B7d | SM: desmarcar Otro. SO: conservar el padre y marcar el texto como decidido. Así ninguna anulación inventa un código |
| D6 | **Decisión por caso**: ADR 0100 D3 dice que la codificación depende del texto y no del caso. ¿Se admite un override por caso (`_uuid`/`_index` → código) que gane sobre el texto en SO y SM, sin que desaparezca si cambia la limpieza? | B7b | Sí, como capa opcional por encima del texto (como `matrix_cases` en `text`), con aviso cuando el id deja de existir. Va como enmienda al ADR 0100 |
| D7 | **Valores especiales en codificación**: adoptar el estándar de la casa (90 No aplica, 98 No sabe, 99 No responde) y retirar la convención propia del front (`Otros=70, No sabe=88, No aplica=99`) | B7c | Una sola fuente (`reporte_plan_opciones.R:625`) y botones fijos en el codificador |
| D8 | **Camino canónico de un texto que detalla una opción distinta de Otro** (A9_otro detalla la opción 3): (a) SO/SM-padre con disparador = 3, y el texto recodifica solo las filas que marcaron 3; (b) dejarlo como abierta aparte | B8 | (a): el texto pertenece a la pregunta madre y el `relevant` lo dice |
| D9 | **Analítica con derivadas**: si existe `p_recod`/`p_agrup`, ¿se oculta la original de las secciones sugeridas o se lista detrás? | B9 | Proponer la derivada más reciente y dejar la original disponible pero fuera de las secciones sugeridas |
| D10 | **Runner headless**: ¿script oficial soportado (con target de Makefile) o solo herramienta interna de QA? ¿Puede escribir el `.pulso` de vuelta? | B11 | Herramienta interna que escribe a un `.pulso` nuevo, nunca al original; se decide después de cerrar B1, B2 y B13, que son las que hoy obligan a rodearla |

## Detalle por brecha

### B1. Codificación vuelve a adaptar desde el origen viejo

**Verificación**
- `estudio_preserve_original_base_files` (`api/R/session_store.R:1221-1235`) copia `xlsform_file_id`/`data_file_id`
  a `original_*` **solo si `original_*` está vacío**. La primera aplicación de codificación lo fija
  (`.codif_apply_complete`, `router_codificacion.R:2084`) y nadie lo vuelve a mover.
- `estudio_replace_base_files` (`session_store.R:1154-1219`) cambia solo los ids actuales.
  `estudio_init_default_base` (`router_carga.R:557-607`) lo usa al subir instrumento o data
  (`router_carga.R:1820`, `:1863`).
- `.codif_source_pair_for_adapt` (`router_codificacion.R:70-74`) llama a `.codif_base_file_meta(...,
  prefer_original = TRUE)`, que recorre primero `original_*` (`:54-66`). La excepción es un
  `effective_data_file_id` de Limpieza o del filtro de universo (`:45-53`).
- Tampoco reasignan el origen: `carga_reemplazar_respuestas` (`carga_reemplazar_respuestas.R:113-123`), el
  refresco de Kobo (`router_carga.R:1709-1720`) ni la lógica del XLSForm por base. **Sí** lo reasignan
  SurveyMonkey SAV (`surveymonkey_sav_bundle.R:1067-1071`, cuyo comentario describe justo este bug) y el
  refresco multibase de SM (`surveymonkey_multibase.R:3766-3768`).
- Los avisos que existen no lo detectan: `codificacion_verificar_respuestas_de_partida`
  (`codificacion_readaptar.R:23-33`) compara `data_file_id` y no el archivo que realmente se leyó; `readaptar_desde`
  pide volver a adaptar, pero esa readaptación lee el original viejo.
- Analítica ya lo resolvió: `.analitica_original_member_id` (`router_analitica.R:48-60`) usa el id actual salvo
  que sea el artefacto adaptado.

**Propuesta (fix)**. Llevar la regla de `.analitica_original_member_id` a `.codif_base_file_meta`: el original
es el archivo actual mientras no sea un artefacto adaptado. Opcional: que `estudio_replace_base_files`
actualice `original_*` cuando el archivo que entra no es adaptado, como ya hace SurveyMonkey. En
`.codif_source_pair_for_adapt`, publicar en la respuesta de `/aplicar` el archivo y el n de filas leídos, para
que un origen inesperado se vea. La lógica nueva va en un archivo propio (`codificacion_origen_vigente.R`):
`router_codificacion.R` tiene 3 343 líneas.

**Test**: subir data A → aplicar → subir data B con otro n → aplicar ⇒ el instrumento adaptado tiene el n de B.
Lo mismo por «Nueva versión» y por el refresco de Kobo.

**Dependencias**: ninguna. Es condición para confiar en B2.

### B2. «Nueva versión» no actualiza las hijas de repeat

**Verificación**
- Las hijas son bases hermanas con `parent_base`, `repeat_group`, `source_kind` (`xlsx_repeat`/`kobo_repeat`) y
  claves de enlace (`carga_xlsx_repeats.R:115-120`, `carga_kobo_repeats.R:483-497`).
- `carga_reemplazar_respuestas` (`carga_reemplazar_respuestas.R:76-140`) reemplaza solo la base `nombre`, invalida
  solo esa (`session_store.R:1201`) y reconstruye solo esa (`:132`). No llama a `.carga_xlsx_register_repeat_bases`.
- En cambio, `estudio_init_default_base` sí regenera las hijas xlsx (`router_carga.R:611-613`), y el refresco de
  Kobo también (`router_carga.R:1754-1760`).
- Al reabrir, `.pulso_repair_xlsx_repeat_bases` (`project_pulso.R:2818`) pone al día las hijas xlsx; las
  `kobo_repeat` no tienen esa reparación. ADR 0100 lo reconoce como límite (l.87-88).
- La UI ofrece «Nueva versión» en cada tarjeta sin distinguir madre de hija (`BasesDelEstudio.tsx:163`).

**Propuesta (fix)**. Al final de `carga_reemplazar_respuestas`: si la data es xlsx, regenerar las hijas con
`.carga_xlsx_register_repeat_bases(sid, nombre)`; invalidar las hijas con `parent_base == nombre`. Si la data no
trae las hojas del repeat, devolver en `cambios` que la hija quedó desactualizada, en vez de callarlo. En la UI,
«Nueva versión» de una hija remite a su madre.

**Test**: madre + hija xlsx; nueva versión con menos casos ⇒ la hija tiene solo las filas de los casos que
quedan; sin la hoja del repeat ⇒ aviso explícito.

**Dependencias**: B1 (si no, la hija se regenera bien y codificación sigue leyendo el original viejo).

### B3. Selección por cuotas y factor de ponderación

**Verificación**
- El reparto «mayor déficit» dentro de carrera×sexo por nivel, con semilla 2026, vive en el script (l.207-243).
  `grep` de `deficit`/`submuestr`/`seleccion_final` en `api/R` no encuentra un equivalente: los `deficit_*` de
  `monitoreo_aulas_calibracion.R` son de avance de campo y no de selección.
- El redondeo es del **script**, no de la app: `round(metas$Meta / metas$Seleccionados, 6)` (script l.286). La
  suma 399,99997 sale de ahí.
- Capacidad parcial: `.ponderacion_design_weights` (`api/R/ponderacion_engine.R:77-95`) da N_h/n_h por estrato,
  proporcional al factor del script, pero **normalizado a media 1** (suma = n = 397, no 400). Además necesita la
  variable de estrato en la data (`ponderacion_compute`, `:261-265`), que es el mismo hueco de B5 y B6.

**Propuesta (feature + ADR)**. Según D1, un modo «selección de casos» que reciba la base, las metas por
estrato, las variables de balance y la semilla, y devuelva `seleccionado` + factor + registro reproducible
(tabla de metas, disponibles y seleccionados), con test de semilla fija. El factor se guarda sin redondear (D2).
Alternativa mínima mientras tanto: documentar que, con `nivel` visible (B6), la ponderación de diseño de la app
reproduce las proporciones del factor del script.

**Dependencias**: D1, D2, B6 (estrato visible). ADR nuevo (Rama 8).

### B4. Depuración, reatribución, correcciones y anonimización

**Verificación**
- El script aplica en orden: sin aula o prueba → no acepta → código inválido → duplicado (se conserva el primero) →
  fuera del padrón → fuera de la población (6 a 9); además reatribuye CORREO → aula aplicada.
- **Monitoreo cursos-horario ya calcula casi lo mismo**: consentimiento (`monitoreo_aulas_consentimiento.R`),
  `valid_filters` y criterio de validez (`monitoreo_aulas_criterio_validez.R`), cruce con el padrón y
  deduplicación «la primera» **después** de resolver el padrón (`monitoreo_aulas_eje_atribucion.R:128` →
  `monitoreo_aulas_nivel.R:161-171`), y aula aplicada (`monitoreo_aulas_aula_aplicada.R`).
- El puente Monitoreo → Procesamiento (`carga_monitoreo_handoff.R`, `carga_monitoreo_handoff_general.R`) cubre
  las familias **territorial y general, no cursos-horario** (`grep -i aulas` sin coincidencias).
- `origen_externo` (ADR 0100 P2, `carga_origen_externo.R`) ya permite declarar una base preparada fuera con su
  lista de exclusiones. Pero acepta como id solo `.codif_key_candidates` (`router_codificacion.R:86-90`): una base
  anonimizada con `id_anon` no entra, salvo por `_index`.
- Limpieza tiene `exclude_cases`, `set_value`, `replace_value` y `recode_map` (`limpieza_decision_engine.R`). La
  regla `duplicate_tuple` de Validación marca **todas** las apariciones (`validacion_ast_compiler_r.R:264-268`),
  no «todas menos la primera».
- No hay anonimización con llave (id_anon ↔ código) ni lista del sorteo en el motor.

**Propuesta**. Según D3, un `carga_monitoreo_handoff_aulas.R` (archivo nuevo: `router_monitoreo.R` está
congelado) que promueva las efectivas del perfil aulas con su registro paso a paso y su atribución de aula como
base de Procesamiento, incluidas las variables del padrón (empalma con B6). Correcciones por caso en Limpieza.
Agregar `id_anon` (y una columna id declarable) a los candidatos de `origen_externo`, para el camino (c). La
anonimización, según D4.

**Dependencias**: D3, D4, B2 (la base aulas tiene repeat `datos_crianza`), B6.

### B5. Peso por columna

**Verificación**
- El motor no consulta el XLSForm: `.analitica_ponderacion_apply_columna` (`ponderacion_analitica.R:141-151`)
  solo pide `col %in% names(data)`, y `.analitica_filter_data_to_inst` conserva las columnas extra
  (`router_analitica.R:279-301`).
- **El selector de la UI sí lo exige**: `/api/analitica/variables` lista solo `.variables_desde_instrumento`
  (`router_analitica.R:3736-3764`, `:1814-1850`), y `PesoPorColumna.tsx:24-29` filtra de ahí; si la columna no
  está, dice «(no está en la base)» (`:61`, `:112`), que es falso.
- `variables_extra_incluidas` solo alimenta el plan de exportación (`reconciliacion_variables.R:267-273`); no
  hace visible la columna en ningún selector.
- **El error real, por lectura de código**: Cruces excluye `variables_excluidas` **antes** de ponderar
  (`router_analitica.R:4399` → `:4404`); Frecuencias pondera antes de excluir
  (`analitica_frecuencias_export.R:43-51`). Si el peso está en `variables_excluidas`, Cruces da
  E_PONDERACION_COLUMNA_INEXISTENTE y Frecuencias no. Gráficos lo traga (`router_graficos.R:809-814`).
  **Falta reproducirlo con el `.pulso` del caso** para confirmar que fue esta vía.

**Propuesta (fix)**. (a) En Cruces, ponderar antes de excluir, igual que Frecuencias. (b) Candidatas del selector
= columnas numéricas de la data, incluidas las extra; corregir el texto. (c) Gráficos publica el error en vez de
tragarlo.

**Dependencias**: ninguna; D2 para la normalización.

### B6. Variables del marco como cruce

**Verificación (la capacidad existe en gran parte)**
- Declarar una variable propia `select_one` con etiquetas: `POST /api/carga/base-variables/declarar` →
  `base_variables_declarar` (`base_variables_servicio.R:105-131`), que la inserta en survey y choices
  (`base_variables_instrumento.R:175-210`); Analítica la lee y aparece en Cruces.
- Traer columnas del padrón por clave: `POST /api/estudio/base/anexar` (`carga_columnas_anexadas.R:59-104`), que
  sobrevive a «Nueva versión».
- Segmentos de cruce (ADR 0107): `segmentos_cruce.R`.

**Huecos (lectura de código, sin test)**
1. Las columnas anexadas **no son declarables**: `.base_variables_par_original` (`base_variables_servicio.R:26-37`)
   lee y normaliza **sin** `base_variables_materializar`, así que la anexada no aparece entre las extras y
   declararla da E_BASE_VARIABLE_INEXISTENTE. Contradice `AnexarColumnas.tsx:2-3`.
2. Un segmento cuyo origen es una anexada falla si la base no tiene otras calculadas
   (`segmentos_cruce.R:326-336`, `:198-202`).
3. El tipo no se elige: el detector propone `select_one` solo con ≤30 valores (`base_variables_detector.R:20`,
   `:76-78`), y la UI no ofrece selector (`ColumnasDeLaBase.tsx:144`, `:200`).
4. Descubribilidad: todo vive en Carga › base › «Variables»; desde Analítica › Cruces no hay pista. Una variable
   propia cae en «General» y no se agrega sola a secciones ya guardadas.

**Propuesta (fix + UI)**. Materializar en `.base_variables_par_original` (arregla 1 y 2); selector de tipo en
`ColumnasDeLaBase.tsx` (el backend ya valida); en Cruces, un acceso «Agregar variable de la base…» que abra
`?panel=variables-base` (con `usePanelDireccionable`, Contrato de Superficie C1/C4).

**Por qué no fue el camino obvio**: estaba en otro módulo y, para el padrón, el camino corto (anexar →
declarar) está roto por el hueco 1.

**Dependencias**: ninguna. Desbloquea B3 y B4.

### B7. Codificación de «Otro»

**7a — anular texto (verificación)**. Las acciones del codificador son crear, editar, borrar, reordenar, asignar
y mover grupos (`RespuestasCodificador.tsx:250-344`). `.match_grupos` ignora grupos sin código
(`router_codificacion.R:1045`): no se puede fabricar un grupo nulo. En SO-padre, un texto sin grupo conserva el
código del padre (`:1470-1477`). En SM, asignar una opción ya marcada pone 0 en Otro (`:1587-1595`), que es la
única anulación de hecho. **Propuesta**: grupo especial `origen:"anular"` tratado en `.patch_so_padre_sheet` y
`.patch_sm_sheet`, contado como decidido en `.codif_material_de_pregunta` (`codificacion_decisiones.R:186`).
Semántica según D5.

**7b — por caso (verificación)**. La clave es el texto normalizado (`.normalize_text`, `:393-413`), y
`.respuestas_unicas` guarda solo 10 uuids por texto (`:879`). Existe `matrix_cases` + `POST /matrices/caso`
(`codificacion_config_excel.R:346-357`, `:999-1075`), pero el bridge solo lo consume con `tipo == "text"`
(`router_codificacion.R:1747-1751`). El import de matrices tiene alias fijos de carreras de ingeniería
(`codificacion_config_excel.R:267-280`), un respaldo a `p35` (`:313-319`) y pares `p23`/`p24` (`:527-548`); y el
upsert **reemplaza la fila entera** del draft (`codificacion_config_json.R:780-797`), lo que borra
`text_col`/`other_dummy_col` de un SO/SM ya emparejado. **Propuesta**: (i) fix inmediato, sin decisión: el upsert
conserva `text_col`/`modo_so`/`other_dummy_col`; (ii) según D6, consumir el override por caso en SO-padre y SM
con prioridad id > texto; (iii) un import genérico «matriz de decisiones por caso» (columnas `id`, `variable`,
`texto`, `codigo`, `accion`) con mapeo explícito hoja → base, que retire los alias del otro estudio.

**7c — valores especiales (verificación)**. El estándar existe (`.claude/skills/dominio-prosecnur/SKILL.md:105-109`;
`reporte_plan_opciones.R:625-640`; `analitica_codigos_especiales.R:13-16`) y codificación no lo llama. Usos
sueltos e incoherentes: `.opciones_sm` toma 70/95/98/99 como candidatos a Otro (`router_codificacion.R:636-637`);
`nextCodigo` del front reserva «No sabe=88, No aplica=99» (`RespuestasCodificador.tsx:217-228`).
**Propuesta**: según D7, botones fijos 90/98/99 desde una sola fuente, reservados en `.match_grupos`, y quitar
98/99 de los candidatos a Otro.

**7d — ya marcada (verificación)**. `.sm_marcas_por_fila` y `ya_marcadas` (`router_codificacion.R:799-836`,
`:891-910`) alimentan un chip informativo (`marcasPrevias.ts:31-54`). No se compara el texto con las etiquetas de
las opciones, y en SO no existe. **Propuesta**: acción «Ya marcada → quitar de Otro» en el menú de asignar,
contada como decidida; sugerirla cuando el texto coincide con la etiqueta de una opción marcada. Va con 7a.

**Dependencias**: B13 primero (sin parejas no hay `other_dummy_col`); 7a ↔ 7d comparten acción; 7b(ii) necesita
enmendar el ADR 0100.

### B8. Texto que detalla una opción que no es «Otro»

**Verificación**
- El motor semántico lee el `relevant` (`codificacion_flujo_hibrido.R:888-889`), extrae el código disparador
  (`.codif_extract_trigger_code`, `:975-991`) y encuentra el texto (`:993-1047`). Pero el `trigger_code` solo
  arma `other_dummy_col` en SM (`:1077-1085`) y no se guarda en la fila.
- En la app ese motor no corre (B13). Lo que se usa es `.candidatos_texto_for`, que puntúa por nombre y sección
  sin `relevant` (`router_codificacion.R:648-694`).
- SO-padre reemplaza el valor del padre en cualquier fila con texto, sin comparar con el disparador (`:1456-1468`).
  En SM, el desmarcado en datos reconoce Otro por etiqueta «otro…» (`codificacion_aplicar_data.R:640-648`), y
  «otra persona responsable» no lo cumple.
- Sin pareja confirmada, A9_otro queda como fila `text` y sale `A9_otro_recod` como abierta (`:1742-1752`). Es
  justo el síntoma observado.

**Propuesta (fix + decisión D8)**. Guardar `trigger_code` en la fila del draft (`.familias_rows_from_df`,
`.familias_draft_to_xlsx`) y usarlo como señal fuerte en `.candidatos_texto_for`. En SO-padre, recodificar solo
donde padre == disparador. En SM, desmarcar por `other_dummy_col`/disparador, no por la etiqueta. Copy de la UI:
«detalla la opción 3», no «Otros».

**Dependencias**: B13; D8.

### B9. Analítica con derivadas y markdown en las secciones

**Verificación**
- `.detect_secciones_analitica` (`router_analitica.R:1734-1810`) recorre los grupos; toda fila con `name` entra,
  incluidos `note`/`calculate` (`:1776`), que `.variables_desde_instrumento` sí excluye (`:1844-1845`).
- El nombre de la sección es el label crudo (`:1770`): «### MÓDULO A…» pasa tal cual.
- Codificación inserta `p_recod` debajo de `p` (`codificacion_aplicar_instrumento.R:542`), así que las dos caen
  en el mismo grupo. `.analitica_filter_sections` (`:1952-1983`) cambia a `_recod` solo como respaldo y no conoce
  `_agrup`.
- El mismo algoritmo está copiado en `.dashboard_build_secciones` (`dashboard_secciones.R:21`) y en
  `.section_map` (`router_codificacion.R:~418`).
- Helpers que ya existen: `.form_rt_a_plano(x, markdown = TRUE)` (`reporte_formulario_ricotexto.R:292`). En el
  front, `stripMarkdown` solo quita `####` (`markdown.ts:142`) y `humanizeLabel` quita todos los niveles
  (`buildChoiceFilterModel.ts:39-45`).

**Propuesta**. Sin decisión: un `analitica_secciones_detectar.R` único que limpie el label con
`.form_rt_a_plano`, filtre los tipos que no son dato y que usen los tres consumidores. Con D9: preferir la derivada
más reciente (`_agrup*` > `_recod` > original) usando el mapa padre → target de `codif_por_base[[b]]$agrupaciones`.

**Dependencias**: D9 solo para la preferencia; conviene hacerlo después de B10 (mismo endpoint).

### B10. `detect-secciones` lento

**Verificación (lectura de código; no medido)**
- El handler (`router_analitica.R:3727-3735`) paga `.load_rp_data` entero (`:2196-2248`) para usar solo
  `rp_inst$survey`.
- En cada llamada corre `.analitica_repair_project_context` (`:2150-2168`):
  - `.pulso_repair_multibase_variant_xlsforms` (`project_pulso.R:1534-1738`) no tiene memo y lee data y XLSForm
    del disco;
  - el memo de `.pulso_repair_parent_recod_columns` no se guarda cuando la salvaguarda bloquea la escritura
    (`project_pulso.R:1452-1459`), y si escribe, vacía los cachés (`:1468-1482`). El propio archivo documenta un
    bucle sin convergencia de ~60 s (`project_pulso_recod_reparacion.R:3-15`).
- Incluso con caché, `.analitica_context_usable` (`:2049-2072`) revalida la compatibilidad, y
  `.bases_normalize_report_context` (`helpers_bases.R:725-743`) corre sin memo.

**Propuesta**. Primero medir sobre `CCSS2026_procesamiento_codificado_24-10.pulso` (copia en `tmp/`; el 8787 es del
usuario) con `Rprof` o tiempos por tramo: reparadores, contexto usable, normalización. Después: que
detect-secciones lea solo el instrumento; memoizar el reparador de variantes y el caso «bloqueada».

**Dependencias**: ninguna. Puede ir en paralelo con la oleada 1.

### B11. Vía headless

**Verificación**. `reference-project-run`, `dev-pulso`, `audit-*-run` y `desktop-audit` solo copian el proyecto y
levantan API + UI (`Makefile` ~117-121 y ~300-325; `api/scripts/reference_project_prepare_run.R`).
`audit_project_deliverables` (`audit_projects.R:1846-1944`) genera resúmenes, pero no codifica, no configura
Analítica ni guarda el `.pulso`. El bootstrap (`launcher/launch.R:144-189`) deja un `sid` usable por HTTP, sin
script que lo encadene.

**Propuesta (según D10)**. `api/scripts/pipeline_run.R` + `make pipeline-run PULSO=… PASOS=…`: `load_pulso` →
codificación síncrona (`.codif_apply_complete`) → import de la config de Analítica → generar → `build_pulso` a un
`.pulso` nuevo. Debe usar `load_all` y fijar `PULSO_API_DIR` (ver B12).

**Dependencias**: D10; después de B1, B2 y B13.

### B12. Jobs callr y paquete instalado

**Verificación**
- El bootstrap del worker (`api/R/jobs.R:94-121`) hace `load_all` si hay `PULSO_API_DIR` o `PULSO_REPO_ROOT`, y
  si no, `library(prosecnurapp)`. `launcher/launch.R:39` fija `PULSO_REPO_ROOT`, así que `make dev-api` ya usa el
  código del árbol.
- **El caso de hoy encaja con un Plumber lanzado a mano en el 8799 sin `PULSO_REPO_ROOT`**: entonces los workers
  cargan el paquete instalado, que no tiene el commit `50cdabdfe`. Es una hipótesis, no verificada.
- Agujero adicional (inferencia, no probado): los closures anónimos de job no están marcados con
  `prosecnur_job_function_name` (`jobs.R:123-130`) y su entorno queda enlazado al namespace instalado
  (`jobs.R:146-153`). Afecta, entre otros, a `analitica.cruces`, `analitica.panel.export` y `hojas_ruta.generate`.
- Detección de desfase que ya existe: reinstalación por mtime solo al arrancar (`launch.R:75-109`) y sello de
  código del warmup (`analitica_warmup.R:50-64`). En `job_submit` no hay nada.

**Propuesta (fix)**. Generalizar el sello de código del warmup a `job_submit`: si el worker resuelve otro código,
avisar en el resultado del job, o fallar en dev. Marcar o subir a top-level los closures de job. Documentar en
`/jobs-asincronos` que un Plumber ad hoc debe exportar `PULSO_REPO_ROOT`.

**Dependencias**: ninguna; precede a B11.

### B13. La sugerencia de parejas nunca empareja (hallazgo lateral)

**Verificación**. `.familias_suggest_tibble` (`router_codificacion.R:957-968`) llama
`escribir_plantilla_familias(inst, dat = list(raw = data_df))` **sin `name_map`**. `resolve_parent_col_original`
(`codificacion_flujo_hibrido.R:790-798`) devuelve NA con `name_map` NULL (comprobado en Rscript por el agente y
releído aquí). Por eso `parent_col`/`text_col` salen NA en toda sugerencia, y la lectura del `relevant` y de los
sufijos `_otro` nunca llega a la app.

**Propuesta (fix)**. Construir el `name_map` como `leer_datos` (`codificacion_flujo_hibrido.R:773`) y pasarlo.
Test: XLSForm con `p` + `p_otro` (relevant `selected(${p},'96')`) ⇒ la sugerencia trae `text_col = p_otro`.
Revisar que no cambie parejas ya confirmadas en proyectos existentes (la sugerencia solo propone).

**Dependencias**: ninguna. Precede a B7 y B8.

## Orden sugerido en oleadas

Reglas de la casa: máximo tres trabajadores y dos writers con globs sin solape; `autor-regresiones` fija el rojo
primero; toda oleada termina en `verificador`; gate por área (`make gate-area AREA=codificacion|carga|analitica`,
`make gate-front AREA=codificacion|analitica`).

| Oleada | Rama | Ítems | Trabajadores (writers) | Glob de escritura | Gate |
|---|---|---|---|---|---|
| 0 | 8 | D1–D10 con Gonzalo; ADR nuevo de selección y depuración (D1–D4); enmienda al ADR 0100 (D6, D8) | lead | `docs/adrs/`, este plan | — |
| 1 | 1 | **B1 + B13** · **B2** | `autor-regresiones` → `backend-r` A (`codificacion_origen_vigente.R`, `router_codificacion.R` mínimo) · `backend-r` B (`carga_reemplazar_respuestas.R`, `carga_xlsx_repeats.R`) | sin solape | `gate-area` codificación y carga; reproducir con el `.pulso` del caso (n = 397 en `_recod`; la hija con las filas de la muestra) |
| 1b | 1 | **B10** (solo medir) | `diagnosticador-regresiones` (solo lectura) | `tmp/` | informe de tiempos por tramo |
| 2 | 1 | **B5** · **B6** | `backend-r` (Cruces: orden ponderar/excluir; `base_variables_servicio.R`, `segmentos_cruce.R`) · `frontend-react` (`PesoPorColumna.tsx`, `ColumnasDeLaBase.tsx`, acceso desde Cruces) | contrato congelado antes: candidatas de peso y tipo declarable | `gate-area` analítica y base-variables, `gate-front`, `ui-quick-check` de Carga › Variables y Analítica › Cruces |
| 3 | 1 | **B12** · **B9** (markdown + tipos) · **B10** (fix según medición) | `backend-r` A (`jobs.R`) · `backend-r` B (`analitica_secciones_detectar.R` y sus tres consumidores) | sin solape | `gate-area` jobs y analítica |
| 4 | 1 | **B7b(i)** upsert · **B7a/B7d** · **B7c** · **B8** (tras D5–D8) | `backend-r` (bridge en un archivo nuevo `codificacion_bridge_*.R`) · `frontend-react` (`RespuestasCodificador.tsx`) + `revisor-metodologico` | contrato congelado: acciones `anular`/`ya_marcada`, códigos reservados, `trigger_code` | `gate-area` codificación, `gate-front`, reaplicar CCSS y HSyVbG y comparar |
| 5 | 1 | **B7b(ii-iii)** import por caso · **B9** preferencia (tras D9) | `backend-r` · `frontend-react` | — | ídem |
| 6 | 1 | **B3** · **B4** (tras D1–D4) | `backend-r` (motor de selección; `carga_monitoreo_handoff_aulas.R`) + `revisor-metodologico` + `guardian-contratos` (PII, `.pulso`) | archivos nuevos | test de semilla fija que reproduzca las 400 del script; registro de filtros que cuadre con el del script |
| 7 | 7 | **B11** (tras D10) | `backend-r` | `api/scripts/pipeline_run.R`, `Makefile` | correr el pipeline del caso sin UI |

**Criterio de cierre del plan**: rehacer el procesamiento de CCSS 2026-II dentro de la app, sin script
externo ni curl, y que la base, el factor y las frecuencias coincidan con los del 24-10. Solo Gonzalo da por
cerrado cada ítem.

## Notas para la próxima sesión

- B10 se mide sobre una **copia** del `.pulso` en `tmp/`. No se toca el backend del 8787, que es del usuario.
- La deduplicación de Monitoreo resuelve el padrón y después deduplica; el script deduplica y después cruza.
  Con el mismo código limpio dan lo mismo, pero el registro paso a paso no cuenta igual. Hay que cuadrarlo en B4.
- B5: antes de tocar código, confirmar con el `.pulso` del caso si `factor_ponderacion` estaba en
  `variables_excluidas`. Si no estaba, la causa es otra y la propuesta cambia.
