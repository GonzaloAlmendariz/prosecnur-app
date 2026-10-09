# ADR 0092 (F2.7f) — el mapa de cobertura con la diagramación del recetario:
# leyenda al lado, en vertical y al pie; rótulos sin recuadro que no se pisan.

.ctx_mapa <- function() {
  cuadro <- function(x0, y0) list(list(x = c(x0, x0 + 1, x0 + 1, x0), y = c(y0, y0, y0 + 1, y0 + 1)))
  list(
    scope = "district", mostrar_titulo = FALSE,
    zones = list(list(rings = cuadro(0, 0), status = "intervencion", zona = "A", distrito = "A"),
                 list(rings = cuadro(1.2, 0), status = "comparacion", zona = "B", distrito = "B")),
    district_labels = list(list(x = 0.5, y = 0.5, distrito = "Distrito A"), list(x = 1.7, y = 0.5, distrito = "Distrito B"))
  )
}

test_that("la leyenda va al lado, en vertical y alineada al pie del mapa", {
  p <- suppressWarnings(graficar_mapa_cobertura_territorial(contexto = .ctx_mapa()))
  expect_identical(p$theme$legend.position, "right")
  expect_identical(p$theme$legend.direction, "vertical")
  expect_equal(as.numeric(p$theme$legend.justification), c(0, 0))
})

test_that("los rótulos de distrito son texto que descarta los que se pisarían", {
  p <- suppressWarnings(graficar_mapa_cobertura_territorial(contexto = .ctx_mapa()))
  capas <- Filter(function(l) inherits(l$geom, "GeomText") && !inherits(l$geom, "GeomLabel"), p$layers)
  expect_length(capas, 1L)
  expect_true(isTRUE(capas[[1]]$geom_params$check_overlap))
})
