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
- **Ampliación del mismo día** (sesión «CCSS Base (fork)», al generar los entregables de Analítica): B0 y B14 a
  B17. El material es `4. Seleccion/CCSS2026_analitica_muestra400_24-10.pulso` (muestra 400 con secciones, banner
  de 6 variables, notas al pie y peso por columna) y `7. Entregables/Entregables 2026-10-24 (borrador)/`.
  **B0 bloquea el entregable al cliente y va primero.**
- **Segunda ampliación** (misma sesión, al armar el mazo de 38 láminas guardado en `graficos_config` de ese
  `.pulso`; mazo en `7. Entregables/…/CCSS PUCP 2026_Presentación de resultados.pptx`): **G1 a G9**, de Gráficos.
- **Precedente**: HSyVbG 2026 (`checklist-entregables-hsyvbg-2026-10-13.md`, ADR 0100,
  `api/R/carga_reemplazar_respuestas.R`).
- **Método**: cada brecha se verificó leyendo el código en `claude/keen-diffie-8fc654` (base `50cdabdfe`).
  Lo que no se ejecutó se marca como *lectura de código*. Las líneas son de ese commit.

## Checklist vivo

Estados: **pendiente** (falta implementar) · **bloqueado** (falta una decisión de Gonzalo) ·
**medir** (falta medir antes de decidir) · **hecho** (verificado). Solo Gonzalo da un ítem por cerrado.

| # | Brecha | ¿Se confirma? | Dónde vive | Capacidad parcial que ya existe | Severidad | Estado |
|---|---|---|---|---|---|---|
| **B0a** | **Las categorías de toda recodificada salen desordenadas en Frecuencias y Cruces** (los códigos de los grupos de Codificación primero, el resto después; 98/99 a mitad de lista) | **Sí, reproducido con el estado del `.pulso`** | Motor: `api/R/orden_categorias.R` (`.apply_grupos_recod_orden`, `.orden_categorias_perm`) | El instrumento adaptado ya está en orden y con los especiales al final; `.orden_especiales_al_final` existe, pero solo actúa dentro de la lista parcial | **Crítica: bloquea el entregable al cliente** | **hecho** (`fe745aaad`): verificado en Frecuencias y Cruces del caso; falta tu visto bueno |
| B0b | Sufijo «(Recodificada)» en el título de Frecuencias y Cruces | Sí; PPT y Word ya lo quitan | Motor: `reporte_frecuencias.R:328-341` (`.clean_recode_title`), `reporte_cruces.R:141,151` | `reporte_plan_ppt.R:2944` y `reporte_word_publico_barra.R` ya lo retiran | Media (entregable al cliente) | **bloqueado** (D11) |
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
| B14 | Una variable retirada en la carga (`cod_pucp`) rompe `/api/analitica/preparar` (E_DATA_XLSFORM_INCOMPATIBLE) | Sí: la retirada se apaga cuando cambia el `data_file_id` (aplicar codificación lo cambia) | Motor: `base_variables_instrumento.R:30-35`, `carga_origen_externo.R:146-153`, `session_store.R:1178` | La retirada existe (ADR 0100 Enm. 1 / ADR 0106); el test cubre carga + redeclaración, no carga + aplicar + preparar | **Alta**: obliga a editar el instrumento a mano | pendiente |
| B15 | Al reabrir el proyecto, Frecuencias y Cruces piden «Paso 1 preparar» (E_ANALITICA_NO_PREP) | Sí: la caché no se persiste a propósito, y la re-preparación implícita **traga el error real** | Motor: `router_analitica.R:2242`, `:2280-2285`; `helpers_multibase.R:46-48`; `project_pulso.R:628-646` | La re-preparación implícita y el auto-preparar del front existen | Media-alta: esconde la causa (probablemente B14) | pendiente |
| B16 | El worker callr de cruces depende del cwd («Could not find a root DESCRIPTION in ./api») | Sí | Motor: `app_paths.R:17` + 7 jobs con `load_all` propio | El bootstrap de `jobs.R:94-121` ya carga el paquete con rutas absolutas; `project_warmup_paralelo.R:72-86` tiene el patrón correcto | Media (rompe en cuanto el servidor no arranca desde la raíz) | pendiente |
| B17 | El rótulo del banner de Cruces es el enunciado completo; no hay forma corta | Sí | Motor: `reporte_cruces.R` (`label_variable`, `:131-154`), `router_analitica.R:3196-3211` (`.cruces_vars_parse`) + front de Cruces | `variable_labels` de Analítica (renombra en todas partes); `etiquetas_vars` de Gráficos (la única etiqueta corta real, pero en el plan PPT/Word) | Media (entregable al cliente) | **bloqueado** (D12) |

