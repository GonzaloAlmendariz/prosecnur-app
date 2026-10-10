# K15 — los layouts de la ruta anterior conforman al estándar (una sola fuente).
#
# Ocho tipos sin renderer nativo (3, 4, 8, 9, 11, 16, 19, 20) ponen cada gráfico en un placeholder de un layout de
# plantilla_16_9.pptx. La correspondencia placeholder ↔ ranura vive en plantilla_layouts_estandar.R y el script
# api/scripts/plantilla_layouts_desde_estandar.R reescribe los layouts con ella. Este test mide el .pptx versionado:
# (1) cada placeholder está en su ranura del estándar (0.02 in), y (2) officer le da el `type_idx` que el contrato del
# motor espera, de modo que cada gráfico cae en su ranura y no en la del vecino.

.ple_plantilla <- function() system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")

test_that("cada placeholder de la ruta anterior está en su ranura del estándar (0.02 in)", {
  doc <- officer::read_pptx(.ple_plantilla())
  for (layout in names(.plantilla_layouts_estandar())) {
    filas <- .plantilla_layouts_estandar()[[layout]]
    lp <- officer::layout_properties(doc, layout = layout)
    for (i in seq_len(nrow(filas))) {
      fila <- filas[i, , drop = FALSE]
      ph <- lp[!is.na(lp$ph) & grepl(sprintf('idx="%d"', as.integer(fila$idx)), lp$ph, fixed = TRUE), , drop = FALSE]
      expect_equal(nrow(ph), 1L, label = sprintf("%s idx %d", layout, fila$idx))
      caja <- .plantilla_layout_caja(fila)
      real <- c(x = ph$offx, y = ph$offy, w = ph$cx, h = ph$cy)
      expect_lte(max(abs(real - caja)), 0.02,
                 label = sprintf("%s idx %d (%s ranura %s): real %s, estándar %s", layout, fila$idx, fila$tipo, fila$ranura,
                                 paste(round(real, 3), collapse = "/"), paste(round(caja, 3), collapse = "/")))
    }
  }
})

test_that("officer numera los placeholders como el contrato del motor espera (cada gráfico en su ranura)", {
  doc <- officer::read_pptx(.ple_plantilla())
  for (layout in names(.plantilla_layouts_estandar())) {
    filas <- .plantilla_layouts_estandar()[[layout]]
    lp <- officer::layout_properties(doc, layout = layout)
    for (i in seq_len(nrow(filas))) {
      fila <- filas[i, , drop = FALSE]
      ph <- lp[!is.na(lp$ph) & grepl(sprintf('idx="%d"', as.integer(fila$idx)), lp$ph, fixed = TRUE), , drop = FALSE]
      expect_identical(ph$type, fila$ph, label = sprintf("%s idx %d, tipo", layout, fila$idx))
      expect_equal(as.integer(ph$type_idx), as.integer(fila$type_idx), label = sprintf("%s idx %d, type_idx", layout, fila$idx))
    }
  }
})

test_that("el script es idempotente: reescribir la plantilla versionada no la cambia", {
  out <- tempfile(fileext = ".pptx")
  .plantilla_layouts_desde_estandar(.ple_plantilla(), out)
  a <- officer::read_pptx(.ple_plantilla()); b <- officer::read_pptx(out)
  for (layout in names(.plantilla_layouts_estandar())) {
    pa <- officer::layout_properties(a, layout = layout); pb <- officer::layout_properties(b, layout = layout)
    expect_equal(pb[, c("offx", "offy", "cx", "cy")], pa[, c("offx", "offy", "cx", "cy")], tolerance = 1e-6, label = layout)
  }
})
