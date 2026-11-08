# Apiladas: dos cifras vecinas de la misma fila no se montan.
#
# `.estimate_label_width_apiladas` medía la cifra como fracción de la barra sin conocer su ancho físico: en la apilada de
# una composición «4%» (14 pt, negrita) sobre un segmento de 0.164 in contaba como «entra» y se pintaba encima del «7%»
# vecino (Arte, 2026-11-08). La cifra se mide ahora en pulgadas (graficador_barras_apiladas_ancho_cifra.R).

.acm_fixture <- function() {
  q <- c(rep("2", 2), rep("3", 20), rep("4", 1), rep("1", 2), rep("2", 4), rep("3", 38), rep("4", 6), rep("9", 4))
  d <- data.frame(q19 = q, ded = c(rep("1", 23), rep("2", 54)), p18 = "1", stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = c("q19", "ded", "p18"), type = c("select_one lk", "select_one dd", "select_one sn"),
                        list_name = c("lk", "dd", "sn"),
                        label = c("El reglamento es pertinente", "Dedicación", "¿Conoce el reglamento?"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("lk", 5), "dd", "dd", "sn", "sn"), name = c("1", "2", "3", "4", "9", "1", "2", "1", "2"),
                         label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
                                   "Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)", "Sí", "No"), stringsAsFactors = FALSE),
    orders_list = NULL)
  list(data = list(doc = d), instrumento = list(doc = inst))
}

.acm_cajas <- function(pth) {
  x <- paste(readLines(unz(pth, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  parts <- strsplit(x, "(?=<p:cNvPr )", perl = TRUE)[[1]]
  out <- list()
  for (p in parts) {
    t <- gsub("</?a:t>", "", regmatches(p, gregexpr("<a:t>[^<]*</a:t>", p))[[1]])
    o <- regmatches(p, regexec('<a:off x="(-?[0-9]+)" y="(-?[0-9]+)"/>\\s*<a:ext cx="([0-9]+)" cy="([0-9]+)"', p))[[1]]
    if (length(o) == 5 && length(t)) {
      v <- as.numeric(o[2:5]) / 914400
      out[[length(out) + 1]] <- data.frame(txt = paste(t, collapse = ""), x = v[1], y = v[2], w = v[3], h = v[4], stringsAsFactors = FALSE)
    }
  }
  do.call(rbind, out)
}

test_that("en la apilada de una composición las cajas de cifras de la misma fila no se solapan en x", {
  skip_if_not_installed("officer")
  fx <- .acm_fixture()
  s <- p_slide_2_graficos_vertical(
    titulo = "Prueba", superior = p_barras_agrupadas(var = "doc$p18"),
    inferior = p_barras_apiladas(var = "doc$q19", cruces = "doc$ded",
                                 overrides = list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))))
  pth <- tempfile(fileext = ".pptx")
  on.exit(unlink(pth), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = fx$data, instrumento = fx$instrumento, presets = .build_presets(.enriquecer_presets(list(), NULL)),
    plan = p_plan(slides = list(s)), path_ppt = pth, mensajes_progreso = FALSE)))
  cj <- .acm_cajas(pth)
  pct <- cj[grepl("^[0-9]+%$", cj$txt), ]
  expect_gte(nrow(pct), 8L)
  choques <- character(0)
  for (a in seq_len(nrow(pct) - 1L)) for (b in (a + 1L):nrow(pct)) {
    A <- pct[a, ]; B <- pct[b, ]
    solapa_y <- A$y < B$y + B$h && B$y < A$y + A$h
    solapa_x <- A$x < B$x + B$w && B$x < A$x + A$w
    if (solapa_y && solapa_x) choques <- c(choques, paste(A$txt, "sobre", B$txt))
  }
  expect_identical(choques, character(0))
})

test_that(".apiladas_ancho_cifra_frac mide la tinta en pulgadas sobre el ancho de la barra", {
  w <- .apiladas_ancho_cifra_frac(c("4%", "70%"), size = 14 / ggplot2::.pt, bold = TRUE, ancho_barras_in = 4)
  tinta <- .lam_ancho_tinta(c("4%", "70%"), 14, bold = TRUE)
  expect_equal(w, tinta / 4)
  expect_gt(w[2], w[1])
  expect_equal(.apiladas_ancho_cifra_frac("4%", 3, ancho_barras_in = NA_real_), 0)
  expect_equal(.apiladas_ancho_barras_in(10, 0, 0, 0.38, 0, 0.52, 0, 0), 10 * 0.52 / 0.90)
  expect_true(is.na(.apiladas_ancho_barras_in(NA, 0, 0, 0.38, 0, 0.52, 0, 0)))
})
