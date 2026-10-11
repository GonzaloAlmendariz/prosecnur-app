# Fuentes de una base SurveyMonkey emparejadas por pregunta (ADR 0094, ítem 13):
# los tres caminos que juntan encuestas, la persistencia en la base, Carga ›
# Revisión, el worker async y el bloqueo del refresh por otro instrumento.
#
# Fixtures sintéticos; sin red: los fetchers SurveyMonkey se reemplazan en el
# namespace y el runner async corre in-process (mismo sandbox que el worker).

.smp_mock <- function(name, value) {
  env <- asNamespace("prosecnurapp")
  had <- exists(name, envir = env, inherits = FALSE)
  previous <- if (had) get(name, envir = env) else NULL
  locked <- had && bindingIsLocked(name, env)
  if (locked) unlockBinding(name, env)
  assign(name, value, envir = env)
  if (locked) lockBinding(name, env)
  function() {
    if (bindingIsLocked(name, env)) unlockBinding(name, env)
    if (had) assign(name, previous, envir = env) else rm(list = name, envir = env)
    if (locked) lockBinding(name, env)
  }
}

# --- Encuestas sintéticas -----------------------------------------------------

.smp_op <- function(id, text, pos) list(id = id, text = text, position = pos)

.smp_choice_q <- function(id, family, heading, labels, other = FALSE) {
  q <- list(
    id = id, family = family, subtype = "vertical",
    headings = list(list(heading = heading)),
    answers = list(choices = lapply(seq_along(labels), function(i) .smp_op(paste0(id, "c", i), labels[[i]], i)))
  )
  if (other) q$answers$other <- list(id = paste0(id, "oth"), text = "Otro (especifique)", visible = TRUE)
  q
}
.smp_single <- function(id, heading, labels, other = FALSE) .smp_choice_q(id, "single_choice", heading, labels, other)
.smp_multiple <- function(id, heading, labels, other = FALSE) .smp_choice_q(id, "multiple_choice", heading, labels, other)
.smp_open <- function(id, heading) {
  list(id = id, family = "open_ended", subtype = "single", headings = list(list(heading = heading)))
}
.smp_matrix <- function(id, heading, rows, labels) {
  list(
    id = id, family = "matrix", subtype = "rating", headings = list(list(heading = heading)),
    answers = list(
      rows = lapply(seq_along(rows), function(i) list(id = paste0(id, "r", i), text = rows[[i]], position = i)),
      choices = lapply(seq_along(labels), function(i) .smp_op(paste0(id, "c", i), labels[[i]], i))
    )
  )
}
.smp_details <- function(survey_id, title, questions) {
  list(id = survey_id, title = title, pages = list(list(id = "pg1", questions = questions)))
}

.SMP_GENEROS <- c("Masculino", "Femenino")
.SMP_SERVICIOS <- c("Préstamo", "Sala", "Ninguno")

# REF: la encuesta principal. Género y servicios con «Otro», una matriz.
.smp_ref <- function(survey_id = "REF") {
  .smp_details(survey_id, "Egresados Personalizado", list(
    .smp_single("a1", "¿Desea continuar?", c("Sí", "No")),
    .smp_open("a2", "¿Cuántos años tiene?"),
    .smp_single("a3", "¿Cuál es su género?", .SMP_GENEROS, other = TRUE),
    .smp_multiple("a4", "¿Qué servicios usa?", .SMP_SERVICIOS, other = TRUE),
    .smp_matrix("a5", "Evalúe los servicios", c("Biblioteca", "Comedor"), c("Malo", "Bueno"))
  ))
}

# FUE: «Indique su código PUCP» insertado tras Q1, la matriz con las filas en
# otro orden y un «Enumerador» final que la base no tiene.
.smp_fuente <- function(survey_id = "FUE") {
  .smp_details(survey_id, "Egresados Telefónico", list(
    .smp_single("f1", "¿Desea continuar?", c("Sí", "No")),
    .smp_open("f2", "Indique su código PUCP"),
    .smp_open("f3", "¿Cuántos años tiene?"),
    .smp_single("f4", "¿Cuál es su género?", .SMP_GENEROS, other = TRUE),
    .smp_multiple("f5", "¿Qué servicios usa?", .SMP_SERVICIOS, other = TRUE),
    .smp_matrix("f6", "Evalúe los servicios", c("Comedor", "Biblioteca"), c("Malo", "Bueno")),
    .smp_open("f7", "Enumerador")
  ))
}

