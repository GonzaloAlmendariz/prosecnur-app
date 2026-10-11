# Fuentes de una base SurveyMonkey emparejadas por pregunta (ADR 0099, ítem 13):
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

  # Los diffs de la fuente entera no viajan con pos NA: pos 0 y su título.
  orden <- Find(function(d) identical(d$kind, "question_order"), diffs)
  expect_identical(orden$pos, 0L)
  expect_equal(orden$variable, "Egresados Telefónico")
  expect_identical(bloqueo$pos, 0L)
  expect_equal(bloqueo$variable, "Otra encuesta")
  expect_false(any(vapply(c(diffs, otra), function(d) is.na(d$pos %||% NA_integer_), logical(1))))
})

test_that("el porcentaje del umbral se trunca: 43 de 54 no se muestra como 80 %", {
  expect_equal(.sm_mb_cobertura_texto(43 / 54), "79.6")
  expect_equal(.sm_mb_cobertura_texto(0.8), "80.0")
  expect_equal(.sm_mb_cobertura_texto(0.5), "50.0")
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
                                "n_filas_incorporadas", "consentimiento_sin_par", "n_excluidas_consentimiento",
                                "sin_par_fuente", "sin_par_base", "ambiguas", "pares", "opciones_sin_par"))
  expect_equal(fue$n_filas_incorporadas, 2L)
  expect_false(isTRUE(fue$consentimiento_sin_par))
  expect_equal(fue$n_excluidas_consentimiento, 0L)
  expect_length(fue$ambiguas, 0L)
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
                                    "n_filas_incorporadas", "consentimiento_sin_par", "n_excluidas_consentimiento",
                                    "sin_par_fuente", "sin_par_base", "ambiguas", "n_opciones_sin_par"))
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
  # Import con 1 fila de FUE: la alineación guardada declara 1 incorporada.
  expect_equal(.smp_fuente_de(session_get(sid)$estudio$bases[[base_name]], "FUE")$n_filas_incorporadas, 1L)

  responses$FUE <- .smp_responses_fuente()
  out <- sm_multibase_refresh(sid, token = "smp-token-efimero", reapply_codificacion = FALSE)
  res <- out$results[[1]]
  expect_true(isTRUE(res$ok))
  expect_false(isTRUE(res$skipped))
  expect_equal(res$n_new, 1L)

  # El refresh reescribe la alineación con la data nueva.
  base <- session_get(sid)$estudio$bases[[base_name]]
  expect_equal(.smp_fuente_de(base, "FUE")$n_filas_incorporadas, 2L)
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

# =============================================================================
# 6. Consentimiento: se evalúa en la fuente, antes de alinear (H1)
# =============================================================================

.SMP_CONSENT_DISTINTO <- "Habiendo leído el consentimiento informado, ¿acepta participar en la encuesta?"

.smp_fuente_consent_distinto <- function(survey_id = "FUEC") {
  .smp_details(survey_id, "Egresados Telefónico", list(
    .smp_single("f1", .SMP_CONSENT_DISTINTO, c("Sí", "No")),
    .smp_open("f3", "¿Cuántos años tiene?"),
    .smp_single("f4", "¿Cuál es su género?", .SMP_GENEROS, other = TRUE),
    .smp_multiple("f5", "¿Qué servicios usa?", .SMP_SERVICIOS, other = TRUE),
    .smp_matrix("f6", "Evalúe los servicios", c("Biblioteca", "Comedor"), c("Malo", "Bueno"))
  ))
}

test_that("un consentimiento redactado distinto no descarta en silencio las filas de la fuente", {
  ref <- .smp_ref()
  fuente <- .smp_fuente_consent_distinto()
  responses <- list(
    .smp_response(fuente, "c1", list(f1 = "Sí", f3 = list(text = "31"), f4 = "Femenino")),
    .smp_response(fuente, "c2", list(f1 = "Sí", f3 = list(text = "40"), f4 = "Masculino")),
    .smp_response(fuente, "c3", list(f1 = "No"))
  )
  inst_base <- .smp_inst(ref)
  out <- .sm_mb_codificar_fuente(details_fuente = fuente, responses = responses,
                                 inst_base = inst_base, survey_id = "FUEC")
  edad <- .smp_var(inst_base, "¿Cuántos años tiene?")
  # Las dos filas con «Sí» entran; la de «No» se excluye EN LA FUENTE.
  expect_setequal(as.character(out$response_id), c("c1", "c2"))
  expect_setequal(as.character(out[[edad]]), c("31", "40"))
  consentimiento <- attr(out, "sm_consentimiento", exact = TRUE)
  expect_true(isTRUE(consentimiento$sin_par))
  expect_equal(consentimiento$n_excluidas, 1L)

  resumen <- .sm_mb_alineacion_resumen(out, "FUEC", "Telefónico")
  expect_true(resumen$consentimiento_sin_par)
  expect_equal(resumen$n_filas_incorporadas, 2L)
  expect_equal(resumen$n_excluidas_consentimiento, 1L)
})

