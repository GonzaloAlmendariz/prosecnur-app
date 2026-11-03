# Un solo numerador para el total de cada cuota y su serie diaria (checklist de
# cuotas 1b, 3/11). Antes el total contaba «Completa» de la hoja si la
# plataforma no traía respuestas mientras la serie seguía en Kobo (vacía), y con
# la base inferida de la población el total salía 0 con la serie en Kobo.
# Fixture: los constructores de test-monitoreo-telefonico-rms.R.

for (.num_expr in parse(testthat::test_path("test-monitoreo-telefonico-rms.R"), keep.source = FALSE)) {
  if (is.call(.num_expr) && identical(.num_expr[[1]], as.name("<-"))) eval(.num_expr)
}
rm(.num_expr)

num_total_y_serie <- function(datos, cfg) {
  b <- .monitoreo_report_phone_blocks(datos, cfg$monitoreo_profile, cfg)
  b <- stats::setNames(b, vapply(b, function(x) x$id, ""))
  filas <- function(id) {
    r <- b[[id]]$rows
    if (is.data.frame(r)) return(r)
    if (!length(r)) return(data.frame())
    do.call(rbind, lapply(r, function(x) as.data.frame(x, check.names = FALSE, stringsAsFactors = FALSE)))
  }
  q <- filas("cuotas_variable")
  d <- filas("avance_efectivo_variable_dia")
  q <- q[q$Valor != "Sin dato", , drop = FALSE]
  serie <- vapply(seq_len(nrow(q)), function(i) {
    if (!nrow(d)) return(0L)
    as.integer(sum(as.integer(d$Efectivas[d$Variable == q$Variable[i] & d$Valor == q$Valor[i]])))
  }, 1L)
  kobo <- if (nrow(d)) sum(as.integer(d$`Efectivas Kobo`)) else 0L
  list(total = as.integer(q$Efectivas), serie = serie, kobo = kobo)
}

test_that("con Kobo, el total de cada cuota y su serie diaria cuentan las mismas efectivas de Kobo", {
  esc <- rms_escenario()
  r <- num_total_y_serie(esc$datos, esc$cfg)
  expect_gt(sum(r$total), 0L)
  expect_identical(r$serie, r$total)
  expect_identical(r$kobo, sum(r$total))
})

test_that("sin respuestas de plataforma, total y serie cuentan «Completa» de la hoja; la columna Kobo queda en 0", {
  esc <- rms_escenario()
  sin_kobo <- esc$datos[esc$datos$.source_role != "respuestas", , drop = FALSE]
  r <- num_total_y_serie(sin_kobo, esc$cfg)
  expect_gt(sum(r$total), 0L)           # antes: total de la hoja…
  expect_identical(r$serie, r$total)    # …con la serie vacía
  expect_identical(r$kobo, 0L)
})