# OTRA: comparte el consentimiento y nada más con REF: otro instrumento.
.smp_otra <- function(survey_id = "OTRA") {
  .smp_details(survey_id, "Otra encuesta", list(
    .smp_single("o1", "¿Desea continuar?", c("Sí", "No")),
    .smp_open("o2", "Edad en años cumplidos"),
    .smp_single("o3", "Sexo", .SMP_GENEROS)
  ))
}

# --- Respuestas ---------------------------------------------------------------

.smp_q_by_id <- function(details) {
  qs <- details$pages[[1]]$questions
  stats::setNames(qs, vapply(qs, `[[`, "", "id"))
}
.smp_choice_id <- function(q, label) {
  ch <- q$answers$choices
  ch[[match(label, vapply(ch, `[[`, "", "text"))]]$id
}
.smp_row_id <- function(q, label) {
  rows <- q$answers$rows
  rows[[match(label, vapply(rows, `[[`, "", "text"))]]$id
}

# `answers`: qid -> list(...) con formas legibles:
#   "Etiqueta" o c("A", "B")          elección por etiqueta
#   list(text = "x")                   abierta
#   list(otro = "x", elegidas = ...)   «Otro» con texto (y elegidas en múltiple)
#   list(filas = c(Fila = "Etiqueta")) matriz
.smp_response <- function(details, id, answers) {
  by_id <- .smp_q_by_id(details)
  questions <- lapply(names(answers), function(qid) {
    q <- by_id[[qid]]
    val <- answers[[qid]]
    ans <- if (is.list(val) && !is.null(val$text)) {
      list(list(text = val$text))
    } else if (is.list(val) && !is.null(val$filas)) {
      lapply(names(val$filas), function(fila) {
        list(row_id = .smp_row_id(q, fila), choice_id = .smp_choice_id(q, val$filas[[fila]]))
      })
    } else if (is.list(val) && !is.null(val$otro)) {
      c(lapply(val$elegidas %||% character(0), function(v) list(choice_id = .smp_choice_id(q, v))),
        list(list(other_id = q$answers$other$id, text = val$otro)))
    } else {
      lapply(val, function(v) list(choice_id = .smp_choice_id(q, v)))
    }
    list(id = qid, answers = ans)
  })
  list(id = id, response_status = "completed", collector_id = "col1",
       date_created = "2026-10-01T10:00:00+00:00", date_modified = "2026-10-01T10:00:00+00:00",
       pages = list(list(id = "pg1", questions = questions)))
}

.smp_responses_ref <- function(details = .smp_ref()) {
  list(.smp_response(details, "rr1", list(
    a1 = "Sí", a2 = list(text = "28"), a3 = "Masculino", a4 = "Sala",
    a5 = list(filas = c(Biblioteca = "Bueno", Comedor = "Malo"))
  )))
}

.smp_responses_fuente <- function(details = .smp_fuente()) {
  list(
    .smp_response(details, "rf1", list(
      f1 = "Sí", f2 = list(text = "20151234"), f3 = list(text = "30"),
      f4 = list(otro = "No binario"),
      f5 = list(elegidas = "Préstamo", otro = "Hemeroteca"),
      f6 = list(filas = c(Comedor = "Bueno", Biblioteca = "Malo")),
      f7 = list(text = "Ana")
    )),
    .smp_response(details, "rf2", list(
      f1 = "Sí", f2 = list(text = "20189999"), f3 = list(text = "45"),
      f4 = "Femenino", f5 = c("Sala", "Ninguno"),
      f6 = list(filas = c(Comedor = "Malo", Biblioteca = "Bueno")),
      f7 = list(text = "Luis")
    ))
  )
}

.smp_responses_otra <- function(details = .smp_otra()) {
  list(.smp_response(details, "ro1", list(o1 = "Sí", o2 = list(text = "50"), o3 = "Femenino")))
}

# --- Instrumentos -------------------------------------------------------------

.smp_inst <- function(details, choice_code_maps = NULL) {
  model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  if (length(choice_code_maps)) model <- .carga_sm_adoptar_orden_editor(model, choice_code_maps)$model
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  .sm_mb_write_xlsform_model(model, path)
  reporte_instrumento(path = path)
}

.smp_code <- function(inst, var, label) {
  ch <- .sm_mb_choices_for_var(inst, var)
  as.character(ch$name[ch$label == label])
}

# Variable de la base por etiqueta (no por posición: es lo que se prueba).
.smp_var <- function(inst, label) {
  sv <- inst$survey
  as.character(sv$name[!is.na(sv$label) & sv$label == label])[1]
}

