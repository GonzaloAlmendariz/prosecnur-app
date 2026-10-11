# Contrato — miniaturas en lote y vista previa asíncrona de lámina (F6 §5.3 · riesgo 7)

Fecha: 2026-10-11 · Unidad A4 backend (B-a K7 miniaturas en lote + B-b `/preview-slide` asíncrono).
Plan de origen: `docs/qa/plan-integracion-f6-2026-10-10.md` §5.3 («Punto de estado y miniaturas de 60 láminas») y §7
riesgo 7 («render sólo de la lámina activa, cola cancelable, caché por hash»).

Código: `api/R/graficos_miniaturas_hash.R` (huella), `api/R/graficos_miniaturas.R` (contexto, motor, caché, respuesta),
`api/R/graficos_miniaturas_jobs.R` (worker y jobs), `api/R/router_graficos_miniaturas.R` (mount delgado). Tests:
`api/tests/testthat/test-graficos-miniaturas.R` (huella/caché/motor) y `test-graficos-miniaturas-http.R` (contrato HTTP y
jobs reales).

## 1. Audiencia, grano y artefacto

- **Audiencia: interna** (editor de Gráficos). No es un entregable de cliente. Las guías de depuración (`debug_ph`) se
  dibujan en la vista previa como hasta hoy; el entregable (`/ppt`) sigue sin ellas (D17).
- **Grano**: una lámina del plan (`slide.id`). Denominadores y grano de cada gráfico son los del motor del export: la vista
  previa corre `reporte_ppt_plan` con un mini-plan de una lámina (mismo rebuild, mismos presets, misma plantilla). La caché
  no altera el render: lo servido desde caché es byte a byte lo recién renderizado con las mismas entradas.
- **Artefacto derivado de sesión**: vive en `tempdir()/prosecnur/<sid>/cache/miniaturas/<huella>/`. Nunca entra al
  `.pulso` ni a `state.rds` (es caché derivable), no se exporta al lado del proyecto. El índice llave → `file_id` reutiliza
  la clave de sesión `graficos_preview_cache` (ya declarada `cache_stripped` en `session_schema.R`: se descarta al guardar y
  no marca dirty).
- Se sirve con el mecanismo de siempre: el mini-PPTX se registra con `.register_output_file()` (kind `graficos_preview`,
  MIME por extensión) y la miniatura PNG con kind `graficos_miniatura` (`image/png`); ambos se descargan por
  `GET /api/files/<file_id>/download`. La vista previa sigue devolviendo además el raster inline (`png_base64`) como hoy.

## 2. Rutas

| Ruta | Qué hace | Bloquea plumber |
|---|---|---|
| `POST /api/graficos/preview-slide` | Igual que antes; ahora consulta la caché por huella antes de renderizar | Sólo en miss |
| `POST /api/graficos/preview-slide-job` | Misma entrada que `/preview-slide`; lanza job `graficos.preview_slide` | No |
| `POST /api/graficos/miniaturas` | Lanza job `graficos.miniaturas` con N láminas | No |
| `GET /api/graficos/miniaturas/<lote_id>` | Estado del lote lámina por lámina (también a medias) | No |
| `GET /api/jobs/<job_id>` · `POST /api/jobs/<job_id>/cancel` | Progreso, resultado y cancelación (endpoints existentes) | No |

### 2.1 `POST /api/graficos/preview-slide` (síncrono, compatibilidad)

Entrada sin cambios: `{slide, scope?, config?|graficos_config?, profile_id?, template_id?, folio?, preview_quality?,
include_images?, render_slide_preview?, preview_partes?, preview_formas?}`. Mismos errores y en el mismo orden:
`E_EMPTY_BODY`, `E_BAD_JSON`, `E_NO_VALID_RP_DATA` (409), `E_NO_SLIDE`, `E_BAD_PREVIEW_QUALITY`, `E_BAD_INCLUDE_IMAGES`,
`E_BAD_RENDER_SLIDE_PREVIEW`, `E_BAD_PREVIEW_PARTES`, `E_BAD_PREVIEW_FORMAS`, `E_BAD_SLIDE`, `E_PREVIEW_FAILED` (400).

