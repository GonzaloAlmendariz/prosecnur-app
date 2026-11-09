# Íconos de los graficadores: tinte, borde y validación del radar.
#
# La parte de radar y FODA de dimensiones salió con el ADR 0137 (fase 2); los helpers de íconos viven ahora en
# graficos_lienzo_iconos.R y los siguen usando `p_radar` y el Dashboard.

test_that(".dim_tint_icon aplica tinte y preserva alpha", {
  img <- array(0, dim = c(1, 1, 4))
  img[1, 1, 1] <- 0.2
  img[1, 1, 2] <- 0.8
  img[1, 1, 3] <- 0.4
  img[1, 1, 4] <- 0.6

  out <- .dim_tint_icon(img, tint_color = "#FF0000")
  expect_equal(out[1, 1, 4], img[1, 1, 4], tolerance = 1e-8)
  expect_gt(out[1, 1, 1], out[1, 1, 2])
  expect_gt(out[1, 1, 1], out[1, 1, 3])

  out_w <- .dim_tint_icon(img, tint_color = "#FFFFFF")
  expect_equal(out_w[1, 1, 1], 1, tolerance = 1e-8)
  expect_equal(out_w[1, 1, 2], 1, tolerance = 1e-8)
  expect_equal(out_w[1, 1, 3], 1, tolerance = 1e-8)
})

test_that(".dim_tint_icon soporta imagen en escala de grises", {
  img_gray <- matrix(c(0.1, 0.9, 0.2, 0.8), nrow = 2)
  out <- .dim_tint_icon(img_gray, tint_color = "#00FF00")
  expect_equal(length(dim(out)), 3L)
  expect_equal(dim(out)[3], 4L)
  expect_true(all(out[, , 2] == 1))
  expect_true(all(out[, , 1] == 0))
  expect_true(all(out[, , 3] == 0))
})

test_that(".dim_outline_icon agrega borde interno sin romper alpha", {
  img <- array(0, dim = c(7, 7, 4))
  img[2:6, 2:6, 1] <- 1
  img[2:6, 2:6, 2] <- 1
  img[2:6, 2:6, 3] <- 1
  img[2:6, 2:6, 4] <- 1

  out <- .dim_outline_icon(img, outline_color = "#000000", outline_alpha = 0.4)
  expect_equal(dim(out), dim(img))
  expect_equal(out[, , 4], img[, , 4], tolerance = 1e-8)
  expect_lt(out[2, 2, 1], img[2, 2, 1])  # esquina interna se oscurece
  expect_equal(out[4, 4, 1], img[4, 4, 1], tolerance = 1e-8)  # centro intacto
})

test_that("graficar_radar valida color y tamaño de íconos", {
  df <- data.frame(
    eje = c("A", "B", "C"),
    grupo = "G1",
    valor = c(70, 75, 80),
    stringsAsFactors = FALSE
  )

  expect_error(
    graficar_radar(
      data = df,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      icono_color_radar = "no-color",
      exportar = "rplot"
    ),
    "icono_color_radar"
  )

  expect_error(
    graficar_radar(
      data = df,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      icono_color_leyenda_radar = "no-color",
      exportar = "rplot"
    ),
    "icono_color_leyenda_radar"
  )

  expect_error(
    graficar_radar(
      data = df,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      icono_size_radar = 0,
      exportar = "rplot"
    ),
    "icono_size_radar"
  )

  p_ok <- graficar_radar(
    data = df,
    var_eje = "eje",
    var_grupo = "grupo",
    var_valor = "valor",
    escala_valor = "proporcion_100",
    mostrar_leyenda_iconos = FALSE,
    exportar = "rplot"
  )
  expect_s3_class(p_ok, "ggplot")
})