.smp_item <- function(src, lab, xls) list(source_code = src, source_label = lab, xls_code = xls, xls_label = lab)

# Mapas del editor: invierten el orden de género y de servicios en la base.
.smp_mapas_editor <- function(inst_ref) {
  genero <- .smp_var(inst_ref, "¿Cuál es su género?")
  servicios <- .smp_var(inst_ref, "¿Qué servicios usa?")
  list(
    list(variable = genero, type = "select_one", list_name = paste0("lst_", genero), mappings = list(
      .smp_item("1", "Masculino", "2"), .smp_item("2", "Femenino", "1"), .smp_item("3", "Otro (especifique)", "3"))),
    list(variable = servicios, type = "select_multiple", list_name = paste0("lst_", servicios), mappings = list(
      .smp_item("1", "Préstamo", "3"), .smp_item("2", "Sala", "2"), .smp_item("3", "Ninguno", "1"),
      .smp_item("4", "Otro (especifique)", "4")))
  )
}

.smp_tokens <- function(x) sort(strsplit(as.character(x), " ")[[1]])

# --- Mocks de red ---------------------------------------------------------------

.smp_network_mocks <- function(details_by_id, responses_by_id) {
  responses_of <- function(survey_id) responses_by_id()[[as.character(survey_id)]] %||% list()
  list(
    .smp_mock(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      "smp-token-efimero"
    }),
    .smp_mock("sm_api_fetch_survey_details", function(survey_id, token, ...) {
      details_by_id()[[as.character(survey_id)]] %||% stop("survey_id inesperado: ", survey_id)
    }),
    .smp_mock("sm_api_fetch_all_responses_bulk", function(survey_id, token, ...) {
      data <- responses_of(survey_id)
      list(total = length(data), data = data)
    }),
    .smp_mock("sm_api_fetch_responses_bulk", function(survey_id, token, ...) {
      data <- responses_of(survey_id)
      list(total = length(data), data = utils::head(data, 1L))
    }),
    .smp_mock("sm_api_fetch_collectors", function(survey_id, ...) list(total = 0L, data = list())),
    .smp_mock("sm_multibase_list_surveys", function(token, ...) list(surveys = list()))
  )
}

.smp_spec_independiente <- function(sources = c("REF", "FUE")) {
  titles <- c(REF = "Personalizado", FUE = "Telefónico", OTRA = "Otra")
  list(list(
    survey_id = sources[1],
    label = "Egresados",
    source_title = "Egresados",
    response_statuses = list("completed"),
    sources = lapply(sources, function(id) {
      list(survey_id = id, source_title = titles[[id]], response_statuses = list("completed"))
    })
  ))
}

# Importa la base REF+FUE por el camino independiente y devuelve su nombre.
.smp_importar <- function(sid, sources = c("REF", "FUE")) {
  out <- sm_multibase_import_independent(sid, specs = .smp_spec_independiente(sources), token = "smp-token-efimero")
  as.character(out$bases[[1]]$nombre %||% out$bases[[1]]$name %||% out$active_base)
}

.smp_base_data <- function(sid, base_name) {
  base <- session_get(sid)$estudio$bases[[base_name]]
  meta <- get_file(sid, base$data_file_id)
  as.data.frame(.read_data_any_path(meta$path, meta$ext), stringsAsFactors = FALSE, check.names = FALSE)
}

.smp_fuente_de <- function(base, survey_id) {
  Find(function(f) identical(f$survey_id, survey_id), base$sm_alineacion_fuentes %||% list())
}

# =============================================================================
# 1. Codificar una fuente: `_other`, múltiple con tokens y matriz por fila
# =============================================================================

