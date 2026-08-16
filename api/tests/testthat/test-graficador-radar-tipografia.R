# Historia de este archivo, porque explica por que ahora mide lo que mide.
#
# El mazo salia con DOS tipografias: 22 textos en Helvetica —titulo, subtitulo,
# etiquetas de eje y leyenda de las dos laminas de radar— contra un entregable
# aprobado que usa Arial y nada mas. Los textos no declaraban familia y caian al
# default del device.
#
# El primer arreglo escribio «Arial» literal en veinte sitios, y los tests que
# lo acompanaban leian el FUENTE: comprobaban que existiera algun
# `family = "Arial"`. Eso dio verde mientras el motor estaba roto —dos de esos
# sitios se habian escrito como `family = font_family`, variable que entonces no
# existia en el cuerpo de `graficar_radar()`, y la funcion abortaba en cuanto se
# le pedia sin canvas—.
#
# Ahora `font_family` es un parametro de `graficar_radar()`. Los tests miden el
# COMPORTAMIENTO: que la familia pedida llegue a los textos, en las dos rutas.

.familias_del_radar <- function(...) {
  d <- data.frame(
    eje = c("E1", "E2", "E3"),
    grupo = "Total",
    valor = c(0.30, 0.55, 0.70),
    stringsAsFactors = FALSE
  )
  p <- graficar_radar(d, var_eje = "eje", var_grupo = "grupo",
                      var_valor = "valor", escala_valor = "proporcion_100",
                      mostrar_valores = TRUE, exportar = "rplot", ...)
  # Las familias viven en los parametros de cada capa del ggplot y en el tema.
  fams <- unlist(lapply(p$layers, function(l) l$aes_params$family))
  c(fams, p$theme$text$family)
}


test_that("la familia pedida llega a los textos del radar", {
  # Es lo que el parametro viene a permitir: un estudio con otra tipografia no
  # deberia tener que editar el graficador.
  fams <- .familias_del_radar(font_family = "Times", usar_canvas = FALSE)
  expect_true("Times" %in% fams)
  expect_false("Arial" %in% fams)
})


test_that("el default sigue siendo Arial", {
  # La unica tipografia del entregable aprobado.
  fams <- .familias_del_radar(usar_canvas = FALSE)
  expect_true("Arial" %in% fams)
  expect_false(any(fams %in% c("sans", "Helvetica")))
})


test_that("`graficar_radar` corre en las dos rutas", {
  # Sin canvas es la ruta que el mazo NO ejercita —las 66 laminas usan canvas—
  # y por eso pudo vivir rota sin que ninguna lamina lo notase.
  expect_no_error(.familias_del_radar(usar_canvas = FALSE))
  expect_no_error(.familias_del_radar(usar_canvas = TRUE))
})


test_that("no queda ni un `family = \"sans\"`", {
  # `sans` es el alias generico del device y en el .pptx se resuelve a
  # Helvetica: asi entraron seis de los veintidos.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  )
  expect_length(grep('family = "sans"', f, fixed = TRUE), 0L)
})


test_that("la tabla conserva su propia familia", {
  # `tabla_font_family` es aparte a proposito: la tabla del radar la gobierna su
  # propio grob, y unificarlas quitaria un control que ya existia.
  expect_true("tabla_font_family" %in% names(formals(graficar_radar)))
  expect_true("font_family" %in% names(formals(graficar_radar)))
})