| **G1** | **Gráficos pierde toda select_multiple graficada por su madre original** (A9, B1: «no se encuentra en `data` ni se detectaron dummies») | **Sí, reproducido**: las dummies llegan en minúscula (`a9.1`) y solo se realinean las `_recod` | Motor: `graficos_plan_coverage.R:57-89`, `router_graficos.R:860`, `reporte_data.R:182-185` | Analítica ya realinea todo con `.analitica_restore_survey_case` (`analitica_sm_dummy_order.R:226-260`) | **Alta**: saca variables del mazo; afecta a todas las SM sin `_recod` | **hecho** (`e3b341388`): A9 y B1 vuelven al mazo (95/76/14 %); falta tu visto bueno |
| G2 | `p_cifra` no acepta una select_multiple (`A12_recod`) | Sí: exige una columna única, y la madre de una SM no existe en la data | Motor: `graficos_cifra.R:36-40` | `freq_table_spss` ya detecta `var.k` (`reporte_frecuencias.R:1061-1077`); pedir la dummy directa (`A12_recod.3`) probablemente funcione | Media | **hecho** (`f0712b59e`); falta tu visto bueno |
| G3 | `excluir_opciones` como arreglo JSON falla («debe ser NULL o character()») | Sí: el body se relee sin simplificar y el arreglo llega como `list` | Motor: `reporte_plan_slides.R:1892-1899` | El motor de opciones ya acepta listas (`reporte_plan_opciones.R:143-150`); multiapiladas tiene su propio `.ppt_as_chr_vec` | Media (rompe lo que la UI guarda) | pendiente |
| G4 | `p_barras_multiapiladas` no puede excluir códigos no sustantivos; el argumento se descarta en silencio | Sí; el renderer **ya** sabe excluir | Motor: `reporte_plan_slides.R:2165-2189`, `graficos_metadata.R:1282-1367`, `router_graficos.R:203` | `overrides.excluir_opciones` funciona hoy; `.reporte_plan_excluir_cascada` lo aplica antes de los porcentajes | **Alta**: el Top Two Box sale con el denominador equivocado | explícito: pendiente (1H) · automático: **decidido** (D13: sólo si el plan lo declara, con aviso) |
| **G5** | Orden roto en una variable **no** recodificada (B2 `tiempo_llegada` sale 3, 4, 5, 1, 2) | **Sí, reproducido**: la heurística de rangos toma el primer número sin unidades (30, 30, 1, 1, 2) | Motor: `graficos_orden_rangos.R:11-28`, `graficos_orden_categorias.R:171-229` | Pedir `orden_barras = "manual"` lo evita | **Alta**: orden equivocado y silencioso en el entregable (no es B0a) | **hecho** (`18a8726cf`): B2 sale 1→5 sin orden manual; el modo «instrumento» explícito queda con `motor-ppt` |
| G6 | Título duplicado en los slots de láminas mixtas (`p_slide_4_graficos`, `1mas2`, `cifras_y_graficos`) | Sí: el respaldo dibuja el título del panel y el gráfico canvas conserva el suyo | Motor: `lamina_mixtas.R:503-518`, `reporte_slides_composicion.R:99-103`, `reporte_plan_ppt.R:8340` (congelado) | El re-render del respaldo ya existe para `nota_pie = ""` | Media | pendiente |
| G7 | Un título de lámina en dos líneas se monta sobre los gráficos (`p_slide_2_graficos`, narrativo con dos gráficos) | Sí en la ruta de plantilla; la nativa solo desplaza desde cuatro líneas | Motor: `lamina_titulo_alto.R:10-27`, ruta de plantilla en `reporte_plan_ppt.R:8004-8013` (congelado) | `.lam_titulo_desplazo` + `.lam_con_titulo` (solo en escala y multilista); `.lam_aviso_titulo` | Media | **hecho por `motor-ppt`** (`7e10765b8`, en `main`); falta tu visto bueno |
| G8 | La opción 3 de A9, «Otra persona responsable o tutor/a», sale como «Otros» | Sí; el culpable es `.freq_clean_other_label_es`, no `es_otros_sugerido` | Motor: `reporte_frecuencias.R:896-917` y su gemelo `reporte_plan_opciones.R:69-88` | — | **Alta**: rótulo falso en Frecuencias y en el mazo; además suma opciones que acaban como «Otros» | **hecho** (`0217376c3`, `7d58ff7e9`): además, «Otra institución:» se imprime sin los dos puntos; falta tu visto bueno |
| G9 | La nota de significancia pisa la leyenda en `p_barras_agrupadas` con cruces | Sí: bandas de alto fijo (0,40 y 0,75 in) sin medir líneas | Motor: `graficador_barras_agrupadas.R:1804-1821`, `:2155-2168` | Apiladas ya mide su leyenda (`.barras_leyenda_alto_in`, `graficador_helpers_leyenda.R:125`) | Media | **hecho por `motor-ppt`** (`0ee5f6695`, `7e10765b8`, en `main`); falta tu visto bueno |