test_that("una fuente sin consentimiento reconocible entra entera y lo declara", {
  ref <- .smp_ref()
  fuente <- .smp_details("FUEN", "Sin consentimiento", list(
    .smp_open("f3", "¿Cuántos años tiene?"),
    .smp_single("f4", "¿Cuál es su género?", .SMP_GENEROS, other = TRUE),
    .smp_multiple("f5", "¿Qué servicios usa?", .SMP_SERVICIOS, other = TRUE),
    .smp_matrix("f6", "Evalúe los servicios", c("Biblioteca", "Comedor"), c("Malo", "Bueno"))
  ))
  responses <- list(.smp_response(fuente, "n1", list(f3 = list(text = "22"))),
                    .smp_response(fuente, "n2", list(f3 = list(text = "23"))))
  out <- .sm_mb_codificar_fuente(details_fuente = fuente, responses = responses,
                                 inst_base = .smp_inst(ref), survey_id = "FUEN")
  expect_equal(nrow(out), 2L)
  resumen <- .sm_mb_alineacion_resumen(out, "FUEN", "Sin consentimiento")
  expect_true(resumen$consentimiento_sin_par)
  expect_equal(resumen$n_excluidas_consentimiento, 0L)
})

test_that("el consent_var configurado en la fuente vale en su propia posición", {
  autoriza <- "Autorización de uso de datos"
  ref <- .smp_details("REFA", "Base", list(
    .smp_single("a1", autoriza, c("Sí", "No")),
    .smp_open("a2", "¿Cuántos años tiene?"),
    .smp_single("a3", "¿Cuál es su género?", .SMP_GENEROS)
  ))
  fuente <- .smp_details("FUEA", "Fuente", list(
    .smp_open("f1", "¿Cuántos años tiene?"),
    .smp_single("f2", autoriza, c("Sí", "No")),
    .smp_single("f3", "¿Cuál es su género?", .SMP_GENEROS)
  ))
  responses <- list(
    .smp_response(fuente, "k1", list(f1 = list(text = "30"), f2 = "Sí", f3 = "Femenino")),
    .smp_response(fuente, "k2", list(f1 = list(text = "50"), f2 = "No", f3 = "Masculino"))
  )
  inst_base <- .smp_inst(ref)
  # Configurado en el espacio de la fuente: su consentimiento es p2 (en la base, p1).
  out <- .sm_mb_codificar_fuente(details_fuente = fuente, responses = responses, inst_base = inst_base,
                                 survey_id = "FUEA", consent_var = "p2")
  expect_equal(as.character(out$response_id), "k1")
  expect_equal(as.character(out$p1), .smp_code(inst_base, "p1", "Sí"))
  expect_equal(as.character(out$p2), "30")
  expect_equal(attr(out, "sm_consentimiento", exact = TRUE)$variable_fuente, "p2")
  expect_false(isTRUE(attr(out, "sm_consentimiento", exact = TRUE)$sin_par))
})

.smp_consent_import_fuente <- function() .smp_fuente_consent_distinto("FUE")

test_that("import independiente: la fuente con el consentimiento redactado distinto aporta sus filas", {
  details <- list(REF = .smp_ref(), FUE = .smp_consent_import_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = list(
    .smp_response(details$FUE, "c1", list(f1 = "Sí", f3 = list(text = "31"))),
    .smp_response(details$FUE, "c2", list(f1 = "No"))
  ))
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  df <- .smp_base_data(sid, base_name)
  expect_setequal(as.character(df$response_id), c("rr1", "c1"))
  fue <- .smp_fuente_de(session_get(sid)$estudio$bases[[base_name]], "FUE")
  expect_true(fue$consentimiento_sin_par)
  expect_equal(fue$n_filas_incorporadas, 1L)
  expect_equal(fue$n_excluidas_consentimiento, 1L)
})

# El «sí» del consentimiento lo decide la etiqueta de la opción en el
# instrumento que codificó la respuesta, no el código «1» (checklist ítem 14):
# con la lista reordenada en el editor (No = 1, Sí = 2) ni la fuente adicional
# ni la principal descartan a quien consintió.
test_that("consentimiento reordenado en el editor: la fuente adicional se evalúa con sus códigos", {
  ref <- .smp_ref()
  fuente <- .smp_fuente()
  inst_clave <- .smp_inst(ref)
  consent <- .smp_var(inst_clave, "¿Desea continuar?")
  mapas <- list(list(variable = consent, type = "select_one", list_name = paste0("lst_", consent), mappings = list(
    .smp_item("1", "Sí", "2"), .smp_item("2", "No", "1"))))
  inst_base <- .smp_inst(ref, mapas)
  expect_equal(.smp_code(inst_base, consent, "Sí"), "2")

  out <- .sm_mb_codificar_fuente(details_fuente = fuente, responses = .smp_responses_fuente(fuente),
                                 inst_base = inst_base, survey_id = "FUE", inst_clave_base = inst_clave)
  expect_equal(nrow(out), 2L)
  expect_equal(unique(as.character(out[[consent]])), "2")
})

