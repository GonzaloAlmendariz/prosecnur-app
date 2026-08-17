# El radar del mazo dibujaba un hexagono perfecto pegado al borde, con sus tres
# series superpuestas, mientras la tabla de al lado decia 98, 96, 91… Se
# persiguio como un problema de grosor de linea —el aprobado dibuja lineas mas
# finas y ahi si se ven sus tres series— y el tope de grosor no cambiaba nada.
#
# La causa era otra: `escala_valor` llegaba como «proporcion_1» y los datos como
# porcentajes de 90.83 a 98.14. El `pmin(1, .)` los aplastaba TODOS al tope, o
# sea 100 % en los dieciocho vertices. El radar no estaba dibujando los datos.
#
# Se mide por el AVISO y no hurgando en las capas del ggplot: el objeto expone
# sus coordenadas de formas que cambian con la version de ggplot2, y un test que
# depende de eso se rompe sin que el motor tenga nada malo.

.radar_pinta <- function(valores, escala_valor = "proporcion_1") {
  d <- data.frame(
    eje = rep(c("A", "B", "C"), each = 2),
    grupo = rep(c("x", "y"), 3),
    valor = valores,
    stringsAsFactors = FALSE
  )
  graficar_radar(d, var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
                 escala_valor = escala_valor, usar_canvas = FALSE,
                 exportar = "rplot")
}


test_that("porcentajes declarados como proporcion se detectan y se avisan", {
  # Sin esto, los seis valores salen los seis al tope y el radar es un poligono
  # lleno. El aviso dice el valor, cuantos vertices y como quitarlo.
  msgs <- character(0)
  withCallingHandlers(
    .radar_pinta(c(98, 96, 96, 91, 92, 94)),
    message = function(m) {
      msgs <<- c(msgs, conditionMessage(m))
      invokeRestart("muffleMessage")
    }
  )
  txt <- paste(msgs, collapse = " ")
  expect_true(grepl("proporcion", txt))
  expect_true(grepl("100", txt))
})


test_that("una proporcion de verdad no dispara nada", {
  # 0 a 1 es lo que dice ser: ni se reescala ni se avisa.
  msgs <- character(0)
  withCallingHandlers(
    .radar_pinta(c(0.98, 0.96, 0.96, 0.91, 0.92, 0.94)),
    message = function(m) {
      msgs <<- c(msgs, conditionMessage(m))
      invokeRestart("muffleMessage")
    }
  )
  expect_false(any(grepl("declarados como proporcion", msgs)))
})


test_that("declararlo bien tampoco dispara el aviso", {
  msgs <- character(0)
  withCallingHandlers(
    .radar_pinta(c(98, 96, 96, 91, 92, 94), "proporcion_100"),
    message = function(m) {
      msgs <<- c(msgs, conditionMessage(m))
      invokeRestart("muffleMessage")
    }
  )
  expect_false(any(grepl("declarados como proporcion", msgs)))
})


test_that("el umbral es 1.5 y no 1", {
  # Un 1.0 exacto es el 100 % y es una proporcion legitima; un redondeo puede
  # dejarlo en 1.01. Por encima de 1.5 ya no hay lectura posible como
  # proporcion.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  )
  expect_length(grep("max_val > 1.5", f, fixed = TRUE), 1L)
})


test_that("el aviso dice la causa y como quitarlo", {
  # Un aviso que solo dice «valores raros» obliga a reinvestigar. Este nombra el
  # valor, cuantos vertices afecta y el parametro que lo arregla.
  f <- paste(readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  ), collapse = " ")
  expect_true(grepl("saldrian todos al 100", f, fixed = TRUE))
  expect_true(grepl("proporcion_100", f, fixed = TRUE))
})