Respuesta: la misma forma de siempre — `ok, file_id, size, type="pptx", images, slide_preview, partes{n, partes[], truncado},
slide_previews[], avisos[], folio` (+ `formas`/`ranuras_estandar` con `preview_formas`) — **más tres campos aditivos**:
`hash` (huella sha256 de la lámina), `cache = {pptx: "hit"|"miss", raster: "hit"|"miss"|"no_pedido"|"sin_renderer"}` y
`graficos = {pedidos, vacios, motivo[]}` (ver §2.4).
Pedir dos veces la misma lámina devuelve el mismo `file_id` (como hoy). Cambio de conducta deliberado: la caché ya no
expira a los 300 s ni ignora los datos; una entrada vale mientras su huella no cambie.

### 2.2 `POST /api/graficos/preview-slide-job`

Misma entrada y mismas validaciones síncronas que `/preview-slide` (un `E_BAD_*` o `E_NO_SLIDE` sale 400 en el POST, no
dentro del job). Respuesta inmediata:

```json
{"ok": true, "job_id": "…", "lote_id": "…", "kind": "graficos.preview_slide", "total": 1,
 "en_cache": 0, "pendientes": 1, "hash": "<sha256>", "slide_id": "s-…"}
```

Con la lámina entera en caché el job nace `done` (`job_submit_completed`): el primer poll ya trae el resultado.
`result_data` del job = **exactamente la respuesta de `/preview-slide`** (con `hash` y `cache`). Error de dominio
estructurado (lo lee `jobResultDomainError()`): `{"ok": false, "error": {"code": "E_PREVIEW_FAILED", "status": 400,
"message": "No se pudo generar el preview: …"}}`. Un pedido nuevo de la **misma lámina** en la misma sesión cancela el
job anterior que siga vivo (render sólo de la lámina activa).

### 2.3 `POST /api/graficos/miniaturas`

Entrada (JSON, sin simplificar):

```json
{"slides": [{"id": "s-…", "tipo": "p_slide_1_grafico", "payload": {…}, "folio": 12}],
 "slide_ids": ["s-…"], "scope": "consolidated", "config": {…}, "profile_id": "…", "template_id": "…",
 "preview_quality": "quick", "reemplazar": true}
```

- Láminas: `slides` explícitas (el editor manda su estado vivo) **o** `slide_ids` (subconjunto del plan guardado) **o**
  nada (todo el plan guardado). Tope 200.
- Fijo para miniaturas: `render_slide_preview = true`, `preview_partes = false` (parte 1), `include_images = false`.
- `reemplazar` (default `true`): cancela el lote de miniaturas anterior de la sesión que siga corriendo (cola cancelable).
- Errores: `E_BAD_MINIATURAS_SLIDES` (400, `slides` no es arreglo), `E_MINIATURAS_SIN_LAMINAS` (400),
  `E_MINIATURAS_DEMASIADAS` (400), `E_BAD_MINIATURAS_QUALITY` (400), `E_BAD_MINIATURAS_REEMPLAZAR` (400),
  `E_NO_VALID_RP_DATA` (409).

Respuesta inmediata: `{"ok": true, "job_id", "lote_id", "kind": "graficos.miniaturas", "total", "en_cache", "pendientes"}`.
Las láminas ya cacheadas no viajan al worker; si todas lo están, el job nace `done`.

### 2.4 Estado del lote — `GET /api/graficos/miniaturas/<lote_id>` y `result_data` del job

Ambos devuelven la misma forma (el `result_data` es el estado final):

```json
{"ok": true, "lote_id": "…", "job_id": "…", "status": "running|done|error|cancelled", "total": 67,
 "conteo": {"ok": 60, "sin_datos": 2, "sin_imagen": 0, "error": 1, "pendiente": 4},
 "laminas": [
   {"slide_id": "s-…", "orden": 1, "hash": "<sha256>", "estado": "ok", "folio": 3,
    "cache": {"pptx": "hit", "raster": "miss"},
    "partes": {"n": 2, "partes": [{"indice": 1, "titulo": "…", "estado": "nativa", "continuacion": false}, …]},
    "avisos": ["…"],
    "graficos": {"pedidos": 4, "vacios": 1, "motivo": ["n0"]},
    "miniatura": {"file_id": "…", "url": "/api/files/<file_id>/download", "mime": "image/png",
                  "width": 480, "height": 270, "sha256": "…"},
    "error": null}
 ]}
```

`laminas` va en el orden del pedido. Estados por lámina:

| `estado` | Significa | `miniatura` |
|---|---|---|
| `pendiente` | El worker aún no la resuelve (o el lote se canceló antes) | `null` |
| `ok` | PPTX, partes y PNG de la parte 1 listos | objeto |
| `sin_imagen` | PPTX y partes listos, pero no hay renderer o el raster falló (el front cae a `ComposicionLamina` SVG) | `null` |
| `sin_datos` | El motor armó la lámina pero **todos** sus gráficos pedidos quedaron vacíos (`graficos.vacios == graficos.pedidos > 0`) | objeto o `null` |
| `error` | El motor falló; `error = {code, message}` con `E_MINIATURA_FALLIDA` o `E_MINIATURA_TIPO_INVALIDO` | `null` |

Campo aditivo `graficos` (también en `/preview-slide` y en el `result_data` de `/preview-slide-job`; `null` si la
lámina está `pendiente` o en `error`): `pedidos` = gráficos con graficador en la lámina; `vacios` = cuántos no dibujan
datos; `motivo` = arreglo (siempre arreglo, vacío si todos dibujan) con:

| `motivo` | Cómo se detecta (estructurado, no por texto) |
|---|---|
| `borrador_incompleto` | Al reconstruir: falta una ref requerida o un argumento requerido (la lámina del editor está a medio armar) |
| `variable_fuera_de_base` | Al reconstruir: alguna ref del gráfico no está en los datos de su base (`.graficos_consolidado_ref_context`) |
| `variable_fuera_de_base` (filtro) | Al reconstruir: un `filtro` sobre una columna que no está en la base (`pulso_filter_missing_column` de `.apply_named_filters`; el motor la vuelve 0 filas con un warning) |
| `n0` | Al reconstruir: los `filtros` del gráfico dejan 0 filas, filtrando con `.apply_named_filters` (el mismo filtro del motor) |
| `sin_respuestas_validas` | El motor dibujó «Sin datos para mostrar» por el embudo `.blank_canvas` (reporte_plan_ppt.R), que señala `pulso_grafico_sin_datos`: variable toda NA, filtro con casos pero NA en la variable, `excluir_opciones` que cubre todo, pesos en 0, o filtros que dejan 0 filas (`.tab_freq` devuelve NULL sólo en ese caso; los errores de `freq_table_spss` se propagan y degradan por `pulso_slide_render_error` → `degradado`). Se cuenta **una vez por gráfico**: las señales de los bloques de una multilista se silencian y sólo cuenta si TODOS sus bloques quedaron vacíos (`.plan_con_sin_datos_por_grafico`, reporte_plan_condiciones.R) |
| `degradado` | El motor señaló `pulso_lamina_degradada` (reporte_plan_condiciones.R) sin diagnóstico previo |

Las degradaciones se cuentan por la condición `pulso_lamina_degradada` (`motivo`: `error_render`, `render_nulo`,
`elemento_invalido`) que señalan `.plan_render_element_degradable`, `.plan_canvas_render_nulo` y
`.plan_elemento_degradado`; el texto del aviso es para personas y puede cambiar. Una ref fuera de la base ya produce su
propia señal: no se cuenta dos veces. `pulso_grafico_sin_datos` hereda de `pulso_lamina_degradada` con `motivo = "sin_respuestas_validas"`; un `n0` o una
variable fuera de la base diagnosticados no se cuentan otra vez cuando el canvas vacío también señala. Supuestos: refs
sin base en un estudio multibase no se diagnostican en el rebuild (cuentan si el motor degrada o dibuja el canvas
vacío); los graficadores de dimensiones (`.dim_blank_canvas` directo, graficador_dimensiones.R congelado) no pasan por
`.blank_canvas` y su «Sin datos» no se detecta. Una lámina con 2 gráficos y 1 vacío es `ok` con `graficos.vacios = 1`.

El 404 del lote es `E_MINIATURAS_LOTE_NO_EXISTE` (también si el lote es de otra sesión). Progreso del job:
`{phase: "running", current: k-1, total: N, message: "Lámina <id> (k de N)"}` y `{phase: "done", percent: 100}`.

## 3. Huella por lámina (llave de la caché)

**Regla de cierre (decidida por el lead): la caché no es transparente por suposición. La llave es la huella de TODO lo
que el render lee**, que son exactamente los argumentos de `reporte_ppt_plan` más lo que el rebuild y el motor leen de
afuera. sha256 sobre la forma canónica (textos en UTF-8, tablas y listas tal cual) de seis grupos.

