# Fuentes de una base SurveyMonkey emparejadas por pregunta (ADR 0094, ítem 13
# del checklist de codificación SM 2026-10-11).
#
# Una base que junta varias encuestas asignaba cada pregunta de la fuente a la
# variable `p<posición>` de la base. Una encuesta hermana con «Indique su código
# PUCP» insertado corre toda la numeración: la edad recibía el código PUCP, el
# género la edad, y nadie avisaba. Aquí corre la codificación real
# (`sm_api_xlsform` + motor canónico + alineación); solo se simula la red.

.sma_mock <- function(name, value) {
  env <- asNamespace("prosecnurapp")
  previous <- get(name, envir = env)
  locked <- bindingIsLocked(name, env)
  if (locked) unlockBinding(name, env)
  assign(name, value, envir = env)
  if (locked) lockBinding(name, env)
  function() {
    if (bindingIsLocked(name, env)) unlockBinding(name, env)
    assign(name, previous, envir = env)
    if (locked) lockBinding(name, env)
  }
}

# --- Constructores de details SurveyMonkey sintéticos -------------------------

.sma_op <- function(id, text, pos) list(id = id, text = text, position = pos)

.sma_single <- function(id, heading, labels) {
  list(id = id, family = "single_choice", subtype = "vertical",
       headings = list(list(heading = heading)),
       answers = list(choices = lapply(seq_along(labels), function(i) {
         .sma_op(paste0(id, "c", i), labels[[i]], i)
       })))
}

.sma_multiple <- function(id, heading, labels) {
  q <- .sma_single(id, heading, labels)
  q$family <- "multiple_choice"
  q
}

.sma_open <- function(id, heading) {
  list(id = id, family = "open_ended", subtype = "single",
       headings = list(list(heading = heading)))
}

.sma_details <- function(survey_id, title, questions) {
  list(id = survey_id, title = title,
       pages = list(list(id = "pg1", questions = questions)))
}

.sma_q_consent <- function(id) .sma_single(id, "¿Desea continuar?", c("Sí", "No"))
.sma_q_edad <- function(id) .sma_open(id, "¿Cuántos años tiene?")
.sma_q_genero <- function(id) .sma_single(id, "¿Cuál es su género?", c("Masculino", "Femenino"))
.sma_q_egreso <- function(id) .sma_single(id, "¿Cuál es su año de egreso?", c("2021", "2022"))

# REF: la encuesta principal de la base.
.sma_ref <- function(survey_id = "REF") {
  .sma_details(survey_id, "Egresados Personalizado", list(
    .sma_q_consent("a1"), .sma_q_edad("a2"), .sma_q_genero("a3"), .sma_q_egreso("a4")
  ))
}

# FUENTE: la misma secuencia con «Indique su código PUCP» tras Q1 y un
# «Enumerador» final que REF no tiene.
.sma_fuente <- function(survey_id = "FUE") {
  .sma_details(survey_id, "Egresados Telefónico", list(
    .sma_q_consent("f1"), .sma_open("f2", "Indique su código PUCP"),
    .sma_q_edad("f3"), .sma_q_genero("f4"), .sma_q_egreso("f5"),
    .sma_open("f6", "Enumerador")
  ))
}

# --- Respuestas ---------------------------------------------------------------

# Una respuesta: `answers` es una lista nombrada qid -> elección. Un valor
# `list(text=)` es abierta; un vector de etiquetas es elección (choice_id por
# etiqueta dentro de la pregunta).
.sma_response <- function(details, id, answers) {
  qs <- details$pages[[1]]$questions
  by_id <- setNames(qs, vapply(qs, `[[`, "", "id"))
  questions <- lapply(names(answers), function(qid) {
    q <- by_id[[qid]]
    val <- answers[[qid]]
    if (is.list(val)) {
      return(list(id = qid, answers = list(list(text = val$text))))
    }
    ch <- q$answers$choices
    labs <- vapply(ch, `[[`, "", "text")
    list(id = qid, answers = lapply(val, function(v) list(choice_id = ch[[match(v, labs)]]$id)))
  })
  list(id = id, response_status = "completed", collector_id = "col1",
       date_created = "2026-10-01T10:00:00+00:00", date_modified = "2026-10-01T10:00:00+00:00",
       pages = list(list(id = "pg1", questions = questions)))
}

.sma_txt <- function(x) list(text = x)

