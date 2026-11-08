# Ola 2, E3 (diag4/e3_saldo.R): con `valores_decimales = 1` las cifras de la divergente salen con un decimal y los lados
# también («Negativo 10.3%», «Positivo 84.4%»), pero el saldo se escribía redondeado a entero: «+74 pp». Decisión del lead:
# el saldo lleva los mismos decimales que los rótulos, así que la resta de lo rotulado (84.4 - 10.3) se lee «+74.1 pp».

.ola2_e3_et <- c(td = "Totalmente en desacuerdo", ed = "En desacuerdo", da = "De acuerdo", ta = "Totalmente de acuerdo",
                 si = "SIN INF")
.ola2_e3_d <- data.frame(item = "P", td = 2.64, ed = 7.74, da = 75.36, ta = 9.04, si = 5.22, stringsAsFactors = FALSE)

.ola2_e3_rotulos <- function(p) {
  b <- ggplot2::ggplot_build(p)
  labs <- unlist(lapply(b$data, function(x) if ("label" %in% names(x)) as.character(x$label)))
  labs[!is.na(labs) & nzchar(labs)]
}

.ola2_e3 <- function(dec) {
  graficar_barras_divergentes(.ola2_e3_d, "item", names(.ola2_e3_et), etiquetas_grupos = .ola2_e3_et, n_negativas = 2,
                              incluir_neutro = FALSE, valores_decimales = dec, mostrar_saldo = TRUE)
}

test_that("E3: con valores_decimales = 1 el saldo se escribe con un decimal: «+74.1 pp»", {
  skip_if_not_installed("ggplot2")
  p <- .ola2_e3(1L)
  labs <- .ola2_e3_rotulos(p)
  # Precondición: las cifras ya salen con un decimal.
  expect_true(all(c("75.4%", "9.0%") %in% labs))
  expect_true("+74.1 pp" %in% labs, info = paste("rótulos:", paste(labs, collapse = " ")))
  expect_false("+74 pp" %in% labs)
})

test_that("E3: con valores_decimales = 0 el saldo sigue entero y sale de lo rotulado («+73 pp»)", {
  skip_if_not_installed("ggplot2")
  labs <- .ola2_e3_rotulos(.ola2_e3(0L))
  expect_true("+73 pp" %in% labs)
})