**Las claves NO se ordenan** (corrección B1 del revisor metodológico, 2026-10-11): el orden de una lista con nombres sí
cambia el render — `vars` con nombres son los bloques de las multiapiladas `var_cruce` y del radar, en el orden de temas
que arma el editor; los ejes del radar de equivalencias van en orden de filas. Una colisión sirve una lámina equivocada;
un falso miss sólo cuesta un render. Único reordenamiento, por lista blanca de niveles probadamente conmutativos y nunca
en la lámina: el primer nivel de `presets` (familias, consumidas por nombre en `.build_presets`) y del registro de íconos
(buscado por id). Las paletas no se reordenan (`.graficos_palette_vector` conserva el orden de categorías).
`.MINIATURAS_VERSION_CACHE` subió a «2» por este cambio.

| Grupo | Qué entra | Test |
|---|---|---|
| (a) lámina | La lámina tal como entra al motor: `payload`, `args` de cada gráfico, `orden_categorias`, `filtros`, textos, antetítulo heredado del separador vigente, refs calificadas con la base activa, y el folio | texto, orden, filtro, folio |
| (b) scope/base | `scope` (`active_base`/`consolidated`), base activa, conjunto **ordenado** de bases que recibe el motor | scope, base, orden de bases |
| (a′) consolidado | En `scope = consolidated` la lámina entra a la huella ya pasada por la metodología del catálogo (`excluir_opciones`, `eligible_if` → `filtros`) y `.normalize_plan`, y las fuentes en el orden de las releases: lo mismo que dibuja el export (`.graficos_consolidado_marco` + `.graficos_consolidado_plan_entregable`, compartidos con `graficos_consolidado_preflight`). La config es la del export: la que manda el cliente o el borrador consolidado (`graficos_consolidado_draft_get`), en forma portable, **nunca** mezclada con la de la base activa (`.graficos_preview_config_consolidada`). Los avisos metodológicos y los de denominador cero (`methodology_zero_denominator`, sólo de las reglas cuyas refs toca la lámina) van a `avisos` | paridad de presets y «Base: N» vista previa = export |
| (c) datos | Digest (xxhash64) de cada `data_sources[[base]]` y de cada `inst_sources[[base]]` **tal como los recibe el motor** (después de recodificación, etiquetas curadas ADR 0061, orden de categorías, dummies, pesos y atributos como `instrumento_reporte`) | ponderación, etiqueta, atributo; HTTP: `label-overrides`, ponderación y `orden_categorias` de `/api/analitica/config` invalidan |
| (d) estilo | Presets ya enriquecidos (formato, sufijo_auto, nota_redondeo, cálculos por familia, `debug_ph`…), paletas, íconos (ruta + sha256 del archivo), `profile_id`, `template_id`, `auto_otros_slides`, opciones `prosecnur.*` vigentes (menos el desplazo de folio que fija la propia vista previa) | presets, paletas, ícono, plantilla, perfil, opción |
| (e) archivos | sha256 del `.pptx` de plantilla resuelto, de `inst/estandar/estandar_pulso.json` y de cada logo de `inst/estandar/logos/` (por contenido: la ruta no entra) | contenido de plantilla y estándar |
| (f) versión | Versión del paquete (DESCRIPTION) y `.MINIATURAS_VERSION_CACHE` (constante para invalidar a mano) | ambas |

No entran en la llave del PPTX (renderer, calidad, partes): son la llave de sus **productos derivados** (§4). UI-only de la
config (`selected_slide_id`, `view_mode`, `density`, `canvas_viewport`, `inspector_tab`, `w_presets`) no la lee el render y
no invalida.

Sobre la memoización del digest de datos: la sesión no lleva un contador de mutaciones por base (`project_dirty` es un
booleano global), así que el digest se calcula sobre los objetos en cada pedido y se comparte entre las N láminas del
mismo pedido. Costo medido en §7. Cambio de código del motor sin cambio de versión: la caché vive en el `tempdir()` del
proceso, así que reiniciar el backend la vacía; para invalidar en caliente se sube `.MINIATURAS_VERSION_CACHE`.

## 4. Caché en disco

```
<tempdir>/prosecnur/<sid>/cache/miniaturas/<huella>/
  preview_<huella>.pptx                              mini-PPTX (entrada)
  meta.rds                                           hash, slide_id, tipo, folio, partes, avisos, gráficos pedidos/vacíos, sha256 del PPTX
  raster_<calidad>_<max_partes>_<renderer>.rds       slide_previews (png_base64 por parte, atributo truncado)
  miniatura_<calidad>_<renderer>_w480.png            parte 1 del raster reducida a 480 px de ancho (promedio por bloques, determinista)
```