test_that("consentimiento reordenado en el editor: la fuente principal conserva a quien consintió (ítem 14)", {
  ref <- .smp_ref()
  inst_clave <- .smp_inst(ref)
  consent <- .smp_var(inst_clave, "¿Desea continuar?")
  mapas <- list(list(variable = consent, type = "select_one", list_name = paste0("lst_", consent), mappings = list(
    .smp_item("1", "Sí", "2"), .smp_item("2", "No", "1"))))
  out <- sm_multibase_api_responses_to_canonical_data(details = ref, responses = .smp_responses_ref(ref),
                                                       inst = .smp_inst(ref, mapas), survey_id = "REF")
  expect_equal(nrow(out), 1L)
})

# =============================================================================
# 7. Ambigüedad: una clave con distinto número de apariciones no se empareja (H2)
# =============================================================================

.smp_baterias <- function(survey_id, conoce = TRUE) {
  qs <- list(.smp_single("b1", "¿Desea continuar?", c("Sí", "No")))
  if (conoce) qs <- c(qs, list(.smp_matrix("b2", "¿Conoce estos servicios?", c("Biblioteca", "Comedor"), c("Sí", "No"))))
  qs <- c(qs, list(.smp_matrix("b3", "¿Ha utilizado estos servicios?", c("Biblioteca", "Comedor"), c("Sí", "No"))))
  .smp_details(survey_id, if (conoce) "Base" else "Sin «¿Conoce?»", qs)
}

test_that("una batería omitida en la fuente no cruza sus filas con la gemela por ordinal", {
  base <- .smp_baterias("BAT")
  fuente <- .smp_baterias("BATF", conoce = FALSE)
  inst_base <- .smp_inst(base)
  al <- .sm_mb_alinear_fuente(inst_base, .smp_inst(fuente))
  expect_setequal(as.character(al$ambiguas$etiqueta), c("Biblioteca", "Comedor"))
  expect_equal(NROW(al$ambiguas), 4L)
  expect_equal(al$n_emparejadas, 1L)
  expect_false(any(c("p2_1", "p2_2") %in% names(al$mapa)))

  responses <- list(.smp_response(fuente, "u1", list(b1 = "Sí", b3 = list(filas = c(Biblioteca = "Sí", Comedor = "No")))))
  out <- .sm_mb_codificar_fuente(details_fuente = fuente, responses = responses,
                                 inst_base = inst_base, survey_id = "BATF")
  # Ni «¿Conoce?» ni «¿Ha utilizado?» de la base reciben las respuestas de la fuente.
  for (v in c("p2_1", "p2_2", "p3_1", "p3_2")) expect_true(is.na(out[[v]][1]), info = v)
  resumen <- .sm_mb_alineacion_resumen(out, "BATF", "Sin «¿Conoce?»")
  expect_length(resumen$ambiguas, 4L)

  diffs <- .sm_mb_compare_to_ref(.sm_mb_question_table(base), .sm_mb_question_table(fuente))
  expect_true("ambiguous" %in% vapply(diffs, function(d) d$kind, ""))
})

# =============================================================================
# 8. Snapshot del refresh: una fuente que es otro instrumento se salta (M3)
# =============================================================================

test_that("el snapshot del refresh no suma las filas de una fuente que es otro instrumento", {
  details <- list(REF = .smp_ref(), OTRA = .smp_otra())
  responses <- list(REF = .smp_responses_ref(), OTRA = .smp_responses_otra())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  spec <- .sm_mb_normalize_survey_specs(.smp_spec_independiente(c("REF", "OTRA")))[[1]]
  snap <- .sm_mb_prepare_refresh_snapshot(sid, "egresados", spec, token = "smp-token-efimero")
  expect_equal(as.character(snap$remote_df$response_id), "rr1")
  otra <- Find(function(f) identical(f$survey_id, "OTRA"), snap$alineacion_fuentes)
  expect_true(otra$excluida)
  expect_equal(otra$n_filas_excluidas, 1L)
})

# =============================================================================
# 9. Base multi-fuente armada por posición: el refresh se bloquea (H3)
# =============================================================================

test_that("una base multi-fuente sin alineación se bloquea con legacy_positional y regenerarla la realinea", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente()[1])
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  # Simula la base armada por posición antes del ADR 0099.
  s <- session_get(sid)
  s$estudio$bases[[base_name]]$sm_alineacion_fuentes <- NULL
  .session_env[[sid]] <- s
  data_antes <- s$estudio$bases[[base_name]]$data_file_id
  responses$FUE <- .smp_responses_fuente()

  plan <- sm_multibase_refresh_plan(sid, token = "smp-token-efimero")
  row <- plan$bases[[1]]
  expect_equal(row$refresh_action, "blocked")
  legacy <- Find(function(d) identical(d$kind, "legacy_positional"), row$structure$diffs)
  expect_equal(legacy$severity, "blocking")
  expect_identical(legacy$pos, 0L)
  expect_match(legacy$message, "regenera la base desde SurveyMonkey", fixed = TRUE)

  out <- sm_multibase_refresh(sid, token = "smp-token-efimero", reapply_codificacion = FALSE)
  expect_match(out$results[[1]]$reason, "antes de emparejar por pregunta", fixed = TRUE)
  expect_equal(session_get(sid)$estudio$bases[[base_name]]$data_file_id, data_antes)

  # Regenerar desde el snapshot realinea todo y guarda la alineación.
  sm_multibase_decision_apply(sid, base_name)
  base <- session_get(sid)$estudio$bases[[base_name]]
  expect_false(is.null(.smp_fuente_de(base, "FUE")))
  inst <- reporte_instrumento(path = get_file(sid, base$xlsform_file_id)$path)
  df <- .smp_base_data(sid, base_name)
  expect_equal(as.character(df[[.smp_var(inst, "¿Cuántos años tiene?")]][as.character(df$response_id) == "rf1"]), "30")
  plan2 <- sm_multibase_refresh_plan(sid, token = "smp-token-efimero")
  expect_false("legacy_positional" %in% vapply(plan2$bases[[1]]$structure$diffs, function(d) d$kind, ""))
})

