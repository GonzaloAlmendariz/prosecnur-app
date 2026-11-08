# Composición: el lienzo de escala recibe el alto real de su slot.
#
# `graficos_2_vertical` pasaba al graficador el ancho del hueco pero no el alto: la apilada se dibujaba para 6 in y se
# pegaba en 2.57, y la base «Base: 77» caía 0.013 in bajo la leyenda «SIN INF» (lámina de Arte, 2026-11-08). La regla de
# entregables pide al menos 0.03 in de aire vertical entre pie y leyenda.

.cas_fixture <- function() {
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

.cas_cajas <- function(pth) {
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

test_that("en graficos_2_vertical la base de la apilada queda al menos 0.03 in bajo la leyenda SIN INF", {
  skip_if_not_installed("officer")
  fx <- .cas_fixture()
  s <- p_slide_2_graficos_vertical(
    titulo = "Prueba", superior = p_barras_agrupadas(var = "doc$p18"),
    inferior = p_barras_apiladas(var = "doc$q19", cruces = "doc$ded",
                                 overrides = list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))))
  pth <- tempfile(fileext = ".pptx")
  on.exit(unlink(pth), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = fx$data, instrumento = fx$instrumento, presets = .build_presets(.enriquecer_presets(list(), NULL)),
    plan = p_plan(slides = list(s)), path_ppt = pth, mensajes_progreso = FALSE)))
  cj <- .cas_cajas(pth)
  sin <- cj[cj$txt == "SIN INF", ]
  expect_equal(nrow(sin), 1L)
  base <- cj[grepl("^Base", cj$txt) & cj$y > sin$y - 0.5, ]
  base <- base[which.max(base$y), ]
  expect_gte(base$y - (sin$y + sin$h), 0.03)
})

test_that(".composicion_alto_slot lee loc$height y, sin él, el alto del marcador; las agrupadas no reciben alto", {
  expect_equal(.composicion_alto_slot(NULL, list(slots = list(a = list(loc = list(height = 2.5)))), "a"), 2.5)
  expect_null(.composicion_alto_slot(NULL, list(slots = list()), "a"))
  expect_true(.composicion_recibe_alto(p_barras_apiladas(var = "doc$q19")))
  expect_false(.composicion_recibe_alto(p_barras_agrupadas(var = "doc$p18")))
})
