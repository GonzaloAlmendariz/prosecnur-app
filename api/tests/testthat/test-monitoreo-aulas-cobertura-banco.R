# El banco no entra en el reparto de cobertura.

test_that("las reservas extra quedan fuera del reparto y se cuentan aparte", {
  # Mismo criterio que `brechas`, que ya las excluye: son aulas adicionales
  # esperando en su estrato, no aulas que alguien vaya a visitar. Contarlas como
  # «sin respuestas» convertia el banco en alarma —73 de las 121 que salian ahi
  # en el fixture— y ademas era la barra mas larga del grafico.
  fila <- function(code, rol, meta, validas) list(
    operational_code = code, classroom_id = code, sample_role = rol, faculty = "DERECHO",
    expected_valid = meta, eligible_n = 30, sample_status = "agendada",
    operational_status = "aplicada", responses_total = validas)

  plan <- c(
    lapply(1:4, function(i) fila(sprintf("CH %d", i), "titular", 10, 0)),
    lapply(1:6, function(i) fila(sprintf("EXTRA %d", i), "extra_reserve_pool", 10, 0))
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())

  reparto <- vapply(d$course_status_cobertura, function(x) x$aulas, integer(1))
  names(reparto) <- vapply(d$course_status_cobertura, function(x) x$clave, character(1))

  # **El juego de claves, primero y completo.** Sin esto, renombrar un tramo no
  # hacia fallar el test: hacia que el `[[` de abajo reventara con «subscript
  # out of bounds», y un error aborta el bloque sin sumar `failed` — el resumen
  # bajaba de 8 a 4 pass y seguia diciendo 0 fallos.
  expect_identical(names(reparto),
                   c("nulo", "critico", "insuficiente", "parcial", "satisfactorio", "pleno"))

  # Las 4 titulares, sin respuestas. Las 6 del banco, fuera.
  expect_identical(unname(reparto[["nulo"]]), 4L)
  expect_identical(sum(reparto), 4L)
  expect_identical(d$course_status_banco, 6L)
  # El total sigue siendo el del plan entero: es la cabecera del panel.
  expect_identical(d$course_status_total, 10L)
})

test_that("«sin meta» tambien se cuenta solo entre las que estan en juego", {
  # Una reserva del banco sin meta declarada no es un dato que falte: es que no
  # le toca. Contarla obligaba al pie a avisar de algo que nadie tiene que
  # arreglar.
  fila <- function(code, rol, meta) list(
    operational_code = code, classroom_id = code, sample_role = rol, faculty = "DERECHO",
    expected_valid = meta, eligible_n = 30, sample_status = "agendada",
    operational_status = "aplicada")
  d <- monitoreo_aulas_dashboard(list(
    fila("CH 1", "titular", 10),
    fila("CH 2", "titular", 0),           # esta SI es una meta que falta
    fila("EXTRA 1", "extra_reserve_pool", 0),
    fila("EXTRA 2", "extra_reserve_pool", 0)
  ), data.frame(), list())
  expect_identical(d$course_status_sin_meta, 1L)
  expect_identical(d$course_status_banco, 2L)
})

test_that("sin banco, el reparto es el de siempre", {
  # El cambio no puede alterar un estudio que no usa banco.
  fila <- function(code) list(operational_code = code, classroom_id = code, sample_role = "titular",
    faculty = "D", expected_valid = 10, eligible_n = 30, sample_status = "agendada",
    operational_status = "aplicada")
  d <- monitoreo_aulas_dashboard(lapply(1:5, function(i) fila(sprintf("CH %d", i))), data.frame(), list())
  expect_identical(sum(vapply(d$course_status_cobertura, function(x) x$aulas, integer(1))), 5L)
  expect_identical(d$course_status_banco, 0L)
})

