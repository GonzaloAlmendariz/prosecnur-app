test_that("sin declaracion la app NO inventa un criterio de aula valida", {
  # Es el estado de hoy en todos los estudios: la app se cree el veredicto del
  # Excel. Devolver un umbral por defecto seria peor que no tener ninguno,
  # porque la pantalla diria «valida» con una vara que nadie eligio.
  expect_null(monitoreo_aulas_criterio_aula(list()))
  expect_null(monitoreo_aulas_criterio_aula(list(aula_valida = list())))
  expect_null(monitoreo_aulas_criterio_aula(list(aula_valida = list(umbral = 0))))
  expect_null(monitoreo_aulas_criterio_aula(list(aula_valida = list(umbral = "hola"))))
})

test_that("el umbral se escribe como se dice: 70 y 0.7 son el mismo", {
  # El usuario escribe el porcentaje que dice en voz alta; la config de otro
  # estudio puede traer la proporcion. Las dos formas tienen que dar lo mismo.
  expect_identical(monitoreo_aulas_criterio_aula(list(aula_valida = list(umbral = 70)))$umbral, 0.7)
  expect_identical(monitoreo_aulas_criterio_aula(list(aula_valida = list(umbral = 0.7)))$umbral, 0.7)
  # 150 no es ni una cosa ni la otra.
  expect_null(monitoreo_aulas_criterio_aula(list(aula_valida = list(umbral = 150))))
})

test_that("un denominador en cero es INDETERMINADO, no un aula que falla", {
  # No es que el aula no llegue: es que no hay con que medirla. Decir FALSE
  # acusaria al aula por un hueco de la hoja.
  c70 <- monitoreo_aulas_criterio_aula(list(aula_valida = list(umbral = 70)))
  r <- monitoreo_aulas_veredicto_propio(
    list(sent_total = 14, observed_students = 0, eligible_n = 20), c70)
  expect_true(is.na(r$asistentes))
  expect_true(is.na(r$efectiva))
  # Y el control: con el denominador lleno, la misma aula SI resuelve.
  ok <- monitoreo_aulas_veredicto_propio(
    list(sent_total = 14, observed_students = 18, eligible_n = 20), c70)
  expect_true(ok$efectiva)
})

test_that("`exige` decide con cual de los dos denominadores se juzga", {
  c70 <- function(exige) monitoreo_aulas_criterio_aula(
    list(aula_valida = list(umbral = 70, exige = exige)))
  # 14 de 18 asistentes es 77.8 % —pasa—; 14 de 30 matriculados es 46.7 % —no—.
  fila <- list(sent_total = 14, observed_students = 18, eligible_n = 30)
  expect_true(monitoreo_aulas_veredicto_propio(fila, c70("asistentes"))$efectiva)
  expect_false(monitoreo_aulas_veredicto_propio(fila, c70("matriculados"))$efectiva)
  expect_false(monitoreo_aulas_veredicto_propio(fila, c70("ambos"))$efectiva)
})

test_that("el contraste solo compara las aulas que las DOS resolvieron", {
  c70 <- monitoreo_aulas_criterio_aula(list(aula_valida = list(umbral = 70)))
  filas <- list(
    # Coinciden: las dos dicen efectiva.
    list(operational_code = "A", sent_total = 18, observed_students = 20, eligible_n = 20, efectiva = TRUE),
    # DISCREPAN: la app dice que no llega (10/20 = 50 %) y la hoja dice que si.
    list(operational_code = "B", sent_total = 10, observed_students = 20, eligible_n = 20, efectiva = TRUE),
    # La hoja no resolvio: no discrepa de nada.
    list(operational_code = "C", sent_total = 18, observed_students = 20, eligible_n = 20, efectiva = NA),
    # La app no puede resolver: tampoco entra.
    list(operational_code = "D", sent_total = 18, observed_students = 0, eligible_n = 0, efectiva = TRUE)
  )
  r <- monitoreo_aulas_contraste_veredicto(filas, c70)
  expect_identical(r$comparadas, 2L)
  expect_identical(r$discrepan, 1L)
  expect_identical(r$casos[[1]]$operational_code, "B")
  expect_false(r$casos[[1]]$segun_la_app)
  expect_true(r$casos[[1]]$segun_la_hoja)
})

