if (!exists("%||%", mode = "function", envir = globalenv())) {
  `%||%` <- function(a, b) if (is.null(a)) b else a
}

ensure_preview_renderer_helpers <- function() {
  if (!exists(".preview_renderer_status", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "graficos_metadata.R"), envir = globalenv())
    sys.source(file.path("../../R", "router_graficos.R"), envir = globalenv())
  }
  invisible(TRUE)
}

preview_renderer_available <- function() {
  ensure_preview_renderer_helpers()
  isTRUE(.preview_renderer_status()$available)
}

test_that("diagnostico de renderer de preview es headless y estable", {
  ensure_preview_renderer_helpers()

  status <- .preview_renderer_status()
  expect_type(status$available, "logical")
  expect_false(isTRUE(status$desktop_automation))
  expect_true(status$renderer %in% c("artifact-tool", "soffice", NA_character_))
  expect_true(length(status$renderers) >= 2L)
  expect_true(all(vapply(status$renderers, function(x) "available" %in% names(x), logical(1))))
})

test_that("renderer de preview prefiere soffice empaquetado", {
  ensure_preview_renderer_helpers()

  vars <- c(
    "PULSO_APP_ROOT",
    "PROSECNUR_PREVIEW_RENDERER_DIR",
    "PROSECNUR_BUNDLED_SOFFICE",
    "PROSECNUR_SOFFICE",
    "SOFFICE_PATH",
    "LIBREOFFICE_PATH"
  )
  old <- Sys.getenv(vars, unset = NA_character_)
  on.exit({
    for (var in vars) {
      if (is.na(old[[var]])) {
        Sys.unsetenv(var)
      } else {
        do.call(Sys.setenv, as.list(stats::setNames(old[[var]], var)))
      }
    }
  }, add = TRUE)

  root <- tempfile("prosecnur_app_root_")
  fake <- file.path(root, "preview-renderer", "soffice")
  dir.create(dirname(fake), recursive = TRUE, showWarnings = FALSE)
  writeLines("", fake)
  on.exit(unlink(root, recursive = TRUE, force = TRUE), add = TRUE)

  Sys.setenv(
    PULSO_APP_ROOT = root,
    PROSECNUR_PREVIEW_RENDERER_DIR = "",
    PROSECNUR_BUNDLED_SOFFICE = "",
    PROSECNUR_SOFFICE = "",
    SOFFICE_PATH = "",
    LIBREOFFICE_PATH = ""
  )

  expect_equal(
    normalizePath(.soffice_cmd(), winslash = "/", mustWork = FALSE),
    normalizePath(fake, winslash = "/", mustWork = FALSE)
  )
})

test_that("comparador interno de previews detecta PNGs iguales y distintos", {
  skip_if_not_installed("png")
  ensure_preview_renderer_helpers()

  ref <- tempfile(fileext = ".png")
  same <- tempfile(fileext = ".png")
  diff <- tempfile(fileext = ".png")
  on.exit(unlink(c(ref, same, diff)), add = TRUE)

  img <- array(1, dim = c(12, 16, 3))
  img[4:8, 5:11, 1] <- 0.2
  img[4:8, 5:11, 2] <- 0.4
  img[4:8, 5:11, 3] <- 0.8

  img_diff <- img
  img_diff[4:8, 5:11, 1] <- 0.9

  png::writePNG(img, ref)
  png::writePNG(img, same)
  png::writePNG(img_diff, diff)

  equal_metrics <- .compare_png_files(ref, same)
  diff_metrics <- .compare_png_files(ref, diff)

  expect_true(isTRUE(equal_metrics$available))
  expect_equal(equal_metrics$verdict, "match")
  expect_equal(equal_metrics$similarity, 1)

  expect_true(isTRUE(diff_metrics$available))
  expect_true(diff_metrics$similarity < 1)
  expect_true(diff_metrics$rmse > 0)
})

test_that("preview y export pueden usar config visual actual sin esperar autosave", {
  ensure_preview_renderer_helpers()
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "graficos_config", list(
    presets = list(base = list(debug_ph_bordes = TRUE, debug_ph_col = "#111111")),
    debug_ph = list(activo = FALSE, color = "#111111", lwd = 0.6),
    iconos = list()
  ))

  cfg <- .graficos_effective_config(sid, list(
    presets = list(base = list(debug_ph_bordes = FALSE)),
    debug_ph = list(activo = TRUE, color = "#00FFAA", lwd = 2.5),
    iconos = list(list(id = "logo", file_id = "missing"))
  ))
  enriched <- .enriquecer_presets(cfg$presets, cfg$debug_ph)

  expect_true(isTRUE(enriched$base$debug_ph_bordes))
  expect_equal(enriched$base$debug_ph_col, "#00FFAA")
  expect_equal(enriched$base$debug_ph_lwd, 2.5)
  expect_length(cfg$iconos, 1)
})

