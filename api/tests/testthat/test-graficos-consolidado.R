library(testthat)

.gcc_test_file <- function(s, base, kind) {
  file_id <- paste(base, kind, sep = "-")
  path <- file.path(s$dir, "uploads", paste0(file_id, ".xlsx"))
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  writeBin(charToRaw(paste(base, kind, sep = "\r")), path)
  s$files[[file_id]] <- list(
    file_id = file_id, kind = kind, original_name = basename(path),
    path = path, size = file.info(path)$size, ext = "xlsx"
  )
  list(state = s, file_id = file_id)
}

.gcc_test_inst <- function(variable, label, list_name) {
  list(
    survey = data.frame(
      type = paste("select_one", list_name),
      type_base = "select_one",
      name = variable,
      label = label,
      list_name = list_name,
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep(list_name, 4),
      name = c("1", "2", "3", "4"),
      label = c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

.gcc_test_setup <- function(include_egresados = FALSE) {
  sid <- session_create()
  s <- session_get(sid)
  actors <- c(docentes = "Docentes", estudiantes = "Estudiantes", administrativos = "Administrativos")
  vars <- c(docentes = "p_sat", estudiantes = "q_sat", administrativos = "r_sat")
  if (isTRUE(include_egresados)) {
    actors <- c(actors, egresados = "Egresados")
    vars <- c(vars, egresados = "s_sat")
  }
  s$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion"))
  s$estudio <- list(
    nombre = "ACRDCONTA",
    processing_mode = "independent_siblings",
    sibling_family_id = "family-acrdconta",
    active_base = "docentes",
    bases = list()
  )
  s$files <- list()
  s$rp_data_sources <- list()
  s$rp_inst_sources <- list()
  s$codif_por_base <- list()
  s$analitica_config_por_base <- list()
  s$analitica_status_por_base <- list()
  for (base in names(actors)) {
    data_file <- .gcc_test_file(s, base, "data_adaptada")
    s <- data_file$state
    inst_file <- .gcc_test_file(s, base, "instrumento_adaptado")
    s <- inst_file$state
    variable <- vars[[base]]
    inst <- .gcc_test_inst(variable, "Satisfaccion con el servicio", paste0("likert_", base))
    dat <- data.frame(
      value = c("1", "2", "3", "4", "4"),
      response_id = paste0(base, "-", seq_len(5)),
      stringsAsFactors = FALSE
    )
    names(dat)[[1]] <- variable
    s$rp_data_sources[[base]] <- dat
    s$rp_inst_sources[[base]] <- inst
    s$estudio$bases[[base]] <- list(
      nombre = base,
      data_file_id = data_file$file_id,
      xlsform_file_id = inst_file$file_id,
      n_filas = nrow(dat),
      source_alias = actors[[base]],
      source_title = actors[[base]],
      project_kind = "acreditacion",
      profile_family = "acreditacion",
      processing_intake_entry_id = paste0("entry-", base),
      sibling_family_id = "family-acrdconta",
      instrument_revision_id = paste0("revision-", base),
      batch_fingerprint = "batch-1",
      response_filter = list(
        source = "persisted_case_rollup",
        counts_in_advance = TRUE,
        platform_state = "Completa",
        advancement = "effective",
        selected_rows = nrow(dat)
      ),
      traceability = list(
        snapshot_synced_at = "2026-07-20T10:00:00Z",
        snapshot_hash = paste(rep("b", 64), collapse = ""),
        cache_token_sha256 = paste(rep("c", 64), collapse = ""),
        selection_sha256 = paste(rep("d", 64), collapse = "")
      ),
      variables_extra_checksum = paste(rep("a", 64), collapse = ""),
      variables_extra_incluidas = list(),
      validacion = list(
        plan_result = list(plan = data.frame(rule = "required")),
        evaluacion = list(resumen = data.frame(rule = "required", n = 0L)),
        limpieza_draft = list(),
        limpieza_preview = list(data_final = dat, impact = list(cells_changed = 0L)),
        limpieza_artifacts = list(finalized_at = "2026-07-20T10:00:00Z")
      )
    )
    s$codif_por_base[[base]] <- list(aplicado = TRUE, familias_generated = TRUE)
    s$analitica_config_por_base[[base]] <- list(
      fuente_preferida = "adaptados",
      ponderacion = list(enabled = FALSE)
    )
    s$analitica_status_por_base[[base]] <- list(
      analitica_prep_ok = TRUE,
      analitica_frecuencias_ok = TRUE,
      analitica_cruces_ok = TRUE
    )
  }
  s$rp_data <- s$rp_data_sources$docentes
  s$rp_inst <- s$rp_inst_sources$docentes
  s$analitica_prep_ok <- TRUE
  s$analitica_frecuencias_ok <- TRUE
  s$analitica_cruces_ok <- TRUE
  .session_env[[sid]] <- s
  catalog <- processing_release_get(sid)
  for (entry in catalog$entries) {
    processing_release_approve(sid, entry$base, entry$input_fingerprint)
  }
  sid
}

.gcc_test_api_error <- function(expr) tryCatch(expr, api_error = function(e) e)

.gcc_test_graph_specs <- function(plan) {
  unlist(lapply(plan$slides %||% list(), function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    Filter(function(item) is.list(item) && !is.null(item$graficador), payload)
  }), recursive = FALSE)
}

.gcc_test_with_comparison_refs <- function(plan, refs) {
  slides <- plan$slides %||% list()
  for (slide_idx in seq_along(slides)) {
    payload <- (slides[[slide_idx]] %||% list())$payload %||% list()
    for (slot in names(payload)) {
      graph <- payload[[slot]]
      if (!is.list(graph) ||
          !identical(graph$graficador %||% "", "p_barras_multiapiladas") ||
          !identical((graph$args %||% list())$modo %||% "", "var_cruce")) next
      graph$args$vars <- stats::setNames(list(refs), "satisfaccion")
      payload[[slot]] <- graph
      slides[[slide_idx]]$payload <- payload
      plan$slides <- slides
      return(plan)
    }
  }
  stop("El plan de prueba no contiene una comparacion multifuente.")
}

.gcc_test_release_projection <- function(sid) {
  lapply(processing_release_get(sid)$entries, function(entry) list(
    base = entry$base,
    status = entry$status,
    approved = entry$approved,
    input_fingerprint = entry$input_fingerprint
  ))
}

.gcc_test_coding_projection <- function(sid) {
  coding <- session_get(sid)$codif_por_base %||% list()
  lapply(sort(names(coding)), function(base) list(
    base = base,
    aplicado = isTRUE(coding[[base]]$aplicado),
    familias_generated = isTRUE(coding[[base]]$familias_generated),
    state_sha256 = .processing_release_hash(coding[[base]])
  ))
}

test_that("preflight usa todas las releases sin cambiar active_base", {
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)
  before <- session_get(sid)

  preflight <- graficos_consolidado_preflight(sid)

  expect_true(preflight$ready)
  expect_equal(unlist(preflight$source_order), c("docentes", "estudiantes", "administrativos"))
  expect_equal(length(preflight$releases), 3L)
  refs <- .graficos_collect_plan_refs(preflight$plan)
  expect_true(length(refs) >= 3L)
  expect_true(all(grepl("^[^$]+\\$[^$]+$", refs)))
  expect_true(any(vapply(.gcc_test_graph_specs(preflight$plan), function(graf) {
    identical(graf$graficador, "p_barras_multiapiladas") &&
      identical((graf$args %||% list())$modo, "var_cruce")
  }, logical(1))))
  expect_gt(preflight$n_comparison_slides, 0L)
  expect_identical(session_get(sid), before)
})

test_that("preflight consolidado repetido preserva releases y codificacion aprobadas", {
  sid <- .gcc_test_setup(include_egresados = TRUE)
  on.exit(session_delete(sid), add = TRUE)
  releases_before <- .gcc_test_release_projection(sid)
  coding_before <- .gcc_test_coding_projection(sid)

  first <- graficos_consolidado_preflight(sid)
  releases_after_first <- .gcc_test_release_projection(sid)
  coding_after_first <- .gcc_test_coding_projection(sid)
  second <- graficos_consolidado_preflight(sid)

  expect_true(first$ready)
  expect_identical(releases_after_first, releases_before)
  expect_identical(coding_after_first, coding_before)
  expect_true(second$ready)
  expect_identical(.gcc_test_release_projection(sid), releases_before)
  expect_identical(.gcc_test_coding_projection(sid), coding_before)
  expect_true(all(vapply(releases_before, function(entry) {
    identical(entry$status, "approved") && isTRUE(entry$approved)
  }, logical(1))))
})

test_that("preflight bloquea una variable inexistente antes del job", {
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)
  suggested <- graficos_consolidado_preflight(sid)
  plan <- .gcc_test_with_comparison_refs(
    suggested$plan,
    c("docentes$p_sat", "estudiantes$variable_ausente")
  )

  preflight <- graficos_consolidado_preflight(sid, config = list(plan = plan))
  blockers <- Filter(
    function(item) identical(item$code, "unknown_variable_reference"),
    preflight$blockers
  )

  expect_false(preflight$ready)
  expect_length(blockers, 1L)
  expect_equal(blockers[[1]]$references[[1]]$ref, "estudiantes$variable_ausente")
  expect_equal(blockers[[1]]$references[[1]]$source, "estudiantes")
  expect_equal(blockers[[1]]$references[[1]]$variable, "variable_ausente")
  expect_true(nzchar(blockers[[1]]$references[[1]]$slide_id))
  expect_equal(
    .gcc_test_api_error(graficos_consolidado_start(sid, config = list(plan = plan)))$code,
    "E_GRAFICOS_CONSOLIDADO_NOT_READY"
  )
})

