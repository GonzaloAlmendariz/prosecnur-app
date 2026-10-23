# Una categoría declarada con casos no se pierde en el Word porque su cifra redondee a 0 % (Arte, Gráfico 9: «2021-I», 1 caso
# de 279). El ggplot de la agrupada la conserva con su piso (`.cero_con_casos`) y el PPT de varios gráficos la dibuja; la
# espec de una serie (la que lee el Word y la lámina nativa) la tiraba con `sin_ceros`. Las que nadie eligió (n = 0) siguen
# la decisión de lámina «Mostrar opciones 0 %»: fuera por defecto (C40 «1a»), dentro si se pide.
withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))

# Como la arma el plan: tabla ancha con N, la columna de casos por serie (`cols_n`) y sin umbral de barra.
.wc_graf <- function(n, ...) {
  cats <- LETTERS[seq_along(n)]
  d <- data.frame(cat = cats, N = sum(n), pct = n / sum(n), n_pct = n, stringsAsFactors = FALSE)
  suppressMessages(suppressWarnings(graficar_barras_agrupadas(d, var_categoria = "cat", var_n = "N", cols_porcentaje = "pct", cols_n = c(pct = "n_pct"),
    etiquetas_series = c(pct = "Total"), decimales = 0, umbral_barra = 0, orden_barras = "instrumento", invertir_barras = TRUE, ...)))
}
# Rótulo -> cifra de lo que dibuja el Word, de arriba hacia abajo.
.wc_word <- function(g) {
  w <- .word_grafico(g); expect_identical(attr(w, "renderer"), "categorica")
  b <- suppressWarnings(ggplot2::ggplot_build(w))
  cif <- b$data[[2]]; rot <- b$data[[3]]; rot <- rot[order(-rot$y), ]
  setNames(vapply(rot$y, function(y) as.character(cif$label[which.min(abs(cif$y - y))]), ""), gsub("\n", " ", rot$label))
}

test_that("el Word muestra la categoría con casos cuya cifra redondea a 0 %", {
  w <- .wc_word(.wc_graf(c(1000, 200, 1)))
  expect_identical(names(w), c("A", "B", "C"))
  expect_identical(unname(w), c("83%", "17%", "0%"))
})

test_that("la categoría con casos en 0 % conserva su lugar entre las demás, también en la espec", {
  e <- attr(.wc_graf(c(1000, 1, 200)), "pulso_espec")
  expect_identical(e$rotulos, c("A", "B", "C"))
  expect_identical(e$cifras, c("83%", "0%", "17%"))
})

test_that("una categoría sin casos sigue «Mostrar opciones 0 %»: fuera por defecto, dentro si se pide", {
  expect_identical(names(.wc_word(.wc_graf(c(1000, 200, 0)))), c("A", "B"))
  w <- .wc_word(.wc_graf(c(1000, 200, 0), mostrar_ceros = TRUE))
  expect_identical(names(w), c("A", "B", "C"))
  expect_identical(unname(w)[3], "0%")
})