test_that("render headless devuelve PNG inline con dimensiones reales de slide", {
  skip_if_not_installed("officer")
  skip_if_not_installed("png")
  skip_if(!preview_renderer_available(), "No hay renderer headless disponible para renderizar PPTX")

  doc <- officer::read_pptx()
  size <- officer::slide_size(doc)
  doc <- officer::add_slide(doc, layout = "Title and Content", master = "Office Theme")
  doc <- officer::ph_with(
    doc,
    "Preview inline",
    location = officer::ph_location(left = 0.55, top = 0.35, width = size$width - 1.1, height = 0.65)
  )
  doc <- officer::ph_with(
    doc,
    "El PNG debe conservar el canvas completo de la lamina.",
    location = officer::ph_location(left = 0.75, top = 1.35, width = size$width - 1.5, height = size$height - 2.6)
  )

  pptx <- tempfile(fileext = ".pptx")
  on.exit(unlink(pptx), add = TRUE)
  print(doc, target = pptx)

  preview <- .render_pptx_slide_preview(pptx)
  expect_type(preview, "list")
  expect_match(preview$png_base64, "^data:image/png;base64,")
  expect_true(nzchar(preview$renderer))
  expect_gt(preview$width, 200)
  expect_gt(preview$height, 150)
  expect_equal(preview$width / preview$height, size$width / size$height, tolerance = 0.02)
})

preview_compare_failure_info <- function(case_name, metrics) {
  metric_value <- function(name) {
    if (!is.list(metrics) || is.null(metrics[[name]]) || !length(metrics[[name]])) {
      return(NULL)
    }
    as.character(metrics[[name]][[1]])
  }
  parts <- c(
    case_name,
    metric_value("reason"),
    metric_value("message"),
    metric_value("renderer")
  )
  paste(parts[nzchar(parts)], collapse = " | ")
}

load_preview_compare_package <- function() {
  if (exists("reporte_ppt_plan", mode = "function")) return(invisible(TRUE))
  skip_if_not_installed("pkgload")
  candidates <- c(".", "../..", "api", file.path(getwd(), "api"))
  roots <- candidates[file.exists(file.path(candidates, "DESCRIPTION"))]
  if (!length(roots)) skip("No se encontro el DESCRIPTION del paquete para cargar prosecnurapp")
  pkgload::load_all(roots[[1]], quiet = TRUE)
  invisible(TRUE)
}

preview_compare_pkg_file <- function(...) {
  rel <- file.path(...)
  candidates <- c(
    testthat::test_path("..", "..", rel),
    file.path("api", rel),
    rel
  )
  hits <- candidates[file.exists(candidates)]
  if (length(hits)) return(hits[[1]])
  candidates[[1]]
}

test_that("QA interno compara PPTX completo vs mini-PPTX en layouts y tamaños distintos", {
  skip_if_not_installed("officer")
  skip_if(!preview_renderer_available(), "No hay renderer headless disponible para renderizar PPTX")

  make_deck <- function(path = NULL, case, include_cover = FALSE) {
    doc <- if (is.null(path)) officer::read_pptx() else officer::read_pptx(path)
    size <- officer::slide_size(doc)

    if (include_cover) {
      doc <- officer::add_slide(doc, layout = "Title Slide", master = "Office Theme")
      doc <- officer::ph_with(
        doc,
        "Slide anterior para probar índice real",
        location = officer::ph_location(left = 0.7, top = 0.7, width = size$width - 1.4, height = 0.6)
      )
    }

    doc <- officer::add_slide(doc, layout = case$layout, master = "Office Theme")
    doc <- officer::ph_with(
      doc,
      case$title,
      location = officer::ph_location(left = 0.55, top = 0.35, width = size$width - 1.1, height = 0.65)
    )
    doc <- officer::ph_with(
      doc,
      paste(case$body, "Canvas", sprintf("%.2f x %.2f", size$width, size$height)),
      location = officer::ph_location(left = 0.75, top = 1.35, width = size$width - 1.5, height = size$height - 2.6)
    )
    doc <- officer::ph_with(
      doc,
      "Base: 124 respuestas",
      location = officer::ph_location(left = 0.55, top = size$height - 0.55, width = 2.6, height = 0.25)
    )
    doc
  }

  cases <- list(
    list(name = "default_4_3_title_content", template = NULL, layout = "Title and Content", title = "Layout 4:3", body = "Contenido central."),
    list(name = "default_4_3_two_content", template = NULL, layout = "Two Content", title = "Layout dos columnas 4:3", body = "Dos columnas."),
    list(name = "pulso_16_9_graficos", template = preview_compare_pkg_file("inst", "plantillas", "plantilla_16_9.pptx"), layout = "Graficos", title = "Layout gráfico 16:9", body = "Gráfico principal."),
    list(name = "pulso_16_9_graficos2", template = preview_compare_pkg_file("inst", "plantillas", "plantilla_16_9.pptx"), layout = "Graficos2", title = "Layout dos gráficos 16:9", body = "Gráfico izquierdo y derecho.")
  )

  for (case in cases) {
    full <- tempfile(fileext = ".pptx")
    mini <- tempfile(fileext = ".pptx")
    on.exit(unlink(c(full, mini)), add = TRUE)

    print(make_deck(case$template, case, include_cover = TRUE), target = full)
    print(make_deck(case$template, case, include_cover = FALSE), target = mini)

    metrics <- .compare_pptx_slide_preview(full, mini, slide_index = 2L, dpi = 140)
    info <- preview_compare_failure_info(case$name, metrics)
    expect_true(isTRUE(metrics$available), info = info)
    expect_equal(metrics$verdict, "match", info = info)
    expect_true(metrics$similarity >= 0.99, info = info)
    expect_true(isTRUE(metrics$dimensions_match), info = info)
  }
})

