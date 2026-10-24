source("setup-load-all.R")

# Gonzalo (2026-10-23): «Prefiero no responder» en gris es adicional, sólo si el analista lo desea; por defecto no.
# Las residuales siguen al FINAL en cualquier caso: el opcional es el color, no el lugar.

.rg_fills <- function(g) {
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  unlist(lapply(b$data, function(l) if ("fill" %in% names(l)) as.character(l$fill)))
}
.rg_cols <- function(g) {
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  unlist(lapply(b$data, function(l) if ("colour" %in% names(l)) as.character(l$colour)))
}
.rg_esp <- function(...) preparar_categorica(c("Prefiero no responder", "Mujer", "Hombre", "Agénero"), c(.05, .50, .40, .05),
                                             c("5%", "50%", "40%", "5%"), ...)

test_that("la espec lleva residuales_gris apagado por defecto y el residual sigue al final", {
  e <- .rg_esp()
  expect_false(e$residuales_gris)
  expect_identical(e$rotulos[length(e$rotulos)], "Prefiero no responder")
  expect_true(.rg_esp(residuales_gris = TRUE)$residuales_gris)
  expect_identical(.rg_esp(residuales_gris = TRUE)$rotulos, e$rotulos)
})

test_that("barras Word: por defecto el residual lleva el color de las demás; encendido, el gris", {
  T <- .WORD_TINTA
  f0 <- .rg_fills(.word_g_barras(.rg_esp()))
  expect_false(T$gris %in% f0)
  expect_identical(unique(f0), T$navy)
  f1 <- .rg_fills(.word_g_barras(.rg_esp(residuales_gris = TRUE)))
  expect_identical(sum(f1 == T$gris), 1L)
  expect_identical(f1[length(f1)], T$gris)
})

test_that("barras Word con realce: sin gris el residual es tenue, no gris; la mayor sigue sin contar residuales", {
  T <- .WORD_TINTA
  e <- preparar_categorica(c("Otro", "A", "B", "C"), c(.6, .2, .1, .1), c("60%", "20%", "10%", "10%"), resaltar = TRUE)
  expect_true(isTRUE(e$realce))
  f0 <- .rg_fills(.word_g_barras(e))
  expect_false(T$gris %in% f0)
  expect_identical(f0[1], T$navy)                    # A: la mayor sin contar la residual
})

test_that("lollipop Word: por defecto sin gris; encendido, gris", {
  T <- .WORD_TINTA
  c0 <- c(.rg_fills(.word_g_lollipop(.rg_esp())), .rg_cols(.word_g_lollipop(.rg_esp())))
  expect_false(T$gris %in% c0)
  c1 <- c(.rg_fills(.word_g_lollipop(.rg_esp(residuales_gris = TRUE))), .rg_cols(.word_g_lollipop(.rg_esp(residuales_gris = TRUE))))
  expect_true(T$gris %in% c1)
})

.rg_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.rg_puntos <- function(...) {
  d <- data.frame(cat = c("Prefiero no responder", "B", "A"), v = c(4, 21, 29))
  e <- attr(graficar_lollipop(d, "cat", "v", ...), "pulso_espec")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  xml <- .rg_xml(.lam_laminas_lollipop(doc, e, "Mejoras", folio = 72)$doc)
  col <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='lollipop:punto']]//a:solidFill/a:srgbClr"), "val")
  list(rotulos = e$rotulos, col = col[seq(1, length(col), 2)])   # un srgbClr de relleno y uno de línea por punto
}

test_that("lollipop PPT nativo: por defecto la residual lleva el azul y va al final; encendido, el tenue", {
  p0 <- .rg_puntos()
  expect_identical(p0$rotulos[3], "Prefiero no responder")
  expect_length(unique(p0$col), 1L)
  p1 <- .rg_puntos(residuales_gris = TRUE)
  expect_identical(p1$rotulos, p0$rotulos)
  expect_identical(p1$col[3], .lam_hex(.std_color("texto_tenue")))
  expect_identical(unique(p1$col[1:2]), .lam_hex(.std_color("azul")))
})

test_that("la opción está declarada y llega del plan guardado a la espec (config -> constructor -> graficador)", {
  for (g in c("p_barras_categoricas", "p_barras_agrupadas", "p_lollipop")) {
    a <- Filter(function(x) identical(x$name, "residuales_gris"), .GRAFICADORES_META[[g]]$args)
    expect_length(a, 1L)
    expect_identical(a[[1]]$tipo_input, "bool"); expect_false(a[[1]]$default); expect_identical(a[[1]]$label, "Residuales en gris")
  }
  for (g in c("p_barras_categoricas", "p_barras_agrupadas", "p_lollipop")) {
    el <- .graficos_rebuild_graf_json(list(graficador = g, args = list(var = "x", residuales_gris = TRUE)))
    expect_true(isTRUE(el$overrides$residuales_gris), label = g)
    el0 <- .graficos_rebuild_graf_json(list(graficador = g, args = list(var = "x")))
    expect_null(el0$overrides$residuales_gris)
  }
  # y el graficador la acepta y la deja en la espec
  d <- data.frame(cat = c("Prefiero no responder", "B", "A"), v = c(.04, .21, .75))
  e <- attr(graficar_barras_categoricas(d, "cat", "v", modo_valor = "porcentaje", residuales_gris = TRUE), "pulso_espec")
  expect_true(e$residuales_gris)
  expect_false(attr(graficar_barras_categoricas(d, "cat", "v", modo_valor = "porcentaje"), "pulso_espec")$residuales_gris)
})