**Lo que cubre la ampliación de B1 y B2.** «Reemplazar respuestas no alcanza a la hija repeat y cambiar de base deja
un origen viejo» es B2 + B1. El rodeo de ese día —rehacer el proyecto y copiar `codif_por_base` a mano— pasa a ser
el criterio de aceptación de ambos: pasar de la base total a la muestra con «Nueva versión» conserva el catálogo
(ADR 0100 D3) y deja madre, hija y origen de Codificación en la muestra.

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
| D11 | **«(Recodificada)» en el título**: ¿se quita de Frecuencias y Cruces siempre, o solo en los entregables al cliente (y se conserva en el libro de códigos interno)? | B0b | Quitarlo de Frecuencias y Cruces, como ya hacen PPT y Word. El libro de códigos distingue la recodificada por su nombre `_recod` |
| D12 | **Rótulo corto del banner**: ¿dónde vive? (a) campo `rotulo` por variable del banner en la config de Cruces; (b) reusar `etiquetas_vars` de Gráficos como fuente única de etiqueta corta; (c) una columna del XLSForm (`label::short`) | B17 | (a) con (b) como valor sugerido: el rótulo es del banner, y no debe cambiar el enunciado de la misma variable cuando va en filas |
| D13 ✅ | **Códigos no sustantivos en escalas** (decidido por Gonzalo el 2026-10-24: sólo cuando el plan lo declara, con aviso) (9 «No tengo información suficiente», 77 «No lo sé / No uso este recurso»): ¿se excluyen solos del denominador del Top Two Box y de la escala, o solo cuando el plan lo declara? | G4 | Solo cuando se declara, pero con aviso en la lámina si una escala trae una categoría que no es del recorrido. El 9 no cae en ningún rango estándar y no se puede adivinar |
| D10 | **Runner headless**: ¿script oficial soportado (con target de Makefile) o solo herramienta interna de QA? ¿Puede escribir el `.pulso` de vuelta? | B11 | Herramienta interna que escribe a un `.pulso` nuevo, nunca al original; se decide después de cerrar B1, B2 y B13, que son las que hoy obligan a rodearla |

## Detalle por brecha

### B0. Orden de las categorías recodificadas (prioridad 1)

**Verificación (reproducida sobre una copia de `CCSS2026_analitica_muestra400_24-10.pulso`)**
- El instrumento adaptado está bien. `choices` de `ciclo_recod` = 6, 7, 8, 9, 70, 10, 98 con etiquetas completas, y
  `reporte_instrumento(...)$orders_list$A1_recod` da el mismo orden. **El desorden entra después.**
- `.analitica_get_config` (`router_analitica.R:2446-2458`) inyecta en la config los `grupos_recod` de Codificación.
  `.analitica_apply_data_review` (`router_analitica.R:2693-2694`) los pasa por `.orden_grupos_recod_por_parent` y
  `.apply_grupos_recod_orden` (`orden_categorias.R:107-175`), que reordenan `orders_list[[<p>_recod]]`.
- `.orden_categorias_perm` (`orden_categorias.R:43-50`) pone **a la cabeza** los códigos de la lista y deja el resto
  detrás. Pero `grupos_recod` no es un orden completo: trae **solo los grupos que el analista tocó**. Estado real del
  `.pulso`:

  | Pregunta | `grupos_recod` | Resultado en la tabla |
  |---|---|---|
  | A1 | 10 (nuevo), 98 (nuevo) | Décimo ciclo, No sabe, Sexto…Noveno, Otro (lo observado, exacto) |
  | B3 | 1, 2, 6, 7, 9 (existentes) | esos cinco primero, el resto detrás |
  | B14 | 1, 2, 80, 99 | 80 y 99 a mitad de lista |
  | E2 | 4, 99 | 99 en segundo lugar |

- `.orden_especiales_al_final` (`orden_categorias.R:135-142`) ordena los especiales **dentro** de la lista parcial,
  no del orden final: por eso 99 queda delante de la cola.
- El override está documentado para select_multiple (`orden_categorias.R:82-96`), pero se aplica a todo `_recod`,
  incluidos los SO.
- `.reordenar_por_instrumento` (`reporte_frecuencias.R:290-325`) respeta fielmente el `orders_list` que recibe. El
  error no está ahí, sino en el orden que se le entrega. Las SM `_recod` heredan lo mismo por
  `.analitica_order_sm_dummy_cols` (`analitica_sm_dummy_order.R`), que lee el `instrumento_reporte` sincronizado
  en `:2703-2709`.
- Tests: `test-analitica-order-by-instrument.R:300-340` y `test-orden-grupos-recod-especiales.R` solo prueban listas
  **completas** de SM. Ninguno prueba una lista parcial ni un SO.

**Propuesta (fix, Rama 1, con regresión)**
1. `autor-regresiones`: un test que falle con `grupos_recod` parcial (A1: `10, 98` sobre 6, 7, 8, 9, 70, 10, 98 ⇒
   esperado 6, 7, 8, 9, 10, 70, 98, o el orden del instrumento) y con especiales en la lista parcial (B14).