test_that("sin criterio declarado no hay contraste que hacer", {
  filas <- list(list(operational_code = "A", sent_total = 18, observed_students = 20, efectiva = TRUE))
  r <- monitoreo_aulas_contraste_veredicto(filas, NULL)
  expect_false(r$declarado)
  expect_identical(r$comparadas, 0L)
})

test_that("el modo ESPERADO juzga cada aula contra lo que el diseño esperaba de ella", {
  # La vara que pidio Gonzalo: «si en un aula no se llega a lo que se esperaba,
  # lo logico es que se tenga que ir a otra aula para suplir aquello que falto».
  # El diseño publica `efectivas_esperadas` por curso-horario y en el marco 2026
  # va de 5,8 a 34,8: una proporcion igual para todas ignora esa variacion.
  crit <- monitoreo_aulas_criterio_aula(list(aula_valida = list(modo = "esperado", alfa = 0.8)))
  expect_identical(crit$modo, "esperado")
  # Con meta 12.1 y alfa 0.8, la vara son 9.68 encuestas.
  expect_true(monitoreo_aulas_veredicto_propio(list(sent_total = 10), crit, 12.1)$efectiva)
  expect_false(monitoreo_aulas_veredicto_propio(list(sent_total = 9), crit, 12.1)$efectiva)
})

test_that("sin meta del diseño el modo esperado NO juzga, en vez de inventar una vara", {
  # Es el caso de los planes que no vienen del calculo de muestra. Caer aqui a
  # una proporcion cualquiera seria exactamente lo que este modo viene a quitar,
  # y ademas repetiria el defecto de la meta = elegibles.
  crit <- monitoreo_aulas_criterio_aula(list(aula_valida = list(modo = "esperado", alfa = 0.8)))
  expect_true(is.na(monitoreo_aulas_veredicto_propio(list(sent_total = 30), crit, NA)$efectiva))
  expect_true(is.na(monitoreo_aulas_veredicto_propio(list(sent_total = 30), crit, 0)$efectiva))
})

test_that("«80» y «0.8» son el mismo alfa, y uno invalido no declara criterio", {
  m <- function(a) monitoreo_aulas_criterio_aula(list(aula_valida = list(modo = "esperado", alfa = a)))
  expect_identical(m(80)$alfa, 0.8)
  expect_identical(m(0.8)$alfa, 0.8)
  expect_null(m(0))
  expect_null(m(150))
})

test_that("un aula sin `sent_total` no se juzga en ningun modo", {
  # No es que no llegue: es que no hay con que medirla.
  crit <- monitoreo_aulas_criterio_aula(list(aula_valida = list(modo = "esperado", alfa = 0.8)))
  expect_true(is.na(monitoreo_aulas_veredicto_propio(list(), crit, 12.1)$efectiva))
})


test_that("la meta de la Base de control SI llega al contraste en modo esperado", {
  # Las filas de la Base de control emiten `efectivas_esperadas`
  # (carga_base_control.R) — `expected_valid` es el alias del PLAN y no viaja
  # en esas filas. El contraste leia solo el alias: la meta llegaba NA en TODAS
  # las filas y «comparadas = 0» siempre, con la hoja llena. El espejo correcto
  # es el de `monitoreo_aulas_control_meta()`: `expected_valid` con fallback a
  # `efectivas_esperadas`.
  crit <- monitoreo_aulas_criterio_aula(list(aula_valida = list(modo = "esperado", alfa = 0.7)))
  filas <- list(
    # 18 efectivas contra vara 14 (= 0.7 x 20): llega, y la hoja coincide.
    list(operational_code = "A", efectivas_esperadas = 20,
         efectivas_obtenidas = 18, sent_total = 18, efectiva = TRUE),
    # 10 contra 14: no llega, y la hoja tambien lo dice.
    list(operational_code = "B", efectivas_esperadas = 20,
         efectivas_obtenidas = 10, sent_total = 10, efectiva = FALSE)
  )
  # Numerador y sent_total van IGUALES a proposito: este test aisla el hueco de
  # la meta, no la eleccion de numerador (esa vive en el test de abajo).
  r <- monitoreo_aulas_contraste_veredicto(filas, crit)
  expect_identical(r[["comparadas"]], 2L)
  expect_identical(r[["discrepan"]], 0L)
})

