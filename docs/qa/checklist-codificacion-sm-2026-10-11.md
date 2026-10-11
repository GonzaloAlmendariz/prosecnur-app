# Checklist — Códigos de respuesta en imports SurveyMonkey por API (2026-10-11)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-11
Autoridad: Registro de alcance del pedido; el comportamiento vigente lo fijan `carga_sm_orden_editor.R`, `carga_platform_separate.R` y `test-carga-sm-orden-editor.R`

Origen: traspaso `docs/qa/traspaso-codificacion-surveymonkey-2026-10-11.md` (rama `meta-b-revamp`)
y revisión metodológica sobre `main` (`88ea0a8c9`, PR #10). Estudio en campo:
Acreditación Arte y Diseño PUCP (Docentes, Administrativos, Estudiantes).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Llevar N4 (mapas solo de la misma encuesta) y «bases separadas» a `main` | `carga_platform_separate.R`, `router_carga.R` | Hecho antes de esta sesión: PR #10 (`88ea0a8c9`) ya los trae |
| 2 | Triple aplicación de mapas en base única (preview y `rp_data` invertidos) | `.carga_codigos_ya_aplicados` (`router_carga.R`), `project_pulso.R` | Hecho en PR #10; test l.906/l.923 de `test-carga-platform-jobs.R` |
| 3 | Gate de Carga | `make gate-area AREA=carga …` | Verde sobre `main`: 1491 pass. Verde en la rama al cierre (verificador 2026-10-11): 2562 pass R, 558 front, tsc, `--audit`, docs |
| 4 | **H2**: los mapas del editor se aplican contra el instrumento generado y no contra el del editor; una pregunta reordenada queda con la etiqueta equivocada | `carga_sm_orden_editor.R`, `.carga_sm_prepare_import` | Hecho (`198d429`): el instrumento adopta códigos y orden del editor por etiqueta antes de codificar; re-revisión metodológica aprobada con supuestos |
| 5 | **H3**: `select_multiple` no recibe el reordenamiento | ídem | Hecho (`198d429`), test `"1 2","3","2"` |
| 6 | **H1**: la confirmación de Carga › Revisión quedó sin efecto tras PR #10 | `carga_review.R`, `CargaReviewSummary.tsx` | Hecho: no hay recode que confirmar (`not_required` es correcto); Revisión declara adoptadas y omitidas con su motivo, sin bloquear |
| 7 | **H4**: la base no registra qué se adoptó; los códigos pueden cambiar entre imports si se edita el orden | `carga_sm_orden_editor.R` (receta), `carga_review.R` | Hecho (`d4f345d`): el orden se fija al importar (receta en `choice_order_editor`), cada refresh la reaplica y, si el editor tiene hoy otro orden, Revisión lo avisa sin recodificar (ADR 0099, decisión 7) |
| 8 | **H5**: handoff de Monitoreo hereda mapas sin procedencia | `carga_monitoreo_handoff_mapas.R`, `carga_monitoreo_handoff_general.R` | Hecho: misma regla de procedencia que N4 (`.carga_handoff_choice_maps`); Kobo nunca aplica mapas y, si no aplica, lo declara en el resultado (`mapas_omitidos`). Antes un formulario activo con 30↔40 recodificaba la madre en silencio; 4 tests H5 rojos contra HEAD y verdes con el arreglo |
| 9 | Prueba de punta a punta con las encuestas reales | script local, fuera del repo | Hecho: Arte y Diseño (4), Ing. (9) y Contabilidad (7); la corrida final con el código definitivo (19 encuestas) solo muestra diferencias explicadas (consentimiento, «Otro» con texto, rótulo de escala) |
| 10 | Usar el formulario del editor (con su lógica) como instrumento de la base | contrato de instrumento | Bloqueado: requiere decisión/ADR |
| 11 | El refresh de SM («Traer respuestas») reconstruía el instrumento sin el orden del editor | `.sm_mb_prepare_refresh_snapshot` | Hecho: adopta el orden antes de la lógica compartida y renueva la marca |
| 12 | Reescritura de lógica: formas no reconocidas (`'x' = ${v}`, comillas dobles, `count-selected`) omiten la lista; `selected(., 'x')` en constraints no se detecta | `carga_sm_orden_editor.R` (`.carga_sm_orden_reescribir_expr`) | Hecho (gate Carga 2314 pass · 0 fail): reescribe `${v} = 'x'`, `${v} != 'x'`, `'x' = ${v}`, `'x' != ${v}` y `selected(${v}, 'x')` con comillas simples o dobles (conserva la comilla); en el constraint o relevant de la fila de `v`, las mismas formas con `.`. `count-selected`, `string-length` y comparaciones con `''` se dejan tal cual sin omitir la lista. Cualquier otra forma (`${v} > 2`, `${v} = 1`, `cf = ${v}`, `. < '3'`) sigue omitiendo la lista con su motivo. Tests por forma en `test-carga-sm-orden-editor.R` |
| 13 | **Base multi-fuente por API con encuestas hermanas de numeración distinta**: las respuestas se emparejan por nombre de posición (`pN`) y no por pregunta; las columnas se corren sin aviso | `surveymonkey_multibase_alineacion.R`, ADR 0099 | Hecho — decisión de Gonzalo 2026-10-11: emparejar por pregunta con la clave de las equivalencias, a fondo. Contrato abajo |
| 14 | **Preexistente**: `.sm_mb_consent_yes` toma el código «1» como sí. Si el editor reordena la lista del consentimiento (No = 1), la fuente PRINCIPAL descarta a quien consintió | `surveymonkey_consentimiento.R` (nuevo), `.sm_mb_filter_effective_consent_df`, `.sm_mb_filter_raw_responses_by_consent`, `.sm_mb_decision_apply_df`, `.sm_mb_fetch_filtered_response_refs` | Hecho (gate Carga 2314 pass · 0 fail): el «sí» se decide por la etiqueta de la opción en el instrumento que codificó la respuesta («sí», «acepto», «de acuerdo», «sí, deseo continuar», «autorizo»…; nunca una que empiece por «no»). Sin etiquetas, o sin ninguna afirmativa, cae al «1» y lo declara (`consent_yes_criterio = "respaldo_codigo_1"`, `consent_yes_motivo`). Corrección del supuesto anterior: una fuente adicional SÍ lo sufría si su plataforma traía «No» primero. El conteo de filas nuevas del refresh evalúa cada fuente adicional en su propio instrumento (ya no por posición). El rechazo (`rejection_values`) no se tocó. El test que estaba con `skip` pasa a verde; nuevos: principal reordenada, «No» primero en la plataforma, fuente adicional invertida, fuente vacía/excluida, lista sin etiquetas, base sin consentimiento, política de decisiones y conteo del refresh (sin red) |
| 15 | Ver cómo se emparejó cada pregunta de una fuente, de forma didáctica, y encontrar la matriz de equivalencias | `carga_fuentes_emparejamiento.R`, `FuentesEmparejamiento*.tsx`, pestaña Equivalencias | Hecho: panel «Ver preguntas» (secciones con título real, matrices bajo su enunciado, variable en la base y en la fuente); Equivalencias como pestaña 6 de 6; QA visual independiente 19/21 y regresión del rail corregida (`fd5a428`) |

## Aprendido

- Los mapas de códigos nacieron para el import por `.sav` (SM exporta códigos por posición).
  En el import por API las respuestas se codifican por **etiqueta** contra el instrumento
  (`.sm_mb_code_for_label`), así que recodificar después con mapas solo puede desalinear.
- El reordenamiento manual del editor existe porque la API devolvía «Otro»/«Ninguna» en un
  orden distinto al del constructor y la lógica por posición fallaba (Gonzalo, 2026-10-11).
- Prueba real sin mapas: Docentes 91/91, Administrativos 30/30 y Estudiantes 72/72 variables
  coinciden con el conteo crudo de SM en archivo, preview, base `default`, Ver base, Analítica
  y reapertura. Las únicas diferencias de Estudiantes se explican: «Otro» con texto
  (7/19/15) y una respuesta sin consentimiento filtrada a propósito.
- Ing. (nueve carreras, bases SAV bundle): en las 9 encuestas cada etiqueta tiene el mismo código
  por API que en el instrumento ya trabajado de la base (0 diferencias). El import por API
  coincide con el conteo crudo de SM salvo «Otro» con texto, el filtro de consentimiento y el
  rótulo de escala («Totalmente de acuerdo<br>4» → «Totalmente de acuerdo»), sin cambiar conteos.
- La re-revisión deja supuestos: biyección exacta por etiqueta (una etiqueta editada omite la
  lista), matrices con el mapa en la variable madre no adoptan, y no cambiar el orden en el
  editor una vez que hay trabajo sobre la base.
- Contabilidad (v6, bases por SAV con equivalencias): las 7 encuestas 2026, una por una,
  coinciden con el conteo crudo de SM salvo consentimiento y «Otro» con texto. Las versiones
  «Personalizado» tienen una pregunta extra al inicio (código PUCP): toda la numeración `pN` se
  corre en uno respecto de Telefónico/Egresados/Docentes (34 de 42 y 32 de 40 nombres comunes
  son otra pregunta). Comparar códigos por nombre entre esas encuestas da verde por ausencia.

## Contrato congelado del ítem 13 (ADR 0099)

**Motor** — `api/R/surveymonkey_multibase_alineacion.R`:

- `.sm_mb_alinear_fuente(inst_base, inst_fuente)` → `list(mapa = c(<var_fuente> = <var_base>, …),
  sin_par_fuente, sin_par_base, ambiguas = data.frame(variable, etiqueta), reordenada, n_reordenadas,
  n_emparejadas, n_preguntas_base, cobertura = n_emparejadas / n_preguntas_base,
  instrumento_distinto = cobertura < .SM_MB_COBERTURA_MINIMA (0.8))`. La cobertura cuenta VARIABLES (una
  matriz de 11 filas pesa 11). Clave: `.equiv_claves_de_base` sobre los XLSForm GENERADOS por la plataforma
  (antes de adoptar el orden del editor), sin `_other` (sigue a su pregunta). Una clave sin `##n` que
  aparece un número distinto de veces en la base y en la fuente es **ambigua**: ninguno de sus miembros se
  empareja, la base los lista en `ambiguas` y no cuentan como emparejados.
- `.sm_mb_codificar_fuente(details_fuente, responses, inst_base, survey_id, inst_clave_base, consent_var,
  apply_consent_filter, consent_var_base, cache, …)` — único punto por el que pasa una encuesta distinta de
  la principal. El consentimiento se evalúa ANTES de alinear, en el espacio de la fuente (`consent_var` es
  de la fuente; si no existe ahí se traduce por el mapa; si no hay, se detecta). Luego codifica contra su
  propio instrumento, renombra con `mapa` (padre, `_other`, dummies), descarta lo que no tiene par y
  recodifica por etiqueta a los códigos de `inst_base`. Atributos: `sm_alineacion`, `sm_opciones_sin_par`,
  `sm_consentimiento`.
- Una fuente con `instrumento_distinto` no entra a la base en ninguno de los tres caminos (refresh,
  import independiente, base efectiva desde el snapshot): se declara `excluida`.
- `.sm_mb_compare_to_ref` compara pares ALINEADOS. Kinds: `question_order` (info), `unpaired_source`,
  `unpaired_base` y `ambiguous` (review), `different_instrument` y `legacy_positional` (blocking; bloquean el
  refresh haya o no filas nuevas). Los diffs de la fuente entera llevan `pos = 0` y el título como
  `variable`. El comparador posicional (`.sm_mb_compare_to_ref_posicional`) sobrevive solo en «Unificar».
- `.sm_mb_code_for_label`: etiqueta sin par y código de respaldo fuera de la lista → `NA`. El motor
  canónico lo cuenta en `attr(, "sm_opciones_sin_par")` (variable → n), también para la principal.
- Instrumentos generados: caché por `survey_id` en un entorno local de la operación
  (`.sm_mb_cache_operacion()`), nunca en la sesión.

**Persistencia** — solo cuando la data de la base cambia (`data_file_id` nuevo; con `keep_current` no se
toca), dentro del bloque con rollback:

- `s$estudio$bases[[b]]$sm_alineacion_fuentes`: lista por fuente distinta de la principal
  `{survey_id, titulo, n_emparejadas, n_preguntas_base, cobertura, reordenada, instrumento_distinto,
  excluida, n_filas_excluidas, n_filas_incorporadas, consentimiento_sin_par, n_excluidas_consentimiento,
  sin_par_fuente: [{variable, etiqueta}], sin_par_base: [{variable, etiqueta}], ambiguas: [{variable,
  etiqueta}], opciones_sin_par: [{variable, n}]}`.
- `s$estudio$bases[[b]]$sm_opciones_sin_par_principal`: `[{variable, n}]` de la encuesta principal (campo
  hermano, también en bases de una sola encuesta). NULL si no perdió ninguna opción.
- `s$estudio$bases[[b]]$choice_order_editor`: `{adoptadas, omitidas, receta: [{variable, list_name,
  opciones: [{etiqueta (normalizada), codigo}]}], editor_distinto?, editor_distinto_variables?}`. El orden
  se fija al importar (decisión 7); el refresh reaplica la receta y nunca el editor del momento.
- `decision_apply` que reemplaza `data_file_id` renueva `choice_codes_applied_data_file_id`.

**Revisión** — `.carga_review_payload()`:

- `$fuentes` (NULL si no hay fuentes alineadas ni opciones perdidas en la principal):
  `{fuentes: [{survey_id, titulo, n_emparejadas, n_preguntas_base, reordenada, instrumento_distinto,
  excluida, n_filas_excluidas, n_filas_incorporadas, consentimiento_sin_par, n_excluidas_consentimiento,
  sin_par_fuente, sin_par_base, ambiguas: [{variable, etiqueta}], n_opciones_sin_par}],
  principal: {opciones_sin_par: [{variable, n}], n_opciones_sin_par} | null}`.
- `$orden_editor` suma `editor_distinto: [variables]`.
- Ninguno entra en `ready`.

**UI**:

- Carga › Revisión: un aviso por fuente con preguntas sin par u opciones sin par («Telefónico: 3
  preguntas no existen en la base y no entraron · Cod Pulso, Celular, Enumerador»), y un dato neutro cuando
  solo se reordenó («Telefónico: 73 preguntas emparejadas por texto, en otro orden»). Los avisos
  informativos (orden del editor adoptado, fuentes emparejadas) dejan de pintarse como advertencia: clase
  `is-info` con tokens neutros.
- Diagnóstico del refresh (`BasesPanel`, wizard de fuentes independientes): etiquetas legibles para los
  kinds nuevos; `different_instrument` dice qué hacer («impórtala como base separada y relaciónala en
  Equivalencias») con enlace a `/procesamiento?seccion=carga&pestana=equivalencias`; `legacy_positional`
  pide regenerar la base desde SurveyMonkey. Componentes nuevos en archivo propio (BasesPanel supera 1000
  líneas).

## Contrato congelado del ítem 15 — ver cómo se emparejó cada pregunta (2026-10-11)

Pedido de Gonzalo: «las variables y sus etiquetas tienen que estar clarísimas, mostradas de forma
didáctica», y no encontraba la matriz de equivalencias (la pestaña solo existe con dos o más bases
separadas, ADR 0062).

**Persistencia** — cada fuente de `sm_alineacion_fuentes` guarda además `pares: [{base, fuente,
etiqueta, seccion}]` (pregunta emparejada; sin `_other`). Bases anteriores sin `pares` no se
reconstruyen: el detalle dice que hay que volver a traer respuestas.

**Endpoint** — `GET /api/carga/fuentes/emparejamiento?base_nombre=` (router nuevo, montado en
`plumber_app.R`):

```
{ base_nombre, equivalencias: { disponible, motivo },
  fuentes: [{ survey_id, titulo, estado: "incorporada" | "excluida",
              n_emparejadas, n_preguntas_base, n_filas_incorporadas, n_filas_excluidas,
              detalle_disponible,
              filas: [{ seccion, etiqueta, variable_base, variable_fuente,
                        estado: "emparejada" | "otro_nombre" | "no_entro" | "sin_respuesta" | "ambigua" }] }] }
```

Filas en el orden del instrumento de la base; las preguntas que solo existen en la fuente
(`no_entro`) al final, con `seccion = "Solo en la fuente"`. `equivalencias.disponible` sale del
mismo predicado de ADR 0061 que usa la pestaña (fuente única; el front deja de duplicarlo).

**UI** — Carga › Revisión: cada tarjeta de fuente ofrece «Ver preguntas», que abre un panel lateral
direccionable (`panel=emparejamiento`, `foco=<survey_id>`, `usePanelDireccionable`):

- encabezado «Cómo se emparejaron las preguntas de <fuente>» y una línea que explica la regla en
  llano (por su texto y su escala, la misma regla que Equivalencias);
- cifras: emparejadas, en otro nombre, no entraron, sin respuesta, ambiguas;
- filtro «Solo diferencias / Todas» (por defecto diferencias si las hay);
- tabla agrupada por sección: Pregunta (texto completo) · En la base · En <fuente> · Estado
  (insignia con ícono y texto, nunca solo color);
- pie: qué es Equivalencias y enlace cuando está disponible; si no, por qué no aparece.

## Invariantes de los ítems 13 y 15 (contrato del lead)

**dominio-prosecnur**

- D1. «La misma pregunta» entre fuentes de UNA base se define solo con la clave exacta de ADR 0062
  (`.equiv_claves_de_base`: etiqueta normalizada @@ firma de escala ## ordinal) sobre los XLSForm
  generados por la plataforma; nunca por posición ni por similitud. Claves con conteo distinto entre
  base y fuente son ambiguas y no se emparejan.
- D2. El grano es la respuesta SurveyMonkey (`response_id`/`case_uid`). Alinear no crea, une ni elimina
  filas: decide en qué columna cae cada respuesta. Única excepción: una fuente de otro instrumento no
  entra entera, y se declara.
- D3. Nada se recodifica ni se descarta en silencio: preguntas y opciones sin par, ambiguas,
  consentimiento sin par y fuentes excluidas quedan contadas en la base y llegan a Revisión; una
  opción sin par queda NA, nunca con el código de otra lista.
- D4. El estado vive en `s$estudio$bases[[b]]`. La fuente principal (mismo `survey_id` que la base)
  sigue el camino canónico sin cambios.
- D5. Los códigos finales son los del instrumento de la base; su orden de opciones se fija al importar
  (receta en `choice_order_editor`) y cada refresh lo reaplica.

**integraciones-datos**

- I1. Capas separadas: transporte (fetch SM) y traducción del proveedor (`sm_api_xlsform`,
  `.sm_mb_question_specs`) no cambian; la alineación es una capa entre traducción y normalización;
  `normalize_data_for_xlsform` corre después y conserva su metadata de auditoría.
- I2. Tokens nunca en logs, fixtures, `.pulso` ni en lo que se persiste o expone. Tests sin red, con
  mocks por binding.
- I3. Fixtures sintéticos; ningún dato de cliente en el repo.
- I4. Cada transformación nueva con test del caso feliz, de la fuente vacía y de la fuente excluida.

**jobs-asincronos**

- J1. El worker `callr` resuelve contra el paquete instalado: el código nuevo llega al worker al
  instalar o publicar la versión (`/preparar-release`). Los agentes no instalan; los tests corren en
  proceso con `load_all`.
- J2. El resultado del worker llega a la sesión por el diff de claves de `carga_platform_jobs.R`;
  lo que vive en `s$estudio` viaja entero.
- J3. Un bloqueo de estructura es un resultado, no un error: nada de `stop` en el worker. Los secretos
  efímeros siguen el flujo actual (`job_save_rds` y borrado al leerlos).