2. Fix en `orden_categorias.R`: el orden de las flechas **solo reordena los códigos que nombra, en sus posiciones
   relativas dentro del orden del instrumento**, en vez de ponerlos a la cabeza. Así, una lista parcial no mueve nada
   que no haya tocado. Después, especiales [80,100) al final **sobre la lista completa**.
3. Fijar el mismo contrato en Frecuencias, Cruces, la BBDD y el libro de códigos (todos leen ese `orders_list`).
   Verificar los cuatro sobre el `.pulso` del caso y revisar las láminas de Gráficos.

Pendiente de confirmar con Gonzalo: si un orden puesto **a propósito** con las flechas (por ejemplo, una categoría
nueva subida al principio) debe seguir pudiendo ganar sobre el instrumento. Con el fix 2 gana para lo que nombra,
pero nunca arrastra al resto.

**B0b.** Quitar el sufijo de `.clean_recode_title` según D11. Lo usan Frecuencias (`reporte_frecuencias.R:441,453`)
y Cruces (`reporte_cruces.R:141,151`).

**Dependencias**: ninguna. Va en la oleada 1.

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

### B14. Una variable retirada rompe Analítica

**Verificación**
- Retirar no reescribe la data ni el XLSForm. Se deriva un XLSForm adaptado sin las filas retiradas
  (`base_variables_instrumento.R:85-111`, `:168-170`). Salen del instrumento las de `retiradas_carga_manual` o las de
  motivo `metadato`/`no_va_al_cliente` (`:50-59`). Las de motivo `otra` se rellenan con NA
  (`base_variables_calculadas.R:128-136`).
- **El candado**: las dos listas se leen solo a través de `.base_variables_retiradas_vigentes`
  (`base_variables_instrumento.R:30-35`). Esa función devuelve `list()` salvo que `origen_externo` esté «vigente»
  para el `data_file_id` **actual** (`carga_origen_externo.R:146-153`).
- `.codif_apply_complete` (`router_codificacion.R:2084-2096`) cambia `data_file_id` a la data adaptada
  (`session_store.R:1178`) sin mover el `data_file_id` del bloque. Desde ahí el estado es `otra_base`, `cod_pucp`
  vuelve al instrumento, y el assert estricto (`data_normalizer.R:1056`, sin umbral; mensaje en
  `router_carga.R:262-279`) falla en `.analitica_read_pair_uncached` (`router_analitica.R:636`).
- Lo mismo pasa en cualquier flujo que llame a `estudio_replace_base_files` sin volver a registrar la retirada
  (handoffs de Monitoreo, refresco de Kobo, SM, repeats xlsx).
- ADR 0106 (l.76-81) dice que `retiradas_carga_manual` vive fuera del bloque «para sobrevivir a la redeclaración».
  El código no lo cumple cuando el bloque pasa a `otra_base`.

**Propuesta (fix)**. Que la vigencia de la retirada siga el **linaje** de la data (original, limpieza, universo,
adaptada) y no un id puntual. O bien que `estudio_replace_base_files` traslade el `data_file_id` del bloque cuando la
data nueva es una derivada. Test: cargar → retirar → aplicar codificación → preparar ⇒ sin error y sin `cod_pucp`.

**Dependencias**: comparte terreno con B1 (los dos son «qué archivo es el original»). Conviene que un mismo
writer los resuelva con una sola regla de linaje.

### B15. «Paso 1 preparar» tras reabrir

**Verificación**
- E_ANALITICA_NO_PREP se lanza solo en `.load_rp_data` (`router_analitica.R:2247`).
- Antes se intenta `.analitica_prepare_and_cache(sid)` dentro de `tryCatch(..., error = function(e) NULL)` (`:2242`):
  **el error real se pierde** y se publica «Paso 1» en su lugar. Igual en `.load_rp_sources` (`:2280-2285`) y en
  `run_report_per_base` (`helpers_multibase.R:46-48`).
- La caché no viaja en el `.pulso` a propósito (`.pulso_strip_caches`, `project_pulso.R:628-646`; la lista de la
  cabecera, `:20-25`, está desactualizada). El warmup no la reconstruye. Aplicar codificación también la invalida
  (`router_codificacion.R:147`, `:183-185`). En esa sesión funcionó porque la re-preparación implícita tuvo éxito.
  Al reabrir, falla: lo más probable es B14 (inferido).

**Propuesta (fix)**. Propagar el `stop_api` de la preparación, o adjuntarlo en `details` de NO_PREP, en los tres
sitios. Actualizar el comentario de `project_pulso.R:20-25`. Test: proyecto con B14 reabierto ⇒ el error dice
«Faltantes: …», no «Paso 1».

**Dependencias**: se verifica junto con B14.

### B16. Worker de cruces dependiente del cwd

