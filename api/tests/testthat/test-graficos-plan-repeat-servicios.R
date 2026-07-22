source("setup-load-all.R")

# =============================================================================
# Apertura POR SERVICIO del plan de Gráficos (ADR 0030 repeat groups).
# =============================================================================

# --- Helpers de test --------------------------------------------------------

.svc_test_var <- function(name, label, choices, label_original = label) {
  list(
    name = name,
    label = label,
    label_original = label_original,
    tipo = "select_one",
    choices = lapply(choices, function(pair) list(name = pair[[1]], label = pair[[2]])),
    scale_signature = paste(vapply(choices, function(p) paste0(p[[1]], "=", p[[2]]), character(1)), collapse = "|")
  )
}

.svc_slides_by_type <- function(slides, type) {
  Filter(function(s) identical(.graficos_scalar_chr(s$tipo, ""), type), slides)
}

.svc_graph_slides <- function(slides) {
  .svc_slides_by_type(slides, "p_slide_1_grafico")
}

.svc_graph_filter_code <- function(slide) {
  graf <- (slide$payload %||% list())$grafico %||% list()
  args <- graf$args %||% list()
  .graficos_scalar_chr((args$filtros %||% list())$current_code, "")
}

.svc_graph_note <- function(slide) {
  graf <- (slide$payload %||% list())$grafico %||% list()
  args <- graf$args %||% list()
  .graficos_scalar_chr((args$overrides %||% list())$nota_pie, "")
}

# --- Núcleo puro (sin sesión) -----------------------------------------------

test_that("abre una sección por servicio titulada con el nombre del servicio", {
  vars <- list(
    .svc_test_var("srv_claridad", "Claridad de la información",
                  list(c("muy", "Muy clara"), c("poco", "Poco clara"), c("nada", "Nada clara")))
  )
  data <- data.frame(
    srv_claridad = c("muy", "poco", "muy", "nada", "poco"),
    stringsAsFactors = FALSE
  )
  svc_code <- c("salud", "salud", "legal", "cepr", "salud")
  svc_label <- c("Socios en Salud", "Socios en Salud", "Protección Legal",
                 "CEPR / Cancillería", "Socios en Salud")

  slides <- .graficos_repeat_service_slides_core(
    vars, data, svc_code, svc_label,
    ref_prefix = "rep_servicios",
    profile_id = "acnur_kobo_cruncher_plus"
  )

  sec <- .svc_slides_by_type(slides, "p_slide_seccion")
  titles <- vapply(sec, function(s) .graficos_scalar_chr(s$payload$titulo, ""), character(1))
  # Orden por frecuencia desc, estable: salud (3) > legal (1, primero visto) > cepr (1).
  expect_identical(titles, c("Socios en Salud", "Protección Legal", "CEPR / Cancillería"))

  graphs <- .svc_graph_slides(slides)
  codes <- vapply(graphs, .svc_graph_filter_code, character(1))
  expect_setequal(unique(codes), c("salud", "legal", "cepr"))
  # Cada lámina lleva el filtro por current_code de su servicio.
  expect_true(all(nzchar(codes)))
})

test_that("una srv_* que no aplica a un servicio no genera lámina para ese servicio", {
  vars <- list(
    .svc_test_var("srv_claridad", "Claridad",
                  list(c("si", "Sí"), c("no", "No"))),
    .svc_test_var("srv_salud", "Escucha del personal de salud",
                  list(c("bien", "Bien"), c("mal", "Mal")))
  )
  # srv_salud sólo tiene respuesta en las filas del servicio "salud".
  data <- data.frame(
    srv_claridad = c("si", "no", "si"),
    srv_salud    = c("bien", NA, NA),
    stringsAsFactors = FALSE
  )
  svc_code <- c("salud", "legal", "legal")
  svc_label <- c("Socios en Salud", "Protección Legal", "Protección Legal")

  slides <- .graficos_repeat_service_slides_core(
    vars, data, svc_code, svc_label,
    ref_prefix = "rep_servicios", profile_id = "acnur_kobo_cruncher_plus"
  )
  graphs <- .svc_graph_slides(slides)
  refs_by_code <- lapply(graphs, function(s) {
    graf <- s$payload$grafico
    list(code = .svc_graph_filter_code(s),
         ref = .graficos_scalar_chr(graf$args$var, ""))
  })
  legal_refs <- vapply(Filter(function(r) r$code == "legal", refs_by_code), `[[`, character(1), "ref")
  salud_refs <- vapply(Filter(function(r) r$code == "salud", refs_by_code), `[[`, character(1), "ref")
  # srv_salud sólo aparece bajo "salud", nunca bajo "legal".
  expect_false("rep_servicios$srv_salud" %in% legal_refs)
  expect_true("rep_servicios$srv_salud" %in% salud_refs)
})