.sma_responses_fuente <- function(details = .sma_fuente()) {
  list(
    .sma_response(details, "rf1", list(f1 = "Sí", f2 = .sma_txt("20151234"), f3 = .sma_txt("30"),
                                       f4 = "Femenino", f5 = "2022", f6 = .sma_txt("Ana"))),
    .sma_response(details, "rf2", list(f1 = "Sí", f2 = .sma_txt("20189999"), f3 = .sma_txt("45"),
                                       f4 = "Masculino", f5 = "2021", f6 = .sma_txt("Luis")))
  )
}

.sma_responses_ref <- function(details = .sma_ref()) {
  list(.sma_response(details, "rr1", list(a1 = "Sí", a2 = .sma_txt("28"), a3 = "Masculino", a4 = "2021")))
}

# --- Instrumentos -------------------------------------------------------------

# XLSForm que la plataforma genera para una encuesta, leído como lo lee la base.
.sma_inst <- function(details, choice_code_maps = NULL) {
  model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  if (length(choice_code_maps)) model <- .carga_sm_adoptar_orden_editor(model, choice_code_maps)$model
  path <- tempfile(fileext = ".xlsx")
  .sm_mb_write_xlsform_model(model, path)
  on.exit(unlink(path), add = TRUE)
  reporte_instrumento(path = path)
}

.sma_code <- function(inst, var, label) {
  ch <- .sm_mb_choices_for_var(inst, var)
  as.character(ch$name[ch$label == label])
}

.sma_unlist <- function(x) unlist(x %||% list(), use.names = TRUE)

.sma_kinds <- function(diffs) vapply(diffs, function(d) as.character(d$kind %||% ""), "")
.sma_severities <- function(diffs) vapply(diffs, function(d) as.character(d$severity %||% ""), "")
.sma_mentions <- function(diffs, text) {
  any(vapply(diffs, function(d) any(grepl(text, unlist(d), fixed = TRUE)), logical(1)))
}

# =============================================================================
# 1. Codificar una fuente: cada respuesta queda en la variable de su pregunta
# =============================================================================

test_that("una fuente con una pregunta insertada no corre las respuestas a la variable vecina", {
  inst_ref <- .sma_inst(.sma_ref())
  fuente <- .sma_fuente()

  out <- .sm_mb_codificar_fuente(
    details_fuente = fuente,
    responses = .sma_responses_fuente(fuente),
    inst_base = inst_ref,
    survey_id = "FUE"
  )
  out <- as.data.frame(out, stringsAsFactors = FALSE)
  r1 <- out[as.character(out$response_id) == "rf1", , drop = FALSE]
  r2 <- out[as.character(out$response_id) == "rf2", , drop = FALSE]

  # p2 es la edad en REF; p3 el género; p4 el año de egreso.
  expect_equal(as.character(r1$p2), "30")
  expect_equal(as.character(r1$p3), .sma_code(inst_ref, "p3", "Femenino"))
  expect_equal(as.character(r1$p4), .sma_code(inst_ref, "p4", "2022"))
  expect_equal(as.character(r2$p2), "45")
  expect_equal(as.character(r2$p3), .sma_code(inst_ref, "p3", "Masculino"))
  expect_equal(as.character(r2$p4), .sma_code(inst_ref, "p4", "2021"))

  # El código PUCP y el enumerador no entran a ninguna columna de la base.
  con_pucp <- names(out)[vapply(out, function(col) any(as.character(col) %in% c("20151234", "20189999")), TRUE)]
  expect_equal(con_pucp, character(0))
  con_enum <- names(out)[vapply(out, function(col) any(as.character(col) %in% c("Ana", "Luis")), TRUE)]
  expect_equal(con_enum, character(0))
  expect_false(any(c("p5", "p6") %in% names(out)))

  al <- attr(out, "sm_alineacion", exact = TRUE)
  expect_false(is.null(al))
  expect_setequal(as.character(al$sin_par_fuente$etiqueta), c("Indique su código PUCP", "Enumerador"))
  expect_equal(NROW(al$sin_par_base), 0L)
})

# =============================================================================
# 2. Alinear: pares por pregunta, cobertura e instrumento distinto
# =============================================================================