- **Hit** = existen PPTX y `meta.rds` con la misma huella. Escritura atómica (tmp + rename): un job cancelado o un lector
  concurrente nunca ven una entrada a medias; un PPTX sin meta no es hit.
- **Compartida**: `/preview-slide`, `/preview-slide-job` y `/miniaturas` usan la misma huella y el mismo directorio. Una
  miniatura (1 parte) reutiliza el raster de 6 partes que dejó la vista previa de la lámina activa; la vista previa de una
  lámina ya miniaturizada no re-renderiza el PPTX.
- Un raster incompleto (renderer ausente, timeout, una parte nula) **no se guarda**: se reintenta en el pedido siguiente.
- Errores no se cachean.
- **Invalidación**: por construcción (otra huella = otra entrada). Poda LRU a 400 entradas por sesión (mtime del directorio,
  tocado en cada uso; opción `pulso.miniaturas_cache_max`), al final de cada vista previa síncrona, de cada job y del lote
  servido entero desde caché. El índice `graficos_preview_cache` (llave → `file_id`) se acota a 512 entradas y se descarta al
  guardar el `.pulso`; al cerrar la sesión se va con su directorio.

## 5. Jobs (`jobs-asincronos`)

- Kinds `graficos.miniaturas` y `graficos.preview_slide`.
- **Trampa 1 (namespace)**: el worker recibe un thunk con environment global que, después del bootstrap de `job_submit()`
  (load_all en dev, `library` en prod), obtiene `.graficos_miniaturas_worker` del namespace recién cargado. No viaja ningún
  closure del paquete: el job funciona sin el paquete instalado (los tests HTTP lo ejercitan sin `R CMD INSTALL`).
- **Trampa 2 (locale)**: intacta; la fija `job_submit()`.
- Payload: las fuentes van por RDS una vez por huella de fuentes (`jobs/inputs/miniaturas_fuentes_<digest>.rds`); la
  entrada del job lleva los contextos sin fuentes. Las opciones `prosecnur.*` del padre se fijan en el worker (son parte de
  la huella).
- El worker escribe el resultado de cada lámina apenas la termina (`jobs/miniaturas_<lote_id>/item_NNNN.rds`): el GET del
  lote muestra el avance real. `on_complete` (proceso principal) registra los PNG/PPTX y arma `result_data`.
- **Cancelación**: `POST /api/jobs/<id>/cancel` mata el worker; el lote queda `cancelled`, con las láminas ya terminadas
  en caché (reutilizables) y las demás `pendiente`. `reemplazar` hace lo mismo con el lote anterior al pedir uno nuevo.

## 6. Qué tiene que hacer el frontend (para el encargo)

1. Vista previa de la lámina activa: cambiar `apiGraficosPreviewSlide` por `POST /preview-slide-job` + `useJob` (polling
   de `/api/jobs/<id>`); al `done`, `result_data` es la respuesta que ya consume `usePreviewLamina.ts`. El síncrono sigue
   disponible y sin cambios para quien no migre.
2. Miniaturas del navegador de láminas: `POST /miniaturas` con las láminas visibles (o `slide_ids`), luego poll de
   `GET /miniaturas/<lote_id>` (no hace falta esperar al `done`): pintar cada `laminas[k]` por `slide_id` según `estado`;
   `miniatura.url` + `sid` (o header) para la imagen; `sha256`/`hash` sirven de llave de caché del navegador.
3. `sin_imagen` → `ComposicionLamina` SVG; `sin_datos` → miniatura con marca «sin datos»; `error` → `error.message`.
   `graficos.motivo` dice por qué (borrador a medio armar, variable fuera de la base, filtro sin casos); una lámina `ok`
   con `graficos.vacios > 0` puede marcar sólo el gráfico vacío.
4. Al editar una lámina, mandar el lote nuevo con `reemplazar = true` (cancela el anterior).

## 7. Mediciones (acrconta_mazo, 67 láminas, 4 bases)

Copia de `api/inst/reference_projects/acrconta_mazo/acrconta_mazo.pulso`, backend real (plumber + load_all en dev),
R 4.3.3, 4 núcleos, LibreOffice 24.2 + pdftools. Pedido igual al de `usePreviewLamina.ts` (`render_slide_preview`,
`preview_partes`, calidad quick). Lámina 6 (`p_slide_4_graficos`).