test_that("preflight bloquea comparaciones con escala codigo-etiqueta incompatible", {
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)
  suggested <- graficos_consolidado_preflight(sid)
  plan <- .gcc_test_with_comparison_refs(
    suggested$plan,
    c("docentes$p_sat", "estudiantes$q_sat")
  )
  s <- session_get(sid)
  s$rp_inst_sources$docentes$survey$list_name[] <- "likert_compartida"
  s$rp_inst_sources$docentes$choices$list_name[] <- "likert_compartida"
  s$rp_inst_sources$estudiantes$survey$list_name[] <- "likert_compartida"
  s$rp_inst_sources$estudiantes$choices$list_name[] <- "likert_compartida"
  s$rp_inst_sources$estudiantes$choices$label[[1]] <- "Totalmente en desacuerdo"
  .session_env[[sid]] <- s

  preflight <- graficos_consolidado_preflight(sid, config = list(plan = plan))
  blockers <- Filter(
    function(item) identical(item$code, "incompatible_comparison_scale"),
    preflight$blockers
  )

  expect_false(preflight$ready)
  expect_length(blockers, 1L)
  expect_equal(
    unlist(blockers[[1]]$refs),
    c("docentes$p_sat", "estudiantes$q_sat")
  )
  expect_true(nzchar(blockers[[1]]$slide_id))
  expect_match(blockers[[1]]$message, "escala", ignore.case = TRUE)
})