test_that("alinear una fuente empareja por pregunta, declara lo que sobra y mide la cobertura", {
  inst_ref <- .sma_inst(.sma_ref())
  inst_fue <- .sma_inst(.sma_fuente())

  al <- .sm_mb_alinear_fuente(inst_ref, inst_fue)
  mapa <- .sma_unlist(al$mapa)

  # var_fuente -> var_base. La fuente p2 (código PUCP) y p6 (Enumerador) no tienen par.
  expect_equal(unname(mapa[c("p1", "p3", "p4", "p5")]), c("p1", "p2", "p3", "p4"))
  expect_false(any(c("p2", "p6") %in% names(mapa)))
  expect_setequal(as.character(al$sin_par_fuente$variable), c("p2", "p6"))
  expect_setequal(as.character(al$sin_par_fuente$etiqueta), c("Indique su código PUCP", "Enumerador"))
  expect_equal(NROW(al$sin_par_base), 0L)
  expect_true(isTRUE(al$reordenada))
  expect_equal(al$cobertura, 1)
  expect_false(isTRUE(al$instrumento_distinto))
})

test_that("una fuente con otra redacción en más del 20 % de las preguntas es otro instrumento", {
  inst_ref <- .sma_inst(.sma_ref())
  otra <- .sma_details("OTRA", "Otra encuesta", list(
    .sma_q_consent("o1"),
    .sma_open("o2", "Edad en años cumplidos"),
    .sma_single("o3", "Sexo", c("Masculino", "Femenino")),
    .sma_q_egreso("o4")
  ))
  al <- .sm_mb_alinear_fuente(inst_ref, .sma_inst(otra))

  expect_equal(al$cobertura, 0.5)
  expect_true(isTRUE(al$instrumento_distinto))
  expect_setequal(as.character(al$sin_par_base$variable), c("p2", "p3"))
})

# =============================================================================
# 3. Ordinal: dos preguntas idénticas se emparejan por orden de aparición
# =============================================================================

.sma_ref_ordinal <- function() {
  .sma_details("REFO", "Servicios", list(
    .sma_q_consent("a1"),
    .sma_single("a2", "¿Lo conoce?", c("Sí", "No")),
    .sma_q_edad("a3"),
    .sma_single("a4", "¿Lo conoce?", c("Sí", "No"))
  ))
}
.sma_fuente_ordinal <- function() {
  .sma_details("FUEO", "Servicios telefónico", list(
    .sma_q_consent("f1"),
    .sma_q_edad("f2"),
    .sma_single("f3", "¿Lo conoce?", c("Sí", "No")),
    .sma_single("f4", "¿Lo conoce?", c("Sí", "No"))
  ))
}

test_that("dos preguntas con el mismo texto y escala se emparejan por ordinal, no por la primera coincidencia", {
  inst_ref <- .sma_inst(.sma_ref_ordinal())
  fuente <- .sma_fuente_ordinal()
  al <- .sm_mb_alinear_fuente(inst_ref, .sma_inst(fuente))
  mapa <- .sma_unlist(al$mapa)

  expect_equal(unname(mapa[c("p1", "p2", "p3", "p4")]), c("p1", "p3", "p2", "p4"))
  expect_equal(al$cobertura, 1)
  expect_true(isTRUE(al$reordenada))

  resp <- list(.sma_response(fuente, "ro1", list(f1 = "Sí", f2 = .sma_txt("33"), f3 = "Sí", f4 = "No")))
  out <- as.data.frame(.sm_mb_codificar_fuente(details_fuente = fuente, responses = resp,
                                               inst_base = inst_ref, survey_id = "FUEO"))
  expect_equal(as.character(out$p2), .sma_code(inst_ref, "p2", "Sí"))
  expect_equal(as.character(out$p3), "33")
  expect_equal(as.character(out$p4), .sma_code(inst_ref, "p4", "No"))
})

# =============================================================================
# 5. Una opción fuera de la lista no se convierte en código
# =============================================================================

test_that("code_for_label no devuelve el código de otra lista cuando la etiqueta no calza", {
  inst_ref <- .sma_inst(.sma_ref())
  # «2015» no es una opción de p4 (2021/2022) y «6» no es un código de lst_p4.
  expect_true(is.na(.sm_mb_code_for_label(inst_ref, "p4", "2015", "6")))
  # La etiqueta que sí está sigue resolviendo a su código.
  expect_equal(.sm_mb_code_for_label(inst_ref, "p4", "2022", "9"), .sma_code(inst_ref, "p4", "2022"))
})

# =============================================================================
# 6. Auditoría de estructura sobre pares alineados
# =============================================================================

