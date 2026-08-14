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

# REVISADO 2026-08-14. Estos dos exigían que un ícono ausente ABORTARA el
# render, y el mensaje era claro y accionable, sí — pero el precio no: una
# lámina de 67 dejaba al usuario sin mazo entero, y el PNG se pierde con solo
# cerrar la app entre la subida y el guardado porque vive en el tempdir. El
# proyecto de ACRD CONTA no podía regenerar su propio informe por eso.
#
# Ahora degrada: la lámina sale sin ícono (o con el integrado cuando el
# constructor lo exige) y el aviso sellado dice cuál falta. El mensaje sigue
# siendo accionable; lo que cambia es que ya no cuesta el export.

.iconos_export_avisos <- function(expr) {
  msgs <- character(0)
  withCallingHandlers(
    force(expr),
    message = function(m) {
      msgs <<- c(msgs, conditionMessage(m))
      invokeRestart("muffleMessage")
    }
  )
  msgs[grepl("[PULSO-AVISO]", msgs, fixed = TRUE)]
}

test_that("slides de poblacion avisan y siguen cuando el icono no existe", {
  slide <- list(
    tipo = "p_slide_2_graficos_poblacion",
    payload = list(
      izquierda = list(graficador = "p_pie", args = list(var = "p1")),
      derecha = list(graficador = "p_pie", args = list(var = "p2")),
      icono = "icono-borrado"
    )
  )

  out <- NULL
  avisos <- .iconos_export_avisos(
    out <- .graficos_rebuild_slide_json(slide, icon_registry = list())
  )
  expect_false(is.null(out))
  expect_true(any(grepl("icono-borrado", avisos, fixed = TRUE)))
})

test_that("slides que requieren icono caen al integrado con aviso accionable", {
  slide <- list(
    tipo = "p_slide_objetivo_icono",
    payload = list(
      texto = "Objetivo principal",
      icono = ""
    )
  )

  out <- NULL
  avisos <- .iconos_export_avisos(out <- .graficos_rebuild_slide_json(slide))
  expect_false(is.null(out))
  expect_true(any(grepl("Configuracion global > Iconos", avisos, fixed = TRUE)))
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
