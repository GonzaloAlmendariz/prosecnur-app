test_that("freq_table_spss desagrega madres select_multiple con tokens separados por espacios", {
  data <- data.frame(
    estudios = c("1 2", "2 5", "3 4", "3 5"),
    stringsAsFactors = FALSE
  )

  orders_list <- list(
    estudios = list(
      names = c("1", "2", "3", "4", "5"),
      labels = c("Primaria", "Secundaria", "Técnico", "Bachiller", "Título"),
      label = "Marque todos sus estudios, grados y títulos alcanzados:"
    )
  )

  tab <- freq_table_spss(
    data = data,
    var = "estudios",
    survey = data.frame(
      name = "estudios",
      type = "text",
      label = "Marque todos sus estudios, grados y títulos alcanzados:",
      stringsAsFactors = FALSE
    ),
    orders_list = orders_list
  )

  body <- tab[tab$Opciones != "Total", , drop = FALSE]

  expect_equal(body$Opciones, orders_list$estudios$labels)
  expect_equal(body$n, c(1, 2, 2, 1, 2))
  expect_equal(tab$n[tab$Opciones == "Total"], 4)
  expect_false(any(body$Opciones %in% c("1 2", "2 5", "3 4", "3 5")))
})

test_that("plan PPT prefiere variables recodificadas cuando existen en la base procesada", {
  if (!exists(".reporte_plan_resolve_recod_var", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "reporte_plan_ppt.R"), envir = globalenv())
  }

  data <- data.frame(
    modo = c("1", "96", "1"),
    modo_recod = c("1", "3", "1"),
    need.1 = c(1, 1, 0),
    need.other = c(0, 1, 0),
    need_recod.1 = c(1, 1, 0),
    need_recod.99 = c(0, 1, 0),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  expect_equal(
    .reporte_plan_resolve_recod_var("modo", data),
    "modo_recod"
  )
  expect_equal(
    .reporte_plan_resolve_recod_var("need", data),
    "need_recod"
  )
  expect_equal(
    .reporte_plan_resolve_recod_var("modo_recod", data),
    "modo_recod"
  )
  expect_equal(
    .reporte_plan_resolve_recod_var("otra_var", data),
    "otra_var"
  )
})

test_that("estilos de frecuencias centran columnas n y porcentaje", {
  st <- mk_styles_spss()

  expect_equal(st$freq_body_int$halign, "center")
  expect_equal(st$freq_body_pct$halign, "center")
  expect_equal(st$freq_total_num$halign, "center")
  expect_equal(st$freq_total_pct$halign, "center")
  expect_false(isTRUE(st$freq_body_pct$wrapText))
  expect_false(isTRUE(st$freq_total_pct$wrapText))
})