test_that("una fuente con _other, múltiple y matriz reordenada cae en las variables de la base con sus códigos", {
  ref <- .smp_ref()
  fuente <- .smp_fuente()
  inst_clave <- .smp_inst(ref)
  # La base adoptó el orden del editor: sus códigos no son los de la plataforma.
  inst_base <- .smp_inst(ref, .smp_mapas_editor(inst_clave))

  out <- .sm_mb_codificar_fuente(
    details_fuente = fuente,
    responses = .smp_responses_fuente(fuente),
    inst_base = inst_base,
    survey_id = "FUE",
    inst_clave_base = inst_clave
  )
  out <- as.data.frame(out, stringsAsFactors = FALSE)
  fila <- function(rid) out[as.character(out$response_id) == rid, , drop = FALSE]

  edad <- .smp_var(inst_base, "¿Cuántos años tiene?")
  genero <- .smp_var(inst_base, "¿Cuál es su género?")
  servicios <- .smp_var(inst_base, "¿Qué servicios usa?")
  biblioteca <- .smp_var(inst_base, "Biblioteca")
  comedor <- .smp_var(inst_base, "Comedor")

  # D2: alinear no crea ni elimina filas.
  expect_equal(nrow(out), 2L)
  expect_equal(as.character(fila("rf1")[[edad]]), "30")

  # select_one con «Otro»: el código de «Otro» de la base y el texto en su _other.
  expect_equal(as.character(fila("rf1")[[genero]]), .smp_code(inst_base, genero, "Otro (especifique)"))
  expect_equal(as.character(fila("rf1")[[paste0(genero, "_other")]]), "No binario")
  expect_equal(as.character(fila("rf2")[[genero]]), .smp_code(inst_base, genero, "Femenino"))
  expect_equal(.smp_code(inst_base, genero, "Femenino"), "1")

  # select_multiple: tokens recodificados por etiqueta a los códigos del editor.
  expect_equal(.smp_tokens(fila("rf1")[[servicios]]),
               sort(c(.smp_code(inst_base, servicios, "Préstamo"), .smp_code(inst_base, servicios, "Otro (especifique)"))))
  expect_equal(as.character(fila("rf1")[[paste0(servicios, "_other")]]), "Hemeroteca")
  expect_equal(.smp_tokens(fila("rf2")[[servicios]]),
               sort(c(.smp_code(inst_base, servicios, "Sala"), .smp_code(inst_base, servicios, "Ninguno"))))
  expect_equal(.smp_code(inst_base, servicios, "Préstamo"), "3")

  # Matriz: cada fila se empareja por su texto, no por su orden.
  expect_equal(as.character(fila("rf1")[[biblioteca]]), .smp_code(inst_base, biblioteca, "Malo"))
  expect_equal(as.character(fila("rf1")[[comedor]]), .smp_code(inst_base, comedor, "Bueno"))
  expect_equal(as.character(fila("rf2")[[biblioteca]]), .smp_code(inst_base, biblioteca, "Bueno"))
  expect_equal(as.character(fila("rf2")[[comedor]]), .smp_code(inst_base, comedor, "Malo"))

  # Lo que no tiene par no entra a ninguna columna.
  todo <- unlist(lapply(out, as.character), use.names = FALSE)
  expect_false(any(c("20151234", "Ana", "Luis") %in% todo))
  expect_false(any(names(out) %in% setdiff(.sm_mb_expected_names(.smp_inst(fuente)), .sm_mb_expected_names(inst_base))))

  al <- attr(out, "sm_alineacion", exact = TRUE)
  expect_setequal(as.character(al$sin_par_fuente$etiqueta), c("Indique su código PUCP", "Enumerador"))
  expect_equal(NROW(al$sin_par_base), 0L)
  expect_true(isTRUE(al$reordenada))
  expect_equal(al$cobertura, 1)
  expect_length(attr(out, "sm_opciones_sin_par", exact = TRUE), 0L)
})

test_that("una opción que la lista de la base no tiene queda NA y se cuenta, nunca con otro código", {
  ref <- .smp_ref()
  fuente <- .smp_fuente()
  inst_clave <- .smp_inst(ref)
  inst_base <- .smp_inst(ref)
  genero <- .smp_var(inst_base, "¿Cuál es su género?")
  # La lista de la base dejó de tener «Femenino» (p. ej. la renombró la lógica
  # compartida); la clave sigue saliendo del XLSForm generado.
  ch <- inst_base$choices
  ln <- as.character(inst_base$survey$list_name[which(inst_base$survey$name == genero)])
  ch$label[which(ch$list_name == ln & ch$label == "Femenino")] <- "Mujer"
  inst_base$choices <- ch

  out <- .sm_mb_codificar_fuente(
    details_fuente = fuente, responses = .smp_responses_fuente(fuente),
    inst_base = inst_base, survey_id = "FUE", inst_clave_base = inst_clave
  )
  rf2 <- out[as.character(out$response_id) == "rf2", , drop = FALSE]
  expect_true(is.na(rf2[[genero]]))
  op <- attr(out, "sm_opciones_sin_par", exact = TRUE)
  expect_equal(unname(op[[genero]]), 1L)
  expect_equal(names(op), genero)

  resumen <- .sm_mb_alineacion_resumen(out, "FUE", "Telefónico")
  expect_equal(resumen$opciones_sin_par, list(list(variable = genero, n = 1L)))
})

