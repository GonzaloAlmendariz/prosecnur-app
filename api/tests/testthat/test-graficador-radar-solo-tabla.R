# B1 del GOAL motor PPT (carril L8, hallazgo B-H4): p_tabla promete "tabla sin
# radar" via radar_scale = 0, pero el graficador trataba el 0 como invalido
# (reset a 1 + clamp [0.70, 1.10]) y el radar se dibujaba igual. Ademas
# tabla_ph_ancho = 1.0 caia al default 0.40. El contrato ahora es real:
# radar_scale = 0 con tabla activa dibuja SOLO la tabla, a ancho completo.

.radar_test_data <- function() {
  data.frame(
    eje = rep(c("Atencion", "Canales", "Personal", "Tiempos"), 2),
    grupo = rep(c("Mujer", "Hombre"), each = 4),
    valor = c(.61, .45, .38, .22, .55, .49, .30, .28),
    stringsAsFactors = FALSE
  )
}

test_that("radar_scale = 0 con tabla activa suprime el radar del canvas", {
  d <- .radar_test_data()
  p_combinado <- graficar_radar(
    data = d, mostrar_tabla_derecha = TRUE, radar_scale = 1,
    mostrar_leyenda = FALSE, usar_canvas = TRUE, exportar = "rplot"
  )
  p_solo_tabla <- graficar_radar(
    data = d, mostrar_tabla_derecha = TRUE, radar_scale = 0,
    tabla_ph_ancho = 1.0,
    mostrar_leyenda = FALSE, usar_canvas = TRUE, exportar = "rplot"
  )
  # El canvas de solo-tabla pierde el grob del radar y sus etiquetas externas:
  # tiene estrictamente menos capas que el combinado.
  expect_lt(length(p_solo_tabla$layers), length(p_combinado$layers))
})

test_that("radar_scale = 0 SIN tabla conserva el fallback historico (radar normal)", {
  d <- .radar_test_data()
  p_cero <- graficar_radar(
    data = d, mostrar_tabla_derecha = FALSE, radar_scale = 0,
    mostrar_leyenda = FALSE, usar_canvas = TRUE, exportar = "rplot"
  )
  p_uno <- graficar_radar(
    data = d, mostrar_tabla_derecha = FALSE, radar_scale = 1,
    mostrar_leyenda = FALSE, usar_canvas = TRUE, exportar = "rplot"
  )
  expect_identical(length(p_cero$layers), length(p_uno$layers))
})

test_that("el wrapper p_tabla declara el colapso del radar en sus overrides", {
  el <- p_tabla(modo = "sm", var = "servicios")
  expect_identical(el$overrides$radar_scale, 0)
  expect_true(isTRUE(el$overrides$mostrar_tabla_derecha))
  expect_identical(el$overrides$tabla_ph_ancho, 1.0)
})

test_that("las etiquetas de vertice dicen el porcentaje real en escala 0-100", {
  # `.valor` ya viene normalizado a 0-1 para AMBAS escalas, asi que la etiqueta
  # siempre multiplica por 100. Condicionarlo escribia «1.0%» sobre un vertice
  # que vale 98 %, y el umbral —que compara contra 3— borraba de paso casi todas
  # las etiquetas. No se veia porque ningun estilo enciende `mostrar_valores`.
  d <- data.frame(
    eje = c("A", "B", "C"), grupo = "g",
    valor = c(98.0, 96.3, 2.0), stringsAsFactors = FALSE
  )
  p <- graficar_radar(d, var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
                      escala_valor = "proporcion_100",
                      mostrar_valores = TRUE, valores_decimales = 1)
  capas <- Filter(function(l) inherits(l$geom, "GeomText"), p$layers)
  etiquetas <- unlist(lapply(capas, function(l) as.character(l$data$.lab_val)))
  expect_true("98.0%" %in% etiquetas)
  expect_true("96.3%" %in% etiquetas)
  # El umbral por defecto (3 %) sigue silenciando lo que es de verdad chico.
  expect_false("2.0%" %in% etiquetas)

  # Y la escala 0-1 no se rompe al arreglar la otra.
  d1 <- transform(d, valor = d$valor / 100)
  p1 <- graficar_radar(d1, var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
                       escala_valor = "proporcion_1",
                       mostrar_valores = TRUE, valores_decimales = 1)
  capas1 <- Filter(function(l) inherits(l$geom, "GeomText"), p1$layers)
  expect_true("98.0%" %in% unlist(lapply(capas1, function(l) as.character(l$data$.lab_val))))
})

test_that("cada serie escribe su cifra en su propio anillo", {
  # Separarlas solo de lado no bastaba: tres publicos dentro de dos puntos —el
  # caso normal de un indicador de acuerdo— caen practicamente en el mismo radio
  # y las tres cifras se rozaban aunque estuvieran corridas.
  d <- data.frame(
    eje = rep(c("A", "B", "C"), each = 3),
    grupo = rep(c("g1", "g2", "g3"), times = 3),
    valor = rep(c(96, 96, 96), times = 3),
    stringsAsFactors = FALSE
  )
  p <- graficar_radar(d, var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
                      escala_valor = "proporcion_100",
                      mostrar_valores = TRUE, valores_umbral_pct = 0)
  capa <- Filter(function(l) inherits(l$geom, "GeomText"), p$layers)[[1]]
  # Mismo eje, mismo valor, tres series: los tres puntos tienen que caer en
  # posiciones distintas o el lector ve un borron.
  en_a <- capa$data[capa$data$.eje == "A", c("x", "y")]
  expect_equal(nrow(en_a), 3L)
  expect_equal(nrow(unique(round(en_a, 6))), 3L)
  # Y la distancia entre las tres es apreciable, no de un pelo.
  d_min <- min(stats::dist(as.matrix(en_a)))
  expect_gt(d_min, 0.04)
})
