test_that("preview de filas serializa columnas haven_labelled del .sav", {
  skip_if_not_installed("haven")

  if (!exists(".plan_rows_preview", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "router_validacion.R"), envir = globalenv())
  }

  df <- tibble::tibble(
    p32_1 = haven::labelled(c(NA_real_, 1), labels = c("Sí" = 1))
  )

  rows <- .plan_rows_preview(df, n = 2L)
  expect_true(is.na(rows[[1]]$p32_1))
  expect_equal(rows[[2]]$p32_1, 1)
  expect_error(jsonlite::toJSON(list(casos = rows), auto_unbox = TRUE, null = "null"), NA)
})

test_that("drill obtiene nombres de casos de una sola columna sin evaluar data.frame como lógico", {
  if (!exists(".drill_data_names", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "router_validacion.R"), envir = globalenv())
  }

  casos <- tibble::tibble(p7 = c("3", "3 4", "5"))

  expect_equal(.drill_data_names(casos), "p7")
  expect_equal(.drill_data_names(NULL), character(0))
})

test_that("explorar valores conserva opciones declaradas aunque falten dummies en data", {
  if (!exists(".explorar_complete_catalog_options", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "router_validacion.R"), envir = globalenv())
  }

  inst <- list(
    survey = tibble::tibble(
      type = "select_multiple grados",
      name = "p7",
      list_name = "grados",
      label = "Grados"
    ),
    choices = tibble::tibble(
      list_name = rep("grados", 4),
      name = c("1", "2", "5", "7"),
      label = c("Egresado/a", "Bachiller", "Magíster", "Doctorado")
    )
  )
  tab <- data.frame(
    code = c("1", "2", "5"),
    label = c("Egresado/a", "Bachiller", "Magíster"),
    n = c(10L, 8L, 2L),
    pct = c(1, 0.8, 0.2),
    stringsAsFactors = FALSE
  )

  out <- .explorar_complete_catalog_options(tab, "p7", inst)
  expect_equal(out$code, c("1", "2", "5", "7"))
  expect_equal(out$label[out$code == "7"], "Doctorado")
  expect_equal(out$n[out$code == "7"], 0L)
})

test_that("preview público de limpieza no expone campos pesados al cerrar", {
  if (!exists(".limpieza_preview_public", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "router_validacion.R"), envir = globalenv())
  }

  preview <- list(
    before = list(total_inconsistencias = 2L),
    after = list(total_inconsistencias = 0L),
    impact = list(cells_changed = 2L),
    residual_final = list(),
    decisions_ready = 1L,
    data_final = tibble::tibble(x = 1),
    evaluacion_final = list(bundle = list(closure = function() TRUE)),
    logs = list(trace = tibble::tibble(status = "ok"))
  )

  out <- .limpieza_preview_public(preview)
  expect_null(out$data_final)
  expect_null(out$evaluacion_final)
  expect_null(out$logs)
  expect_error(jsonlite::toJSON(list(before_after_preview = out), auto_unbox = TRUE, null = "null"), NA)
})
