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

test_that("con pocos casos no hay banda, y sin banda no se juzga", {
  # Caso real de acnur_acg: la jornada 2026-07-02 trae UNA respuesta de 1 467
  # min. Sin banda seria «el dia mas lento con diferencia»; con banda no dice
  # nada, que es lo correcto.
  sola <- monitoreo_tiempos_banda_mediana(1467.89)
  expect_true(is.na(sola$inferior))

  minutos <- c(rep(c(12, 14, 16), 8), 1467.89)
  grupo <- c(rep("jornada llena", 24), "jornada de una")
  r <- monitoreo_tiempos_por_grupo(minutos, grupo)
  suelta <- r[r$grupo == "jornada de una", ]
  expect_equal(suelta$n, 1)
  expect_true(suelta$n_bajo)
  expect_false(suelta$destaca)
  expect_true(is.na(suelta$banda_inf))
})

test_that("la banda sale de los ordenes estadisticos, no de una aproximacion", {
  # Con n = 10 y 95 %, qbinom(0.025, 10, 0.5) = 2: la banda va del 2.o al 9.o
  # valor ordenado.
  x <- c(1, 2, 3, 4, 5, 6, 7, 8, 9, 100)
  b <- monitoreo_tiempos_banda_mediana(x)
  expect_equal(b$inferior, 2)
  expect_equal(b$superior, 9)

  # Y el valor extremo no la mueve: es lo que distingue esta banda de una
  # construida sobre la media y su desviacion.
  y <- c(1, 2, 3, 4, 5, 6, 7, 8, 9, 1e6)
  expect_equal(monitoreo_tiempos_banda_mediana(y)$superior, 9)
})

test_that("destaca quien queda fuera de la banda, y no quien solo difiere un poco", {
  lento <- monitoreo_tiempos_por_grupo(
    c(rep(c(10, 11, 12), 10), rep(c(40, 42, 44), 10)),
    c(rep("normal", 30), rep("lento", 30))
  )
  expect_true(all(lento$destaca))

  # El control: dos grupos que difieren en un minuto no destacan, aunque sus
  # medianas no sean iguales.
  parejo <- monitoreo_tiempos_por_grupo(
    c(rep(c(10, 12, 14), 10), rep(c(11, 13, 15), 10)),
    c(rep("uno", 30), rep("otro", 30))
  )
  expect_false(any(parejo$destaca))
})

test_that("la referencia es el resto de la muestra, no la muestra entera", {
  # El grupo mayoritario ARRASTRA la mediana global hacia si mismo: comparar
  # contra ella lo dejaria siempre dentro y nunca destacaria. Aqui «casi todo»
  # son 60 respuestas rapidas y «unos pocos» 12 lentas.
  minutos <- c(rep(c(10, 11, 12), 20), rep(c(40, 41, 42), 4))
  grupo <- c(rep("casi todo", 60), rep("unos pocos", 12))
  r <- monitoreo_tiempos_por_grupo(minutos, grupo)

  mayoritario <- r[r$grupo == "casi todo", ]
  expect_true(mayoritario$destaca)
  # La mediana global cae DENTRO de su banda; la del resto, fuera. Si el motor
  # usara la global, este grupo no destacaria.
  expect_true(stats::median(minutos) >= mayoritario$banda_inf &&
                stats::median(minutos) <= mayoritario$banda_sup)
  expect_equal(mayoritario$mediana_resto, 41)
})

test_that("las filas salen ordenadas por mediana y sin grupos vacios", {
  r <- monitoreo_tiempos_por_grupo(
    c(rep(30, 6), rep(10, 6), rep(20, 6), 15, 15),
    c(rep("c", 6), rep("a", 6), rep("b", 6), "", NA)
  )
  expect_equal(r$grupo, c("a", "b", "c"))
  expect_equal(r$mediana, c(10, 20, 30))
})

test_that("una respuesta sin grupo no se cuela en el grupo de al lado", {
  r <- monitoreo_tiempos_por_grupo(c(10, 10, 10, 10, 10, 999), c(rep("x", 5), ""))
  expect_equal(nrow(r), 1)
  expect_equal(r$n, 5)
})

test_that("no se agrupa lo que no viene emparejado", {
  expect_error(
    monitoreo_tiempos_por_grupo(c(1, 2, 3), c("a", "b")),
    "una entrada por respuesta"
  )
})

