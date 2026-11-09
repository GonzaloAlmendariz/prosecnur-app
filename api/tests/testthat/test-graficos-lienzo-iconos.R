# ADR 0137, fase 2: el lienzo "Sin datos" y los íconos vivían en
# `graficador_dimensiones.R`. Sus consumidores los llaman detrás de `exists()`,
# así que si faltan nada falla: el lienzo de todos los gráficos cae a su respaldo
# y los íconos de `p_radar` y del Dashboard desaparecen sin aviso. Este test
# convierte esa ausencia muda en un rojo.

.lienzo_iconos_exists_dim <- function(archivo) {
  src <- paste(readLines(testthat::test_path("..", "..", "R", archivo), warn = FALSE), collapse = "\n")
  m <- regmatches(src, gregexpr("exists\\(\"(\\.dim_[A-Za-z0-9_]+)\"", src))[[1]]
  unique(sub("^exists\\(\"", "", sub("\"$", "", m)))
}

test_that("cada exists('.dim_*') de los consumidores resuelve en el paquete", {
  consumidores <- c("reporte_plan_ppt.R", "graficador_radar.R", "dashboard_dimensiones.R")
  nombres <- unique(unlist(lapply(consumidores, .lienzo_iconos_exists_dim)))

  esperados <- c(
    ".dim_blank_canvas", ".dim_normalize_optional_color", ".dim_tint_icon",
    ".dim_load_icon", ".dim_icono_leyenda_block"
  )
  # El escaneo tiene que seguir viendo a los consumidores conocidos: si un
  # renombre lo deja ciego, el resto del test pasaría por ausencia.
  expect_true(all(esperados %in% nombres), info = paste(setdiff(esperados, nombres), collapse = ", "))

  ns <- asNamespace("prosecnurapp")
  for (nm in nombres) {
    expect_true(exists(nm, envir = ns, mode = "function", inherits = FALSE), info = nm)
  }
})

test_that("los helpers rescatados existen aunque nadie los llame por exists()", {
  ns <- asNamespace("prosecnurapp")
  rescatados <- c(
    ".dim_blank_canvas", ".dim_wrap_debug_canvas",
    ".dim_normalize_optional_color", ".dim_tint_icon", ".dim_load_icon",
    ".dim_icono_leyenda_block", ".dim_outline_icon", ".dim_trim_icon_alpha"
  )
  for (nm in rescatados) {
    expect_true(exists(nm, envir = ns, mode = "function", inherits = FALSE), info = nm)
  }
})

test_that(".dim_blank_canvas dibuja el mensaje y la guía sólo con debug", {
  g <- .dim_blank_canvas(mensaje = "Sin datos para mostrar")
  expect_s3_class(g, "ggplot")
  expect_identical(.dim_wrap_debug_canvas(g, debug_ph_bordes = FALSE), g)
})

test_that(".dim_load_icon recorta el alfa y tiñe; ruta ausente da NULL", {
  skip_if_not_installed("png")
  expect_null(.dim_load_icon(NULL))
  expect_null(.dim_load_icon(tempfile(fileext = ".png")))

  img <- array(0, dim = c(9, 9, 4))
  img[4:6, 4:6, ] <- 1
  path <- tempfile(fileext = ".png")
  png::writePNG(img, target = path)
  out <- .dim_load_icon(path, tint_color = "#FF0000")
  expect_equal(dim(out)[1:2], c(5L, 5L))   # 3x3 visibles + 1 px de margen
  expect_equal(out[3, 3, 1], 1, tolerance = 1e-8)
  expect_equal(out[3, 3, 2], 0, tolerance = 1e-8)
  expect_error(.dim_normalize_optional_color("no-color", "x"), "`x`")
})

test_that(".dim_icono_leyenda_block arma la leyenda con y sin íconos", {
  expect_s3_class(.dim_icono_leyenda_block(list()), "ggplot")
  expect_s3_class(.dim_icono_leyenda_block(list(A = NULL, B = NULL)), "ggplot")
})
