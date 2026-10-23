# V1/N14 (checklist-comentarios-renzo-arte): el panel de respaldo de una lámina mixta (`mixta:respaldo`) lleva sus cifras
# y el grosor de sus barras al estándar de los paneles nativos hermanos: antes la cifra salía a 14 pt montada sobre barras
# más delgadas que las del panel de al lado. Sólo tamaño y posición; valores, orden y denominadores no cambian.

.rsp_xml <- function(doc) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
}
.rsp_cajas <- function(xml, patron) {
  sp <- xml2::xml_find_all(xml, "//p:sp")
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "./p:nvSpPr/p:cNvPr"), "name")
  sp <- sp[grepl(patron, nm)]
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  sz <- suppressWarnings(as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr"), "sz"))) / 100
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400,
             sz = sz, txt = vapply(sp, function(s) paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t")), collapse = ""), ""))
}

# Lámina de cinco paneles (la de perfil de Arte): cuatro nativos y el quinto de respaldo (gráfico de lienzo del motor).
.rsp_lamina <- function() {
  cats <- c("Principal", "Asociado", "Auxiliar", "Jefe de Práctica", "Contratado")
  pct <- c(.03, .11, .17, .42, .27)
  nativo <- function() preparar_categorica(cats[1:4], pct[1:4] / sum(pct[1:4]), paste0(round(100 * pct[1:4] / sum(pct[1:4])), "%"), NULL)
  df <- data.frame(categoria = cats, N = 115, pct = pct)
  g <- suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Porcentaje"),
    mostrar_leyenda = FALSE, exportar = "rplot", usar_canvas = TRUE, size_texto_barras = 4.92, preservar_tamanos_texto = TRUE,
    canvas_min_filas = 7, ancho = 5.86, alto = 5.66))
  # `ancho`/`alto` de arriba son los de diseño del gráfico; la caja real la fija la lámina.
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  list(g = g, doc = .lam_laminas_mixta(doc, list(nativo(), nativo(), nativo(), nativo(), nativo()), "poblacion_5",
                                       preguntas = list("A", "B", "C", "D", "E"), publicos = list(NULL, NULL, NULL, NULL, NULL),
                                       titulo = "Perfil", base = "Base: 115 docentes", folio = 2L,
                                       respaldo = list(NULL, NULL, NULL, NULL, g))$doc)
}

test_that("el respaldo de un panel de cinco categorías lleva las cifras y el grosor de los paneles nativos hermanos", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("xml2")
  xml <- .rsp_xml(.rsp_lamina()$doc)
  nat_barras <- .rsp_cajas(xml, "^barra$"); nat_cifras <- .rsp_cajas(xml, "^cifra$")
  rc <- .rsp_cajas(xml, "^rc[0-9]+$"); tx <- .rsp_cajas(xml, "^tx[0-9]+$")
  caja <- rc[1, ]; barras <- rc[rc$w < caja$w - 1e-6 & rc$h < caja$h - 1e-6, ]
  cifras <- tx[grepl("%$", tx$txt), ]
  expect_equal(nrow(barras), 5L); expect_equal(nrow(cifras), 5L)
  # tamaño de la cifra == el de los nativos (±0,5 pt)
  expect_true(all(abs(cifras$sz - min(tail(nat_cifras$sz, 4))) <= 0.5))
  # grosor == el del panel hermano de cinco categorías (±0,03 in)
  expect_true(all(abs(barras$h - median(tail(nat_barras$h, 4))) <= 0.03))
  # la cifra va fuera del extremo de su barra, sin montarse sobre ella
  for (i in seq_len(nrow(cifras))) {
    b <- barras[which.min(abs((barras$y + barras$h / 2) - (cifras$y[i] + cifras$h[i] / 2))), ]
    expect_gte(cifras$x[i] + 1e-3, b$x + b$w)
  }
})

test_that("el ajuste del respaldo no cambia cifras ni orden y un gráfico ajeno al lienzo sale como llegó", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("xml2")
  xml <- .rsp_xml(.rsp_lamina()$doc)
  tx <- .rsp_cajas(xml, "^tx[0-9]+$")
  expect_equal(tx$txt[grepl("%$", tx$txt)], c("3%", "11%", "17%", "42%", "27%"))
  p <- ggplot2::ggplot(data.frame(x = 1:3, y = 1:3), ggplot2::aes(x, y)) + ggplot2::geom_point()
  expect_identical(.lam_mixta_respaldo_cifras(p, 3, 1.5), p)
})
