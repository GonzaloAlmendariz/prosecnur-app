source("setup-load-all.R")

# A8: el preset `radar_tabla` ofrecía en «Escala de valores» el valor
# `porcentaje_100`, que `graficar_radar()` no acepta (su `match.arg` conoce
# `proporcion_1` y `proporcion_100`). Elegirlo en la UI reventaba con
# «'arg' should be one of …». El catálogo ahora ofrece exactamente lo que el
# motor acepta y el valor viejo se normaliza en la entrada del motor para que
# los planes y `.pulso` guardados con él sigan renderizando.

.rec_datos <- function(valores) {
  data.frame(
    eje = rep(c("A", "B", "C"), each = 2),
    grupo = rep(c("x", "y"), 3),
    valor = valores,
    stringsAsFactors = FALSE
  )
}

.rec_pinta <- function(valores, ...) {
  graficar_radar(.rec_datos(valores), var_eje = "eje", var_grupo = "grupo",
                 var_valor = "valor", usar_canvas = FALSE, exportar = "rplot", ...)
}

.rec_mensajes <- function(expr) {
  msgs <- character(0)
  val <- withCallingHandlers(expr, message = function(m) {
    msgs <<- c(msgs, conditionMessage(m))
    invokeRestart("muffleMessage")
  })
  list(valor = val, mensajes = msgs)
}

.rec_choices <- function(preset, arg) {
  p <- Filter(function(x) identical(x$name, preset), .presets_metadata_payload()$presets)[[1]]
  a <- Filter(function(x) identical(x$name, arg), p$args)[[1]]
  vapply(a$choices, function(ch) as.character(ch$value), character(1))
}

test_that("el catálogo ofrece exactamente las escalas que el motor acepta", {
  vals <- .rec_choices("radar_tabla", "escala_valor")
  expect_setequal(vals, eval(formals(graficar_radar)$escala_valor))
  expect_false("porcentaje_100" %in% vals)
})

test_that("las etiquetas visibles dicen el rango, no el valor crudo", {
  p <- Filter(function(x) identical(x$name, "radar_tabla"), .presets_metadata_payload()$presets)[[1]]
  a <- Filter(function(x) identical(x$name, "escala_valor"), p$args)[[1]]
  labels <- setNames(vapply(a$choices, function(ch) ch$label, character(1)),
                     vapply(a$choices, function(ch) ch$value, character(1)))
  expect_identical(unname(labels["proporcion_1"]), "Proporción (0 a 1)")
  expect_identical(unname(labels["proporcion_100"]), "Porcentaje (0 a 100)")
})

test_that("cada escala del catálogo renderiza sin error ni aviso con datos de su rango", {
  datos <- list(proporcion_1 = c(0.98, 0.96, 0.96, 0.91, 0.92, 0.94),
                proporcion_100 = c(98, 96, 96, 91, 92, 94))
  for (v in .rec_choices("radar_tabla", "escala_valor")) {
    r <- .rec_mensajes(.rec_pinta(datos[[v]], escala_valor = v))
    expect_false(is.null(r$valor), info = v)
    expect_false(any(grepl("Se leen como porcentaje", r$mensajes)), info = v)
  }
})

test_that("el viejo porcentaje_100 se normaliza a proporcion_100 y no revienta", {
  expect_identical(.radar_escala_valor_compat("porcentaje_100"), "proporcion_100")
  expect_identical(.radar_escala_valor_compat("proporcion_1"), "proporcion_1")
  r <- .rec_mensajes(.rec_pinta(c(98, 96, 96, 91, 92, 94), escala_valor = "porcentaje_100"))
  expect_false(is.null(r$valor))
  # Si se hubiera leído como proporción, el aviso de escala saturada saltaría.
  expect_false(any(grepl("Se leen como porcentaje", r$mensajes)))
})

test_that("un valor que nunca existió sigue fallando: el compat no traga cualquier cosa", {
  expect_error(.rec_pinta(c(98, 96, 96, 91, 92, 94), escala_valor = "porcentaje"))
})

test_that("cada posición de leyenda del catálogo renderiza; el viejo arriba cae a abajo", {
  for (v in .rec_choices("radar_tabla", "leyenda_posicion")) {
    expect_no_error(.rec_mensajes(.rec_pinta(c(0.9, 0.8, 0.7, 0.6, 0.5, 0.4), leyenda_posicion = v)))
  }
  expect_identical(.radar_leyenda_posicion_compat("arriba"), "abajo")
  expect_no_error(.rec_mensajes(.rec_pinta(c(0.9, 0.8, 0.7, 0.6, 0.5, 0.4), leyenda_posicion = "arriba")))
})
