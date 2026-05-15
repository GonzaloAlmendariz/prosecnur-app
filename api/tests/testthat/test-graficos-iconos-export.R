test_that("slides de poblacion exportan cuando icono viene vacio", {
  slide <- list(
    tipo = "p_slide_2_graficos_poblacion",
    payload = list(
      titulo = "Perfil poblacional",
      izquierda = list(graficador = "p_pie", args = list(var = "p1")),
      derecha = list(graficador = "p_pie", args = list(var = "p2")),
      icono = ""
    )
  )

  out <- .graficos_rebuild_slide_json(slide)

  expect_identical(out$.slide_type, "poblacion_2")
  expect_s3_class(out$slots$left, "ppt_element")
  expect_s3_class(out$slots$right, "ppt_element")
  expect_null(out$slots$icon)
})

test_that("slides de poblacion dan error claro cuando el icono no existe", {
  slide <- list(
    tipo = "p_slide_2_graficos_poblacion",
    payload = list(
      izquierda = list(graficador = "p_pie", args = list(var = "p1")),
      derecha = list(graficador = "p_pie", args = list(var = "p2")),
      icono = "icono-borrado"
    )
  )

  expect_error(
    .graficos_rebuild_slide_json(slide, icon_registry = list()),
    "Icono no encontrado: 'icono-borrado'"
  )
})

test_that("slides que requieren icono fallan con mensaje accionable", {
  slide <- list(
    tipo = "p_slide_objetivo_icono",
    payload = list(
      texto = "Objetivo principal",
      icono = ""
    )
  )

  expect_error(
    .graficos_rebuild_slide_json(slide),
    "requiere un icono"
  )
})

test_that("slides de poblacion convierten iconos del catalogo a ppt_element", {
  skip_if_not_installed("png")
  skip_if_not_installed("ggplot2")

  path <- tempfile(fileext = ".png")
  img <- array(0, dim = c(4, 4, 4))
  img[, , 1] <- 0.05
  img[, , 2] <- 0.25
  img[, , 3] <- 0.85
  img[, , 4] <- 1
  png::writePNG(img, path)

  slide <- list(
    tipo = "p_slide_2_graficos_poblacion",
    payload = list(
      izquierda = list(graficador = "p_pie", args = list(var = "p1")),
      derecha = list(graficador = "p_pie", args = list(var = "p2")),
      icono = "ico-1"
    )
  )

  out <- .graficos_rebuild_slide_json(slide, icon_registry = list("ico-1" = path))

  expect_s3_class(out$slots$icon, "ppt_element")
  expect_identical(out$slots$icon$.element_type, "ggplot_raw")
})