test_that("una release stale bloquea antes de encolar", {
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$analitica_config_por_base$docentes$ponderacion <- list(enabled = TRUE)
  .session_env[[sid]] <- s
  before <- session_get(sid)

  # La config de ponderacion incompleta de arriba es solo un MARCADOR de
  # staleness; dispara legitimamente el warning "configurada pero no aplicada"
  # del contrato del sello (reporte_ponderacion_sello.R), que aqui no es el
  # objeto bajo prueba.
  preflight <- suppressWarnings(graficos_consolidado_preflight(sid))
  err <- .gcc_test_api_error(suppressWarnings(graficos_consolidado_start(sid)))

  release_blocker <- Filter(
    function(x) identical(x$code, "processing_release_not_approved"),
    preflight$blockers
  )[[1]]
  docentes <- Filter(
    function(item) identical(item$base, "docentes"),
    release_blocker$requirements
  )[[1]]

  expect_false(preflight$ready)
  expect_true(any(vapply(preflight$blockers, function(x) x$code == "processing_release_not_approved", logical(1))))
  expect_identical(docentes$status, "stale")
  expect_length(docentes$blockers, 0L)
  expect_equal(err$code, "E_GRAFICOS_CONSOLIDADO_NOT_READY")
  expect_identical(session_get(sid), before)
})