test_that("comparar una fuente reordenada pero emparejada no bloquea y declara orden y sin par", {
  diffs <- .sm_mb_compare_to_ref(.sm_mb_question_table(.sma_ref()), .sm_mb_question_table(.sma_fuente()))
  kinds <- .sma_kinds(diffs)

  expect_false("blocking" %in% .sma_severities(diffs))
  expect_true("question_order" %in% kinds)
  expect_true(all(.sma_severities(diffs)[kinds == "question_order"] == "info"))
  expect_true("unpaired_source" %in% kinds)
  expect_true(all(.sma_severities(diffs)[kinds %in% c("unpaired_source", "unpaired_base")] == "review"))
  expect_true(.sma_mentions(diffs[kinds == "unpaired_source"], "Indique su código PUCP"))
  expect_true(.sma_mentions(diffs[kinds == "unpaired_source"], "Enumerador"))
  # Comparar por posición fabricaba «fraseo distinto» y «estructura» al correrse.
  expect_false(any(kinds %in% c("wording", "structure", "missing_or_extra")))
})

test_that("una pregunta de la base sin par en la fuente se declara unpaired_base", {
  # Base de 5 preguntas: faltar una deja la cobertura en 4/5 = 80 %, el umbral
  # del contrato. Con la base de 4 (`.sma_ref()`) faltar una es 75 % y el
  # contrato la declara otro instrumento, que es el test siguiente.
  ref5 <- .sma_ref()
  ref5$pages[[1]]$questions <- c(ref5$pages[[1]]$questions, list(.sma_open("a5", "Comentario final")))
  sin_egreso <- .sma_details("FUE2", "Sin egreso", list(
    .sma_q_consent("f1"), .sma_open("f2", "Indique su código PUCP"),
    .sma_q_edad("f3"), .sma_q_genero("f4"), .sma_open("f5", "Comentario final")
  ))
  diffs <- .sm_mb_compare_to_ref(.sm_mb_question_table(ref5), .sm_mb_question_table(sin_egreso))
  kinds <- .sma_kinds(diffs)
  expect_true("unpaired_base" %in% kinds)
  expect_true(.sma_mentions(diffs[kinds == "unpaired_base"], "¿Cuál es su año de egreso?"))
  expect_false("blocking" %in% .sma_severities(diffs))
})

test_that("comparar contra otro instrumento bloquea con different_instrument", {
  otra <- .sma_details("OTRA", "Otra encuesta", list(
    .sma_q_consent("o1"),
    .sma_open("o2", "Edad en años cumplidos"),
    .sma_single("o3", "Sexo", c("Masculino", "Femenino")),
    .sma_q_egreso("o4")
  ))
  diffs <- .sm_mb_compare_to_ref(.sm_mb_question_table(.sma_ref()), .sm_mb_question_table(otra))
  kinds <- .sma_kinds(diffs)
  expect_true("different_instrument" %in% kinds)
  expect_true(all(.sma_severities(diffs)[kinds == "different_instrument"] == "blocking"))
})

# Variante peligrosa: la inserción cae entre preguntas de igual familia y
# escala, así que comparar posición contra posición solo ve «fraseo distinto»
# (review) y el refresh actualizaba con las columnas corridas.
.sma_sino <- function(id, h) .sma_single(id, h, c("Sí", "No"))
.sma_ref_sino <- function() {
  .sma_details("REFS", "Servicios", list(
    .sma_q_consent("a1"),
    .sma_sino("a2", "¿Usó la biblioteca?"), .sma_sino("a3", "¿Usó el comedor?"),
    .sma_sino("a4", "¿Usó la bolsa de trabajo?"), .sma_sino("a5", "¿Usó el gimnasio?"),
    .sma_sino("a6", "¿Usó la enfermería?")
  ))
}
.sma_fuente_sino <- function() {
  .sma_details("FUES", "Servicios telefónico", list(
    .sma_q_consent("f1"),
    .sma_sino("f2", "¿Tiene correo PUCP activo?"),
    .sma_sino("f3", "¿Usó la biblioteca?"), .sma_sino("f4", "¿Usó el comedor?"),
    .sma_sino("f5", "¿Usó la bolsa de trabajo?"), .sma_sino("f6", "¿Usó el gimnasio?")
  ))
}

