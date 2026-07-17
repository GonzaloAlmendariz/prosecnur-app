# Regresión sistémica de los graficadores de barras: el override de color del
# usuario (colores_categorias / colores_series / colores_grupos) llegaba CRUDO a
# scale_fill_manual y, si traía menos entradas que niveles del factor o venía
# como el DEPARSE de un vector ('c("#0072BC", ...)'), ggplot abortaba con
# "Insufficient values in manual scale" o "Unknown colour name".
# El fix normaliza el override con el helper compartido `.graficos_mk_palette`
# (api/R/graficador_paleta.R) antes de construir cada escala.

.barras_override_fixture_1serie <- function() {
  # 3 categorías, una sola serie: dispara el path colores_categorias.
  data.frame(
    categoria = c("Mujer", "Hombre", "Otro"),
    N = c(520L, 460L, 20L),
    pct = c(0.52, 0.46, 0.02),
    stringsAsFactors = FALSE
  )
}

.barras_override_fixture_2series <- function() {
  # 3 categorías, dos series: dispara el path colores_series.
  data.frame(
    categoria = c("Norte", "Centro", "Sur"),
    N = c(100L, 120L, 90L),
    pct_a = c(0.30, 0.50, 0.20),
    pct_b = c(0.25, 0.45, 0.30),
    stringsAsFactors = FALSE
  )
}

.render_agrupadas_cat <- function(df, colores_categorias) {
  out <- tempfile(fileext = ".png")
  on.exit(unlink(out), add = TRUE)
  graficar_barras_agrupadas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    colores_categorias = colores_categorias,
    mostrar_barra_extra = FALSE,
    mostrar_leyenda = FALSE,
    exportar = "png",
    path_salida = out
  )
  file.exists(out)
}

.render_agrupadas_series <- function(df, colores_series) {
  out <- tempfile(fileext = ".png")
  on.exit(unlink(out), add = TRUE)
  graficar_barras_agrupadas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_a", "pct_b"),
    etiquetas_series = c(pct_a = "Serie A", pct_b = "Serie B"),
    colores_series = colores_series,
    mostrar_barra_extra = FALSE,
    mostrar_leyenda = FALSE,
    exportar = "png",
    path_salida = out
  )
  file.exists(out)
}

test_that("graficar_barras_agrupadas: override de colores más corto que los niveles no crashea", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  df <- .barras_override_fixture_1serie()

  # Un solo color para 3 niveles: reproducción del "Insufficient values".
  expect_error(.render_agrupadas_cat(df, colores_categorias = c("#0B4F8C")), NA)
  # Override parcial (2 de 3): rellena el faltante.
  expect_error(.render_agrupadas_cat(df, colores_categorias = c("#0B4F8C", "#2A9D8F")), NA)
})

test_that("graficar_barras_agrupadas: override deparse string recupera los hex embebidos", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  df <- .barras_override_fixture_1serie()

  # El round-trip de la UI podía entregar el override como el DEPARSE de un
  # vector (un solo string), lo que abortaba con "Unknown colour name".
  expect_error(
    .render_agrupadas_cat(df, colores_categorias = 'c("#0072BC", "#00A98F", "#8FA8C8")'),
    NA
  )
  # Entradas que no son colores válidos: se descartan y se rellena.
  expect_error(
    .render_agrupadas_cat(df, colores_categorias = c("no-es-color", "#2A9D8F", "???")),
    NA
  )
})

test_that("graficar_barras_agrupadas: override correcto y NULL mantienen comportamiento", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  df <- .barras_override_fixture_1serie()

  expect_true(.render_agrupadas_cat(df, colores_categorias = c("#0B4F8C", "#2A9D8F", "#E76F51")))
  expect_true(.render_agrupadas_cat(df, colores_categorias = NULL))
})

test_that("graficar_barras_agrupadas: override de series corto/deparse no crashea", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  df <- .barras_override_fixture_2series()

  # 1 color para 2 series.
  expect_error(.render_agrupadas_series(df, colores_series = c("#0B4F8C")), NA)
  # deparse string.
  expect_error(.render_agrupadas_series(df, colores_series = 'c("#0072BC", "#00A98F")'), NA)
})

# El helper compartido `.graficos_mk_palette` es la única fuente del saneo:
# verificamos sus contratos de longitud, deparse y descarte de no-color.
test_that(".graficos_mk_palette rellena, extrae hex del deparse y descarta no-color", {
  # Rellena a la longitud de niveles cuando el override viene corto.
  pal <- .graficos_mk_palette(c("A", "B", "C"), pal_user = c("#0B4F8C"))
  expect_length(pal, 3L)
  expect_identical(names(pal), c("A", "B", "C"))
  expect_true(all(!is.na(pal) & nzchar(pal)))

  # Extrae los hex embebidos del deparse de un vector.
  pal2 <- .graficos_mk_palette(c("A", "B", "C"), pal_user = 'c("#0072BC", "#00A98F", "#8FA8C8")')
  expect_length(pal2, 3L)
  expect_true(all(grepl("^#[0-9A-Fa-f]{6}$", unname(pal2))))

  # Descarta entradas que no son colores válidos y rellena.
  pal3 <- .graficos_mk_palette(c("A", "B", "C"), pal_user = c("no-es-color", "#2A9D8F", "???"))
  expect_length(pal3, 3L)
  expect_true(all(vapply(unname(pal3), function(col) {
    tryCatch({ grDevices::col2rgb(col); TRUE }, error = function(e) FALSE)
  }, logical(1))))
})