test_that("las dummies de una múltiple siguen al padre con el código de la base", {
  ref <- .smp_ref()
  fuente <- .smp_fuente()
  inst_fuente <- .smp_inst(fuente)
  inst_clave <- .smp_inst(ref)
  inst_base <- .smp_inst(ref, .smp_mapas_editor(inst_clave))
  al <- .sm_mb_alinear_fuente(inst_clave, inst_fuente)
  serv_f <- .smp_var(inst_fuente, "¿Qué servicios usa?")
  serv_b <- .smp_var(inst_base, "¿Qué servicios usa?")
  cod_f <- function(lab) .smp_code(inst_fuente, serv_f, lab)
  df <- data.frame(response_id = "x1", stringsAsFactors = FALSE, check.names = FALSE)
  df[[serv_f]] <- paste(cod_f("Préstamo"), cod_f("Sala"))
  df[[paste0(serv_f, "/", cod_f("Préstamo"))]] <- "1"
  df[[paste0(serv_f, "/", cod_f("Sala"))]] <- "1"
  df[[paste0(serv_f, "/99")]] <- "1"

  res <- .sm_mb_alin_aplicar(df, al, inst_fuente, inst_base)$data
  expect_equal(as.character(res[[paste0(serv_b, "/", .smp_code(inst_base, serv_b, "Préstamo"))]]), "1")
  expect_equal(as.character(res[[paste0(serv_b, "/", .smp_code(inst_base, serv_b, "Sala"))]]), "1")
  expect_false(paste0(serv_f, "/99") %in% names(res))
  expect_false(any(startsWith(setdiff(names(res), serv_b), paste0(serv_f, "/")) & serv_f != serv_b))
})

test_that("una fuente sin respuestas no rompe y declara su alineación igual", {
  ref <- .smp_ref()
  fuente <- .smp_fuente()
  out <- .sm_mb_codificar_fuente(
    details_fuente = fuente, responses = list(), inst_base = .smp_inst(ref), survey_id = "FUE"
  )
  expect_equal(NROW(out), 0L)
  al <- attr(out, "sm_alineacion", exact = TRUE)
  expect_false(is.null(al))
  expect_equal(al$n_emparejadas, al$n_preguntas_base)
  resumen <- .sm_mb_alineacion_resumen(out, "FUE", "Telefónico")
  expect_equal(resumen$survey_id, "FUE")
  expect_length(resumen$sin_par_fuente, 2L)
})

test_that("la fuente principal sigue exactamente el camino canónico", {
  ref <- .smp_ref()
  inst <- .smp_inst(ref)
  responses <- .smp_responses_ref(ref)
  directo <- sm_multibase_api_responses_to_canonical_data(
    details = ref, responses = responses, inst = inst, survey_id = "REF", source_title = "Personalizado"
  )
  despacho <- .sm_mb_codificar_segun_fuente(
    details = ref, responses = responses, inst = inst, survey_id = "REF",
    base_survey_id = "REF", details_base = ref, source_title = "Personalizado"
  )
  expect_identical(despacho, directo)
  expect_null(attr(despacho, "sm_alineacion", exact = TRUE))
  expect_null(.sm_mb_alineacion_resumen(despacho, "REF"))
})

# =============================================================================
# 2. Auditoría de estructura con matriz y otro instrumento
# =============================================================================

test_that("comparar una fuente con la matriz reordenada no bloquea y otro instrumento dice qué hacer", {
  diffs <- .sm_mb_compare_to_ref(.sm_mb_question_table(.smp_ref()), .sm_mb_question_table(.smp_fuente()))
  kinds <- vapply(diffs, function(d) d$kind, "")
  expect_false(any(vapply(diffs, function(d) identical(d$severity, "blocking"), logical(1))))
  expect_true("question_order" %in% kinds)
  expect_false(any(kinds %in% c("structure", "unpaired_base")))

  otra <- .sm_mb_compare_to_ref(.sm_mb_question_table(.smp_ref()), .sm_mb_question_table(.smp_otra()))
  bloqueo <- Find(function(d) identical(d$kind, "different_instrument"), otra)
  expect_equal(bloqueo$severity, "blocking")
  expect_match(bloqueo$message, "base separada", fixed = TRUE)
  expect_match(bloqueo$message, "Equivalencias", fixed = TRUE)
  expect_equal(bloqueo$accion, "base_separada_equivalencias")
})

# =============================================================================
# 3. Persistencia por los tres caminos y Carga › Revisión
# =============================================================================

