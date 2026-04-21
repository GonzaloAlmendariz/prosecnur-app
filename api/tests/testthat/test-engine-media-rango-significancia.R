extract_media_rango_delta_labels <- function(p) {
  gb <- suppressWarnings(ggplot2::ggplot_build(p))
  labs <- unlist(lapply(gb$data, function(layer) {
    if (!("label" %in% names(layer))) return(character(0))
    as.character(layer$label)
  }), use.names = FALSE)
  labs[!is.na(labs) & nzchar(labs)]
}

test_that("graficar_media_rango destaca solo deltas significativos cuando se pide", {
  df <- data.frame(
    categoria = rep(c("A", "B"), each = 12),
    valor = c(seq(88, 99, length.out = 12), seq(51, 62, length.out = 12)),
    stringsAsFactors = FALSE
  )

  p <- graficar_media_rango(
    data = df,
    var_categoria = "categoria",
    var_valor = "valor",
    modo = "score_ref",
    mostrar_ref_line = TRUE,
    mostrar_rango = FALSE,
    destacar_significativos = TRUE,
    mostrar_delta_no_significativo = FALSE,
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  labels <- extract_media_rango_delta_labels(p)
  expect_true(any(grepl("^\\+", labels)))
  expect_true(any(grepl("^-", labels)))
})

test_that("graficar_media_rango puede ocultar deltas no significativos", {
  set.seed(123)
  df <- data.frame(
    categoria = rep(c("A", "B"), each = 20),
    valor = c(rnorm(20, mean = 70, sd = 12), rnorm(20, mean = 71, sd = 12)),
    stringsAsFactors = FALSE
  )

  p <- graficar_media_rango(
    data = df,
    var_categoria = "categoria",
    var_valor = "valor",
    modo = "score_ref",
    mostrar_ref_line = TRUE,
    mostrar_rango = FALSE,
    umbral_brecha = 0,
    destacar_significativos = TRUE,
    mostrar_delta_no_significativo = FALSE,
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  labels <- extract_media_rango_delta_labels(p)
  expect_false(any(grepl("^[+-]", labels)))
})

test_that("graficar_media_rango admite modo_semaforo degradado", {
  df <- data.frame(
    categoria = rep(c("A", "B", "C", "D", "E"), each = 6),
    valor = c(
      rep(1.0, 6),
      rep(1.8, 6),
      rep(3.0, 6),
      rep(4.2, 6),
      rep(5.0, 6)
    ),
    stringsAsFactors = FALSE
  )

  p <- graficar_media_rango(
    data = df,
    var_categoria = "categoria",
    var_valor = "valor",
    mostrar_rango = FALSE,
    mostrar_leyenda = FALSE,
    cortes_chip = c(2, 4),
    modo_semaforo = "degradado",
    chip_colores = c(rojo = "#AA0000", ambar = "#BBBB00", verde = "#00AA00"),
    usar_canvas = FALSE,
    exportar = "rplot"
  )

  gb <- ggplot2::ggplot_build(p)
  fills <- unique(unlist(lapply(gb$data, function(layer) {
    if (!("fill" %in% names(layer))) return(character(0))
    as.character(layer$fill)
  }), use.names = FALSE))
  fills <- toupper(fills[!is.na(fills) & nzchar(fills)])
  pal <- c("#AA0000", "#BBBB00", "#00AA00")

  expect_gt(length(unique(fills)), 3L)
  expect_true(any(!fills %in% pal))
})
