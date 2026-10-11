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
| 3 | Gate de Carga sobre `main` | `make gate-area AREA=carga …` | Verde: 1491 pass, 0 fallos (janitor instalado) |
| 4 | **H2**: los mapas del editor se aplican contra el instrumento generado y no contra el del editor; una pregunta reordenada queda con la etiqueta equivocada | `carga_sm_orden_editor.R`, `.carga_sm_prepare_import` | Hecho (`198d429`): el instrumento adopta códigos y orden del editor por etiqueta antes de codificar; re-revisión metodológica aprobada con supuestos |
| 5 | **H3**: `select_multiple` no recibe el reordenamiento | ídem | Hecho (`198d429`), test `"1 2","3","2"` |
| 6 | **H1**: la confirmación de Carga › Revisión quedó sin efecto tras PR #10 | `carga_review.R`, `CargaReviewSummary.tsx` | Hecho: no hay recode que confirmar (`not_required` es correcto); Revisión declara adoptadas y omitidas con su motivo, sin bloquear |
| 7 | **H4**: la base no registra qué se adoptó; los códigos pueden cambiar entre imports si se edita el orden | metadata de la base | Parcial: `choice_order_editor` en la base y en Revisión; el refresh conserva el orden. Falta la firma del orden y el aviso fuerte si cambia (ADR 0077) |
| 8 | **H5**: handoff de Monitoreo hereda mapas sin procedencia | `carga_monitoreo_handoff_general.R:378/452` | Pendiente (baja, no toca SM) |
| 9 | Prueba de punta a punta con las encuestas reales | script local, fuera del repo | Hecho: Arte y Diseño (3 encuestas) e Ing. (9 encuestas) |
| 10 | Usar el formulario del editor (con su lógica) como instrumento de la base | contrato de instrumento | Bloqueado: requiere decisión/ADR |
| 11 | El refresh de SM («Traer respuestas») reconstruía el instrumento sin el orden del editor | `.sm_mb_prepare_refresh_snapshot` | Hecho: adopta el orden antes de la lógica compartida y renueva la marca |
| 12 | Reescritura de lógica: formas no reconocidas (`'x' = ${v}`, comillas dobles, `count-selected`) omiten la lista; `selected(., 'x')` en constraints no se detecta | `carga_sm_orden_editor.R` | Pendiente (sin efecto hoy: el generador solo emite `${v} = 'x'`/`selected`) |
| 13 | **Base multi-fuente por API con encuestas hermanas de numeración distinta**: las respuestas se emparejan por nombre de posición (`pN`) y no por pregunta; las columnas se corren sin aviso | `sm_multibase_api_responses_to_canonical_data`, fuentes del refresh multi-fuente | Bloqueado: decisión de Gonzalo (guard que bloquee vs. emparejar por texto de pregunta). Reproducido con Contabilidad Egresados Personalizado + Telefónico: «género» recibe años de egreso |

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

## Contrato congelado del ítem 13 (ADR 0094)

**Motor** — archivo nuevo `api/R/surveymonkey_multibase_alineacion.R`:

- `.sm_mb_alinear_fuente(inst_base, inst_fuente)` → `list(mapa = c(<var_fuente> = <var_base>, …),
  sin_par_fuente = data.frame(variable, etiqueta), sin_par_base = data.frame(variable, etiqueta),
  reordenada = lgl, cobertura = n_emparejadas / n_preguntas_base, instrumento_distinto = cobertura < 0.8)`.
  Clave: `.equiv_claves_de_base` sobre los XLSForm GENERADOS por la plataforma (antes de adoptar el orden
  del editor), así la firma de escala compara las listas tal como SM las publica.
- `.sm_mb_codificar_fuente(details_fuente, responses, inst_base, …)` — único punto por el que pasa una
  encuesta distinta de la principal: codifica contra su propio instrumento, renombra con `mapa` (padre,
  `_other`, dummies), descarta `sin_par_fuente`, recodifica por etiqueta a los códigos de `inst_base`
  (select_one y tokens de select_multiple). Devuelve el data.frame con `attr(, "sm_alineacion")`.
- Llamadores que deben usarlo cuando `survey_id` de la fuente ≠ el de la base: el bucle de fuentes de
  `.sm_mb_prepare_refresh_snapshot`, `.sm_mb_build_effective_from_snapshot`, y las fuentes de
  `sm_multibase_import_independent`.
- `.sm_mb_compare_to_ref` compara pares ALINEADOS. Kinds nuevos: `question_order` (info: emparejada en
  otro orden), `unpaired_source` y `unpaired_base` (review), `different_instrument` (blocking).
- `.sm_mb_code_for_label`: etiqueta sin par y código de respaldo fuera de la lista → `NA` y conteo en
  `attr(, "sm_opciones_sin_par")` (variable → n).

**Persistencia** — `s$estudio$bases[[b]]$sm_alineacion_fuentes`: lista por fuente
`{survey_id, titulo, n_emparejadas, n_preguntas_base, cobertura, reordenada, instrumento_distinto,
excluida, n_filas_excluidas, sin_par_fuente: [{variable, etiqueta}], sin_par_base: [{variable, etiqueta}], opciones_sin_par:
[{variable, n}]}`. Solo fuentes distintas de la principal.

**Revisión** — `.carga_review_payload()$fuentes` (NULL si la base no junta encuestas):
`{fuentes: [{survey_id, titulo, n_emparejadas, n_preguntas_base, reordenada, instrumento_distinto,
excluida, n_filas_excluidas, sin_par_fuente: [{variable, etiqueta}], sin_par_base: [{variable, etiqueta}], n_opciones_sin_par}]}`.
No entra en `ready`.

**UI**:

- Carga › Revisión: un aviso por fuente con preguntas sin par u opciones sin par («Telefónico: 3
  preguntas no existen en la base y no entraron · Cod Pulso, Celular, Enumerador»), y un dato neutro cuando
  solo se reordenó («Telefónico: 73 preguntas emparejadas por texto, en otro orden»). Los avisos
  informativos (orden del editor adoptado, fuentes emparejadas) dejan de pintarse como advertencia: clase
  `is-info` con tokens neutros.
- Diagnóstico del refresh (`BasesPanel`, wizard de fuentes independientes): etiquetas legibles para los
  kinds nuevos; `different_instrument` dice qué hacer («impórtala como base separada y relaciónala en
  Equivalencias») con enlace a `/carga?pestana=equivalencias` cuando esa pestaña existe. Componentes
  nuevos en archivo propio (BasesPanel supera 1000 líneas).
