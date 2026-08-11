# Convención de redondeo de la casa: el 0,5 SIEMPRE sube.
#
# R redondea al entero par (`round(12.5) == 12`, `round(13.5) == 14`) y el
# `sprintf` de C hace lo mismo, así que el mismo 0,5 subía o bajaba según la
# paridad del vecino: en un solo gráfico de los informes ACRD Ingeniería
# convivían 87,5 % → 88 % y 12,5 % → 12 %. No había regla que el lector
# pudiera seguir. La familia de dimensiones ya redondeaba hacia arriba con un
# helper propio (duplicado); el resto de los graficadores no.
#
# Este test fija la conducta en los tres valores frontera —12,5 · 13,5 · 2,5—
# para cada graficador que muestra porcentajes. Con la regla de R daban
# 12 · 14 · 2; con la de la casa dan 13 · 14 · 3.

# ---------------------------------------------------------------------------
# Extractor de etiquetas
# ---------------------------------------------------------------------------
#
# Los graficadores devuelven o un ggplot pelado (`usar_canvas = FALSE`) o un
# canvas de cowplot que anida los sub-plots en list-columns de sus capas. Este
# walker recoge cualquier texto de ambos casos para no depender de la
# estructura interna de cada motor.
.rmu_labels <- function(x, depth = 0L) {
  out <- character(0)
  if (depth > 6L) return(out)
  if (inherits(x, "ggplot")) {
    for (ly in x$layers) {
      d <- tryCatch(ly$data, error = function(e) NULL)
      if (is.data.frame(d)) {
        for (nm in names(d)) {
          v <- d[[nm]]
          if (is.character(v) || is.factor(v)) {
            out <- c(out, as.character(v))
          } else if (is.list(v)) {
            out <- c(out, .rmu_labels(v, depth + 1L))
          }
        }
      }
      out <- c(out, .rmu_labels(ly$aes_params, depth + 1L))
      out <- c(out, .rmu_labels(ly$geom_params, depth + 1L))
    }
    gb <- tryCatch(suppressWarnings(ggplot2::ggplot_build(x)), error = function(e) NULL)
    if (!is.null(gb)) {
      for (ld in gb$data) if ("label" %in% names(ld)) out <- c(out, as.character(ld$label))
    }
  } else if (is.list(x)) {
    for (el in x) out <- c(out, .rmu_labels(el, depth + 1L))
  } else if (is.character(x)) {
    out <- c(out, x)
  }
  unique(out[!is.na(out) & nzchar(out)])
}

.rmu_pct <- function(p) grep("%", .rmu_labels(p), value = TRUE)

.rmu_skip <- function() {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  skip_if_not_installed("cowplot")
}

# ---------------------------------------------------------------------------
# Helper compartido
# ---------------------------------------------------------------------------

test_that(".pulso_round_half_up sube el 0,5 sin importar la paridad del vecino", {
  expect_identical(.pulso_round_half_up(12.5), 13)
  expect_identical(.pulso_round_half_up(13.5), 14)
  expect_identical(.pulso_round_half_up(2.5), 3)
  expect_identical(.pulso_round_half_up(0.5), 1)

  # Simetría: en negativos "hacia arriba" es hacia arriba en valor absoluto,
  # que es como redondea el helper histórico de dimensiones.
  expect_identical(.pulso_round_half_up(-12.5), -13)
  expect_identical(.pulso_round_half_up(-2.5), -3)

  # Decimales.
  expect_identical(.pulso_round_half_up(12.25, 1), 12.3)
  expect_identical(.pulso_round_half_up(2.25, 1), 2.3)

  # Los que no son empate se comportan como siempre.
  expect_identical(.pulso_round_half_up(12.4), 12)
  expect_identical(.pulso_round_half_up(12.6), 13)

  expect_true(is.na(.pulso_round_half_up(NA_real_)))
  expect_identical(.pulso_round_half_up(numeric(0)), numeric(0))
})

test_that(".pulso_fmt_half_up formatea elemento por elemento y no contagia decimales", {
  expect_identical(.pulso_fmt_half_up(c(12.5, 13.5, 2.5), 0), c("13", "14", "3"))
  expect_identical(.pulso_fmt_half_up(c(12.25, 13.35), 1), c("12.3", "13.4"))

  # `format(nsmall=)` iguala los decimales de todo el vector: con 1 decimal
  # pedido devolvía "12.50" para c(12.5, 3.25). El formateo de la casa es
  # independiente por elemento.
  expect_identical(.pulso_fmt_half_up(c(12.5, 3.25), 1), c("12.5", "3.3"))

  expect_identical(.pulso_fmt_pct_half_up(c(0.125, 0.135, 0.025), 0), c("13%", "14%", "3%"))
})

