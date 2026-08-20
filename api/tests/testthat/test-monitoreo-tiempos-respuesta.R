test_that("una base sin marcas dice que no las tiene, y cual falta", {
  ninguna <- monitoreo_tiempos_disponibilidad(c("edad", "sexo", "_submission_time"))
  expect_false(ninguna$disponible)
  expect_match(ninguna$motivo, "ni inicio ni fin")

  # El motivo distingue cual de las dos falta: con una sola marca no hay
  # duracion, pero el diagnostico no es el mismo.
  solo_inicio <- monitoreo_tiempos_disponibilidad(c("start", "edad"))
  expect_false(solo_inicio$disponible)
  expect_match(solo_inicio$motivo, "no su fin")

  solo_fin <- monitoreo_tiempos_disponibilidad(c("end", "edad"))
  expect_false(solo_fin$disponible)
  expect_match(solo_fin$motivo, "no su inicio")

  hay <- monitoreo_tiempos_disponibilidad(c("start", "end", "edad"))
  expect_true(hay$disponible)
  expect_equal(hay$inicio, "start")
  expect_equal(hay$fin, "end")
})

test_that("las marcas de bloque no se confunden con las de la entrevista", {
  # acnur_acg trae `A/time_A_start`, `B/time_b_start`... y una sola entrevista.
  # Si la deteccion fuera por parecido, el inicio saldria de un bloque.
  d <- monitoreo_tiempos_disponibilidad(c("A/time_A_start", "closing_group/time_closing_start"))
  expect_false(d$disponible)
  expect_true(is.na(d$inicio))
})

test_that("el offset con dos puntos no se pierde: sin normalizar la duracion daria un dia entero", {
  # Formato real de Kobo. Entre las dos marcas hay 24.87 min y cruzan de hora.
  ini <- "2026-06-13T10:21:21.940-05:00"
  fin <- "2026-06-13T10:46:14.369-05:00"
  minutos <- monitoreo_tiempos_por_respuesta(data.frame(start = ini, end = fin))
  expect_equal(round(minutos, 2), 24.87)

  # El control del caso anterior: con el mismo par de marcas, `as.POSIXct` sin
  # normalizar el offset devuelve NA y la duracion se pierde entera.
  crudo <- as.POSIXct(c(ini, fin), format = "%Y-%m-%dT%H:%M:%OS%z", tz = "UTC")
  expect_true(all(is.na(crudo)))
})

test_that("el offset se respeta: dos marcas en husos distintos no dan la misma duracion", {
  mismo <- monitoreo_tiempos_por_respuesta(
    data.frame(start = "2026-06-13T10:00:00-05:00", end = "2026-06-13T10:30:00-05:00")
  )
  cruzado <- monitoreo_tiempos_por_respuesta(
    data.frame(start = "2026-06-13T10:00:00-05:00", end = "2026-06-13T10:30:00+00:00")
  )
  expect_equal(round(mismo, 2), 30)
  expect_equal(round(cruzado, 2), 30 - 5 * 60)
})

test_that("una marca sin zona horaria tambien se lee", {
  minutos <- monitoreo_tiempos_por_respuesta(
    data.frame(start = "2026-06-13T10:00:00", end = "2026-06-13T10:12:00")
  )
  expect_equal(round(minutos, 2), 12)
})

test_that("sin marcas no devuelve duraciones inventadas", {
  expect_length(monitoreo_tiempos_por_respuesta(data.frame(edad = 1:3)), 0)
})

test_that("el resumen separa lo que no se pudo calcular de lo que salio negativo", {
  # 37 de las filas de acnur_acg traen `duracion_total` negativa; una duracion
  # negativa no es un vacio y no puede contarse como tal.
  r <- monitoreo_tiempos_resumen(c(10, 20, 30, -5, NA, NaN))
  expect_equal(r$n, 3)
  expect_equal(r$negativas, 1)
  expect_equal(r$sin_dato, 2)
  expect_equal(r$mediana, 20)
})

test_that("la cola larga se cuenta aparte y no mueve la mediana", {
  # Cinco respuestas cortas y una entrevista que quedo abierta una semana.
  minutos <- c(8, 12, 14, 16, 20, 10080)
  r <- monitoreo_tiempos_resumen(minutos, cola_min = 120)
  expect_equal(r$mediana, 15)
  expect_equal(r$maximo, 10080)
  expect_equal(r$cola_larga, 1)

  # El control: sin el caso largo la mediana es la misma, que es justo el
  # motivo por el que la cola tiene que contarse y no recortarse.
  expect_equal(monitoreo_tiempos_resumen(minutos[1:5])$mediana, 14)
})

test_that("sin umbral declarado la cola no juzga", {
  r <- monitoreo_tiempos_resumen(c(8, 12, 10080))
  expect_true(is.na(r$cola_min))
  expect_true(is.na(r$cola_larga))
})

test_that("una base vacia no rompe el resumen", {
  r <- monitoreo_tiempos_resumen(numeric(0))
  expect_equal(r$n, 0)
  expect_true(is.na(r$mediana))
})