# =============================================================================
# 10. La alineación solo se escribe cuando la data de la base cambia (M1)
# =============================================================================

test_that("con keep_current el refresh no sobrescribe la alineación; sin él, sí", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  base <- session_get(sid)$estudio$bases[[base_name]]
  guardada <- base$sm_alineacion_fuentes
  otra <- list(fuentes = list(list(survey_id = "X", titulo = "otra")), principal = list())
  actualizar <- function(keep_current) {
    .sm_mb_update_base_refresh_files(
      sid = sid, base_name = base_name,
      inst_meta = get_file(sid, base$xlsform_file_id), data_meta = get_file(sid, base$data_file_id),
      rp_inst = session_get(sid)$rp_inst_sources[[base_name]], rp_data = session_get(sid)$rp_data_sources[[base_name]],
      spec = base$surveymonkey_source_spec, response_filter = base$response_filter,
      source_kind = base$source_kind, keep_current = keep_current,
      choice_order_editor = base$choice_order_editor, alineacion = otra
    )
    session_get(sid)$estudio$bases[[base_name]]$sm_alineacion_fuentes
  }
  expect_identical(actualizar(TRUE), guardada)
  expect_equal(actualizar(FALSE)[[1]]$survey_id, "X")
})

test_that("decision_apply que no reemplaza la data (avance aguas abajo) no toca la alineación", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  responses <- list(REF = .smp_responses_ref(), FUE = .smp_responses_fuente())
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  s <- session_get(sid)
  s$estudio$bases[[base_name]]$sm_alineacion_fuentes <- list(list(survey_id = "centinela"))
  s$estudio$bases[[base_name]]$status <- list(validacion = TRUE)
  .session_env[[sid]] <- s
  data_antes <- s$estudio$bases[[base_name]]$data_file_id

  out <- sm_multibase_decision_apply(sid, base_name)
  expect_false(isTRUE(out$replaced_active))
  base <- session_get(sid)$estudio$bases[[base_name]]
  expect_equal(base$data_file_id, data_antes)
  expect_equal(base$sm_alineacion_fuentes[[1]]$survey_id, "centinela")
})

# =============================================================================
# 11. Opciones sin par de la fuente principal (M2)
# =============================================================================

test_that("la fuente principal cuenta las opciones que su lista no tiene y Revisión las muestra", {
  ref <- .smp_ref()
  inst <- .smp_inst(ref)
  genero <- .smp_var(inst, "¿Cuál es su género?")
  ln <- as.character(inst$survey$list_name[which(inst$survey$name == genero)])
  inst$choices$label[which(inst$choices$list_name == ln & inst$choices$label == "Masculino")] <- "Hombre"
  inst$choices$name[which(inst$choices$list_name == ln & inst$choices$label == "Hombre")] <- "9"
  out <- sm_multibase_api_responses_to_canonical_data(details = ref, responses = .smp_responses_ref(ref),
                                                       inst = inst, survey_id = "REF")
  expect_true(is.na(out[[genero]][1]))
  expect_equal(attr(out, "sm_opciones_sin_par", exact = TRUE)[[genero]], 1L)

  alin <- .sm_mb_alin_registrar(.sm_mb_alin_nuevo(), out, "REF", "Personalizado", "REF")
  base <- .sm_mb_alin_en_base(list(), alin)
  expect_equal(base$sm_opciones_sin_par_principal, list(list(variable = genero, n = 1L)))
  expect_null(base$sm_alineacion_fuentes)
  revision <- .carga_review_fuentes(base)
  expect_length(revision$fuentes, 0L)
  expect_equal(revision$principal$n_opciones_sin_par, 1L)
  expect_equal(revision$principal$opciones_sin_par[[1]]$variable, genero)
})

# =============================================================================
# 12. Caché de instrumentos generados por operación (B5)
# =============================================================================