**Verificación**. `.app_api_dir()` (`api/R/app_paths.R:1-18`) prueba `PULSO_API_DIR`, después
`PULSO_REPO_ROOT/api`, después el cwd, y al final devuelve `normalizePath("./api", mustWork = FALSE)`: una ruta
**relativa** si no existe. Siete jobs calculan esa ruta en el proceso padre y hacen su propio `load_all` dentro del
worker:
- `analitica.multibase.tablas` (`router_analitica.R:4051`)
- `analitica.cruces` (`:4432`, el caso reportado)
- `analitica.enumeradores` (`:5060`)
- `validacion.v2.auditoria` (`router_validacion.R:1221`)
- `validacion.v2.reglas_custom.ejecutar` (`:2145`)
- `hojas_ruta.manual_replacements_pdf` (`router_hojas_ruta.R:866`)
- `hojas_ruta.generate` (`:961`)

El bootstrap de `jobs.R:94-121` ya carga el paquete con rutas absolutas y protegidas por `dir.exists`.

**Propuesta (fix)**. Que `.app_api_dir()` devuelva una ruta absoluta o NULL, resolviendo desde el namespace en dev
como hace `project_warmup_paralelo.R:72-86`. Quitar el `load_all` propio de los siete jobs (el bootstrap ya lo hace).
Es el mismo trabajo que B12: van juntos.

### B17. Rótulo corto del banner

**Verificación**. El encabezado del banner toma `label_variable` (`reporte_cruces.R:131-154`, `:1473-1494` y los
otros modos), que da prioridad a `labels_override` → `attr(label)` → `orders_list` → diccionario. El job
`analitica.cruces` no pasa `labels_override` (`router_analitica.R:4465-4504`). `.cruces_vars_parse` (`:3196-3211`)
descarta todo lo que no sea `name`/`excluidas`. Las capacidades que existen renombran **en todas partes**:
- `variable_labels` de Analítica (`:2538-2544`, `DataReviewPane.tsx`);
- `etiqueta_estandar` de la matriz de equivalencias;
- `label_overrides$titles`.

La única etiqueta corta real es `etiquetas_vars` de Gráficos (`reporte_plan_etiquetas_cortas.R`). El XLSForm no lee
`label::short` (`reporte_instrumento.R:105-205`).

**Propuesta (según D12)**. Campo `rotulo` opcional en cada variable de `cruces_vars`, pasado al job como un
parámetro **solo del encabezado del banner**, no como `labels_override`, que cambiaría también el enunciado de la
variable en filas. El editor del banner lo propone desde `etiquetas_vars` si existe.

**Dependencias**: D12.

### G1–G9. Gráficos (mazo de CCSS 2026)

Verificado leyendo código. G1, G5 y G8 se reprodujeron además con `pkgload::load_all` sobre una copia del
`.pulso` de la muestra 400. Nota de casa: `reporte_plan_ppt.R` está **congelado** (9 272 líneas, línea base 9 304),
así que todo lo que toque esa ruta va en un archivo nuevo al que el congelado llama.

**G1 — select_multiple por su madre original.** `/api/graficos/ppt` (`router_graficos.R:3080-3110`) toma
`s$rp_data_sources`, reconstruidas con `normalize_data_for_xlsform` → `reporte_data` → `sanitize_base_data`
(`project_pulso.R:853-868`). `reporte_data` genera las dummies y las renombra con `clean_dummy_name`, que hace
`tolower` (`reporte_data.R:182-185`, `:473`): salen `a9.1`, `b1.1`…. El único realineo de Gráficos,
`.graficos_align_recoded_dummy_names` (`graficos_plan_coverage.R:57-89`), solo recorre variables `_recod` (`:62`).
`freq_table_spss` distingue mayúsculas (`reporte_frecuencias.R:1065-1072`) y aborta. Analítica funciona porque llama
a `.analitica_restore_survey_case` (`router_analitica.R:2715`). Con esa función, la misma data da A9 = 379 / 301 / 56
sobre 397. Afecta a **toda** SM no recodificada (A12, B3, B4, B11, B14, B18, E1…). La cobertura dice que hay datos
porque compara sin mayúsculas (`graficos_plan_coverage.R:36-40`). **Fix**: llamar a `.analitica_restore_survey_case`
por base en `finalize_sources` (`router_graficos.R:860`) y en `graficos_consolidado.R:152`. El arreglo de raíz es
que `clean_dummy_name` conserve el caso del stem, pero alcanza a todo el motor y va aparte, con su propio análisis
de impacto. Es primo del commit `50cdabdfe` (capitalización en el normalizador): conviene un test de contrato que
compare, para la misma base, las columnas que ven Analítica y Gráficos.

**G2 — `p_cifra` con SM.** `.cifra_desde_datos` (`graficos_cifra.R:36-40`) exige `var %in% names(data)`; no hay
detección de SM. **Fix**: si `var` no existe y hay `var.k`, resolver `categoria` a código (`.explorar_map_choices`)
y calcular sobre `var.<código>`, con base en los casos que tienen alguna dummy no NA. Depende de G1.

