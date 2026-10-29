# Mapa de contexto de la ficha: dibujo en lote, adelgazado del minimapa y
# entrega distrito por distrito (hojas_ruta_mapa_lote.R, hojas_ruta_entrega_fichas.R).

hml_proyeccion <- function(ring) list2DF(list(x = ring[, 1] * 0.5, y = ring[, 2] * 0.5))

test_that("el adelgazado vectorizado da los mismos anillos que el adelgazado anillo por anillo", {
  set.seed(7)
  anillo <- function(n, cx, cy) {
    t <- seq(0, 2 * pi, length.out = n)
    cbind(cx + cos(t) * 0.01 + stats::rnorm(n, 0, 1e-4), cy + sin(t) * 0.01)
  }
  features <- list(
    list(rings = list(anillo(400, 0.2, 0.2), anillo(3, 0.5, 0.5))),
    list(rings = list()),
    list(rings = list(anillo(50, 0.8, 0.3), anillo(2000, 0.4, 0.7)))
  )
  proj <- .hojas_ruta_mapa_adelgazar(hml_proyeccion, tol = 0.0015)
  lote <- .hojas_ruta_mapa_anillos(features, proj)
  uno_a_uno <- unlist(lapply(features, function(f) lapply(f$rings, proj)), recursive = FALSE)
  expect_identical(lote$feature, c(1L, 1L, 3L, 3L))
  expect_length(lote$p, length(uno_a_uno))
  for (i in seq_along(uno_a_uno)) {
    expect_equal(lote$p[[i]]$x, uno_a_uno[[i]]$x)
    expect_equal(lote$p[[i]]$y, uno_a_uno[[i]]$y)
  }
  # Adelgaza de verdad, y ningún vértice que queda se movió: sólo se descartan.
  completo <- hml_proyeccion(features[[3]]$rings[[2]])
  expect_lt(length(lote$p[[4]]$x), length(completo$x) / 2)
  expect_true(all(lote$p[[4]]$x %in% completo$x))
  # Un anillo de menos de cuatro vértices no se toca.
  expect_equal(lote$p[[2]]$x, hml_proyeccion(features[[1]]$rings[[2]])$x)
})

test_that("el dibujo en lote respeta un estilo por anillo y omite anillos degenerados", {
  f <- tempfile(fileext = ".pdf")
  grDevices::pdf(f)
  grid::grid.newpage()
  p <- list(list(x = c(0.1, 0.2, 0.2), y = c(0.1, 0.1, 0.2)), list(x = 0.5, y = 0.5),
            list(x = c(0.6, 0.7, 0.7), y = c(0.6, 0.6, 0.7)))
  expect_true(.hojas_ruta_mapa_poligonos(p, fill = c("#ff0000", "#00ff00", "#0000ff"), col = NA))
  expect_false(.hojas_ruta_mapa_poligonos(list(), fill = NA))
  g <- grid::grid.get(grid::grid.ls(print = FALSE)$name[[1]])
  expect_identical(g$gp$fill, c("#ff0000", "#0000ff"))
  grDevices::dev.off()
})

test_that("al terminar un distrito se sueltan sus calles y nada más", {
  ctx <- new.env()
  for (cache in c("street_features", "street_feature_index", "street_label_maps", "block_features")) {
    ctx[[cache]] <- new.env()
  }
  assign("070106", 1, ctx$street_features); assign("150110", 1, ctx$street_features)
  assign("070106", 1, ctx$street_feature_index)
  assign("070106|01100|x", 1, ctx$street_label_maps); assign("150110|00102|x", 1, ctx$street_label_maps)
  assign("070106", 1, ctx$block_features)
  .hojas_ruta_entrega_soltar_calles(ctx, "070106")
  expect_identical(ls(ctx$street_features), "150110")
  expect_length(ls(ctx$street_feature_index), 0L)
  expect_identical(ls(ctx$street_label_maps), "150110|00102|x")
  expect_identical(ls(ctx$block_features), "070106")  # las hojas de zona aún lo usan
})

test_that("la entrega dibuja todas las fichas, distrito por distrito, e informa el avance", {
  dibujadas <- character(0)
  avance <- integer(0)
  local_mocked_bindings(
    .hojas_ruta_draw_integrated_pdf = function(block, quota_table, meta, config, out_pdf, render_ctx = NULL) {
      dibujadas <<- c(dibujadas, block$ubigeo)
      invisible(out_pdf)
    }
  )
  tareas <- lapply(c("070106", "150110", "070106", "150110"), function(u) {
    list(block = list(ubigeo = u), qdom = data.frame(), out_pdf = tempfile())
  })
  n <- .hojas_ruta_entrega_fichas(tareas, list(), new.env(), function(h, t) avance <<- c(avance, h))
  expect_identical(n, 4L)
  expect_identical(dibujadas, c("070106", "070106", "150110", "150110"))
  expect_identical(avance, 1:4)
})