test_that("preflight explica el requisito pendiente de cada actor", {
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio$bases$estudiantes$validacion$evaluacion <- NULL
  .session_env[[sid]] <- s

  preflight <- graficos_consolidado_preflight(sid)
  release_blocker <- Filter(
    function(x) identical(x$code, "processing_release_not_approved"),
    preflight$blockers
  )[[1]]
  estudiantes <- Filter(
    function(item) identical(item$base, "estudiantes"),
    release_blocker$requirements
  )[[1]]

  expect_false(preflight$ready)
  expect_identical(estudiantes$actor, "Estudiantes")
  expect_identical(estudiantes$status, "stale")
  expect_true("validation_pending" %in% vapply(estudiantes$blockers, `[[`, character(1), "code"))
})

test_that("runner genera un unico PPTX multifuente legible", {
  skip_if_not_installed("officer")
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)
  preflight <- graficos_consolidado_preflight(sid)
  recipe <- list(
    plan = preflight$plan,
    presets = list(),
    paletas = list(),
    icon_registry = list(),
    auto_otros_slides = TRUE,
    input_fingerprint = preflight$input_fingerprint,
    releases = preflight$releases,
    source_order = preflight$source_order,
    plan_sha256 = preflight$plan_sha256
  )
  td <- tempfile("gcc_render_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  data_path <- file.path(td, "data.rds")
  inst_path <- file.path(td, "inst.rds")
  recipe_path <- file.path(td, "recipe.rds")
  output <- file.path(td, "consolidado.pptx")
  saveRDS(preflight$sources$data_sources, data_path)
  saveRDS(preflight$sources$inst_sources, inst_path)
  saveRDS(recipe, recipe_path)
  template <- .graficos_resolve_template_pptx(config = list())

  result <- graficos_consolidado_job_runner(
    data_path = data_path,
    inst_path = inst_path,
    recipe_path = recipe_path,
    template_pptx = template,
    template_id = "generic_16_9",
    result_path = output,
    progress_path = file.path(td, "progress.json")
  )
  deck <- officer::read_pptx(output)

  expect_true(file.exists(output))
  expect_gt(file.info(output)$size, 0)
  expect_equal(result$n_slides, length(deck))
  expect_gt(result$n_slides, 0L)

  artifacts <- .graficos_consolidado_register_artifacts(sid, output, result)
  roles <- vapply(artifacts$artifacts, `[[`, character(1), "role")
  expect_equal(sum(roles == "manifest"), 1L)
  manifest_meta <- session_get(sid)$files[[artifacts$manifest_file_id]]
  manifest <- jsonlite::read_json(manifest_meta$path, simplifyVector = FALSE)
  expect_equal(manifest$schema, "graficos_consolidado_manifest/v1")
  expect_equal(length(manifest$releases), 3L)
  expect_match(manifest$artifact$sha256, "^[0-9a-f]{64}$")
  expect_equal(manifest$releases[[1]]$cut$batch_fingerprint, "batch-1")
  expect_equal(manifest$releases[[1]]$cut$snapshot_synced_at, "2026-07-20T10:00:00Z")
  expect_match(manifest$releases[[1]]$cut$snapshot_sha256, "^[0-9a-f]{64}$")
  expect_match(manifest$releases[[1]]$cut$selection_sha256, "^[0-9a-f]{64}$")
})