| Medición | HEAD (a34edd3) | A4 |
|---|---|---|
| `/preview-slide` fría (miss), lámina de 4 gráficos | 17,90 s | 15,96 s |
| `/preview-slide` caliente (hit), misma lámina | 2,43 s | 2,60 s |
| `/preview-slide` otra lámina de 4 gráficos, fría | 10,09 s | 10,47 s |
| `/preview-slide` de una lámina ya miniaturizada (hit PPTX + raster) | — | 1,05 s |
| `/preview-slide-job`: POST (respuesta) | — | 1,28 s |
| `/preview-slide-job`: hasta `done` (incluye arranque del worker con load_all) | — | 26,0 s |
| `GET /api/system/health` mientras corre el job | (bloqueado durante el render síncrono) | mediana 0,006 s; picos de 0,92–0,97 s (verificación independiente de 8804e22) |
| `/miniaturas` POST, 67 láminas (3 ya en caché por las vistas previas) | — | 1,78 s |
| Lote de 64 láminas frías hasta `done` | — | 444,9 s (6,64 s/lámina) |
| `GET /api/system/health` durante el lote | — | mediana 0,006 s; picos de 0,92–0,97 s (verificación independiente); plumber responde, no queda bloqueado minutos |
| `GET /miniaturas/<lote>` a medias (a los 20 s: 4 ok, 63 pendientes) | — | 0,16 s |
| Segundo lote idéntico (67 en caché, job nace `done`) | — | 2,43 s |

Desglose en proceso (misma copia): fuentes de Gráficos (`.graficos_processing_sources`) 1,15–1,36 s por pedido; huella de
las fuentes (digest de 4 bases + instrumentos, 1,9 MB) **0,007 s**; contexto común 0,36 s; contexto + huella de 67 láminas
0,46 s; lote en proceso de 67 láminas frías 453,5 s (6,77 s/lámina, dominado por la conversión de LibreOffice de cada
lámina); 67 hits en proceso 0,78 s. Caché en disco tras el mazo completo: 44 MB.

Lectura: el hit sigue costando ~2,5 s porque cada pedido recalcula las fuentes de Gráficos (ya pasaba en HEAD); la huella
en sí es despreciable. Memoizar las fuentes exige un contador de mutaciones por base que la sesión no tiene (pendiente
fuera de esta unidad).

## 8. Notas de entorno y arreglos colaterales

- `.pptx_leer_parte` (graficos_preview_lamina.R) ahora lee la parte en binario: con R 4.3.3, `readLines()` sobre `unz()`
  devolvía 0 líneas para una parte de una sola línea sin salto final (el XML que escribe officer por la ruta anterior), y
  `partes[].estado` salía `sin_grafico` en vez de `ruta_anterior`. Era el rojo ambiental de
  `test-graficos-preview-lamina.R:236` y `test-graficos-preview-formas.R:91–95`; test nuevo en
  `test-graficos-miniaturas.R`.
- En este contenedor LibreOffice no arranca desde R: R exporta un `LD_LIBRARY_PATH` (`/usr/lib/R/lib:/usr/lib/x86_64-linux-gnu:
  …/jvm/…/server`) con el que `soffice.bin` no carga `libreglo.so`. Sin raster las láminas salen `sin_imagen` y los tests de
  PNG se saltan o toman la rama `sin_imagen`; con `R_LD_LIBRARY_PATH=/usr/lib/R/lib` todo rasteriza. Es del entorno, pero
  la misma combinación podría darse en un Linux de usuario: `.pptx_to_pdf_soffice` (router_graficos.R, fuera de esta
  unidad) podría limpiar `LD_LIBRARY_PATH` al lanzar soffice.

## 9. Tamaño de la miniatura (pedido del frontend, 2026-10-11)

La miniatura del lote ya no es el raster completo de la vista previa (2133×1200, ~128–257 KB) sino ese raster reducido a
`.MINIATURA_ANCHO = 480` px (alto proporcional: 480×270), promediando bloques con `png` (sin dependencias nuevas). Se deriva
una vez por huella y se sirve desde caché byte a byte; `width`/`height` son los reales del archivo. La vista previa de la
lámina activa (`/preview-slide`, `slide_previews`) sigue con el raster completo. Medido en acrconta (6 láminas):
20,4–40,3 KB por miniatura (6,1–6,4× menos), ~2,2 MB estimados para las 67 láminas contra ~17 MB; reducir cuesta
0,38–0,49 s por lámina (1,36 s la primera, con carga en frío), una vez por huella y dentro del worker.
