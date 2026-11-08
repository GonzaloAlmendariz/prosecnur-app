# Divergentes: el saldo se mide sobre las cifras rotuladas (ADR 0135).
#
# Arte, 2026-11-08: la lámina decía «Negativo 11%», «Positivo 84%» y «+74 pp», porque el saldo sumaba los valores sin
# redondear (84.416 - 10.389 = 74.03). La diferencia de lo rotulado es 73.

.dsr_rotulos <- function(p) {
  b <- ggplot2::ggplot_build(p)
  labs <- unlist(lapply(b$data, function(x) if ("label" %in% names(x)) as.character(x$label)))
  labs[!is.na(labs) & nzchar(labs)]
}

.dsr_et <- c(td = "Totalmente en desacuerdo", ed = "En desacuerdo", da = "De acuerdo", ta = "Totalmente de acuerdo", si = "SIN INF")

test_that("con las proporciones de Arte el saldo dice +73 pp, la resta de los lados rotulados, y no +74 pp", {
  d <- data.frame(item = "El reglamento es pertinente", td = 2.597, ed = 7.792, da = 75.325, ta = 9.091, si = 5.195,
                  stringsAsFactors = FALSE)
  p <- graficar_barras_divergentes(d, "item", c("td", "ed", "da", "ta", "si"), etiquetas_grupos = .dsr_et,
                                   n_negativas = 2, incluir_neutro = FALSE, mostrar_saldo = TRUE)
  labs <- .dsr_rotulos(p)
  expect_true("+73 pp" %in% labs)
  expect_false("+74 pp" %in% labs)
  e <- attr(p, "pulso_espec")
  expect_equal(e$total_pos - e$total_neg, 73)
})

test_that("con varias filas el saldo de cada una se empareja por fila aunque la espec las ordene distinto", {
  d <- data.frame(item = c("Baja", "Arte"), td = c(30, 2.597), ed = c(20, 7.792), da = c(30, 75.325), ta = c(10, 9.091),
                  si = c(10, 5.195), stringsAsFactors = FALSE)
  p <- graficar_barras_divergentes(d, "item", c("td", "ed", "da", "ta", "si"), etiquetas_grupos = .dsr_et,
                                   n_negativas = 2, incluir_neutro = FALSE, mostrar_saldo = TRUE)
  e <- attr(p, "pulso_espec")
  expect_identical(e$filas, c("Arte", "Baja"))
  labs <- .dsr_rotulos(p)
  expect_true(all(c("+73 pp", "-10 pp") %in% labs))
  expect_equal(.divergentes_saldo_rotulado(c("Baja", "Arte"), c(-10, 74.03), e), c(-10, 73))
  expect_equal(.divergentes_saldo_rotulado("x", 74.03, NULL), 74.03)
})