test_that("import independiente: la base guarda la alineación de la fuente y Revisión la declara", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  base_name <- .smp_importar(sid)
  base <- session_get(sid)$estudio$bases[[base_name]]

  # Solo la fuente distinta de la principal.
  expect_length(base$sm_alineacion_fuentes, 1L)
  fue <- .smp_fuente_de(base, "FUE")
  expect_setequal(names(fue), c("survey_id", "titulo", "n_emparejadas", "n_preguntas_base", "cobertura",
                                "reordenada", "instrumento_distinto", "excluida", "n_filas_excluidas",
                                "sin_par_fuente", "sin_par_base", "opciones_sin_par"))
  expect_false(isTRUE(fue$excluida))
  expect_equal(fue$n_filas_excluidas, 0L)
  expect_equal(fue$titulo, "Telefónico")
  expect_true(isTRUE(fue$reordenada))
  expect_false(isTRUE(fue$instrumento_distinto))
  expect_equal(fue$n_emparejadas, fue$n_preguntas_base)
  expect_setequal(vapply(fue$sin_par_fuente, `[[`, "", "etiqueta"), c("Indique su código PUCP", "Enumerador"))
  expect_length(fue$sin_par_base, 0L)
  expect_false(grepl("smp-token-efimero", paste(capture.output(dput(base$sm_alineacion_fuentes)), collapse = "")))

  # La data guardada: la edad de la fuente en la edad de la base.
  inst <- reporte_instrumento(path = get_file(sid, base$xlsform_file_id)$path)
  df <- .smp_base_data(sid, base_name)
  edad <- .smp_var(inst, "¿Cuántos años tiene?")
  expect_equal(nrow(df), 3L)
  expect_equal(as.character(df[[edad]][as.character(df$response_id) == "rf1"]), "30")

  # Carga › Revisión: la clave viaja y no entra en `ready`.
  payload <- .carga_review_payload(sid, base_name)
  expect_true("fuentes" %in% names(payload))
  expect_length(payload$fuentes$fuentes, 1L)
  rev_fue <- payload$fuentes$fuentes[[1]]
  expect_setequal(names(rev_fue), c("survey_id", "titulo", "n_emparejadas", "n_preguntas_base", "reordenada",
                                    "instrumento_distinto", "excluida", "n_filas_excluidas",
                                    "sin_par_fuente", "sin_par_base", "n_opciones_sin_par"))
  expect_equal(rev_fue$survey_id, "FUE")
  expect_equal(rev_fue$n_opciones_sin_par, 0L)
  expect_setequal(vapply(rev_fue$sin_par_fuente, `[[`, "", "etiqueta"), c("Indique su código PUCP", "Enumerador"))
})

test_that("import independiente: una fuente que es otro instrumento no entra y queda declarada excluida", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente(), OTRA = .smp_otra())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente(), OTRA = .smp_responses_otra())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  base_name <- .smp_importar(sid, sources = c("REF", "FUE", "OTRA"))
  base <- session_get(sid)$estudio$bases[[base_name]]

  # La base se arma con las fuentes que calzan: REF (1 fila) + FUE (2 filas).
  df <- .smp_base_data(sid, base_name)
  expect_equal(nrow(df), 3L)
  expect_false("ro1" %in% as.character(df$response_id))
  expect_false("OTRA" %in% as.character(df$survey_id))
  expect_equal(as.integer(base$n_filas), 3L)

  otra <- .smp_fuente_de(base, "OTRA")
  expect_true(isTRUE(otra$instrumento_distinto))
  expect_true(isTRUE(otra$excluida))
  expect_equal(otra$n_filas_excluidas, 1L)
  fue <- .smp_fuente_de(base, "FUE")
  expect_false(isTRUE(fue$excluida))

  # Regenerar la base efectiva desde el snapshot crudo tampoco la suma.
  built <- .sm_mb_build_effective_from_snapshot(sid, base_name)
  expect_false("ro1" %in% as.character(built$data$response_id))
  expect_true(isTRUE(Find(function(f) identical(f$survey_id, "OTRA"), built$alineacion_fuentes)$excluida))

  rev_otra <- Find(function(f) identical(f$survey_id, "OTRA"), .carga_review_payload(sid, base_name)$fuentes$fuentes)
  expect_true(isTRUE(rev_otra$excluida))
  expect_equal(rev_otra$n_filas_excluidas, 1L)
  expect_true(isTRUE(rev_otra$instrumento_distinto))
})

