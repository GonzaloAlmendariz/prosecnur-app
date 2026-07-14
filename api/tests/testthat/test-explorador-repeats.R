source("setup-load-all.R")

.er_fixture <- function() {
  inst <- list(
    survey = data.frame(
      type = c(
        "begin_group", "calculate", "calculate",
        "select_one yes_no", "select_one yes_no", "select_one yes_no",
        "select_one yes_no", "select_one yes_no", "select_one yes_no",
        "end_group"
      ),
      name = c(
        "rep_servicios", "current_code", "current_label",
        "q_shared", "q_legal", "q_multi", "q_empty", "q_followup",
        "q_mixed", "rep_servicios"
      ),
      label = c(
        "Servicios", "", "", "Compartida", "Solo legal",
        "Legal o salud", "Aplicable sin respuestas", "Follow-up compartido",
        "Mixta", ""
      ),
      relevant = c(
        "", "", "", "", "${current_code} = 'legal'",
        "${current_code} = 'legal' or ${current_code} = 'salud'",
        "${current_code} = 'legal'", "${q_shared} = '1'",
        "${current_code} = 'legal' and ${q_shared} = '1'", ""
      ),
      calculation = c(
        "", "selected-at(${services}, position(..)-1)",
        "jr:choice-name(${current_code}, '${services}')",
        "", "", "", "", "", "", ""
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yes_no", "yes_no"), name = c("1", "2"),
      label = c("Si", "No"), stringsAsFactors = FALSE
    )
  )
  parent_inst <- list(
    survey = data.frame(
      type = "select_multiple services_list", name = "services",
      label = "Servicios recibidos", stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("services_list", "services_list", "services_list"),
      name = c("legal", "salud", "sin_observar"),
      label = c("Asistencia legal canonica", "Salud canonica", "Sin observar"),
      stringsAsFactors = FALSE
    )
  )
  data <- data.frame(
    `_index` = 1:5,
    `_parent_index` = c(1L, 1L, 2L, 3L, 4L),
    current_code = c("legal", "legal", "salud", "desconocido", ""),
    current_label = c("Etiqueta divergente", "Otra divergente", "Salud observada",
                      "Servicio nuevo", ""),
    q_shared = c("1", "2", "1", "1", "2"),
    q_legal = c("1", "", "", "", ""),
    q_multi = c("1", "2", "1", "", ""),
    q_empty = c(NA, NA, NA, NA, NA),
    q_followup = c("1", "", "2", "", ""),
    q_mixed = c(NA, NA, NA, NA, NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  base_meta <- list(
    nombre = "rep_servicios", parent_base = "madre",
    repeat_group = "rep_servicios", link_key = "_parent_index",
    parent_index_key = "_index"
  )
  inv <- .explorar_inventario(data, inst)
  list(data = data, inst = inst, parent_inst = parent_inst,
       base_meta = base_meta, inv = inv)
}

.er_var <- function(built, name) {
  vars <- unlist(lapply(built$secciones, function(s) s$variables), recursive = FALSE)
  hits <- Filter(function(v) identical(as.character(v$name), name), vars)
  if (length(hits)) hits[[1]] else NULL
}

.er_count <- function(variable, code) {
  hits <- Filter(function(x) identical(as.character(x$code), code),
                 variable$counts_by_code)
  if (length(hits)) hits[[1]] else NULL
}

test_that("base normal conserva el payload legacy sin repeat_context", {
  fx <- .er_fixture()
  normal <- fx$base_meta
  normal$parent_base <- NULL
  normal$repeat_group <- NULL
  expect_null(.explorar_repeat_build(
    fx$data, fx$inst, fx$inv, normal, fx$parent_inst
  ))

  legacy <- list(ok = TRUE, base_nombre = "normal", fuente = "raw",
                 n_variables = fx$inv$n_variables, secciones = fx$inv$secciones)
  payload <- legacy
  repeat_info <- .explorar_repeat_build(
    fx$data, fx$inst, fx$inv, normal, fx$parent_inst
  )
  if (!is.null(repeat_info)) payload$repeat_context <- repeat_info$repeat_context
  expect_identical(payload, legacy)
  expect_false("repeat_context" %in% names(payload))
})

test_that("contexto repeat usa choices canonicos, fusiona desconocidos y separa personas", {
  fx <- .er_fixture()
  out <- .explorar_repeat_build(
    fx$data, fx$inst, fx$inv, fx$base_meta, fx$parent_inst
  )
  ctx <- out$repeat_context
  expect_equal(ctx$kind, "instancia")
  expect_equal(ctx$n_instancias, 5L)
  expect_equal(ctx$n_personas, 4L)
  expect_equal(ctx$identity_var, "current_code")
  expect_equal(ctx$label_var, "current_label")
  expect_equal(ctx$conductor_var, "services")
  expect_equal(ctx$unclassified_instances, 1L)
  expect_false("identity" %in% names(ctx))

  codes <- vapply(ctx$options, `[[`, character(1), "code")
  expect_identical(codes, c("legal", "salud", "desconocido"))
  expect_false("__sin_codigo__" %in% codes)
  legal <- ctx$options[[match("legal", codes)]]
  expect_equal(legal$label, "Asistencia legal canonica")
  expect_equal(legal$n_instancias, 2L)
  expect_equal(legal$n_personas, 1L)
  unknown <- ctx$options[[match("desconocido", codes)]]
  expect_equal(unknown$label, "Servicio nuevo")
})

test_that("variables shared, conditional y multicode exponen aplicabilidad estructural", {
  fx <- .er_fixture()
  out <- .explorar_repeat_build(
    fx$data, fx$inst, fx$inv, fx$base_meta, fx$parent_inst
  )
  shared <- .er_var(out, "q_shared")
  legal <- .er_var(out, "q_legal")
  multi <- .er_var(out, "q_multi")
  empty <- .er_var(out, "q_empty")
  identity <- .er_var(out, "current_code")

  expect_equal(shared$repeat_scope, "shared")
  expect_equal(identity$repeat_scope, "identity")
  expect_equal(legal$repeat_scope, "conditional")
  expect_identical(unlist(legal$applicable_codes), "legal")
  expect_setequal(unlist(multi$applicable_codes), c("legal", "salud"))
  expect_equal(multi$applicability_source, "relevant_ast")

  legal_n <- .er_count(legal, "legal")
  salud_n <- .er_count(legal, "salud")
  expect_equal(legal_n$n_aplicables, 2L)
  expect_equal(legal_n$n_validos, 1L)
  expect_equal(legal_n$n_nulos, 1L)
  expect_equal(salud_n$n_aplicables, 0L)
  expect_equal(salud_n$n_nulos, 0L)

  # La variable no desaparece aunque todas sus respuestas aplicables sean NA.
  empty_legal <- .er_count(empty, "legal")
  expect_equal(empty$repeat_scope, "conditional")
  expect_equal(empty_legal$n_aplicables, 2L)
  expect_equal(empty_legal$n_validos, 0L)
  expect_equal(empty_legal$n_nulos, 2L)
})

test_that("relevant completo gobierna elegibilidad y no cuenta followups ineligibles como nulos", {
  fx <- .er_fixture()
  out <- .explorar_repeat_build(
    fx$data, fx$inst, fx$inv, fx$base_meta, fx$parent_inst
  )
  followup <- .er_var(out, "q_followup")
  mixed <- .er_var(out, "q_mixed")

  # No depende de current_code: se muestra en todos los servicios, pero solo las
  # tres filas con q_shared=1 pertenecen a su denominador.
  expect_equal(followup$repeat_scope, "shared")
  expect_equal(followup$applicability_source, "relevant_ast")
  expect_equal(followup$n_aplicables, 3L)
  expect_equal(followup$n_validos, 2L)
  expect_equal(followup$n_nulos, 1L)
  legal_followup <- .er_count(followup, "legal")
  expect_equal(legal_followup$n_instancias, 2L)
  expect_equal(legal_followup$n_aplicables, 1L)
  expect_equal(legal_followup$n_validos, 1L)
  expect_equal(legal_followup$n_nulos, 0L)

  # Relevant mixto: current_code gobierna visibilidad; la conjuncion completa
  # deja una sola fila elegible, aun cuando la variable no tiene observados.
  expect_equal(mixed$repeat_scope, "conditional")
  expect_identical(unlist(mixed$applicable_codes), "legal")
  expect_equal(mixed$applicability_source, "relevant_ast")
  expect_equal(mixed$n_aplicables, 1L)
  expect_equal(mixed$n_validos, 0L)
  expect_equal(mixed$n_nulos, 1L)
  legal_mixed <- .er_count(mixed, "legal")
  expect_equal(legal_mixed$n_aplicables, 1L)
  expect_equal(legal_mixed$n_nulos, 1L)
})

test_that("el inventario legacy permanece y solo suma metadata repeat por variable", {
  fx <- .er_fixture()
  out <- .explorar_repeat_build(
    fx$data, fx$inst, fx$inv, fx$base_meta, fx$parent_inst
  )
  before <- .er_var(list(secciones = fx$inv$secciones), "q_shared")
  after <- .er_var(out, "q_shared")
  expect_identical(after[c("name", "label", "tipo", "n_validos", "n_nulos")],
                   before[c("name", "label", "tipo", "n_validos", "n_nulos")])
  expect_true(all(c("repeat_scope", "applicable_codes", "counts_by_code") %in% names(after)))
})