test_that("el instrumento generado se cachea por survey_id dentro de una operación", {
  llamadas <- 0L
  original <- get("sm_api_xlsform", envir = asNamespace("prosecnurapp"))
  restore <- .smp_mock("sm_api_xlsform", function(...) {
    llamadas <<- llamadas + 1L
    original(...)
  })
  on.exit(restore(), add = TRUE)
  cache <- .sm_mb_cache_operacion()
  a <- .sm_mb_inst_generado(.smp_ref(), cache = cache)
  b <- .sm_mb_inst_generado(.smp_ref(), cache = cache)
  expect_identical(a, b)
  expect_equal(llamadas, 1L)
  .sm_mb_inst_generado(.smp_ref())
  expect_equal(llamadas, 2L)
})

# =============================================================================
# 13. Orden del editor: se fija al importar y el refresh reaplica la receta (A2)
# =============================================================================

.smp_editor_maps_en_sesion <- function(sid, survey_id, maps) {
  session_set(sid, "xlsform_state", list(
    source = list(survey_id = survey_id),
    workbook = list(surveyMonkeyLogic = list(choice_code_maps = maps))
  ))
}

.smp_codigo_base <- function(sid, base_name, label_var, label) {
  base <- session_get(sid)$estudio$bases[[base_name]]
  inst <- reporte_instrumento(path = get_file(sid, base$xlsform_file_id)$path)
  .smp_code(inst, .smp_var(inst, label_var), label)
}

.smp_refresh_con_fila_nueva <- function(sid, responses_env) {
  responses_env$FUE <- .smp_responses_fuente()
  sm_multibase_refresh(sid, token = "smp-token-efimero", reapply_codificacion = FALSE)
}

test_that("import independiente adopta el orden del editor y el refresh conserva esos códigos", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  env <- new.env()
  env$REF <- .smp_responses_ref(); env$FUE <- .smp_responses_fuente()[1]
  restores <- .smp_network_mocks(function() details, function() as.list(env))
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .smp_editor_maps_en_sesion(sid, "REF", .smp_mapas_editor(.smp_inst(.smp_ref())))

  base_name <- .smp_importar(sid)
  base <- session_get(sid)$estudio$bases[[base_name]]
  expect_length(base$choice_order_editor$receta, 2L)
  expect_equal(base$choice_codes_applied_data_file_id, base$data_file_id)
  expect_equal(.smp_codigo_base(sid, base_name, "¿Cuál es su género?", "Femenino"), "1")
  expect_equal(.smp_codigo_base(sid, base_name, "¿Qué servicios usa?", "Préstamo"), "3")

  out <- .smp_refresh_con_fila_nueva(sid, env)
  expect_false(isTRUE(out$results[[1]]$skipped))
  expect_equal(.smp_codigo_base(sid, base_name, "¿Cuál es su género?", "Femenino"), "1")
  expect_equal(.smp_codigo_base(sid, base_name, "¿Qué servicios usa?", "Préstamo"), "3")
  expect_null(session_get(sid)$estudio$bases[[base_name]]$choice_order_editor$editor_distinto)
})

test_that("una base sin receta no adopta el editor en el refresh y declara que el editor difiere", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  env <- new.env()
  env$REF <- .smp_responses_ref(); env$FUE <- .smp_responses_fuente()[1]
  restores <- .smp_network_mocks(function() details, function() as.list(env))
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .smp_importar(sid)
  expect_length(session_get(sid)$estudio$bases[[base_name]]$choice_order_editor$receta, 0L)
  expect_equal(.smp_codigo_base(sid, base_name, "¿Cuál es su género?", "Femenino"), "2")

  .smp_editor_maps_en_sesion(sid, "REF", .smp_mapas_editor(.smp_inst(.smp_ref())))
  out <- .smp_refresh_con_fila_nueva(sid, env)
  expect_false(isTRUE(out$results[[1]]$skipped))
  expect_equal(.smp_codigo_base(sid, base_name, "¿Cuál es su género?", "Femenino"), "2")
  orden <- session_get(sid)$estudio$bases[[base_name]]$choice_order_editor
  expect_true(isTRUE(orden$editor_distinto))
  expect_equal(length(orden$editor_distinto_variables), 2L)
})

test_that("con receta guardada y el editor cambiado, el refresh conserva los códigos y lo declara", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  env <- new.env()
  env$REF <- .smp_responses_ref(); env$FUE <- .smp_responses_fuente()[1]
  restores <- .smp_network_mocks(function() details, function() as.list(env))
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  inst_ref <- .smp_inst(.smp_ref())
  .smp_editor_maps_en_sesion(sid, "REF", .smp_mapas_editor(inst_ref))
  base_name <- .smp_importar(sid)

  # El editor ahora pide otro orden para género (Masculino = 1).
  genero <- .smp_var(inst_ref, "¿Cuál es su género?")
  nuevos <- .smp_mapas_editor(inst_ref)
  nuevos[[1]]$mappings <- list(.smp_item("1", "Masculino", "1"), .smp_item("2", "Femenino", "2"),
                               .smp_item("3", "Otro (especifique)", "3"))
  .smp_editor_maps_en_sesion(sid, "REF", nuevos)
  .smp_refresh_con_fila_nueva(sid, env)

  expect_equal(.smp_codigo_base(sid, base_name, "¿Cuál es su género?", "Femenino"), "1")
  base <- session_get(sid)$estudio$bases[[base_name]]
  expect_true(isTRUE(base$choice_order_editor$editor_distinto))
  expect_equal(unlist(base$choice_order_editor$editor_distinto_variables), genero)
  revision <- .carga_review_orden_editor(base)
  expect_equal(unlist(revision$editor_distinto), genero)
})