test_that("import independiente: si todas las fuentes adicionales son otro instrumento, queda solo la principal", {
  details <- list(REF = .smp_ref(), OTRA = .smp_otra())
  responses <- list(REF = .smp_responses_ref(), OTRA = .smp_responses_otra())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  base_name <- .smp_importar(sid, sources = c("REF", "OTRA"))
  df <- .smp_base_data(sid, base_name)
  expect_equal(as.character(df$response_id), "rr1")
  otra <- .smp_fuente_de(session_get(sid)$estudio$bases[[base_name]], "OTRA")
  expect_true(isTRUE(otra$excluida))
  expect_equal(otra$n_filas_excluidas, 1L)
})

test_that("Revisión: sin fuentes alineadas la clave fuentes viaja en NULL", {
  expect_null(.carga_review_fuentes(list()))
  expect_null(.carga_review_fuentes(list(sm_alineacion_fuentes = list())))
  out <- .carga_review_fuentes(list(sm_alineacion_fuentes = list(list(
    survey_id = "FUE", titulo = "T", n_emparejadas = 3L, n_preguntas_base = 4L, cobertura = 0.75,
    reordenada = FALSE, instrumento_distinto = TRUE, sin_par_fuente = list(), sin_par_base = list(),
    opciones_sin_par = list(list(variable = "p3", n = 2L), list(variable = "p4", n = 1L))
  ))))
  expect_equal(out$fuentes[[1]]$n_opciones_sin_par, 3L)
  expect_true(out$fuentes[[1]]$instrumento_distinto)
})

test_that("una base de una sola encuesta no declara fuentes alineadas", {
  details <- list(REF = .smp_ref())
  responses <- list(REF = .smp_responses_ref())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  base_name <- .smp_importar(sid, sources = "REF")
  expect_null(session_get(sid)$estudio$bases[[base_name]]$sm_alineacion_fuentes)
  expect_null(.carga_review_payload(sid, base_name)$fuentes)
})

test_that("snapshot crudo regenerado: la base efectiva alinea la fuente y guarda la alineación", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)

  # Se borra para probar que este camino la vuelve a escribir.
  s <- session_get(sid)
  s$estudio$bases[[base_name]]$sm_alineacion_fuentes <- NULL
  .session_env[[sid]] <- s

  built <- .sm_mb_build_effective_from_snapshot(sid, base_name)
  edad <- .smp_var(built$inst, "¿Cuántos años tiene?")
  df <- built$data
  expect_equal(as.character(df[[edad]][as.character(df$response_id) == "rf2"]), "45")
  expect_length(built$alineacion_fuentes, 1L)

  sm_multibase_decision_apply(sid, base_name)
  fue <- .smp_fuente_de(session_get(sid)$estudio$bases[[base_name]], "FUE")
  expect_false(is.null(fue))
  expect_equal(fue$titulo, "Telefónico")
})

test_that("refresh multi-fuente: las filas nuevas de la fuente entran alineadas y la base guarda la alineación", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente()[1])
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  s <- session_get(sid)
  s$estudio$bases[[base_name]]$sm_alineacion_fuentes <- NULL
  .session_env[[sid]] <- s

  responses$FUE <- .smp_responses_fuente()
  out <- sm_multibase_refresh(sid, token = "smp-token-efimero", reapply_codificacion = FALSE)
  res <- out$results[[1]]
  expect_true(isTRUE(res$ok))
  expect_false(isTRUE(res$skipped))
  expect_equal(res$n_new, 1L)

  base <- session_get(sid)$estudio$bases[[base_name]]
  expect_false(is.null(.smp_fuente_de(base, "FUE")))
  inst <- reporte_instrumento(path = get_file(sid, base$xlsform_file_id)$path)
  df <- .smp_base_data(sid, base_name)
  edad <- .smp_var(inst, "¿Cuántos años tiene?")
  expect_equal(as.character(df[[edad]][as.character(df$response_id) == "rf2"]), "45")
})

# =============================================================================
# 4. Refresh con una fuente que es otro instrumento: blocked, no error
# =============================================================================