test_that("QA interno compara reporte_ppt_plan completo vs preview de un slide", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if(!preview_renderer_available(), "No hay renderer headless disponible para renderizar PPTX")

  load_preview_compare_package()

  dat <- data.frame(x = 1)
  inst <- list(
    survey = data.frame(
      name = "x",
      type = "integer",
      list_name = NA_character_,
      stringsAsFactors = FALSE
    ),
    choices = NULL,
    orders_list = NULL
  )

  g1 <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = c("A", "B", "C"), y = c(0.18, 0.42, 0.4)), ggplot2::aes(x, y)) +
      ggplot2::geom_col(fill = "#2C5F8A") +
      ggplot2::scale_y_continuous(labels = scales::percent) +
      ggplot2::theme_minimal(base_size = 11)
  )
  g2 <- p_ggplot_raw(
    ggplot2::ggplot(data.frame(x = c("Norte", "Sur"), y = c(31, 44)), ggplot2::aes(x, y)) +
      ggplot2::geom_col(fill = "#79B000") +
      ggplot2::theme_minimal(base_size = 11)
  )

  cases <- list(
    list(
      name = "reporte_un_grafico",
      selected = p_slide_1_grafico(
        g1,
        titulo = "Diseña y desarrolla soluciones mecatrónicas mediante la incorporación de tecnologías a los procesos, la automatización e interconexión de sistemas, y la interacción con el usuario, contribuyendo con la competitividad de las empresas e instituciones, y mejorando la calidad de vida de las personas.",
        base = "Base: 124 respuestas",
        pie = "Pulso PUCP"
      )
    ),
    list(
      name = "reporte_dos_graficos",
      selected = p_slide_2_graficos(
        g1,
        g2,
        titulo = "Indicadores principales por segmento",
        base = "Base: 124 respuestas",
        pie = "Pulso PUCP"
      )
    ),
    list(
      name = "reporte_slide_estructural",
      selected = p_slide_texto(
        titulo = "Lectura analítica",
        bullets = c(
          "La incorporación tecnológica ordena procesos críticos.",
          "La automatización mejora consistencia operativa."
        ),
        base = "Base: instrumento 2026"
      )
    )
  )

  for (case in cases) {
    full <- tempfile(fileext = ".pptx")
    mini <- tempfile(fileext = ".pptx")
    on.exit(unlink(c(full, mini)), add = TRUE)

    full_plan <- list(
      diapo_001 = p_slide_seccion("Slide previa para validar índice"),
      diapo_002 = case$selected
    )
    mini_plan <- list(diapo_001 = case$selected)

    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = full_plan,
      presets = p_presets(),
      path_ppt = full,
      mensajes_progreso = FALSE
    )
    reporte_ppt_plan(
      data = dat,
      instrumento = inst,
      plan = mini_plan,
      presets = p_presets(),
      path_ppt = mini,
      mensajes_progreso = FALSE
    )

    expect_true(file.exists(full), info = case$name)
    expect_true(file.exists(mini), info = case$name)

    metrics <- .compare_pptx_slide_preview(full, mini, slide_index = 2L, dpi = 140)
    info <- preview_compare_failure_info(case$name, metrics)
    expect_true(isTRUE(metrics$available), info = info)
    expect_equal(metrics$verdict, "match", info = info)
    expect_true(metrics$similarity >= 0.99, info = info)
    expect_true(isTRUE(metrics$dimensions_match), info = info)
  }
})