test_that("sin umbral declarado el criterio existe pero no juzga", {
  c0 <- monitoreo_tiempos_criterio(NULL)
  expect_false(c0$declarado)
  expect_true(is.na(c0$umbral_min))
  expect_match(c0$leyenda, "no ha declarado")

  v <- monitoreo_tiempos_veredicto(c(1, 2, 3, 40), c0)
  expect_equal(v$n_marcadas, 0)
  expect_equal(v$n_evaluadas, 4)
  expect_false(any(v$marcada))
})

test_that("un umbral vacio, cero o negativo no cuenta como declarado", {
  for (malo in list(NULL, "", NA, 0, -5, "abc")) {
    expect_false(monitoreo_tiempos_criterio(list(duracion_sospecha_min = malo))$declarado)
  }
  expect_true(monitoreo_tiempos_criterio(list(duracion_sospecha_min = "5"))$declarado)
})

test_that("declarado, marca por debajo del umbral y no en el umbral", {
  crit <- monitoreo_tiempos_criterio(list(duracion_sospecha_min = 5))
  v <- monitoreo_tiempos_veredicto(c(1.26, 4.99, 5, 5.01, 20, NA, -3), crit)
  expect_equal(v$n_marcadas, 2)
  expect_equal(which(v$marcada), c(1, 2))
  # Una duracion negativa no es «rapida»: no se cuenta ni como evaluada.
  expect_equal(v$n_evaluadas, 5)
})

test_that("el umbral absoluto sigue midiendo cuando la muestra entera acelera", {
  # Medido en acnur_acg: con las duraciones a la mitad, el absoluto de 5 min
  # pasa de 55 a 436 marcadas y el relativo del 40 % marca exactamente las
  # mismas 82 —el mismo conjunto—. Por eso el umbral es absoluto.
  lento <- c(10, 12, 14, 16, 18, 20)
  rapido <- lento / 5

  crit <- monitoreo_tiempos_criterio(list(duracion_sospecha_min = 5))
  expect_equal(monitoreo_tiempos_veredicto(lento, crit)$n_marcadas, 0)
  expect_equal(monitoreo_tiempos_veredicto(rapido, crit)$n_marcadas, 6)

  # El control que justifica el descarte: un umbral relativo a la mediana marca
  # lo mismo en las dos muestras, porque se mueve con ellas.
  relativo <- function(x) sum(x < 0.4 * stats::median(x))
  expect_equal(relativo(lento), relativo(rapido))
})

test_that("el umbral sobrevive al normalizador de config del perfil de aulas", {
  # `monitoreo_aulas_normalize_config()` ES la whitelist: lo que no nombra se
  # cae al guardar. Es la trampa que ya se comio a `valid_filters`, y una
  # superficie para declarar el umbral con el campo perdiendose seria peor que
  # no tenerla.
  cfg <- monitoreo_aulas_normalize_config(list(duracion_sospecha_min = 4))
  expect_equal(cfg$duracion_sospecha_min, 4)

  # Sin declarar sigue sin existir: no se inventa un defecto que juzgue.
  vacia <- monitoreo_aulas_normalize_config(list())
  expect_null(vacia$duracion_sospecha_min)

  # Y un valor invalido no persiste como si fuera una declaracion.
  expect_null(monitoreo_aulas_normalize_config(list(duracion_sospecha_min = 0))$duracion_sospecha_min)
})

test_that("el dashboard publica el bloque de tiempos aunque la base no los traiga", {
  # Es el caso del estudio de aulas: si el bloque no viajara, la vista no
  # podria decir que faltan los tiempos —solo podria no mostrar nada, que es
  # como se pierde un dato sin que nadie se entere—.
  plan <- list(list(classroom_id = "CH 1", operational_code = "CH 1", eligible_n = 30))
  d <- monitoreo_aulas_dashboard(plan, data.frame(sexo = c("1", "2")), list())
  expect_false(is.null(d$tiempos))
  expect_false(d$tiempos$disponible)
  expect_match(d$tiempos$motivo, "ni inicio ni fin")
  expect_false(d$tiempos$criterio$declarado)

  # Y cuando la base SI las trae, el mismo bloque llega con las cifras.
  respuestas <- data.frame(
    start = sprintf("2026-06-13T10:%02d:00-05:00", 0:9),
    end = sprintf("2026-06-13T10:%02d:00-05:00", seq(12, 30, by = 2)),
    stringsAsFactors = FALSE
  )
  con <- monitoreo_aulas_dashboard(plan, respuestas, list(duracion_sospecha_min = 5))
  expect_true(con$tiempos$disponible)
  expect_equal(con$tiempos$columna_inicio, "start")
  expect_true(is.finite(con$tiempos$resumen$mediana))
  expect_true(con$tiempos$criterio$declarado)
})