**G3 — `excluir_opciones` como arreglo.** El body se relee con `simplifyVector = FALSE`
(`router_graficos.R:111-121`, `:2089-2097`), así que un arreglo llega como `list`. `.clean_rebuild_args`
(`:175-210`) no convierte tipos, y `.ppt_norm_chr_vec_arg` (`reporte_plan_slides.R:1892-1899`) aborta si no es
character. Afecta a agrupadas (`:1976`), categóricas (`:2062`, y por ella dicotómica) y apiladas (`:2114`). El tipo
`codigos_list` del registro (`graficos_metadata.R:28`) solo lo lee la UI. **Fix**: `.ppt_norm_chr_vec_arg` aplana
`list`, convierte numeric/logical y trata `list()` como NULL. Test con los tres formatos.

**G4 — multiapiladas sin exclusión.** El registro (`graficos_metadata.R:1282-1367`) y los formales
(`reporte_plan_slides.R:2165-2189`) no tienen `excluir_opciones`. `router_graficos.R:203` y
`graficos_miniaturas.R:252` descartan en silencio todo argumento que no sea formal. El renderer ya excluye antes de
calcular porcentajes (`.reporte_plan_excluir_cascada`, `reporte_plan_opciones.R:698-718`; uso en
`reporte_plan_ppt.R:4128-4142`). El Top Two Box suma columnas de porcentajes calculados sobre todas las categorías
(`graficador_barras_apiladas.R:2758-2777`). **Fix**: formal + registro («Excluir del denominador») y propagarlo a
los cuatro `el` y a los bloques de multilista. Además, **avisar** de los argumentos descartados en
`.clean_rebuild_args` (`setdiff(names(args), names(formals(fn)))`): ese aviso habría delatado G4 y protege a todo el
registro. La exclusión automática queda sujeta a D13. Mientras tanto, `overrides.excluir_opciones` funciona.

**G5 — orden de rangos.** El choices y `orders_list$B2` están en 1..5; el desorden lo mete el plan.
`.plan_orden_categorias` (`reporte_plan_ppt.R:6925`) → `.goc_traducir` (`graficos_orden_categorias.R:207`) →
`.goc_orden_rangos` (`graficos_orden_rangos.R:21-28`). Esta toma el primer número sin unidades
(«Menos de 30 minutos» = 30, «Entre 1 hora y…» = 1), ve un orden revuelto y lo «corrige» a 3, 4, 5, 1, 2. La
heurística existe para recodificadas revueltas (comentario `:3-7`), pero corre también sobre variables originales
y en el modo «instrumento» explícito. **Fix**: que el modo «instrumento» explícito respete el choices tal cual; que
la heurística solo actúe sobre `_recod`/`_agrup` y solo si todas las etiquetas tienen la misma forma de rango y la
misma unidad. Test con `tiempo_llegada` y con el caso de acrconta que motivó la heurística.

**G6 — título duplicado.** Las mixtas (`paneles_4`, `reporte_plan_ppt.R:8340`; `1mas2` y `cifras_y_graficos`,
`reporte_slides_composicion.R:96-107`) mandan a respaldo los paneles que no caben en piezas nativas.
`.lam_mixta_respaldo_caja` (`lamina_mixtas.R:503-518`) dibuja el título del panel e intenta borrar el del gráfico
con `labs(title = NULL)`. Pero agrupadas en canvas dibuja su título con `cowplot::draw_text`
(`graficador_barras_agrupadas.R:1989-2002`), así que sobrevive. **Fix**: re-render del respaldo con
`overrides$titulo = ""` y `subtitulo = ""`, junto al `nota_pie = ""` que ya existe
(`reporte_slides_composicion.R:100`), y lo mismo en `.lam_composicion_mixta` (`lamina_mixtas.R:452`). Vale para todo
graficador canvas.

**G7 — título en dos líneas.** En la ruta de plantilla, el placeholder del título (`slideLayout6.xml`: y = 0,37 in,
alto 0,685 in, 24 pt) termina cerca de 1,27 in, y los gráficos empiezan en 1,17–1,21 in. Nada mide el título en
`.ph_with_strict`. En la ruta nativa, `.lam_titulo_desplazo` (`lamina_titulo_alto.R:10-19`) solo desplaza desde
cuatro líneas y solo lo usan escala y multilista. `.lam_aviso_titulo` (`lamina_avisos_lineas.R:172-179`) solo avisa
con más de dos. **Fix**: medir con `.lam_lineas_tinta` en la ruta de plantilla y, con dos líneas, bajar los
gráficos (`loc` explícito) o avisar. Envolver mixtas y narrativo2 en `.lam_con_titulo`. La lógica va en un archivo
nuevo (`lamina_titulo_plantilla.R`); el congelado solo gana la llamada.

