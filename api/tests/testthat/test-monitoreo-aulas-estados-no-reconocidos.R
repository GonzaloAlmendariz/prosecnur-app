# La lista cerrada de STATUS MUESTRA se traga lo que no reconoce.

test_that("nombra los valores que caen a sin_contactar sin serlo", {
  # `monitoreo_aulas_estado_muestra()` reconoce agendada, reagendada,
  # reemplazada y «en reserva N»; TODO lo demas cae al default. Estas seis salen
  # las seis como `sin_contactar`, y `sin_contactar` es lo que la cola de
  # contacto manda a llamar y lo que `monitoreo_aulas_reservas_disponibles()`
  # cuenta como reserva libre.
  for (raro in c("aplicada", "contactada", "en campo", "cerrada", "parcial", "efectiva")) {
    expect_identical(monitoreo_aulas_estado_muestra(raro), "sin_contactar")
  }

  x <- monitoreo_aulas_estados_no_reconocidos(list(
    list(sample_status = "aplicada"),
    list(sample_status = "aplicada"),
    list(sample_status = "en campo")
  ))
  expect_identical(x$total, 3L)
  # Ordenados por cuantas aulas, que es por donde se empieza a arreglar.
  expect_identical(x$valores[[1]]$valor, "aplicada")
  expect_identical(x$valores[[1]]$aulas, 2L)
})

test_that("en blanco y guion NO son valores raros", {
  # Son «todavia nada aqui»: 1 810 de 2 040 celdas del estudio de 2025 son `-`.
  # Para ellas `sin_contactar` es la lectura correcta, y avisar de las 1 810
  # convertiria el aviso en ruido que nadie lee.
  x <- monitoreo_aulas_estados_no_reconocidos(list(
    list(sample_status = "-"), list(sample_status = "--"),
    list(sample_status = ""), list(sample_status = "   ")
  ))
  expect_identical(x$total, 0L)
})

test_that("los estados que SI se reconocen no se denuncian", {
  x <- monitoreo_aulas_estados_no_reconocidos(list(
    list(sample_status = "AGENDADA"), list(sample_status = "EN RESERVA 2"),
    list(sample_status = "reemplazada"), list(sample_status = "reagendada")
  ))
  expect_identical(x$total, 0L)
})

test_that("preguntar al plan YA NORMALIZADO devolveria cero: por eso se usa el crudo", {
  # Este es el aserto que sujeta el error facil. Si alguien mueve la llamada
  # detras de `monitoreo_aulas_normalize_plan()`, el chequeo pasa a dar siempre
  # cero y parece que no hay nada que avisar.
  crudo <- list(list(sample_status = "aplicada"))
  ya_normalizado <- lapply(crudo, function(u) {
    u$sample_status <- monitoreo_aulas_estado_muestra(u$sample_status); u
  })
  expect_identical(monitoreo_aulas_estados_no_reconocidos(crudo)$total, 1L)
  expect_identical(monitoreo_aulas_estados_no_reconocidos(ya_normalizado)$total, 0L)
})

test_that("el aviso dice la consecuencia, no solo el hecho", {
  x <- monitoreo_aulas_estados_no_reconocidos(list(list(sample_status = "aplicada")))
  txt <- monitoreo_aulas_estados_no_reconocidos_texto(x)
  expect_true(grepl("aplicada", txt, fixed = TRUE))
  # Lo que pasa si no se arregla, que es lo que hace que alguien lo arregle.
  expect_true(grepl("ya estan en campo", txt, fixed = TRUE))
  expect_identical(
    monitoreo_aulas_estados_no_reconocidos_texto(monitoreo_aulas_estados_no_reconocidos(list())),
    "Todos los valores de STATUS MUESTRA se reconocieron."
  )
})
