library(testthat)

if (!exists("session_create", mode = "function")) {
  setup_path <- if (file.exists("setup-load-all.R")) {
    "setup-load-all.R"
  } else {
    file.path("tests", "testthat", "setup-load-all.R")
  }
  source(setup_path)
}

graficos_share_inst <- function(vars) {
  list(
    survey = data.frame(
      type = rep("text", length(vars)),
      type_base = rep("text", length(vars)),
      name = names(vars),
      label = unname(vars),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = character(),
      name = character(),
      label = character(),
      stringsAsFactors = FALSE
    )
  )
}

graficos_share_data <- function(vars) {
  out <- as.data.frame(stats::setNames(replicate(length(vars), "x", simplify = FALSE), names(vars)))
  out
}

graficos_share_slide <- function(id, title, var) {
  list(
    id = id,
    tipo = "p_slide_1_grafico",
    payload = list(
      titulo = title,
      grafico = list(graficador = "p_barras", args = list(var = var))
    )
  )
}

graficos_share_copy_package_to_session <- function(from_sid, file_id, to_sid) {
  meta <- get_file(from_sid, file_id)
  bytes <- readBin(meta$path, "raw", n = file.info(meta$path)$size)
  save_upload(to_sid, "graficos_share", meta$original_name, bytes)
}

test_that("paquete de graficos se inspecciona y omite slides con variables faltantes por base", {
  src <- session_create()
  target <- session_create()
  on.exit(session_delete(src), add = TRUE)
  on.exit(session_delete(target), add = TRUE)

  estudio_add_base(
    src,
    nombre = "civil",
    xlsform_file_id = "src-xls",
    data_file_id = "src-data",
    data_ext = "xlsx",
    rp_data = graficos_share_data(c(p1 = "P1", p2 = "P2")),
    rp_inst = graficos_share_inst(c(p1 = "Pregunta uno", p2 = "Pregunta dos")),
    n_filas = 1L,
    n_columnas = 2L
  )

  cfg <- .graficos_default_config(src)
  cfg$plan$slides <- list(
    graficos_share_slide("s-p1", "Slide P1", "civil$p1"),
    graficos_share_slide("s-p2", "Slide P2", "civil$p2")
  )
  .graficos_config_set(src, cfg)

  exported <- .graficos_share_export(src)
  expect_true(file.exists(get_file(src, exported$file_id)$path))
  expect_false("state.rds" %in% utils::unzip(get_file(src, exported$file_id)$path, list = TRUE)$Name)

  estudio_add_base(
    target,
    nombre = "civil",
    xlsform_file_id = "target-civil-xls",
    data_file_id = "target-civil-data",
    data_ext = "xlsx",
    rp_data = graficos_share_data(c(p1 = "P1", p2 = "P2")),
    rp_inst = graficos_share_inst(c(p1 = "Pregunta uno", p2 = "Pregunta dos")),
    n_filas = 1L,
    n_columnas = 2L
  )
  estudio_add_base(
    target,
    nombre = "minas",
    xlsform_file_id = "target-minas-xls",
    data_file_id = "target-minas-data",
    data_ext = "xlsx",
    rp_data = graficos_share_data(c(p1 = "P1")),
    rp_inst = graficos_share_inst(c(p1 = "Pregunta uno")),
    n_filas = 1L,
    n_columnas = 1L
  )
  estudio_promote_independent_siblings(target, active_base = "civil")

  package_meta <- graficos_share_copy_package_to_session(src, exported$file_id, target)
  inspection <- .graficos_share_inspect_meta(target, package_meta)

  expect_equal(inspection$summary$n_bases, 2)
  expect_equal(inspection$summary$n_compatible, 2)
  by_base <- setNames(inspection$bases, vapply(inspection$bases, `[[`, character(1), "base_name"))
  expect_equal(by_base$civil$incoming$n_slides_applicable, 2)
  expect_equal(by_base$minas$incoming$n_slides_applicable, 1)
  expect_equal(by_base$minas$incoming$n_slides_skipped, 1)
  expect_equal(by_base$minas$impact$missing_variables[[1]]$code, "p2")
  expect_equal(by_base$minas$impact$missing_variables[[1]]$label, "Pregunta dos")

  imported <- .graficos_share_import(target, package_meta$file_id, selected_bases = c("civil", "minas"))
  expect_true(imported$ok)

  civil_cfg <- .graficos_config_get_for_base(target, "civil")
  minas_cfg <- .graficos_config_get_for_base(target, "minas")
  expect_equal(length(civil_cfg$plan$slides), 2)
  expect_equal(length(minas_cfg$plan$slides), 1)
  expect_equal(minas_cfg$plan$slides[[1]]$payload$grafico$args$var, "p1")

  s <- session_get(target)
  expect_identical(s$estudio$bases$civil$xlsform_file_id, "target-civil-xls")
  expect_false(isTRUE(s$graficos_status_por_base$civil$graficos_ppt_ok))
  expect_false(isTRUE(s$graficos_status_por_base$minas$graficos_word_ok))
  expect_equal(s$graficos_share_snapshot$kind, "graficos_share_snapshot")
})

test_that("paquete de graficos remapea iconos al importar", {
  skip_if_not_installed("png")

  src <- session_create()
  target <- session_create()
  on.exit(session_delete(src), add = TRUE)
  on.exit(session_delete(target), add = TRUE)

  estudio_add_base(
    src,
    nombre = "civil",
    xlsform_file_id = "src-xls",
    data_file_id = "src-data",
    data_ext = "xlsx",
    rp_data = graficos_share_data(c(p1 = "P1")),
    rp_inst = graficos_share_inst(c(p1 = "Pregunta uno")),
    n_filas = 1L,
    n_columnas = 1L
  )
  icon_path <- tempfile(fileext = ".png")
  png::writePNG(array(1, dim = c(2, 2, 4)), icon_path)
  icon_meta <- .register_output_file(src, "graficos_icon", icon_path, original_name = "icono.png")

  cfg <- .graficos_default_config(src)
  cfg$iconos <- list(list(id = "ico-demo", nombre = "Demo", file_id = icon_meta$file_id))
  cfg$plan$slides <- list(list(
    id = "s-icon",
    tipo = "p_slide_objetivo_icono",
    payload = list(titulo = "Objetivo", texto = "Texto", icono = "ico-demo")
  ))
  .graficos_config_set(src, cfg)
  exported <- .graficos_share_export(src)
  expect_true(any(grepl("^files/icons/", utils::unzip(get_file(src, exported$file_id)$path, list = TRUE)$Name)))

  estudio_add_base(
    target,
    nombre = "civil",
    xlsform_file_id = "target-xls",
    data_file_id = "target-data",
    data_ext = "xlsx",
    rp_data = graficos_share_data(c(p1 = "P1")),
    rp_inst = graficos_share_inst(c(p1 = "Pregunta uno")),
    n_filas = 1L,
    n_columnas = 1L
  )
  package_meta <- graficos_share_copy_package_to_session(src, exported$file_id, target)
  .graficos_share_import(target, package_meta$file_id, selected_bases = "civil")
  imported_cfg <- .graficos_config_get_for_base(target, "civil")
  expect_length(imported_cfg$iconos, 1)
  expect_false(identical(imported_cfg$iconos[[1]]$file_id, icon_meta$file_id))
  expect_true(file.exists(get_file(target, imported_cfg$iconos[[1]]$file_id)$path))
})
