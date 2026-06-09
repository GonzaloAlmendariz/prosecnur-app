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

test_that("export de frecuencias limpia Other especificar como Otros", {
  if (!exists(".freq_clean_option_labels_for_export", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "reporte_frecuencias.R"), envir = globalenv())
  }

  tab <- data.frame(
    Opciones = c("A", "Other (especificar)", "Otros", "Total"),
    n = c(2, 1, 3, 6),
    pct = c(2 / 6, 1 / 6, 3 / 6, 1),
    stringsAsFactors = FALSE
  )

  out <- .freq_clean_option_labels_for_export(tab)
  expect_equal(out$Opciones, c("A", "Otros", "Total"))
  expect_equal(out$n, c(2, 4, 6))
  expect_equal(out$pct, c(2 / 6, 4 / 6, 1))
})

test_that("export de frecuencias limpia Other especificar en titulos y secciones", {
  if (!exists(".freq_clean_other_title_es", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "reporte_frecuencias.R"), envir = globalenv())
  }

  expect_equal(
    .freq_clean_other_title_es("Other (especificar): (Recodificada)"),
    "Otros (Recodificada)"
  )
  expect_equal(
    .freq_clean_other_title_es("Otro, por favor especificar:"),
    "Otros"
  )
  expect_equal(
    .freq_clean_section_label_for_export("PAG4 (P9-P9_OTHER)"),
    "PAG4 (P9-P9_OTROS)"
  )
})

test_that("select_one con campo otros no explota textos abiertos como categorias", {
  if (!exists("freq_table_spss", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "reporte_frecuencias.R"), envir = globalenv())
  }

  data <- data.frame(
    p12 = c("1", "Centro Tecnico Internacional", "UNI y CENTRUM PUCP", "2"),
    p12_other = c(NA, "Centro Tecnico Internacional", "UNI y CENTRUM PUCP", NA),
    stringsAsFactors = FALSE
  )

  survey <- data.frame(
    type = c("select_one lst_p12", "text"),
    name = c("p12", "p12_other"),
    relevant = c(NA, "${p12} = '14'"),
    stringsAsFactors = FALSE
  )

  orders_list <- list(
    p12 = list(
      names = c("1", "2", "14"),
      labels = c("PUCP", "ESAN", "Otra institución:")
    )
  )

  tab <- freq_table_spss(
    data = data,
    var = "p12",
    survey = survey,
    orders_list = orders_list
  )
  out <- .freq_clean_option_labels_for_export(tab)

  expect_false(any(out$Opciones %in% c("Centro Tecnico Internacional", "UNI y CENTRUM PUCP")))
  expect_equal(out$n[out$Opciones == "Otros"], 2)
  expect_equal(out$n[out$Opciones == "Total"], 4)
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