**G8 — «Otra persona…» como «Otros».** `.freq_clean_other_label_es` (`reporte_frecuencias.R:896-917`) marca como
otro toda etiqueta que **empiece** por «otro/otra» (`:912`) y la renombra «Otros» (`:915`). Además, si dos opciones
quedan como «Otros», las **suma** (`.freq_clean_option_labels_for_export`, `:969-993`). El gemelo
`.reporte_plan_clean_other_label_es` (`reporte_plan_opciones.R:69-88`) lleva el problema al mazo, también por
`.goc_traducir` (`graficos_orden_categorias.R:229`). `es_otros_sugerido` (`router_codificacion.R:636-643`) solo
sugiere en la UI de Codificación y no renombra. **Fix**: una sola función para los dos sitios. Es «otro» solo la
etiqueta que, sin «especifique», queda en «otro/a/s», o la opción que el instrumento declara como disparadora del
`_otro` (empalma con el `trigger_code` de B8). Test: «Otra persona responsable» se conserva y «Otro (especifique)»
pasa a «Otros».

**G9 — nota de significancia sobre la leyenda.** La nota (`graficos_significancia.R:307-335`) se parte cada 72
caracteres y añade el mapa de letras: dos a cuatro líneas a 8 pt. La banda del caption mide 0,40 in fijos y la de
la leyenda 0,75 in (`graficador_barras_agrupadas.R:487-489`, `:1804-1821`). El caption se centra sin medir
(`:2155-2168`), y en los slots chicos todo se comprime en npc (`:1842-1862`). `.reservar_pie_para_base_slide` no
reserva nada cuando hay caption (`reporte_plan_helpers.R:3135`). **Fix**: alto del caption según sus líneas, alto de
la leyenda con `.barras_leyenda_alto_in`, y caption anclado arriba de su banda (`vjust = 1`).

**Verificación común de G1–G9**: regenerar el mazo de 38 láminas del caso con A9 y B1 de vuelta y **revisar las
láminas renderizadas**, no el XML. Tres fallos (G6, G7, G9) son de geometría y solo se ven en la imagen.

## Orden sugerido en oleadas

Reglas de la casa: máximo tres trabajadores y dos writers con globs sin solape; `autor-regresiones` fija el rojo
primero; toda oleada termina en `verificador`; gate por área (`make gate-area AREA=codificacion|carga|analitica`,
`make gate-front AREA=codificacion|analitica`).

| Oleada | Rama | Ítems | Trabajadores (writers) | Glob de escritura | Gate |
|---|---|---|---|---|---|
| 0 | 8 | D1–D12 con Gonzalo; ADR nuevo de selección y depuración (D1–D4); enmienda al ADR 0100 (D6, D8) | lead | `docs/adrs/`, este plan | — |
| 1 | 1 | **B0a** (prioridad 1) · **B1 + B13** | `autor-regresiones` (rojo de B0a, B1 y B13) → `backend-r` A (`orden_categorias.R`) · `backend-r` B (`codificacion_origen_vigente.R`, `router_codificacion.R` mínimo) | sin solape | `gate-area` analítica y codificación; regenerar Frecuencias y Cruces del `.pulso` de la muestra 400 y **leer las tablas** (A1, B3, B14, E2 en orden, 98/99 al final) |
| 1b | 1 | **B10** (solo medir) | `diagnosticador-regresiones` (solo lectura) | `tmp/` | informe de tiempos por tramo |
| 1G | 1 | **G1 + G2** · **G5 + G8** (los cuatro que dan cifras o rótulos falsos en el mazo) | `autor-regresiones` → `backend-r` A (`router_graficos.R` `finalize_sources`, `graficos_consolidado.R`, `graficos_cifra.R`) · `backend-r` B (`graficos_orden_rangos.R`, `graficos_orden_categorias.R`, una función de «otro» compartida que usen `reporte_frecuencias.R` y `reporte_plan_opciones.R`) | sin solape; B toca `reporte_frecuencias.R` solo en la función de «otro» (B0b la toca después) | `gate-area` gráficos y analítica; test de contrato «Analítica y Gráficos ven las mismas columnas»; regenerar el mazo con A9 y B1 |
| 1H | 1 | **G3 + G4** · **G6 + G7 + G9** | `backend-r` A (`reporte_plan_slides.R`, `graficos_metadata.R`, aviso de argumentos descartados en `router_graficos.R:175-210`) · `especialista-entregables` B (`lamina_mixtas.R`, `reporte_slides_composicion.R`, `lamina_titulo_alto.R`, nuevo `lamina_titulo_plantilla.R`, `graficador_barras_agrupadas.R`) | A y B tocan `router_graficos.R` en zonas distintas: solo A; B no lo toca | `gate-area` gráficos; `sync-agentic-os --audit` (congelado sin crecer); render del mazo y revisión visual lámina por lámina de las afectadas |
| 2 | 1 | **B14 + B15** · **B2** | `backend-r` A (`base_variables_instrumento.R`, `carga_origen_externo.R`, `router_analitica.R:2242/2280`, `helpers_multibase.R`) · `backend-r` B (`carga_reemplazar_respuestas.R`, `carga_xlsx_repeats.R`) | sin solape; A comparte con B1 la regla de linaje (se congela en la oleada 1) | `gate-area` carga, base-variables y analítica; total → muestra con «Nueva versión» sin rehacer el proyecto; reabrir y preparar sin error |
| 3 | 1 | **B5** · **B6** | `backend-r` (Cruces: orden ponderar/excluir; `base_variables_servicio.R`, `segmentos_cruce.R`) · `frontend-react` (`PesoPorColumna.tsx`, `ColumnasDeLaBase.tsx`, acceso desde Cruces) | contrato congelado antes: candidatas de peso y tipo declarable | `gate-area` analítica y base-variables, `gate-front`, `ui-quick-check` de Carga › Variables y Analítica › Cruces |
| 4 | 1 | **B12 + B16** · **B9** (markdown + tipos) | `backend-r` A (`jobs.R`, `app_paths.R`, los siete closures de job) · `backend-r` B (`analitica_secciones_detectar.R`, con sus tres consumidores cambiados por una sola llamada) | A toca `router_analitica.R` solo en los jobs; B solo en el handler de detect-secciones | `gate-area` jobs y analítica; correr cruces con el servidor fuera de la raíz del repo |
| 5 | 1 | **B10** (fix según medición) · **B0b + B17** (tras D11, D12) | `backend-r` (lectura de detect-secciones, memo de reparadores) · `backend-r`/`frontend-react` (`reporte_frecuencias.R`, `reporte_cruces.R`, editor del banner) | sin solape | `gate-area` analítica, `gate-front`, regenerar los entregables y revisarlos visualmente |
| 6 | 1 | **B7b(i)** upsert · **B7a/B7d** · **B7c** · **B8** (tras D5–D8) | `backend-r` (bridge en un archivo nuevo `codificacion_bridge_*.R`) · `frontend-react` (`RespuestasCodificador.tsx`) + `revisor-metodologico` | contrato congelado: acciones `anular`/`ya_marcada`, códigos reservados, `trigger_code` | `gate-area` codificación, `gate-front`, reaplicar CCSS y HSyVbG y comparar |
| 7 | 1 | **B7b(ii-iii)** import por caso · **B9** preferencia (tras D9) | `backend-r` · `frontend-react` | — | ídem |
| 8 | 1 | **B3** · **B4** (tras D1–D4) | `backend-r` (motor de selección; `carga_monitoreo_handoff_aulas.R`) + `revisor-metodologico` + `guardian-contratos` (PII, `.pulso`) | archivos nuevos | test de semilla fija que reproduzca las 400 del script; registro de filtros que cuadre con el del script |
| 9 | 7 | **B11** (tras D10) | `backend-r` | `api/scripts/pipeline_run.R`, `Makefile` | correr el pipeline del caso sin UI |