test_that("una fuente que es otro instrumento deja el refresh en blocked con un motivo accionable", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente(), OTRA = .smp_otra())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente(), OTRA = list())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  data_antes <- session_get(sid)$estudio$bases[[base_name]]$data_file_id

  # La spec guardada suma OTRA como fuente, con respuestas nuevas.
  s <- session_get(sid)
  spec <- s$estudio$bases[[base_name]]$surveymonkey_source_spec
  spec$sources <- c(spec$sources, list(list(survey_id = "OTRA", source_title = "Otra", response_statuses = list("completed"))))
  s$estudio$bases[[base_name]]$surveymonkey_source_spec <- spec
  .session_env[[sid]] <- s
  responses$OTRA <- .smp_responses_otra()

  plan <- sm_multibase_refresh_plan(sid, token = "smp-token-efimero")
  row <- plan$bases[[1]]
  expect_equal(row$refresh_action, "blocked")
  expect_false(isTRUE(row$updateable))
  kinds <- vapply(row$structure$diffs, function(d) as.character(d$kind %||% ""), "")
  expect_true("different_instrument" %in% kinds)
  bloqueo <- row$structure$diffs[[which(kinds == "different_instrument")[1]]]
  expect_equal(bloqueo$survey_id, "OTRA")

  out <- sm_multibase_refresh(sid, token = "smp-token-efimero", reapply_codificacion = FALSE)
  res <- out$results[[1]]
  expect_true(isTRUE(res$skipped))
  expect_match(res$reason, "base separada", fixed = TRUE)
  expect_match(res$reason, "Equivalencias", fixed = TRUE)
  expect_equal(session_get(sid)$estudio$bases[[base_name]]$data_file_id, data_antes)
})

test_that("otro instrumento bloquea aunque no haya filas nuevas", {
  structure <- list(ok = FALSE, diffs = list(list(kind = "different_instrument", severity = "blocking")))
  expect_equal(.sm_mb_refresh_action(list(new_rows = 0L), structure), "blocked")
  expect_equal(.sm_mb_refresh_action(list(new_rows = 3L), structure), "blocked")
  expect_match(.sm_mb_refresh_motivo_bloqueo(structure), "Equivalencias", fixed = TRUE)
  expect_equal(.sm_mb_refresh_motivo_bloqueo(list(diffs = list())), "La base no paso el diagnostico.")
})

# =============================================================================
# 5. Worker async: la alineación viaja en el diff de `estudio`
# =============================================================================

.smp_write_rds <- function(value) {
  path <- tempfile(fileext = ".rds")
  saveRDS(value, path, version = 3)
  path
}

.smp_run_job <- function(sid, action, parsed) {
  snapshot <- session_get(sid)
  result <- carga_platform_job_runner(
    sid = sid,
    action = action,
    state_path = .smp_write_rds(snapshot),
    parsed_path = .smp_write_rds(parsed),
    secrets_path = .smp_write_rds(list()),
    progress_path = tempfile(fileext = ".progress")
  )
  # El runner corrió "en otro proceso": la sesión viva vuelve al snapshot y
  # el apply del on_complete hace el merge mínimo.
  .session_env[[sid]] <- snapshot
  list(result = result, public = .carga_platform_job_apply(sid, result, as.character(snapshot$project_path %||% "")))
}

test_that("import independiente por el worker: sm_alineacion_fuentes llega a la sesión con el diff de estudio", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  run <- .smp_run_job(sid, "sm_multibase_import_independent", list(surveys = .smp_spec_independiente()))
  expect_true(isTRUE(run$result$ok))
  expect_true("estudio" %in% names(run$result$session_changes))

  bases <- session_get(sid)$estudio$bases
  expect_length(bases, 1L)
  fue <- .smp_fuente_de(bases[[1]], "FUE")
  expect_false(is.null(fue))
  expect_true(isTRUE(fue$reordenada))
  expect_false(grepl("smp-token-efimero", paste(capture.output(dput(bases[[1]]$sm_alineacion_fuentes)), collapse = "")))
})

test_that("refresh por el worker con otro instrumento: el job termina bien y el resultado dice blocked", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente(), OTRA = .smp_otra())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente(), OTRA = .smp_responses_otra())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  s <- session_get(sid)
  spec <- s$estudio$bases[[base_name]]$surveymonkey_source_spec
  spec$sources <- c(spec$sources, list(list(survey_id = "OTRA", source_title = "Otra", response_statuses = list("completed"))))
  s$estudio$bases[[base_name]]$surveymonkey_source_spec <- spec
  .session_env[[sid]] <- s

  run <- .smp_run_job(sid, "sm_multibase_refresh", list(reapply_codificacion = FALSE))
  expect_true(isTRUE(run$result$ok))
  res <- run$public$results[[1]]
  expect_true(isTRUE(res$skipped))
  expect_equal(run$public$plan$bases[[1]]$refresh_action, "blocked")
  expect_match(res$reason, "Equivalencias", fixed = TRUE)
})