test_that("una inserción entre preguntas de igual familia y escala se empareja, no se actualiza corrida", {
  ref <- .sma_ref_sino()
  fuente <- .sma_fuente_sino()
  diffs <- .sm_mb_compare_to_ref(.sm_mb_question_table(ref), .sm_mb_question_table(fuente))
  kinds <- .sma_kinds(diffs)

  expect_false(any(kinds == "wording"))
  expect_true("question_order" %in% kinds)
  expect_true(.sma_mentions(diffs[kinds == "unpaired_source"], "¿Tiene correo PUCP activo?"))
  expect_true(.sma_mentions(diffs[kinds == "unpaired_base"], "¿Usó la enfermería?"))

  inst_ref <- .sma_inst(ref)
  al <- .sm_mb_alinear_fuente(inst_ref, .sma_inst(fuente))
  expect_equal(unname(.sma_unlist(al$mapa)[c("p3", "p4", "p5", "p6")]), c("p2", "p3", "p4", "p5"))
  expect_equal(al$cobertura, 5 / 6)
  expect_false(isTRUE(al$instrumento_distinto))

  # Quien dijo Sí al correo y No a la biblioteca: la biblioteca queda en No.
  resp <- list(.sma_response(fuente, "rs1", list(f1 = "Sí", f2 = "Sí", f3 = "No", f4 = "Sí", f5 = "No", f6 = "Sí")))
  out <- as.data.frame(.sm_mb_codificar_fuente(details_fuente = fuente, responses = resp,
                                               inst_base = inst_ref, survey_id = "FUES"))
  no <- .sma_code(inst_ref, "p2", "No")
  si <- .sma_code(inst_ref, "p2", "Sí")
  expect_equal(as.character(unlist(out[1, c("p2", "p3", "p4", "p5")])), c(no, si, no, si))
  expect_true(is.na(out$p6[1]) || !nzchar(as.character(out$p6[1])))
})

# =============================================================================
# 7. Camino real: el bucle de fuentes del refresh
# =============================================================================

.sma_snapshot_mocks <- function(details_by_id, responses_by_id) {
  list(
    .sma_mock("sm_api_fetch_survey_details", function(survey_id, token, ...) {
      details_by_id[[as.character(survey_id)]] %||% stop("survey_id inesperado: ", survey_id)
    }),
    .sma_mock("sm_api_fetch_all_responses_bulk", function(survey_id, token, ...) {
      list(data = responses_by_id[[as.character(survey_id)]] %||% list())
    })
  )
}

.sma_spec <- function(base_id, fuente_id) {
  list(
    survey_id = base_id,
    source_title = "Egresados",
    response_statuses = "completed",
    sources = list(
      list(survey_id = base_id, source_title = "Personalizado", response_statuses = "completed"),
      list(survey_id = fuente_id, source_title = "Telefónico", response_statuses = "completed")
    )
  )
}

test_that("el refresh multi-fuente deja la edad de las filas de la fuente en la variable de edad", {
  ref <- .sma_ref()
  fuente <- .sma_fuente()
  restores <- .sma_snapshot_mocks(
    list(REF = ref, FUE = fuente),
    list(REF = .sma_responses_ref(ref), FUE = .sma_responses_fuente(fuente))
  )
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  snap <- .sm_mb_prepare_refresh_snapshot(sid, "egresados", .sma_spec("REF", "FUE"), token = "tok")
  df <- as.data.frame(snap$remote_df, stringsAsFactors = FALSE)
  inst <- snap$rp_inst
  fila <- function(rid) df[as.character(df$response_id) == rid, , drop = FALSE]

  expect_equal(nrow(df), 3L)
  # La fila de la encuesta principal no cambia.
  expect_equal(as.character(fila("rr1")$p2), "28")
  # Las de la fuente: edad en la edad, género y año con los códigos de la base.
  expect_equal(as.character(fila("rf1")$p2), "30")
  expect_equal(as.character(fila("rf1")$p3), .sma_code(inst, "p3", "Femenino"))
  expect_equal(as.character(fila("rf1")$p4), .sma_code(inst, "p4", "2022"))
  expect_equal(as.character(fila("rf2")$p2), "45")
  expect_equal(as.character(fila("rf2")$p3), .sma_code(inst, "p3", "Masculino"))
  expect_equal(as.character(fila("rf2")$p4), .sma_code(inst, "p4", "2021"))
  con_pucp <- names(df)[vapply(df, function(col) any(as.character(col) %in% c("20151234", "20189999")), TRUE)]
  expect_equal(con_pucp, character(0))
})

# =============================================================================
# 4. Recodificación por etiqueta a los códigos de la base (orden del editor)
# =============================================================================

.sma_item <- function(src, lab, xls) list(source_code = src, source_label = lab, xls_code = xls, xls_label = lab)