test_that("el modo esperado juzga con la EFECTIVA, no con el total de enviadas", {
  # La respuesta que cuenta es la EFECTIVA: la que llego y paso los filtros.
  # `sent_total` es el TOTAL de enviadas —un cuadre de campo, no la efectiva—
  # y usarlo de numerador daba por llegada un aula con 50 enviadas y 10
  # efectivas. El orden correcto: `efectivas_obtenidas` → `effective_surveys`
  # → `sent_total` como ultimo recurso.
  crit <- monitoreo_aulas_criterio_aula(list(aula_valida = list(modo = "esperado", alfa = 0.7)))
  # Vara: 0.7 x 20 = 14. Con 10 efectivas el aula NO llega, aunque envio 50.
  r <- monitoreo_aulas_veredicto_propio(
    list(efectivas_obtenidas = 10, sent_total = 50), crit, 20)
  expect_false(r[["efectiva"]])
  # Sin la columna de plataforma, el parte respalda — y sigue siendo 10, no 50.
  r2 <- monitoreo_aulas_veredicto_propio(
    list(effective_surveys = 10, sent_total = 50), crit, 20)
  expect_false(r2[["efectiva"]])
  # Y `sent_total` solo queda como ULTIMO recurso: un aula que no trae mas que
  # las enviadas se sigue juzgando en vez de quedarse sin vara.
  r3 <- monitoreo_aulas_veredicto_propio(list(sent_total = 15), crit, 20)
  expect_true(r3[["efectiva"]])
})

test_that("M2: el modo esperado juzga con la meta REDONDEADA, espejo de control_meta", {
  # `monitoreo_aulas_control_meta()` ya juzga con `logrado >= floor(meta + 0.5)`
  # porque una vara de 17.4 encuestas no existe en el mundo: se piden 17. El
  # veredicto propio comparaba contra la vara FRACCIONARIA y con
  # efectivas_esperadas = 17.4, alfa = 1 y 17 obtenidas decia FALSE (17 < 17.4)
  # donde la hoja —y el espejo— dicen que el aula llego. Dos varas para la
  # misma meta discrepan solas.
  crit <- monitoreo_aulas_criterio_aula(list(aula_valida = list(modo = "esperado", alfa = 1)))
  r <- monitoreo_aulas_veredicto_propio(list(efectivas_obtenidas = 17), crit, 17.4)
  expect_true(r[["efectiva"]])
  # El borde del redondeo: 17.6 pide 18 (floor(18.1)) y 17 NO llega.
  r2 <- monitoreo_aulas_veredicto_propio(list(efectivas_obtenidas = 17), crit, 17.6)
  expect_false(r2[["efectiva"]])
  # Y por el camino del contraste: con la meta redondeada la app coincide con
  # la hoja; con la fraccionaria, esta misma fila salia como discrepancia.
  filas <- list(list(operational_code = "A", efectivas_esperadas = 17.4,
                     efectivas_obtenidas = 17, efectiva = TRUE))
  rc <- monitoreo_aulas_contraste_veredicto(filas, crit)
  expect_identical(rc[["comparadas"]], 1L)
  expect_identical(rc[["discrepan"]], 0L)
})

test_that("el criterio declarado PERSISTE en la config normalizada", {
  # El normalizador es la whitelist de la config: lo que no nombra, no persiste.
  # Ya se comio a `valid_filters` una vez, y una superficie para declarar el
  # criterio con el campo cayendose al guardar seria peor que no tenerla.
  cfg <- monitoreo_aulas_normalize_config(list(
    aula_valida = list(modo = "esperado", alfa = 80)
  ))
  expect_identical(cfg$aula_valida$modo, "esperado")
  expect_identical(cfg$aula_valida$alfa, 0.8)

  # Y el control: una declaracion invalida no se guarda a medias.
  vacia <- monitoreo_aulas_normalize_config(list(aula_valida = list(modo = "esperado", alfa = 0)))
  expect_null(vacia$aula_valida)
  # Sin declarar, sigue sin haber criterio: la app no se inventa una vara.
  expect_null(monitoreo_aulas_normalize_config(list())$aula_valida)
})