test_that("un servicio con label vacío no crea sección vacía", {
  vars <- list(.svc_test_var("srv_claridad", "Claridad", list(c("si", "Sí"), c("no", "No"))))
  data <- data.frame(srv_claridad = c("si", "no", "si"), stringsAsFactors = FALSE)
  svc_code <- c("salud", "sin_label", "salud")
  svc_label <- c("Socios en Salud", "", "Socios en Salud")

  slides <- .graficos_repeat_service_slides_core(
    vars, data, svc_code, svc_label,
    ref_prefix = "rep_servicios", profile_id = "acnur_kobo_cruncher_plus"
  )
  sec <- .svc_slides_by_type(slides, "p_slide_seccion")
  titles <- vapply(sec, function(s) .graficos_scalar_chr(s$payload$titulo, ""), character(1))
  expect_true(all(nzchar(titles)))
  expect_false("" %in% titles)
  # El código sin label no debe filtrarse en ninguna lámina.
  graphs <- .svc_graph_slides(slides)
  expect_false("sin_label" %in% vapply(graphs, .svc_graph_filter_code, character(1)))
})

test_that("el título nunca cae al ref técnico rep_servicios$srv_* (P2)", {
  # Label vacío tras limpiar el token dinámico ${current_label}.
  vars <- list(
    .svc_test_var("srv_x", "", list(c("a", "A"), c("b", "B")),
                  label_original = "${current_label}")
  )
  data <- data.frame(srv_x = c("a", "b"), stringsAsFactors = FALSE)
  svc_code <- c("salud", "salud")
  svc_label <- c("Socios en Salud", "Socios en Salud")

  slides <- .graficos_repeat_service_slides_core(
    vars, data, svc_code, svc_label,
    ref_prefix = "rep_servicios", profile_id = "acnur_kobo_cruncher_plus"
  )
  graphs <- .svc_graph_slides(slides)
  titles <- vapply(graphs, function(s) .graficos_scalar_chr(s$payload$titulo, ""), character(1))
  expect_true(all(nzchar(titles)))
  # Cae al nombre del servicio, jamás al ref técnico.
  expect_false(any(grepl("rep_servicios\\$", titles)))
  expect_true(all(titles == "Socios en Salud"))
})

test_that("la nota de base usa el subconjunto del servicio, no el pooled (P5)", {
  vars <- list(.svc_test_var("srv_claridad", "Claridad", list(c("si", "Sí"), c("no", "No"))))
  data <- data.frame(srv_claridad = c("si", "no", "si", "si", "no"), stringsAsFactors = FALSE)
  svc_code <- c("salud", "salud", "legal", "legal", "legal")
  svc_label <- c("Salud", "Salud", "Legal", "Legal", "Legal")
  # note_fn inyectado: refleja el N del servicio (sum(mask)), nunca el total (5).
  semantics_fn <- function(v, code, mask, label) {
    list(note = sprintf("Base: %d respuestas del servicio", sum(mask)),
         exclude_options = NULL, source_note = "")
  }
  slides <- .graficos_repeat_service_slides_core(
    vars, data, svc_code, svc_label,
    ref_prefix = "rep_servicios", profile_id = "acnur_kobo_cruncher_plus",
    semantics_fn = semantics_fn
  )
  graphs <- .svc_graph_slides(slides)
  notes <- stats::setNames(
    vapply(graphs, .svc_graph_note, character(1)),
    vapply(graphs, .svc_graph_filter_code, character(1))
  )
  expect_true(grepl("Base: 3", notes[["legal"]]))  # 3 filas de legal
  expect_true(grepl("Base: 2", notes[["salud"]]))  # 2 filas de salud
  expect_false(any(grepl("Base: 5", notes)))       # nunca el pooled
})

# --- P3: heredadas de la madre no se grafican a grano instancia -------------