.sma_ref_editor <- function() {
  .sma_details("REFE", "Egresados Personalizado", list(
    .sma_q_consent("a1"),
    .sma_q_genero("a2"),
    .sma_multiple("a3", "¿Qué servicios usa?", c("Préstamo", "Sala", "Ninguno"))
  ))
}
.sma_fuente_editor <- function() {
  .sma_details("FUEE", "Egresados Telefónico", list(
    .sma_q_consent("f1"),
    .sma_open("f2", "Indique su código PUCP"),
    .sma_q_genero("f3"),
    .sma_multiple("f4", "¿Qué servicios usa?", c("Préstamo", "Sala", "Ninguno"))
  ))
}

# El editor reordenó las listas de la base: Femenino=1, Masculino=2 y
# Ninguno=1, Préstamo=2, Sala=3. La fuente conserva el orden de la plataforma.
.sma_mapas_editor <- function() {
  list(
    list(variable = "p2", type = "select_one", list_name = "lst_p2", mappings = list(
      .sma_item("1", "Masculino", "2"), .sma_item("2", "Femenino", "1"))),
    list(variable = "p3", type = "select_multiple", list_name = "lst_p3", mappings = list(
      .sma_item("1", "Préstamo", "2"), .sma_item("2", "Sala", "3"), .sma_item("3", "Ninguno", "1")))
  )
}

test_that("las respuestas de la fuente llevan los códigos de la base cuando el editor reordenó sus listas", {
  ref <- .sma_ref_editor()
  fuente <- .sma_fuente_editor()
  responses_fue <- list(
    .sma_response(fuente, "re1", list(f1 = "Sí", f2 = .sma_txt("20151234"), f3 = "Femenino", f4 = c("Préstamo", "Sala"))),
    .sma_response(fuente, "re2", list(f1 = "Sí", f2 = .sma_txt("20189999"), f3 = "Masculino", f4 = "Ninguno"))
  )
  responses_ref <- list(.sma_response(ref, "rb1", list(a1 = "Sí", a2 = "Femenino", a3 = "Sala")))
  restores <- .sma_snapshot_mocks(list(REFE = ref, FUEE = fuente), list(REFE = responses_ref, FUEE = responses_fue))
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "xlsform_state", list(
    source = list(survey_id = "REFE"),
    workbook = list(surveyMonkeyLogic = list(choice_code_maps = .sma_mapas_editor()))
  ))
  # ADR 0094, decisión 7: el orden se fija al importar. La base trae la receta
  # que guardó su import; el refresh la reaplica (sin receta no adoptaría nada).
  receta <- .carga_sm_adoptar_y_recetar(
    sm_api_xlsform(ref, style = .sm_api_default_style(), lang = "es"), .sma_mapas_editor()
  )$resumen
  session_set(sid, "estudio", list(bases = list(egresados = list(choice_order_editor = receta))))

  snap <- .sm_mb_prepare_refresh_snapshot(sid, "egresados", .sma_spec("REFE", "FUEE"), token = "tok")
  inst <- snap$rp_inst
  # Precondición: la base adoptó el orden del editor.
  expect_equal(.sma_code(inst, "p2", "Femenino"), "1")
  expect_equal(.sma_code(inst, "p3", "Ninguno"), "1")

  df <- as.data.frame(snap$remote_df, stringsAsFactors = FALSE)
  fila <- function(rid) df[as.character(df$response_id) == rid, , drop = FALSE]
  tokens <- function(rid) {
    if ("p3" %in% names(df)) {
      v <- as.character(fila(rid)$p3)
      return(sort(strsplit(v, " ")[[1]]))
    }
    dummies <- grep("^p3[._]", names(df), value = TRUE)
    marcados <- dummies[vapply(dummies, function(d) {
      isTRUE(suppressWarnings(as.numeric(as.character(fila(rid)[[d]]))) == 1)
    }, logical(1))]
    sort(sub("^p3[._]", "", marcados))
  }

  # select_one: Femenino es 1 en la base aunque en la fuente sea 2.
  expect_equal(as.character(fila("re1")$p2), "1")
  expect_equal(as.character(fila("re2")$p2), "2")
  expect_equal(as.character(fila("rb1")$p2), "1")
  # select_multiple: tokens con los códigos de la base.
  expect_equal(tokens("re1"), c("2", "3"))
  expect_equal(tokens("re2"), "1")
  expect_equal(tokens("rb1"), "3")
})