test_that("el import de base única y el de bases separadas adoptan el editor como hoy y guardan la receta", {
  details <- list(REF = .smp_ref())
  restores <- .smp_network_mocks(function() details, function() list(REF = .smp_responses_ref()))
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .smp_editor_maps_en_sesion(sid, "REF", .smp_mapas_editor(.smp_inst(.smp_ref())))

  prep <- .carga_sm_prepare_import(sid, list(survey_id = "REF"))
  expect_length(prep$choice_order_editor$adoptadas, 2L)
  expect_length(prep$choice_order_editor$receta, 2L)
  expect_equal(.smp_code(prep$rp_inst, .smp_var(prep$rp_inst, "¿Cuál es su género?"), "Femenino"), "1")

  .carga_import_surveymonkey(sid, list(survey_id = "REF"))
  base <- session_get(sid)$estudio$bases$default
  expect_length(base$choice_order_editor$receta, 2L)
  expect_equal(base$choice_codes_applied_data_file_id, base$data_file_id)
})

# =============================================================================
# 14. decision_apply renueva la marca de códigos aplicados (A1) y round-trip .pulso (M4)
# =============================================================================

test_that("decision_apply renueva la marca: un mapeo confirmado no recodifica dos veces, tampoco al reabrir", {
  details <- list(REF = .smp_ref(), FUE = .smp_fuente())
  env <- new.env()
  env$REF <- .smp_responses_ref(); env$FUE <- .smp_responses_fuente()[1]
  restores <- .smp_network_mocks(function() details, function() as.list(env))
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  inst_ref <- .smp_inst(.smp_ref())
  .smp_editor_maps_en_sesion(sid, "REF", .smp_mapas_editor(inst_ref))
  base_name <- .smp_importar(sid)
  .smp_refresh_con_fila_nueva(sid, env)

  # Mapeo confirmado presente en la base: invierte Masculino/Femenino si se reaplicara.
  genero <- .smp_var(inst_ref, "¿Cuál es su género?")
  s <- session_get(sid)
  s$estudio$bases[[base_name]]$choice_code_mapping <- list(
    version = 1L, confirmed = TRUE, confirmed_at = "2026-10-11T00:00:00Z", n_questions = 1L,
    maps = list(list(variable = genero, type = "select_one", list_name = paste0("lst_", genero), mappings = list(
      .smp_item("1", "Femenino", "2"), .smp_item("2", "Masculino", "1"))))
  )
  .session_env[[sid]] <- s

  sm_multibase_decision_apply(sid, base_name)
  base <- session_get(sid)$estudio$bases[[base_name]]
  expect_equal(base$choice_codes_applied_data_file_id, base$data_file_id)

  archivo <- .smp_base_data(sid, base_name)
  esperado <- as.character(archivo[[genero]])
  relectura <- .carga_normalized_data_for_export(sid, base_name)$data
  expect_equal(as.character(relectura[[genero]]), esperado)
  # rr1 es Masculino: con el orden del editor, código 2.
  expect_equal(esperado[as.character(archivo$response_id) == "rr1"], "2")

  destino <- tempfile(fileext = ".pulso")
  on.exit(unlink(destino), add = TRUE)
  build_pulso(sid, destino, project_name = "smp-alineacion")
  reabierto <- load_pulso(destino)
  on.exit(session_delete(reabierto$session_id), add = TRUE)
  s2 <- session_get(reabierto$session_id)
  expect_equal(as.character(s2$rp_data_sources[[base_name]][[genero]]), esperado)

  # M4: la alineación y la receta viajan en el .pulso.
  base2 <- s2$estudio$bases[[base_name]]
  expect_equal(base2$sm_alineacion_fuentes, base$sm_alineacion_fuentes)
  expect_equal(base2$choice_order_editor$receta, base$choice_order_editor$receta)
  expect_length(base2$choice_order_editor$receta, 2L)
})

# =============================================================================
# 10. El «sí» del consentimiento se decide por la etiqueta (checklist ítem 14)
# =============================================================================

.smp_mapas_consent_invertido <- function(inst_clave) {
  consent <- .smp_var(inst_clave, "¿Desea continuar?")
  list(list(variable = consent, type = "select_one", list_name = paste0("lst_", consent), mappings = list(
    .smp_item("1", "Sí", "2"), .smp_item("2", "No", "1"))))
}

# Encuesta cuya PLATAFORMA trae «No» primero: su código 1 es «No».
.smp_ref_no_primero <- function(survey_id = "REFN", etiquetas = c("No", "Sí, deseo continuar")) {
  .smp_details(survey_id, "Egresados No primero", list(
    .smp_single("a1", "¿Desea continuar?", etiquetas),
    .smp_open("a2", "¿Cuántos años tiene?"),
    .smp_single("a3", "¿Cuál es su género?", .SMP_GENEROS)
  ))
}