test_that("un valor no finito no tiene etiqueta", {
  # `formatC()` escribe literalmente "NA", "NaN" e "Inf", que terminaban
  # pintados sobre la lámina como «NA%». Sin etiqueta es sin etiqueta: geom_text
  # y los breaks de un eje descartan NA_character_.
  expect_identical(
    .pulso_fmt_half_up(c(NA_real_, NaN, Inf, -Inf, 12.5), 0),
    c(NA, NA, NA, NA, "13")
  )
  expect_identical(
    .pulso_fmt_pct_half_up(c(NA_real_, NaN, Inf, 0.125), 0),
    c(NA, NA, NA, "13%")
  )
})

# ---------------------------------------------------------------------------
# Graficadores
# ---------------------------------------------------------------------------

test_that("graficar_pie redondea el 0,5 hacia arriba", {
  .rmu_skip()
  p <- graficar_pie(
    data = data.frame(
      opcion = c("A", "B", "C", "D"),
      pct    = c(0.125, 0.135, 0.025, 0.715),
      n      = c(125L, 135L, 25L, 715L),
      stringsAsFactors = FALSE
    ),
    var_categoria = "opcion", var_pct = "pct", var_n = "n",
    decimales_pct = 0, umbral_etiqueta_pct = 0,
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%", "3%") %in% labs))
  expect_false(any(c("12%", "2%") %in% labs))
})

test_that("graficar_barras_agrupadas redondea el 0,5 hacia arriba", {
  .rmu_skip()
  p <- graficar_barras_agrupadas(
    data = data.frame(
      categoria = c("A", "B", "C"),
      n = c(100L, 100L, 100L),
      g1 = c(0.125, 0.135, 0.025),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_n = "n", cols_porcentaje = "g1",
    etiquetas_series = c(g1 = "Serie"),
    decimales = 0, umbral_etiqueta = 0, mostrar_barra_extra = FALSE,
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%", "3%") %in% labs))
  expect_false(any(c("12%", "2%") %in% labs))
})

test_that("graficar_barras_agrupadas con decimales no toca el dígito que sí se muestra", {
  .rmu_skip()
  # 12,5 con un decimal se muestra tal cual: el half-up sólo actúa sobre el
  # último dígito visible.
  p <- graficar_barras_agrupadas(
    data = data.frame(
      categoria = c("A", "B"), n = c(100L, 100L),
      g1 = c(0.125, 0.1225), stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_n = "n", cols_porcentaje = "g1",
    etiquetas_series = c(g1 = "Serie"),
    decimales = 1, umbral_etiqueta = 0, mostrar_barra_extra = FALSE,
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true("12.5%" %in% labs)
  expect_true("12.3%" %in% labs)
})

test_that("graficar_barras_categoricas redondea el 0,5 hacia arriba", {
  .rmu_skip()
  p <- graficar_barras_categoricas(
    data = data.frame(
      categoria = c("A", "B", "C"),
      pct = c(0.125, 0.135, 0.025),
      n   = c(125L, 135L, 25L),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_valor = "pct", var_pct = "pct", var_n = "n",
    modo_valor = "porcentaje", formato_valor = "porcentaje", decimales = 0,
    exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%", "3%") %in% labs))
  expect_false(any(c("12%", "2%") %in% labs))
})

test_that("graficar_barras_apiladas redondea el 0,5 hacia arriba en la barra extra", {
  .rmu_skip()
  # Las etiquetas DENTRO de la barra apilada no se redondean una por una: usan
  # reparto por resto mayor para que la barra sume 100 %. La barra extra
  # (Top2Box/Bottom2Box) sí es un porcentaje independiente y sigue la regla.
  # El canvas emite un warning por lámina cuando la fuente Arial no está en el
  # runner; no dice nada sobre el redondeo.
  p <- suppressWarnings(graficar_barras_apiladas(
    data = data.frame(
      categoria = c("A", "B"), n = c(100L, 100L),
      g1 = c(0.125, 0.135), g2 = c(0.875, 0.865),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_n = "n", cols_porcentaje = c("g1", "g2"),
    etiquetas_grupos = c(g1 = "Si", g2 = "No"), decimales = 0,
    mostrar_barra_extra = TRUE, barra_extra_preset = "top2box",
    top2box_labels = c("Si"),
    usar_canvas = TRUE, exportar = "rplot"
  ))
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%") %in% labs))
  expect_false("12%" %in% labs)
})

test_that("graficar_media_rango redondea el 0,5 hacia arriba en el chip", {
  .rmu_skip()
  p <- graficar_media_rango(
    data = data.frame(
      categoria = rep(c("A", "B", "C"), each = 2),
      valor = c(12.5, 12.5, 13.5, 13.5, 2.5, 2.5),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_valor = "valor",
    chip_decimales = 0, chip_sufijo = "%",
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%", "3%") %in% labs))
  expect_false(any(c("12%", "2%") %in% labs))
})

test_that("graficar_boxplot redondea el 0,5 hacia arriba en el chip de media", {
  .rmu_skip()
  p <- graficar_boxplot(
    data = data.frame(
      categoria = rep(c("A", "B", "C"), each = 2),
      valor = c(12.5, 12.5, 13.5, 13.5, 2.5, 2.5),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", var_valor = "valor",
    chip_decimales = 0, chip_sufijo = "%",
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%", "3%") %in% labs))
  expect_false(any(c("12%", "2%") %in% labs))
})

test_that("graficar_radar redondea el 0,5 hacia arriba", {
  .rmu_skip()
  p <- graficar_radar(
    data = data.frame(
      eje = c("E1", "E2", "E3"), grupo = "Total",
      valor = c(0.125, 0.135, 0.025),
      stringsAsFactors = FALSE
    ),
    mostrar_valores = TRUE, valores_decimales = 0, valores_umbral_pct = 0,
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%", "3%") %in% labs))
  expect_false(any(c("12%", "2%") %in% labs))
})

test_that("graficar_histograma redondea el 0,5 hacia arriba", {
  .rmu_skip()
  p <- graficar_histograma(
    data = data.frame(
      valor = c(rep(0.5, 125), rep(1.5, 135), rep(2.5, 25), rep(3.5, 715))
    ),
    var = "valor", bins = 4, decimales = 0, umbral_etiqueta = 0,
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_pct(p)
  expect_true(all(c("13%", "14%", "3%") %in% labs))
  expect_false(any(c("12%", "2%") %in% labs))
})

test_that("graficar_barras_numericas redondea el 0,5 hacia arriba", {
  .rmu_skip()
  p <- graficar_barras_numericas(
    data = data.frame(
      categoria = c("A", "B", "C"), v = c(12.5, 13.5, 2.5),
      stringsAsFactors = FALSE
    ),
    var_categoria = "categoria", vars_valor = "v",
    etiquetas_series = c(v = "Serie"),
    decimales = 0, umbral_etiqueta = 0,
    usar_canvas = FALSE, exportar = "rplot"
  )
  labs <- .rmu_labels(p)
  expect_true(all(c("13", "14", "3") %in% labs))
  expect_false(any(c("12", "2") %in% labs))
})

# ---------------------------------------------------------------------------
# La familia de dimensiones ya cumplía: aquí se fija que el alias comparte
# implementación con el helper canónico y no vuelve a divergir.
# ---------------------------------------------------------------------------

test_that("el helper de dimensiones delega en el canónico", {
  expect_identical(.dim_round_half_up(12.5), .pulso_round_half_up(12.5))
  expect_identical(.dim_round_half_up(13.5), .pulso_round_half_up(13.5))
  expect_identical(.dim_round_half_up(2.5), .pulso_round_half_up(2.5))
  expect_identical(.dim_round_half_up(c(-2.5, 0.5, 12.25), 1), .pulso_round_half_up(c(-2.5, 0.5, 12.25), 1))
})

test_that("un segmento que redondea a cero se rotula «0%», no «<1%»", {
  # El «<1%» era una notación que no existe en el entregable: el analista pega
  # esa cifra en un informe y tiene que explicar un símbolo que nadie usa. Lo
  # que aquel apaño protegía —no leer «cero» donde sí hay gente— lo resuelve
  # ahora el interruptor de categorías en cero, que hace visible el segmento.
  #
  # Se verifica sobre la regla y no sobre el objeto ggplot: los asserts contra
  # el canvas no ven estas etiquetas y pasan en verde sin medir nada.
  expect_equal(.pulso_fmt_pct_unidades(c(0, 1, 2, 30, 68), 0),
               c("0%", "1%", "2%", "30%", "68%"))
  expect_false(any(grepl("<", .pulso_fmt_pct_unidades(c(0, 1), 0), fixed = TRUE)))
})

test_that("la resolución pedida se respeta también en el cero", {
  # Con un decimal, el cero es «0.0%» y no «<0.1%»: la notación desaparece en
  # todas las resoluciones, no sólo en la de enteros.
  expect_equal(.pulso_fmt_pct_unidades(c(0, 4, 999), 1),
               c("0.0%", "0.4%", "99.9%"))
})

test_that("el graficador usa esa misma regla y no una copia", {
  # Contrato de código: si alguien vuelve a inlinear el formateo en la closure,
  # la regla deja de ser verificable y este test lo delata.
  src <- paste(readLines(file.path("..", "..", "R", "graficador_barras_apiladas.R"),
                         warn = FALSE), collapse = "\n")
  expect_true(grepl(".fmt_units_pct <- function(units, dec) .pulso_fmt_pct_unidades(units, dec)",
                    src, fixed = TRUE))
})
