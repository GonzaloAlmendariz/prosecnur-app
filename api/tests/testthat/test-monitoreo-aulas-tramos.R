# =============================================================================
# Los TRAMOS del operativo: rangos con nombre propio, estado derivado del plan
# (dictado 2026-09-15)
# =============================================================================
#
# Gonzalo: «debería tener un mecanismo para poder ir recordando la aplicación
# de semana a semana y actualizándolas a lo que el excel diga también, y cuando
# se cree una nueva semana de aplicación la app ya las sabe». Y la corrección
# que fija el modelo: «más que semana en el estricto senso, con rango a los que
# llamamos de forma personalizada; en este caso seleccioné dos rangos semanales
# y les puse Semana 1 y Semana 2, pero puede ser otro rango con otros nombres».
#
# Lo que estos tests fijan es el reparto de responsabilidades: el rango y su
# nombre se GUARDAN porque son su decisión; los conteos se DERIVAN porque un
# conteo guardado envejece en silencio.

.mat_aula <- function(cod, fecha, aplicada = FALSE) {
  list(operational_code = cod, classroom_id = cod, faculty = "FAC",
       sample_role = "titular", sample_status = "agendada",
       scheduled_date = fecha, scheduled_time = "10:00 am",
       application_status = if (aplicada) "aplicada" else "")
}

.mat_cfg <- function(...) list(tramos = list(...))

test_that("los tramos declarados se ordenan y se enderezan; el que va a medias se cae", {
  t <- monitoreo_aulas_tramos(.mat_cfg(
    list(nombre = "Semana 2", desde = "2026-09-14", hasta = "2026-09-20"),
    list(nombre = "Semana 1", desde = "2026-09-07", hasta = "2026-09-12"),
    # Sin las dos fechas no puede contener a nadie.
    list(nombre = "a medias", desde = "2026-09-25"),
    # Teclear el fin antes que el inicio es un desliz, no una intención.
    list(nombre = "al revés", desde = "2026-10-05", hasta = "2026-10-01")
  ))
  expect_identical(vapply(t, function(x) x$nombre, character(1)),
                   c("Semana 1", "Semana 2", "al revés"))
  expect_identical(t[[3]]$desde, "2026-10-01")
  expect_identical(t[[3]]$hasta, "2026-10-05")
  expect_true(all(vapply(t, function(x) isTRUE(x$declarado), logical(1))))
})

test_that("un tramo sin nombre recibe uno, porque hay que poder señalarlo", {
  t <- monitoreo_aulas_tramos(.mat_cfg(
    list(desde = "2026-09-07", hasta = "2026-09-12")))
  expect_identical(t[[1]]$nombre, "Tramo 1")
})

test_that("sin tramos declarados caen las semanas de calendario de siempre", {
  # El respaldo no es adorno: un estudio que aún no nombró sus tramos tiene que
  # comportarse exactamente como ayer, con el mismo origen y los mismos nombres
  # que ya usa la pestaña de la distribución.
  plan <- list(.mat_aula("CH 1", "2026-09-08"), .mat_aula("CH 2", "2026-09-16"))
  t <- monitoreo_aulas_tramos(list(), plan)
  expect_identical(vapply(t, function(x) x$nombre, character(1)),
                   c("Semana 1", "Semana 2"))
  expect_identical(t[[1]]$desde, "2026-09-07")
  expect_identical(t[[2]]$desde, "2026-09-14")
  expect_false(any(vapply(t, function(x) isTRUE(x$declarado), logical(1))))
})

test_that("el vigente es el que contiene hoy", {
  t <- monitoreo_aulas_tramos(.mat_cfg(
    list(nombre = "Semana 1", desde = "2026-09-07", hasta = "2026-09-12"),
    list(nombre = "Semana 2", desde = "2026-09-14", hasta = "2026-09-20")))
  expect_identical(monitoreo_aulas_tramo_vigente(t, "2026-09-15")$nombre, "Semana 2")
  expect_identical(monitoreo_aulas_tramo_vigente(t, "2026-09-08")$nombre, "Semana 1")
})

test_that("entre dos tramos manda el SIGUIENTE, no el que acaba de pasar", {
  # El domingo 13 no cae en ninguno. Lo que se está preparando es el que viene:
  # devolver el anterior mandaría a la app a rellenar una semana ya cerrada.
  t <- monitoreo_aulas_tramos(.mat_cfg(
    list(nombre = "Semana 1", desde = "2026-09-07", hasta = "2026-09-12"),
    list(nombre = "Semana 2", desde = "2026-09-14", hasta = "2026-09-20")))
  expect_identical(monitoreo_aulas_tramo_vigente(t, "2026-09-13")$nombre, "Semana 2")
  # Antes de empezar, el primero; pasados todos, el último. Nunca NULL habiendo
  # tramos: quien pregunta necesita algo con lo que trabajar.
  expect_identical(monitoreo_aulas_tramo_vigente(t, "2026-09-01")$nombre, "Semana 1")
  expect_identical(monitoreo_aulas_tramo_vigente(t, "2026-12-01")$nombre, "Semana 2")
  expect_null(monitoreo_aulas_tramo_vigente(list(), "2026-09-15"))
})

test_that("el estado de cada tramo se DERIVA del plan, no se guarda", {
  plan <- list(
    .mat_aula("CH 1", "2026-09-08", aplicada = TRUE),
    .mat_aula("CH 2", "2026-09-10"),
    .mat_aula("CH 3", "2026-09-16", aplicada = TRUE),
    .mat_aula("CH 4", "2026-09-17"),
    .mat_aula("CH 5", "2026-09-18"),
    # Escrita pero ilegible: no cae en ningún tramo y se cuenta aparte, porque
    # meterla donde «parece» que va exigiría adivinar la fecha.
    .mat_aula("EXTRA 17", "Confirmará por correo")
  )
  t <- monitoreo_aulas_tramos(.mat_cfg(
    list(nombre = "Semana 1", desde = "2026-09-07", hasta = "2026-09-12"),
    list(nombre = "Semana 2", desde = "2026-09-14", hasta = "2026-09-20")))
  e <- monitoreo_aulas_tramos_estado(t, plan, hoy = "2026-09-15")
  expect_identical(vapply(e, function(x) x$citas, integer(1)), c(2L, 3L))
  expect_identical(vapply(e, function(x) x$aplicadas, integer(1)), c(1L, 1L))
  expect_identical(vapply(e, function(x) x$por_aplicar, integer(1)), c(1L, 2L))
  expect_identical(vapply(e, function(x) x$vigente, logical(1)), c(FALSE, TRUE))
  expect_identical(e[[1]]$sin_fecha_legible, 1L)
})

test_that("los tramos persisten en la config, normalizados al guardar", {
  # La whitelist del normalizador es la que decide qué sobrevive: sin nombrarlos
  # ahí, declarar un tramo en la UI no llegaría a ninguna parte y el mecanismo
  # entero se caería en silencio al primer «actualizar».
  cfg <- monitoreo_aulas_normalize_config(list(tramos = list(
    list(nombre = "Semana 2", desde = "2026-09-14", hasta = "2026-09-20"),
    list(nombre = "Semana 1", desde = "2026-09-07", hasta = "2026-09-12"))))
  expect_identical(length(cfg$tramos), 2L)
  expect_identical(cfg$tramos[[1]]$nombre, "Semana 1")
  expect_identical(cfg$tramos[[2]]$desde, "2026-09-14")
})