**Si el entregable no puede esperar a la oleada 1 completa**, B0a cabe sola en una oleada mínima: un test rojo, un
fix en `orden_categorias.R` y la regeneración de las tablas del caso. No depende de nada más del plan.

**Criterio de cierre del plan**: rehacer el procesamiento de CCSS 2026-II dentro de la app, sin script
externo ni curl, y que la base, el factor y las frecuencias coincidan con los del 24-10. Además, Frecuencias y
Cruces salen con las categorías en el orden del instrumento, los especiales al final y el rótulo acordado, sin
editar el XLSForm a mano. Y el mazo de 38 láminas sale con todas sus variables (A9 y B1 incluidas), sin orden
manual en B2, sin títulos duplicados ni texto montado. Solo Gonzalo da por cerrado cada ítem.

## Notas para la próxima sesión

- **2026-10-24, tarde**: Gonzalo aprobó B0a + 1G y D13. Implementados con test en rojo primero y verificados sobre una
  copia de `CCSS2026_analitica_muestra400_24-10.pulso` con un backend propio del worktree (puerto 8797, `load_all`,
  sin `launch.R`, que reinstala el paquete). Frecuencias y Cruces: A1 en el orden del instrumento y ningún especial a
  mitad de lista. El mazo de 66 láminas de `graficos_config` renderiza sin «no se detectaron dummies». Ese mazo ya no
  grafica A9 ni B1 (`ccss-mazo` los rodeó con derivadas), así que G1, G2, G5 y G8 se verificaron con un plan de cuatro
  láminas renderizado a imagen. La lámina de cifras mostró rótulos montados en el gráfico chico de A12: es geometría
  y queda para `motor-ppt` o la oleada 1H.
- La oleada 1H se coordina con `motor-ppt`: G7 y G9 los cerró esa sesión en `main` (`7e10765b8`). G3, G4 (con el aviso de D13) y G6 siguen
  pendientes de la aprobación de 1H.

- B10 se mide sobre una **copia** del `.pulso` en `tmp/`. No se toca el backend del 8787, que es del usuario.
- La deduplicación de Monitoreo resuelve el padrón y después deduplica; el script deduplica y después cruza.
  Con el mismo código limpio dan lo mismo, pero el registro paso a paso no cuenta igual. Hay que cuadrarlo en B4.
- B5: antes de tocar código, confirmar con el `.pulso` del caso si `factor_ponderacion` estaba en
  `variables_excluidas`. Si no estaba, la causa es otra y la propuesta cambia.