test_that("runner conserva cuatro actores en un unico PPTX", {
  skip_if_not_installed("officer")
  sid <- .gcc_test_setup(include_egresados = TRUE)
  on.exit(session_delete(sid), add = TRUE)
  preflight <- graficos_consolidado_preflight(sid)
  expect_true(preflight$ready)
  expect_equal(length(preflight$releases), 4L)
  expect_equal(unlist(preflight$source_order), c("docentes", "estudiantes", "administrativos", "egresados"))
  recipe <- list(
    plan = preflight$plan,
    presets = list(),
    paletas = list(),
    icon_registry = list(),
    auto_otros_slides = TRUE,
    input_fingerprint = preflight$input_fingerprint,
    releases = preflight$releases,
    source_order = preflight$source_order,
    plan_sha256 = preflight$plan_sha256
  )
  td <- tempfile("gcc_render_four_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  data_path <- file.path(td, "data.rds")
  inst_path <- file.path(td, "inst.rds")
  recipe_path <- file.path(td, "recipe.rds")
  output <- file.path(td, "consolidado-cuatro-actores.pptx")
  saveRDS(preflight$sources$data_sources, data_path)
  saveRDS(preflight$sources$inst_sources, inst_path)
  saveRDS(recipe, recipe_path)

  result <- graficos_consolidado_job_runner(
    data_path = data_path,
    inst_path = inst_path,
    recipe_path = recipe_path,
    template_pptx = .graficos_resolve_template_pptx(config = list()),
    template_id = "generic_16_9",
    result_path = output,
    progress_path = file.path(td, "progress.json")
  )

  expect_true(file.exists(output))
  expect_gt(file.info(output)$size, 0)
  expect_equal(result$n_slides, length(officer::read_pptx(output)))
  expect_equal(length(result$releases), 4L)
  expect_gt(result$n_slides, 0L)
})

test_that("preflight consume exclusiones y denominador de la revision", {
  skip_if_not_installed("officer")
  sid <- .gcc_test_setup(include_egresados = TRUE)
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  revision_id <- "revision-egresados"
  s$instrument_revisions <- list()
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    xlsform_file_id = s$estudio$bases$egresados$xlsform_file_id,
    logic_audit = list(source_sha256 = paste(rep("e", 64), collapse = "")),
    source = list(provenance = list(
      proposal_schema = "acrdconta_logic_proposal/v3",
      analysis_excluded_codes = list(p12 = list("99")),
      denominator_rules = list(p12 = list(
        eligible_if = "${p10} = '1'",
        exclude_codes = list("99"),
        exclude_empty = TRUE,
        zero_denominator = "report_na_with_warning"
      )),
      ppt_plan_defaults = list(p12 = list(
        excluir_opciones = list("99", "Prefiero no responder"),
        base = "valid_after_exclusions"
      )),
      special_values = list(p12 = list(list(
        code = "99",
        label = "Prefiero no responder",
        role = "nonresponse",
        include_in_valid_denominator = FALSE
      )))
    ))
  )
  s$rp_data_sources$egresados <- data.frame(
    p10 = c("1", "1", "2"),
    p12 = c("99", "", "1"),
    response_id = paste0("egresados-", 1:3),
    stringsAsFactors = FALSE
  )
  s$rp_inst_sources$egresados <- list(
    survey = data.frame(
      type = c("select_one yes_no", "select_one income"),
      type_base = c("select_one", "select_one"),
      name = c("p10", "p12"),
      label = c("Trabaja actualmente", "Ingreso mensual"),
      list_name = c("yes_no", "income"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("yes_no", 2), rep("income", 9)),
      name = c("1", "2", as.character(c(1:8, 99))),
      label = c("Si", "No", paste("Tramo", 1:8), "Prefiero no responder"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  s$processing_releases <- list()
  .session_env[[sid]] <- s
  catalog <- processing_release_get(sid)
  for (entry in catalog$entries) {
    processing_release_approve(sid, entry$base, entry$input_fingerprint)
  }

  preflight <- graficos_consolidado_preflight(sid)
  specs <- .gcc_test_graph_specs(preflight$plan)
  income <- Filter(function(graf) {
    "egresados$p12" %in% .graficos_collect_refs_from_args((graf %||% list())$args %||% list())
  }, specs)

  expect_true(preflight$ready)
  expect_length(income, 1L)
  expect_type(income[[1]]$args$excluir_opciones, "character")
  expect_equal(income[[1]]$args$excluir_opciones, c("99", "Prefiero no responder"))
  expect_equal(income[[1]]$args$filtros$p10, "1")
  expect_true(any(grepl("methodology_zero_denominator.*egresados\\$p12", unlist(preflight$warnings))))
  egresados_release <- Filter(function(x) identical(x$base, "egresados"), preflight$releases)[[1]]
  expect_match(egresados_release$methodology_sha256, "^[0-9a-f]{64}$")

  recipe <- list(
    plan = preflight$plan,
    presets = list(),
    paletas = list(),
    icon_registry = list(),
    auto_otros_slides = TRUE,
    input_fingerprint = preflight$input_fingerprint,
    releases = preflight$releases,
    source_order = preflight$source_order,
    plan_sha256 = preflight$plan_sha256
  )
  td <- tempfile("gcc_methodology_render_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  data_path <- file.path(td, "data.rds")
  inst_path <- file.path(td, "inst.rds")
  recipe_path <- file.path(td, "recipe.rds")
  output <- file.path(td, "consolidado-metodologia.pptx")
  saveRDS(preflight$sources$data_sources, data_path)
  saveRDS(preflight$sources$inst_sources, inst_path)
  saveRDS(recipe, recipe_path)

  graficos_consolidado_job_runner(
    data_path = data_path,
    inst_path = inst_path,
    recipe_path = recipe_path,
    template_pptx = .graficos_resolve_template_pptx(config = list()),
    template_id = "generic_16_9",
    result_path = output,
    progress_path = file.path(td, "progress.json")
  )
  expect_true(file.exists(output))
})

test_that("runner pasa template_id transitorio al renderer sin leerlo de recipe", {
  td <- tempfile("gcc_template_identity_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  data_path <- file.path(td, "data.rds")
  inst_path <- file.path(td, "inst.rds")
  recipe_path <- file.path(td, "recipe.rds")
  output <- file.path(td, "consolidado.pptx")
  saveRDS(list(), data_path)
  saveRDS(list(), inst_path)
  recipe <- list(
    plan = list(slides = list()),
    presets = list(),
    paletas = list(),
    auto_otros_slides = FALSE,
    input_fingerprint = "fingerprint",
    releases = list(),
    source_order = list(),
    plan_sha256 = "plan",
    presets_floor = NULL
  )
  saveRDS(recipe, recipe_path)
  captured <- NULL

  result <- testthat::with_mocked_bindings(
    graficos_consolidado_job_runner(
      data_path = data_path,
      inst_path = inst_path,
      recipe_path = recipe_path,
      template_pptx = "plantilla-transitoria.pptx",
      template_id = "acnur_16_9",
      result_path = output,
      progress_path = file.path(td, "progress.json")
    ),
    job_progress_writer = function(...) function(...) invisible(NULL),
    .graficos_palette_env = function(...) new.env(parent = emptyenv()),
    .build_presets = function(...) list(),
    p_plan = function(slides) list(slides = slides),
    reporte_ppt_plan = function(...) {
      captured <<- list(...)
      file.create(captured$path_ppt)
      invisible(list())
    },
    .graficos_presets_floor_compare = function(...) list(status = "same"),
    .package = "prosecnurapp"
  )

  expect_false("template_id" %in% names(readRDS(recipe_path)))
  expect_identical(captured$template_id, "acnur_16_9")
  expect_identical(captured$template_pptx, "plantilla-transitoria.pptx")
  expect_identical(result$path, output)
})

test_that("start persiste receta global y encola exactamente un job", {
  skip_if_not_installed("png")
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)
  active_before <- session_get(sid)$estudio$active_base
  captured <- NULL
  icon_path <- file.path(session_get(sid)$dir, "icono-consolidado.png")
  png::writePNG(array(1, dim = c(2, 2, 4)), icon_path)
  icon_meta <- .register_output_file(
    sid,
    "graficos_icon",
    icon_path,
    original_name = "icono-consolidado.png"
  )
  config <- list(
    template_id = "acnur_16_9",
    iconos = list(list(
      id = "ico-consolidado",
      file_id = icon_meta$file_id,
      path = icon_meta$path
    ))
  )

  result <- testthat::with_mocked_bindings(
    graficos_consolidado_start(sid, config = config),
    job_submit = function(...) {
      captured <<- list(...)
      "job-consolidado-1"
    },
    .package = "prosecnurapp"
  )

  s <- session_get(sid)
  expect_equal(result$job_id, "job-consolidado-1")
  expect_equal(captured$kind, "graficos.ppt_consolidado")
  expect_equal(s$graficos_consolidado$schema, "graficos_consolidado/v1")
  expect_equal(length(s$graficos_consolidado$releases), 3L)
  expect_equal(s$estudio$active_base, active_before)
  expect_equal(.pulso_strip_caches(s)$graficos_consolidado$input_fingerprint, result$input_fingerprint)
  expect_null(s$graficos_consolidado$icon_registry)
  expect_null(s$graficos_consolidado$config$iconos[[1]]$path)
  expect_equal(s$graficos_consolidado$config$iconos[[1]]$file_id, icon_meta$file_id)
  expect_false("template_id" %in% names(s$graficos_consolidado))
  expect_identical(captured$args$template_id, "acnur_16_9")

  runtime_recipe <- readRDS(captured$args$recipe_path)
  expect_false("template_id" %in% names(runtime_recipe))
  expect_equal(runtime_recipe$icon_registry[["ico-consolidado"]], icon_meta$path)
  expect_equal(runtime_recipe$icon_registry[[icon_meta$file_id]], icon_meta$path)
})

test_that("job real genera y registra un PPTX con un unico manifiesto", {
  skip_if_not_installed("callr")
  skip_if_not_installed("officer")
  api_dir <- normalizePath(testthat::test_path("..", ".."), mustWork = TRUE)
  withr::local_envvar(c(
    PULSO_API_DIR = api_dir,
    PULSO_REPO_ROOT = dirname(api_dir)
  ))
  sid <- .gcc_test_setup()
  on.exit({
    jobs_kill_all()
    session_delete(sid)
  }, add = TRUE)

  started <- graficos_consolidado_start(sid)
  deadline <- Sys.time() + 90
  repeat {
    job <- job_poll(started$job_id)
    if (!identical(job$status, "running")) break
    if (Sys.time() > deadline) fail("El PPT consolidado no termino dentro de 90 segundos.")
    Sys.sleep(0.2)
  }

  if (!identical(job$status, "done")) {
    fail(sprintf("El job consolidado termino en %s: %s", job$status, job$error %||% "sin detalle"))
  }
  expect_true(file.exists(job$result_path))
  expect_s3_class(officer::read_pptx(job$result_path), "rpptx")
  expect_equal(job$result_public$n_slides, job$result_data$n_slides)
  expect_match(job$result_public$file_id, ".+")
  expect_match(job$result_public$manifest_file_id, ".+")
  roles <- vapply(job$result_public$artifacts, `[[`, character(1), "role")
  expect_equal(sum(roles == "deliverable"), 1L)
  expect_equal(sum(roles == "manifest"), 1L)
})

test_that("el flag include_plan del preflight interpreta las formas usuales", {
  expect_false(.graficos_consolidado_truthy(NULL))
  expect_false(.graficos_consolidado_truthy(list()))
  expect_false(.graficos_consolidado_truthy("0"))
  expect_false(.graficos_consolidado_truthy("false"))
  expect_false(.graficos_consolidado_truthy(FALSE))
  expect_true(.graficos_consolidado_truthy("1"))
  expect_true(.graficos_consolidado_truthy("true"))
  expect_true(.graficos_consolidado_truthy(" TRUE "))
  expect_true(.graficos_consolidado_truthy(TRUE))
})

test_that("n_slides del preflight cuenta el mismo plan que el editor siembra", {
  # El menu del conjunto promete "N diapositivas" con `n_slides` y el editor
  # compartido aterriza con `plan$slides`. Si dejaran de salir del mismo
  # calculo volveria el hueco que motivo la siembra: el menu prometiendo
  # laminas que el lienzo no tenia.
  sid <- .gcc_test_setup()
  on.exit(session_delete(sid), add = TRUE)

  preflight <- graficos_consolidado_preflight(sid)

  expect_true(preflight$ready)
  expect_gt(preflight$n_slides, 0L)
  expect_identical(preflight$n_slides, as.integer(length(preflight$plan$slides)))
})
