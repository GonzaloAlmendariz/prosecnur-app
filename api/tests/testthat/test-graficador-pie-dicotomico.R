# Regresión del donut/pie de Sexo del reporte ACNUR territorial: el override
# `colores_categorias` llegaba CRUDO a scale_fill_manual y, si traía menos
# entradas que niveles del factor, ggplot abortaba con
# "Insufficient values in manual scale. 3 needed but only 1 provided.".
# El fix normaliza el override con `.mk_palette` (mismo patrón que boxplot y
# media_rango) antes de construir la escala.

.pie_fixture_3cat <- function() {
  # Fixture mínimo autónomo: 3 categorías, sin depender de ningún .pulso.
  data.frame(
    opcion = c("Mujer", "Hombre", "Otro"),
    pct    = c(0.52, 0.46, 0.02),
    n      = c(520L, 460L, 20L),
    stringsAsFactors = FALSE
  )
}

.pie_render_png <- function(df, colores_categorias) {
  out <- tempfile(fileext = ".png")
  on.exit(unlink(out), add = TRUE)
  # exportar = "png" fuerza el ggsave/ggplot_build: la MISMA ruta de render
  # que dispara el crash al exportar el PPT desde la UI.
  graficar_pie(
    data = df,
    var_categoria = "opcion",
    var_pct = "pct",
    var_n = "n",
    colores_categorias = colores_categorias,
    exportar = "png",
    path_salida = out
  )
  file.exists(out)
}

test_that("override de colores más corto que los niveles no crashea (regresión ACNUR)", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  skip_if_not_installed("cowplot")

  df <- .pie_fixture_3cat()

  # Un solo color para 3 niveles: reproducción byte-exacta del crash.
  expect_error(
    .pie_render_png(df, colores_categorias = c("#0B4F8C")),
    NA
  )

  # Override parcial (2 de 3): también degrada rellenando el faltante.
  expect_error(
    .pie_render_png(df, colores_categorias = c("#0B4F8C", "#2A9D8F")),
    NA
  )
})

test_that("override del largo correcto y sin override mantienen comportamiento", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  skip_if_not_installed("cowplot")

  df <- .pie_fixture_3cat()

  # 3 colores para 3 niveles: sin regresión.
  expect_true(.pie_render_png(df, colores_categorias = c("#0B4F8C", "#2A9D8F", "#E76F51")))

  # Sin override (NULL): comportamiento intacto.
  expect_true(.pie_render_png(df, colores_categorias = NULL))
})

test_that("override malformado del round-trip UI (deparse / no-color) no crashea", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("scales")
  skip_if_not_installed("cowplot")

  df <- .pie_fixture_3cat()

  # El round-trip de la UI podía entregar el override como el DEPARSE de un
  # vector (un solo string 'c("#0072BC", "#00A98F", "#8FA8C8")'), lo que hacía
  # ggplot abortar con "Unknown colour name". El saneo extrae los hex embebidos.
  expect_error(
    .pie_render_png(df, colores_categorias = 'c("#0072BC", "#00A98F", "#8FA8C8")'),
    NA
  )

  # Override con entradas que no son colores válidos: se descartan y se rellena.
  expect_error(
    .pie_render_png(df, colores_categorias = c("no-es-color", "#2A9D8F", "???")),
    NA
  )
})