test_that("las reservas de cadena dormidas tampoco entran, y se cuentan aparte", {
  # El defecto medido sobre HSVG: el plan son 30 titulares con 330 reservas
  # detras, y «Llegaron a su meta» decia «de 360 cursos-horario con meta»
  # mientras la agenda, dos paneles mas arriba, decia «de 30 que se van a
  # visitar». El reparto de cobertura corria sobre las mismas 360.
  #
  # La causa: la cobertura recalculaba «en juego» como «no es del banco de
  # extras», ignorando el `en_juego` que el propio motor ya publica por fila.
  # Una reserva dormida no es un aula sin respuestas: sale a campo solo si su
  # titular cae.
  fila <- function(code, rol, tit, estado) list(
    operational_code = code, classroom_id = code, sample_role = rol,
    titular_operational_code = tit, faculty = "DERECHO", expected_valid = 10,
    eligible_n = 30, sample_status = estado, operational_status = "aplicada",
    responses_total = 0)

  plan <- c(
    lapply(1:3, function(i) fila(sprintf("CH %d", i), "titular", sprintf("CH %d", i), "agendada")),
    lapply(1:9, function(i) fila(sprintf("R %d.%d", (i - 1) %% 3 + 1, i),
                                 "chain_reserve", sprintf("CH %d", (i - 1) %% 3 + 1), "en_reserva")),
    lapply(1:2, function(i) fila(sprintf("EXTRA %d", i), "extra_reserve_pool", "", "agendada"))
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())

  # Tres slots en juego, no catorce.
  expect_identical(d$course_status_con_meta, 3L)
  expect_identical(d$course_status_reservas_dormidas, 9L)
  # El banco conserva su significado: solo extras. La vista lo nombra asi.
  expect_identical(d$course_status_banco, 2L)
  expect_identical(d$course_status_total, 14L)
  # Y el reparto de cobertura cuenta los mismos tres.
  expect_identical(
    sum(vapply(d$course_status_cobertura, function(x) x$aulas, integer(1))), 3L)
})

test_that("una reserva ACTIVADA si entra: es el eslabon que esta en campo", {
  # El control del mutante. Si «dormida» se leyera como «es una reserva», este
  # caso saldria 1 y el operativo perderia de vista justo el aula que sustituyo
  # a la caida.
  fila <- function(code, rol, tit, estado) list(
    operational_code = code, classroom_id = code, sample_role = rol,
    titular_operational_code = tit, faculty = "DERECHO", expected_valid = 10,
    eligible_n = 30, sample_status = estado, operational_status = "aplicada",
    responses_total = 0)
  d <- monitoreo_aulas_dashboard(list(
    fila("CH 1", "titular", "CH 1", "reemplazada"),
    fila("R 1.1", "chain_reserve", "CH 1", "agendada")
  ), data.frame(), list())
  expect_identical(d$course_status_con_meta, 1L)
  expect_identical(d$course_status_reservas_dormidas, 1L)
})

test_that("el reparto es solo de los APLICADOS y los pendientes se cuentan aparte", {
  # Gonzalo, 2026-09-10: «en el rendimiento por curso-horario tiene que
  # considerar tambien que debe medirlo solo aquellos que han sido aplicados».
  # Estaba en el titulo de su propio boceto desde el dia anterior.
  #
  # Medido sobre HSVG26ULT2 antes de este cambio: el reparto corria sobre 219
  # cursos-horario y solo 45 tenian parte de campo; los otros 174 caian en «Sin
  # respuestas» —el 79 % del grafico— diciendo que rindieron cero cuando lo que
  # pasaba es que todavia no les tocaba.
  fila <- function(code, estado, validas) list(
    operational_code = code, classroom_id = code, sample_role = "titular",
    faculty = "DERECHO", expected_valid = 10, eligible_n = 30,
    sample_status = "agendada", operational_status = estado,
    responses_total = validas)

  d <- monitoreo_aulas_dashboard(list(
    # Dos aplicadas: una que llego y otra que se quedo a cero. Las DOS entran,
    # y el cero de la aplicada SI es un resultado.
    fila("CH 1", "aplicada", 10),
    fila("CH 2", "aplicada", 0),
    # Tres agendadas que todavia no salieron a campo: fuera del reparto.
    fila("CH 3", "agendada", 0),
    fila("CH 4", "agendada", 0),
    fila("CH 5", "agendada", 0)
  ), data.frame(), list())

  reparto <- vapply(d$course_status_cobertura, function(x) x$aulas, integer(1))
  names(reparto) <- vapply(d$course_status_cobertura, function(x) x$clave, character(1))
  expect_identical(names(reparto),
                   c("nulo", "critico", "insuficiente", "parcial", "satisfactorio", "pleno"))

  # Solo las dos aplicadas se reparten. Las dos caen en «nulo» porque en este
  # fixture no hay tabla de respuestas —`respuestas_validas` sale de ahi y no de
  # `responses_total`—, y lo que este test sujeta es QUIEN entra al reparto, no
  # en que tramo cae. El tramo ya lo cubren los tests de arriba.
  expect_identical(sum(reparto), 2L)
  expect_identical(unname(reparto[["nulo"]]), 2L)
  # Y las tres pendientes se NOMBRAN en vez de desaparecer: sacarlas del reparto
  # sin decir donde fueron deja dos totales que no cuadran.
  expect_identical(d$course_status_sin_aplicar, 3L)
  # El denominador de «llegaron a su meta» baja con ellas: es el mismo universo.
  expect_identical(d$course_status_con_meta, 2L)
})