test_that("etiquetas afirmativas: sí, acepto, de acuerdo, deseo continuar; nunca las que empiezan por «no»", {
  si <- c("Sí", "si", "SI", "Acepto", "Sí, acepto", "De acuerdo", "Estoy de acuerdo",
          "Sí, deseo continuar", "Autorizo", "Yes", "I agree", "Deseo continuar")
  no <- c("No", "No acepto", "No deseo continuar", "No estoy de acuerdo", "Rechazo", "",
          "1", "Prefiero no responder", "Sigo sin saber")
  expect_true(all(.sm_consent_etiqueta_afirmativa(si)), info = paste(si[!.sm_consent_etiqueta_afirmativa(si)], collapse = ", "))
  expect_false(any(.sm_consent_etiqueta_afirmativa(no)), info = paste(no[.sm_consent_etiqueta_afirmativa(no)], collapse = ", "))
})

test_that("principal reordenada: se queda quien dijo «Sí» (código 2), sale quien dijo «No», y se declara el criterio", {
  ref <- .smp_ref()
  inst_clave <- .smp_inst(ref)
  consent <- .smp_var(inst_clave, "¿Desea continuar?")
  inst <- .smp_inst(ref, .smp_mapas_consent_invertido(inst_clave))
  responses <- list(
    .smp_response(ref, "si1", list(a1 = "Sí", a2 = list(text = "28"))),
    .smp_response(ref, "no1", list(a1 = "No"))
  )
  out <- sm_multibase_api_responses_to_canonical_data(details = ref, responses = responses, inst = inst, survey_id = "REF")
  expect_equal(as.character(out$response_id), "si1")
  expect_equal(as.character(out[[consent]]), "2")
  filtro <- attr(out, "sm_response_filter", exact = TRUE)
  expect_equal(filtro$consent_yes_criterio, "etiqueta")
  expect_equal(unlist(filtro$consent_positive_values), "2")
  expect_equal(filtro$consent_excluded_rows, 1L)
})

test_that("principal con «No» primero en la plataforma (sin editor): «Sí, deseo continuar» = 2 se conserva", {
  ref <- .smp_ref_no_primero()
  inst <- .smp_inst(ref)
  responses <- list(
    .smp_response(ref, "si1", list(a1 = "Sí, deseo continuar", a3 = "Femenino")),
    .smp_response(ref, "no1", list(a1 = "No"))
  )
  out <- sm_multibase_api_responses_to_canonical_data(details = ref, responses = responses, inst = inst, survey_id = "REFN")
  expect_equal(as.character(out$response_id), "si1")
})

test_that("fuente adicional con la lista del consentimiento invertida: se evalúa por etiqueta en su instrumento", {
  ref <- .smp_ref()
  fuente <- .smp_details("FUEN", "Egresados Telefónico No primero", list(
    .smp_single("f1", "¿Desea continuar?", c("No", "Sí")),
    .smp_open("f2", "¿Cuántos años tiene?"),
    .smp_single("f3", "¿Cuál es su género?", .SMP_GENEROS, other = TRUE),
    .smp_multiple("f4", "¿Qué servicios usa?", .SMP_SERVICIOS, other = TRUE),
    .smp_matrix("f5", "Evalúe los servicios", c("Biblioteca", "Comedor"), c("Malo", "Bueno"))
  ))
  responses <- list(
    .smp_response(fuente, "fs1", list(f1 = "Sí", f2 = list(text = "33"), f3 = "Masculino")),
    .smp_response(fuente, "fn1", list(f1 = "No"))
  )
  inst_clave <- .smp_inst(ref)
  inst_base <- .smp_inst(ref, .smp_mapas_consent_invertido(inst_clave))
  out <- .sm_mb_codificar_fuente(details_fuente = fuente, responses = responses, inst_base = inst_base,
                                 survey_id = "FUEN", inst_clave_base = inst_clave)
  expect_equal(as.character(out$response_id), "fs1")
  expect_equal(attr(out, "sm_consentimiento", exact = TRUE)$n_excluidas, 1L)
  expect_equal(attr(out, "sm_response_filter", exact = TRUE)$consent_yes_criterio, "etiqueta")
})

test_that("fuente adicional vacía y fuente excluida no se ven afectadas por el criterio del consentimiento", {
  ref <- .smp_ref()
  inst_base <- .smp_inst(ref)
  vacia <- .sm_mb_codificar_fuente(details_fuente = .smp_fuente(), responses = list(), inst_base = inst_base,
                                   survey_id = "FUE")
  expect_equal(NROW(vacia), 0L)
  otra <- .sm_mb_codificar_fuente(details_fuente = .smp_otra(), responses = .smp_responses_otra(),
                                  inst_base = inst_base, survey_id = "OTRA")
  expect_true(.sm_mb_fuente_es_otro_instrumento(otra))
})

