# L6 — legibilidad del eje Y: H35 (categoricas) y H39 (histograma).
#
# H35 — el eje Y de barras categoricas hablaba en proporciones crudas.
#
# El motor alimenta `var_valor = "pct"` con `modo_valor = "valor"`, asi que lo
# graficado es una proporcion (0-1). Con el eje encendido la lamina mostraba
# 0.00 / 0.25 / 0.50 mientras las etiquetas de barra decian «45% (9)»: dos
# escalas para el mismo dato en la misma lamina. El preset apaga el eje de
# fabrica, asi que el defecto solo aparecia cuando el analista lo encendia.

etiquetas_eje_y <- function(p) {
  gb <- ggplot2::ggplot_build(p)
  as.character(gb$layout$panel_params[[1]]$y$get_labels())
}

test_that("el eje Y se lee en porcentajes cuando lo graficado es una proporcion", {
  skip_if_not_installed("ggplot2")

  p <- graficar_barras_categoricas(
    data = data.frame(
      categoria = c("Alto", "Medio", "Bajo"),
      n         = c(9, 6, 5),
      pct       = c(0.45, 0.30, 0.25),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_valor = "pct", var_n = "n", var_pct = "pct",
    modo_valor = "valor", mostrar_eje_y = TRUE
  )

  etiquetas <- etiquetas_eje_y(p)
  expect_true(all(grepl("%$", etiquetas)))
  expect_true("50%" %in% etiquetas)
  # Lo que NO puede volver a pasar: el eje en proporciones crudas.
  expect_false(any(etiquetas %in% c("0.50", "0,50")))
})

test_that("un eje de conteos sigue mostrando conteos", {
  skip_if_not_installed("ggplot2")

  p <- graficar_barras_categoricas(
    data = data.frame(
      categoria = c("Alto", "Medio", "Bajo"),
      n         = c(90, 60, 50),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_n = "n",
    modo_valor = "conteo", mostrar_eje_y = TRUE
  )

  etiquetas <- etiquetas_eje_y(p)
  expect_false(any(grepl("%", etiquetas)))
  expect_true(any(grepl("^[0-9]", etiquetas)))
})

test_that("el analista puede forzar la lectura del eje en ambos sentidos", {
  skip_if_not_installed("ggplot2")

  datos <- data.frame(
    categoria = c("Alto", "Medio"),
    n         = c(9, 6),
    pct       = c(0.60, 0.40),
    stringsAsFactors = FALSE
  )

  forzado_pct <- graficar_barras_categoricas(
    data = datos, var_categoria = "categoria", var_n = "n",
    modo_valor = "conteo", mostrar_eje_y = TRUE,
    eje_y_porcentaje = TRUE
  )
  expect_true(all(grepl("%$", etiquetas_eje_y(forzado_pct))))

  forzado_num <- graficar_barras_categoricas(
    data = datos, var_categoria = "categoria", var_valor = "pct",
    var_n = "n", var_pct = "pct", modo_valor = "valor",
    mostrar_eje_y = TRUE,
    eje_y_porcentaje = FALSE
  )
  expect_false(any(grepl("%", etiquetas_eje_y(forzado_num))))
})

test_that("el eje del plan PPT queda en la misma escala que sus etiquetas", {
  skip_if_not_installed("ggplot2")

  dat <- data.frame(
    p1 = c(rep("Alto", 9), rep("Medio", 6), rep("Bajo", 5)),
    stringsAsFactors = FALSE
  )
  attr(dat$p1, "label") <- "Satisfaccion"
  inst <- list(
    survey  = data.frame(name = "p1", type = "select_one lst", list_name = "lst",
                         stringsAsFactors = FALSE),
    choices = data.frame(list_name = rep("lst", 3), name = c("Bajo", "Medio", "Alto"),
                         label = c("Bajo", "Medio", "Alto"), stringsAsFactors = FALSE),
    orders_list = NULL
  )

  p <- reporte_ppt_plan(
    data = dat, instrumento = inst,
    plan = list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_categoricas("p1", overrides = list(
        mostrar_eje_y = TRUE, usar_canvas = FALSE
      ))
    )),
    presets = p_presets(barras_categoricas = .PRESETS_DEFAULT_PULSO$barras_categoricas),
    solo_lista = TRUE, mensajes_progreso = FALSE
  )$rendered[[1]]

  expect_true(all(grepl("%$", etiquetas_eje_y(p))))
})

# H39 — el titulo del eje Y del histograma se escribia ENCIMA de sus marcas.
# `axis.title.y` se declaraba sin margen, asi que «Porcentaje del total»
# tachaba «30%» y «20%». El preset del histograma trae mostrar_eje_y = TRUE,
# de modo que el defecto viajaba al entregable sin que nadie lo encendiera.

test_that("el titulo del eje Y no se escribe encima de sus marcas", {
  skip_if_not_installed("ggplot2")

  edad <- c(rep(19:24, times = c(4, 9, 14, 11, 7, 3)))
  dat <- data.frame(
    edad = edad,
    sexo = rep(c("1", "2"), length.out = length(edad)),
    stringsAsFactors = FALSE
  )
  attr(dat$edad, "label") <- "Edad"
  inst <- list(
    survey = data.frame(name = c("edad", "sexo"), type = c("integer", "select_one lst_sexo"),
                        list_name = c(NA_character_, "lst_sexo"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = rep("lst_sexo", 2), name = c("1", "2"),
                         label = c("Hombres", "Mujeres"), stringsAsFactors = FALSE),
    orders_list = NULL
  )

  # El motor FUERZA canvas (.force_canvas_args), asi que por el camino del plan
  # lo devuelto es un cowplot y su tema no es el del histograma: para mirar el
  # tema hay que llamar al graficador directo.
  p <- graficar_histograma(
    data = dat, var = "edad", grupo = "sexo",
    modo = "porcentaje_total", ancho_bin = 2,
    mostrar_eje_y = TRUE, usar_canvas = FALSE, exportar = "rplot"
  )

  # El preset enciende el eje: si eso cambia, este test deja de probar el caso.
  expect_true(isTRUE(.PRESETS_DEFAULT_PULSO$histograma$mostrar_eje_y))

  titulo_y <- p$theme$axis.title.y
  expect_s3_class(titulo_y, "element_text")
  # Sin margen derecho, el titulo se solapa con las marcas del eje.
  expect_false(is.null(titulo_y$margin))
  expect_gt(as.numeric(titulo_y$margin)[[2]], 0)
})