test_that("las variables heredadas de la madre se excluyen de las nativas (P3)", {
  data <- data.frame(
    srv_claridad = c("si", "no"),
    edad_madre = c("30", "45"),
    stringsAsFactors = FALSE
  )
  attr(data$edad_madre, "repeat_inherited") <- TRUE
  inst <- list(
    survey = data.frame(
      type = c("select_one clar_list", "select_one edad_list"),
      name = c("srv_claridad", "edad_madre"),
      parent_inherited = c(FALSE, TRUE),
      stringsAsFactors = FALSE
    )
  )
  stripped <- .repeat_strip_inherited(data, inst)
  native <- .repeat_native_tabulable_vars(
    stripped$data, stripped$inst, exclude = c("current_label", "current_code")
  )
  expect_true("srv_claridad" %in% native)
  expect_false("edad_madre" %in% native)
})

# --- Integración con sesión (plan real) -------------------------------------

.svc_plan_fixture <- function(resolvable = TRUE) {
  sid <- session_create()
  parent <- data.frame(
    `_index` = 1:4,
    mand_Date = as.Date(c("2026-06-26", "2026-06-30", "2026-07-03", "2026-07-06")),
    sexo = c("h", "m", "m", "h"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  parent_inst <- list(
    survey = data.frame(
      type = c("begin_group", "select_one sexo_list", "end_group"),
      name = c("perfil", "sexo", ""),
      label = c("Perfil", "Sexo", ""),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("sexo_list", "sexo_list"),
      name = c("h", "m"), label = c("Hombre", "Mujer"),
      stringsAsFactors = FALSE
    )
  )
  # Base hija: 5 instancias de servicio de 3 personas. current_code/current_label
  # como `calculate` (no graficables) pero presentes como columnas de data.
  code_col <- if (resolvable) {
    c("salud", "salud", "legal", "cepr", "salud")
  } else {
    rep("", 5L)
  }
  label_col <- if (resolvable) {
    c("Socios en Salud", "Socios en Salud", "Protección Legal",
      "CEPR / Cancillería", "Socios en Salud")
  } else {
    rep("", 5L)
  }
  repeat_data <- data.frame(
    `_index` = 101:105,
    `_parent_index` = c(1L, 1L, 2L, 4L, 4L),
    current_code = code_col,
    current_label = label_col,
    srv_claridad = c("muy", "poco", "muy", "nada", "poco"),
    srv_salud = c("bien", "regular", NA, NA, "bien"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  repeat_inst <- list(
    survey = data.frame(
      type = c("begin_repeat", "calculate", "calculate",
               "select_one clar_list", "select_one salud_list", "end_repeat"),
      name = c("rep_servicios", "current_code", "current_label",
               "srv_claridad", "srv_salud", ""),
      label = c("rep_servicios", "", "",
                "Qué tan clara fue la información sobre ${current_label}",
                "El personal de salud te escuchó", ""),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("clar_list", "clar_list", "clar_list",
                    "salud_list", "salud_list", "salud_list"),
      name = c("muy", "poco", "nada", "bien", "regular", "mal"),
      label = c("Muy clara", "Poco clara", "Nada clara", "Bien", "Regular", "Mal"),
      stringsAsFactors = FALSE
    )
  )
  attr(repeat_inst, "repeat_grain") <- list(
    kind = "instancia", n_instancias = 5L, n_personas = 3L,
    parent_base = "principal", repeat_group = "rep_servicios", base_name = "rep_servicios"
  )
  estudio_add_base(
    sid, "principal", "xls-main", "data-main", "xlsx",
    parent, parent_inst, nrow(parent), ncol(parent),
    extra_meta = list(source_kind = "kobo", source_title = "PDM ACNUR")
  )
  estudio_add_base(
    sid, "rep_servicios", "xls-repeat", "data-repeat", "xlsx",
    repeat_data, repeat_inst, nrow(repeat_data), ncol(repeat_data),
    extra_meta = list(
      source_kind = "kobo_repeat", source_title = "Servicios recibidos",
      parent_base = "principal", repeat_group = "rep_servicios",
      link_key = "_parent_index", parent_index_key = "_index"
    )
  )
  state <- session_get(sid)
  state$estudio$nombre <- "PDM de ACNUR"
  session_set(sid, "estudio", state$estudio)
  session_set(sid, "project_path", "/tmp/ACNUR_PDM_svc.pulso")
  sid
}

.svc_plan_slides <- function(res) .normalize_plan(res$plan)$slides %||% list()

.svc_plan_section_titles <- function(slides) {
  sec <- Filter(function(s) identical(.graficos_scalar_chr(s$tipo, ""), "p_slide_seccion"), slides)
  vapply(sec, function(s) .graficos_scalar_chr(s$payload$titulo, ""), character(1))
}

.svc_plan_graph_refs_codes <- function(slides) {
  out <- list()
  for (s in slides) {
    payload <- .as_json_list(s$payload) %||% list()
    for (value in payload) {
      graf <- .as_json_list(value)
      if (is.null(graf$graficador)) next
      args <- .as_json_list(graf$args) %||% list()
      out[[length(out) + 1L]] <- list(
        ref = .graficos_scalar_chr(args$var, ""),
        code = .graficos_scalar_chr((args$filtros %||% list())$current_code, ""),
        nota = .graficos_scalar_chr((.as_json_list(args$overrides) %||% list())$nota_pie, "")
      )
    }
  }
  out
}

test_that("el plan real abre secciones por servicio con títulos de nombre de servicio", {
  sid <- .svc_plan_fixture(resolvable = TRUE)
  res <- .graficos_suggested_plan(sid, list(
    profile_id = "acnur_kobo_cruncher_plus", acnur_mode = "general",
    include_coverage_maps = FALSE, comparison_mode = "none"
  ))
  slides <- .svc_plan_slides(res)
  titles <- .svc_plan_section_titles(slides)
  expect_true(all(c("Socios en Salud", "Protección Legal", "CEPR / Cancillería") %in% titles))

  refs <- .svc_plan_graph_refs_codes(slides)
  srv_refs <- Filter(function(r) grepl("srv_", r$ref), refs)
  expect_true(length(srv_refs) > 0)
  # Toda lámina de srv_* del repeat lleva filtro por current_code.
  expect_true(all(vapply(srv_refs, function(r) nzchar(r$code), logical(1))))
  # srv_salud sólo bajo salud (única con respuestas ahí).
  salud_srv <- Filter(function(r) r$ref == "rep_servicios$srv_salud", refs)
  expect_true(all(vapply(salud_srv, function(r) r$code == "salud", logical(1))))
})

test_that("la nota de base por servicio refleja el N del servicio, no el pooled 668/5 (P5)", {
  sid <- .svc_plan_fixture(resolvable = TRUE)
  res <- .graficos_suggested_plan(sid, list(
    profile_id = "acnur_kobo_cruncher_plus", acnur_mode = "general",
    include_coverage_maps = FALSE, comparison_mode = "none"
  ))
  refs <- .svc_plan_graph_refs_codes(.svc_plan_slides(res))
  clar <- Filter(function(r) r$ref == "rep_servicios$srv_claridad", refs)
  notes_by_code <- stats::setNames(
    vapply(clar, function(r) r$nota, character(1)),
    vapply(clar, function(r) r$code, character(1))
  )
  # salud tiene 3 filas; la nota nunca debe declarar el total pooled de 5.
  expect_true(nzchar(notes_by_code[["salud"]]))
  expect_false(any(grepl("de 5 ", notes_by_code)))
  # La nota menciona el servicio.
  expect_true(grepl("Socios en Salud", notes_by_code[["salud"]]))
})

test_that("degrada a pooled a grano instancia cuando el servicio no se resuelve (P4)", {
  sid <- .svc_plan_fixture(resolvable = FALSE)
  res <- .graficos_suggested_plan(sid, list(
    profile_id = "acnur_kobo_cruncher_plus", acnur_mode = "general",
    include_coverage_maps = FALSE, comparison_mode = "none"
  ))
  slides <- .svc_plan_slides(res)
  titles <- .svc_plan_section_titles(slides)
  # Sin servicios resueltos: no hay secciones por servicio.
  expect_false(any(c("Socios en Salud", "Protección Legal", "CEPR / Cancillería") %in% titles))
  # Pero las srv_* siguen graficándose (pooled), sin filtro por servicio.
  refs <- .svc_plan_graph_refs_codes(slides)
  srv_refs <- Filter(function(r) grepl("srv_", r$ref), refs)
  expect_true(length(srv_refs) > 0)
  expect_true(all(vapply(srv_refs, function(r) !nzchar(r$code), logical(1))))
})