test_that("lista sin etiquetas: respaldo en el código «1» y lo declara", {
  inst <- list(
    survey = data.frame(type = c("select_one lst_c", "text"), name = c("p1", "p2"),
                        label = c("¿Desea continuar con la encuesta?", "Edad"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("lst_c", "lst_c"), name = c("1", "2"), stringsAsFactors = FALSE)
  )
  df <- data.frame(response_id = c("a", "b", "c"), p1 = c("1", "2", "1"), p2 = c("20", "30", "40"),
                   stringsAsFactors = FALSE)
  out <- .sm_mb_filter_effective_consent_df(df, inst, response_filter = list(), consent_var = "p1")
  expect_equal(out$response_id, c("a", "c"))
  filtro <- attr(out, "sm_response_filter", exact = TRUE)
  expect_equal(filtro$consent_yes_criterio, "respaldo_codigo_1")
  expect_equal(filtro$consent_yes_motivo, "sin_etiquetas")

  # Etiquetas sin ninguna afirmativa: también respaldo, con su motivo.
  inst$choices$label <- c("Seguir", "Salir")
  out2 <- .sm_mb_filter_effective_consent_df(df, inst, response_filter = list(), consent_var = "p1")
  expect_equal(out2$response_id, c("a", "c"))
  expect_equal(attr(out2, "sm_response_filter", exact = TRUE)$consent_yes_motivo, "sin_etiqueta_afirmativa")
})

test_that("una base sin consentimiento no cambia: ni filtro ni criterio", {
  inst <- list(
    survey = data.frame(type = c("select_one lst_g", "text"), name = c("p1", "p2"),
                        label = c("¿Cuál es su género?", "Edad"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("lst_g", "lst_g"), name = c("1", "2"),
                         label = c("Masculino", "Femenino"), stringsAsFactors = FALSE)
  )
  df <- data.frame(response_id = c("a", "b"), p1 = c("1", "2"), p2 = c("20", "30"),
                   response_status = "completed", stringsAsFactors = FALSE)
  out <- .sm_mb_filter_effective_consent_df(df, inst, response_filter = list(kept_rows = 2L))
  expect_equal(out$response_id, c("a", "b"))
  expect_identical(attr(out, "sm_response_filter", exact = TRUE), list(kept_rows = 2L))

  policy <- .sm_mb_default_decision_policy(list(), inst)
  expect_equal(policy$consent_var, "")
  decided <- .sm_mb_decision_apply_df(df, inst, policy)
  expect_equal(decided$decision_included, c("1", "1"))
  expect_equal(attr(decided, "sm_decision_audit", exact = TRUE)$consent_yes_criterio, "")
})

test_that("la política de decisiones juzga el consentimiento reordenado por etiqueta, no por el «1» de sus valores", {
  ref <- .smp_ref()
  inst_clave <- .smp_inst(ref)
  consent <- .smp_var(inst_clave, "¿Desea continuar?")
  inst <- .smp_inst(ref, .smp_mapas_consent_invertido(inst_clave))
  df <- data.frame(response_id = c("si", "no"), case_uid = c("REF:si", "REF:no"),
                   response_status = "completed", stringsAsFactors = FALSE)
  df[[consent]] <- c("2", "1")
  policy <- .sm_mb_default_decision_policy(list(), inst)
  policy$consent_var <- consent
  expect_true("1" %in% unlist(policy$consent_yes_values))
  decided <- .sm_mb_decision_apply_df(df, inst, policy)
  # Devuelve solo las incluidas.
  expect_equal(decided$response_id, "si")
  expect_equal(decided$decision_class, "efectiva")
  audit <- attr(decided, "sm_decision_audit", exact = TRUE)
  expect_equal(audit$consent_yes_criterio, "etiqueta")
  expect_equal(audit$completed_with_consent, 1L)
})

test_that("conteo de filas nuevas del refresh: consentimiento por etiqueta en cada fuente, sin red", {
  ref <- .smp_ref_no_primero("REFN", c("No", "Sí"))
  fuente <- .smp_details("FUEN", "Telefónico", list(
    .smp_open("f0", "Indique su código PUCP"),
    .smp_single("f1", "¿Desea continuar?", c("No", "Sí")),
    .smp_open("f2", "¿Cuántos años tiene?")
  ))
  details <- list(REFN = ref, FUEN = fuente)
  responses <- list(
    REFN = list(.smp_response(ref, "r_si", list(a1 = "Sí")), .smp_response(ref, "r_no", list(a1 = "No"))),
    FUEN = list(.smp_response(fuente, "f_si", list(f0 = list(text = "2015"), f1 = "Sí")),
                .smp_response(fuente, "f_no", list(f1 = "No")))
  )
  restores <- .smp_network_mocks(function() details, function() responses)
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  spec <- list(survey_id = "REFN", response_statuses = list("completed"), sources = list(
    list(survey_id = "REFN", response_statuses = list("completed")),
    list(survey_id = "FUEN", response_statuses = list("completed"))
  ))
  refs <- .sm_mb_fetch_filtered_response_refs(spec, token = "smp-token-efimero", inst = .smp_inst(ref))
  ids <- vapply(refs$responses, function(x) x$response_id, "")
  expect_setequal(ids, c("r_si", "f_si"))
})
