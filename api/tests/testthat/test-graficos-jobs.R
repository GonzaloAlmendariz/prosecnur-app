# Tests de graficos_jobs.R — workers top-level de los jobs de exportación
# de Gráficos (ppt / ppt-all / word), extraídos de los closures triplicados
# de router_graficos.R (unidad 5.2). Guardan dos contratos:
#   1. El patrón canónico de jobs: marca prosecnur_job_function_name para
#      que el bootstrap de job_submit() re-obtenga la función fresca en el
#      worker callr (el bug histórico de namespace).
#   2. Comportamiento idéntico al de los closures originales: mismos
#      artefactos, mismo shape de progreso y mismos mensajes de error
#      prefijados por base.
library(testthat)

.gjobs_inst <- function(variable = "p1", list_name = "yesno") {
  list(
    survey = data.frame(
      type = paste("select_one", list_name),
      type_base = "select_one",
      name = variable,
      label = "Acceso a servicios",
      list_name = list_name,
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep(list_name, 2),
      name = c("1", "2"),
      label = c("Si", "No"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

.gjobs_data <- function(variable = "p1") {
  dat <- data.frame(
    value = c("1", "2", "1", "2", "1"),
    response_id = paste0("r", seq_len(5)),
    stringsAsFactors = FALSE
  )
  names(dat)[[1]] <- variable
  dat
}

.gjobs_slide_registry <- function() {
  setNames(
    lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
    .slide_names()
  )
}

.gjobs_plan <- function(variable = "p1") {
  list(slides = list(
    list(
      id = "s1",
      tipo = "p_slide_portada",
      payload = list(titulo = "Estudio de prueba", subtitulo = "Evaluación rápida")
    ),
    list(
      id = "s2",
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = "Acceso a servicios",
        grafico = list(
          graficador = "p_barras_categoricas",
          args = list(var = variable)
        )
      )
    )
  ))
}

test_that("los tres workers llevan la marca prosecnur_job_function_name", {
  expect_identical(
    attr(graficos_job_worker_ppt, "prosecnur_job_function_name", exact = TRUE),
    "graficos_job_worker_ppt"
  )
  expect_identical(
    attr(graficos_job_worker_ppt_all, "prosecnur_job_function_name", exact = TRUE),
    "graficos_job_worker_ppt_all"
  )
  expect_identical(
    attr(graficos_job_worker_word, "prosecnur_job_function_name", exact = TRUE),
    "graficos_job_worker_word"
  )
})

test_that("las firmas de los workers respetan el contrato de job_submit", {
  # result_path lo inyecta job_submit cuando hay result_filename;
  # progress_path se dropea si el func no lo declara — los tres lo declaran.
  for (fn in list(graficos_job_worker_ppt, graficos_job_worker_ppt_all, graficos_job_worker_word)) {
    fml <- names(formals(fn))
    expect_true(all(c("result_path", "progress_path") %in% fml))
    expect_false("..." %in% fml)
    expect_false("api_path" %in% fml) # el bootstrap de jobs.R carga el paquete
  }
  expect_true("template_id" %in% names(formals(graficos_job_worker_ppt)))
})

test_that(".graficos_job_base_error prefija solo cuando hay base activa", {
  con_base <- .graficos_job_base_error("docentes")
  expect_identical(con_base("Slide sin tipo"), "Base 'docentes': Slide sin tipo")

  sin_base <- .graficos_job_base_error("")
  expect_identical(sin_base("Slide sin tipo"), "Slide sin tipo")

  nulo <- .graficos_job_base_error(NULL)
  expect_identical(nulo("Slide sin tipo"), "Slide sin tipo")
})

test_that(".graficos_job_rebuild_slides reporta progreso con el vocabulario del entregable", {
  plan <- list(slides = list(
    list(tipo = "p_slide_portada", payload = list(titulo = "A")),
    list(tipo = "p_slide_portada", payload = list(titulo = "B"))
  ))
  llamadas <- list()
  report <- function(phase, current = NULL, total = NULL, percent = NULL, message = NULL) {
    llamadas[[length(llamadas) + 1L]] <<- list(
      phase = phase, current = current, total = total,
      percent = percent, message = message
    )
    invisible(NULL)
  }

  slides_r <- .graficos_job_rebuild_slides(
    plan, .gjobs_slide_registry(), .graf_names(), icon_registry = list(),
    report = report, base_error = identity, item_label = "slide"
  )
  expect_length(slides_r, 2L)
  expect_length(llamadas, 2L)
  expect_identical(llamadas[[1]]$phase, "rebuild")
  expect_identical(llamadas[[1]]$message, "Armando slide 1 de 2...")
  expect_equal(llamadas[[1]]$percent, 5)
  expect_identical(llamadas[[2]]$message, "Armando slide 2 de 2...")

  # Word usa "seccion" (mismo string que el closure original de /word).
  llamadas <- list()
  invisible(.graficos_job_rebuild_slides(
    plan, .gjobs_slide_registry(), .graf_names(), icon_registry = list(),
    report = report, base_error = identity, item_label = "seccion"
  ))
  expect_identical(llamadas[[1]]$message, "Armando seccion 1 de 2...")

  # report = NULL (path multibase): no revienta y rearma igual.
  expect_length(
    .graficos_job_rebuild_slides(
      plan, .gjobs_slide_registry(), .graf_names(), icon_registry = list(),
      report = NULL, base_error = identity
    ),
    2L
  )
})

test_that(".graficos_job_rebuild_slides prefija los errores con la base", {
  base_error <- .graficos_job_base_error("docentes")

  plan_sin_tipo <- list(slides = list(list(payload = list())))
  expect_error(
    .graficos_job_rebuild_slides(
      plan_sin_tipo, .gjobs_slide_registry(), .graf_names(), icon_registry = list(),
      base_error = base_error
    ),
    "Base 'docentes': Slide sin tipo",
    fixed = TRUE
  )

  plan_tipo_malo <- list(slides = list(list(tipo = "p_slide_inexistente", payload = list())))
  expect_error(
    .graficos_job_rebuild_slides(
      plan_tipo_malo, .gjobs_slide_registry(), .graf_names(), icon_registry = list(),
      base_error = base_error
    ),
    "Base 'docentes': Tipo de slide no registrado: p_slide_inexistente",
    fixed = TRUE
  )
})

test_that("graficos_job_worker_ppt genera un PPTX real con progreso y n_slides", {
  skip_if_not_installed("officer")
  skip_if_not_installed("ggplot2")

  td <- tempfile("gjobs_ppt_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  rp_data_path <- file.path(td, "data.rds")
  rp_inst_path <- file.path(td, "inst.rds")
  saveRDS(list(principal = .gjobs_data()), rp_data_path)
  saveRDS(list(principal = .gjobs_inst()), rp_inst_path)
  result_path <- file.path(td, "reporte.pptx")
  progress_path <- file.path(td, "progress.json")

  result <- graficos_job_worker_ppt(
    rp_data_path = rp_data_path,
    rp_inst_path = rp_inst_path,
    plan = .gjobs_plan(),
    presets = NULL,
    paletas = list(),
    slide_registry = .gjobs_slide_registry(),
    graficador_registry = .graf_names(),
    icon_registry = list(),
    active_base = "",
    template_pptx = .graficos_resolve_template_pptx(config = list()),
    template_id = "generic_16_9",
    auto_otros_slides = FALSE,
    result_path = result_path,
    progress_path = progress_path
  )

  expect_true(file.exists(result_path))
  expect_gt(file.info(result_path)$size, 0)
  expect_identical(result$path, result_path)
  expect_identical(result$n_slides, 2L)
  expect_gte(length(officer::read_pptx(result_path)), 2L)

  # Shape de progreso: la última fase escrita es "export" (igual que el
  # closure original).
  progreso <- jsonlite::fromJSON(paste(readLines(progress_path, warn = FALSE), collapse = "\n"))
  expect_identical(progreso$phase, "export")
  expect_equal(progreso$percent, 96)
})

test_that("graficos_job_worker_word genera un DOCX real", {
  skip_if_not_installed("officer")
  skip_if_not_installed("ggplot2")

  td <- tempfile("gjobs_word_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  rp_data_path <- file.path(td, "data.rds")
  rp_inst_path <- file.path(td, "inst.rds")
  saveRDS(list(principal = .gjobs_data()), rp_data_path)
  saveRDS(list(principal = .gjobs_inst()), rp_inst_path)
  result_path <- file.path(td, "reporte.docx")

  result <- graficos_job_worker_word(
    rp_data_path = rp_data_path,
    rp_inst_path = rp_inst_path,
    plan = .gjobs_plan(),
    presets = NULL,
    w_presets = NULL,
    paletas = list(),
    slide_registry = .gjobs_slide_registry(),
    graficador_registry = .graf_names(),
    icon_registry = list(),
    active_base = "",
    result_path = result_path,
    progress_path = file.path(td, "progress.json")
  )

  expect_true(file.exists(result_path))
  expect_gt(file.info(result_path)$size, 0)
  expect_identical(result$n_slides, 2L)
})

test_that("graficos_job_worker_ppt_all genera un ZIP con un PPTX por base", {
  skip_if_not_installed("officer")
  skip_if_not_installed("ggplot2")

  td <- tempfile("gjobs_ppt_all_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  bases <- c("docentes", "estudiantes")
  vars <- c(docentes = "p_sat", estudiantes = "q_sat")

  all_data <- list()
  all_inst <- list()
  per_base <- list()
  template <- .graficos_resolve_template_pptx(config = list())
  for (base in bases) {
    all_data[[base]] <- .gjobs_data(vars[[base]])
    all_inst[[base]] <- .gjobs_inst(vars[[base]], list_name = paste0("yesno_", base))
    per_base[[base]] <- list(
      plan = .gjobs_plan(vars[[base]]),
      presets = NULL,
      paletas = list(),
      icon_registry = list(),
      template_pptx = template,
      template_id = "generic_16_9",
      auto_otros_slides = FALSE,
      filename = sprintf("reporte_%s.pptx", base)
    )
  }
  rp_data_path <- file.path(td, "data.rds")
  rp_inst_path <- file.path(td, "inst.rds")
  per_base_path <- file.path(td, "per_base.rds")
  saveRDS(all_data, rp_data_path)
  saveRDS(all_inst, rp_inst_path)
  saveRDS(per_base, per_base_path)
  result_path <- file.path(td, "todas_bases.zip")

  result <- graficos_job_worker_ppt_all(
    rp_data_path = rp_data_path,
    rp_inst_path = rp_inst_path,
    per_base_path = per_base_path,
    bases = bases,
    slide_registry = .gjobs_slide_registry(),
    graficador_registry = .graf_names(),
    result_path = result_path,
    progress_path = file.path(td, "progress.json")
  )

  expect_true(file.exists(result_path))
  contenido <- zip::zip_list(result_path)$filename
  expect_setequal(contenido, c("reporte_docentes.pptx", "reporte_estudiantes.pptx"))
  expect_length(result$bases, 2L)
  expect_identical(result$bases[[1]]$nombre, "docentes")
  expect_identical(result$bases[[1]]$filename, "reporte_docentes.pptx")
  expect_identical(result$bases[[1]]$n_slides, 2L)
})

test_that("workers PPT propagan template_id explícito hasta reporte_ppt_plan", {
  td <- tempfile("gjobs_template_id_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  rp_data_path <- file.path(td, "data.rds")
  rp_inst_path <- file.path(td, "inst.rds")
  saveRDS(list(principal = .gjobs_data()), rp_data_path)
  saveRDS(list(principal = .gjobs_inst()), rp_inst_path)

  seen <- character()
  worker_env <- new.env(parent = environment(graficos_job_worker_ppt))
  worker_env$reporte_ppt_plan <- function(..., path_ppt, template_id = NULL) {
    seen <<- c(seen, as.character(template_id))
    if (!file.exists(path_ppt)) file.create(path_ppt)
    invisible(list())
  }
  worker_env$.graficos_job_rebuild_slides <- function(...) {
    list(p_slide_portada("Mock template identity"))
  }
  worker_ppt <- graficos_job_worker_ppt
  worker_ppt_all <- graficos_job_worker_ppt_all
  environment(worker_ppt) <- worker_env
  environment(worker_ppt_all) <- worker_env

  template <- .graficos_resolve_template_pptx(config = list())
  one_slide <- list(slides = .gjobs_plan()$slides[1])
  invisible(worker_ppt(
    rp_data_path = rp_data_path,
    rp_inst_path = rp_inst_path,
    plan = one_slide,
    presets = NULL,
    paletas = list(),
    slide_registry = .gjobs_slide_registry(),
    graficador_registry = .graf_names(),
    icon_registry = list(),
    active_base = "",
    template_pptx = template,
    template_id = "acnur_16_9",
    auto_otros_slides = FALSE,
    result_path = file.path(td, "single.pptx"),
    progress_path = file.path(td, "single-progress.json")
  ))

  bases <- c("docentes", "estudiantes")
  all_data <- setNames(lapply(bases, function(x) .gjobs_data()), bases)
  all_inst <- setNames(lapply(bases, function(x) .gjobs_inst()), bases)
  per_base <- setNames(lapply(seq_along(bases), function(i) {
    list(
      plan = one_slide,
      presets = NULL,
      paletas = list(),
      icon_registry = list(),
      template_pptx = template,
      template_id = c("acnur_16_9", "generic_16_9")[[i]],
      auto_otros_slides = FALSE,
      filename = paste0(bases[[i]], ".pptx")
    )
  }), bases)
  all_data_path <- file.path(td, "all-data.rds")
  all_inst_path <- file.path(td, "all-inst.rds")
  per_base_path <- file.path(td, "per-base.rds")
  saveRDS(all_data, all_data_path)
  saveRDS(all_inst, all_inst_path)
  saveRDS(per_base, per_base_path)

  invisible(worker_ppt_all(
    rp_data_path = all_data_path,
    rp_inst_path = all_inst_path,
    per_base_path = per_base_path,
    bases = bases,
    slide_registry = .gjobs_slide_registry(),
    graficador_registry = .graf_names(),
    result_path = file.path(td, "all.zip"),
    progress_path = file.path(td, "all-progress.json")
  ))

  expect_identical(seen, c("acnur_16_9", "acnur_16_9", "generic_16_9"))
})
