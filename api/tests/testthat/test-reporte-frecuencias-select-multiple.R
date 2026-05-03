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

test_that("estilos de frecuencias centran columnas n y porcentaje", {
  st <- mk_styles_spss()

  expect_equal(st$freq_body_int$halign, "center")
  expect_equal(st$freq_body_pct$halign, "center")
  expect_equal(st$freq_total_num$halign, "center")
  expect_equal(st$freq_total_pct$halign, "center")
  expect_false(isTRUE(st$freq_body_pct$wrapText))
  expect_false(isTRUE(st$freq_total_pct$wrapText))
})
