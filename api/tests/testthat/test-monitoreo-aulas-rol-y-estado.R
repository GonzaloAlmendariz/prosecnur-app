# El estado de aplicacion por ROL, que es la forma del libro.

fila <- function(cod, rol, estado = "pendiente", titular = "", muestra = "") list(
  operational_code = cod, sample_role = rol, application_state = estado,
  titular_operational_code = titular, sample_status = muestra)

marco <- function(filas) {
  campos <- c("operational_code", "sample_role", "application_state",
              "titular_operational_code", "sample_status")
  as.data.frame(stats::setNames(lapply(campos, function(k)
    vapply(filas, function(f) as.character(f[[k]] %||% ""), character(1))), campos),
    stringsAsFactors = FALSE)
}

test_that("cada rol cuenta sus propios estados y no se mezclan", {
  d <- monitoreo_aulas_rol_y_estado(marco(list(
    fila("CH 1", "titular", "cerrando"),
    fila("CH 2", "titular", "lista"),
    fila("CH 3", "titular", "pendiente"),
    fila("R 3.1", "chain_reserve", "en_reserva", "CH 3"),
    fila("EXTRA 1", "extra_reserve_pool", "en_reserva")
  )))
  expect_identical(d$titulares$total, 3L)
  expect_identical(d$titulares$aplicado, 1L)
  expect_identical(d$titulares$agendado, 1L)
  expect_identical(d$titulares$sin_agendar, 1L)
  expect_identical(d$reemplazos$total, 1L)
  expect_identical(d$banco$total, 1L)
})

test_that("«en aplicacion» y «cerrando» son el MISMO estado: al aula se va una vez", {
  d <- monitoreo_aulas_rol_y_estado(marco(list(
    fila("CH 1", "titular", "en_aplicacion"),
    fila("CH 2", "titular", "cerrando")
  )))
  expect_identical(d$titulares$aplicado, 2L)
  expect_identical(d$titulares$agendado, 0L)
})

test_that("una reserva CON su cadena resuelta queda AL AIRE, y con la cadena abierta EN CADENA", {
  # Es la distincion que el eje plano no podia hacer: las 1 173 reservas de
  # HSVG2026 caian todas en «En reserva» sin decir cuales todavia pueden entrar.
  # Y no la escribe nadie en el libro: se deduce de la cadena.
  d <- monitoreo_aulas_rol_y_estado(marco(list(
    # Cadena RESUELTA: el titular se aplico, asi que sus dos reservas ya no
    # entran nunca.
    fila("CH 1", "titular", "cerrando"),
    fila("R 1.1", "chain_reserve", "en_reserva", "CH 1"),
    fila("R 1.2", "chain_reserve", "en_reserva", "CH 1"),
    # Cadena ABIERTA: el titular sigue sin aplicarse.
    fila("CH 2", "titular", "lista"),
    fila("R 2.1", "chain_reserve", "en_reserva", "CH 2")
  )))
  expect_identical(d$reemplazos$al_aire, 2L)
  expect_identical(d$reemplazos$en_cadena, 1L)
  expect_identical(d$reemplazos$utilizado, 0L)
})

test_that("una reserva que ya se aplico resuelve su cadena y deja al aire a las de detras", {
  d <- monitoreo_aulas_rol_y_estado(marco(list(
    fila("CH 1", "titular", "reemplazada"),
    fila("R 1.1", "chain_reserve", "cerrando", "CH 1"),
    fila("R 1.2", "chain_reserve", "en_reserva", "CH 1")
  )))
  expect_identical(d$titulares$reemplazado, 1L)
  expect_identical(d$reemplazos$utilizado, 1L)
  expect_identical(d$reemplazos$al_aire, 1L)
  expect_identical(d$reemplazos$en_cadena, 0L)
})

test_that("un titular con RECHAZO no se cuenta como sin agendar", {
  # «RECHAZO» es como el libro lo escribe (`STATUS MUESTRA`, 4 casos medidos el
  # 2026-09-10). Un rechazo entro y se cayo: no esta esperando que lo agenden.
  d <- monitoreo_aulas_rol_y_estado(marco(list(
    fila("CH 1", "titular", "lista", "", "RECHAZO"),
    fila("CH 2", "titular", "pendiente")
  )))
  expect_identical(d$titulares$rechazado, 1L)
  expect_identical(d$titulares$agendado, 0L)
  expect_identical(d$titulares$sin_agendar, 1L)
})

test_that("los estados de cada rol suman su total, sin fugas", {
  # El control que impide que un caso raro desaparezca del reparto: si algun
  # estado nuevo no cae en ninguna rama, esta suma lo dice.
  d <- monitoreo_aulas_rol_y_estado(marco(list(
    fila("CH 1", "titular", "cerrando"), fila("CH 2", "titular", "lista"),
    fila("CH 3", "titular", "pendiente"), fila("CH 4", "titular", "reemplazada"),
    fila("CH 5", "titular", "lista", "", "RECHAZO"),
    fila("R 4.1", "chain_reserve", "cerrando", "CH 4"),
    fila("R 3.1", "chain_reserve", "en_reserva", "CH 3"),
    fila("R 1.1", "chain_reserve", "en_reserva", "CH 1"),
    fila("EXTRA 1", "extra_reserve_pool", "lista"),
    fila("EXTRA 2", "extra_reserve_pool", "en_reserva")
  )))
  expect_identical(
    d$titulares$aplicado + d$titulares$agendado + d$titulares$sin_agendar +
      d$titulares$rechazado + d$titulares$reemplazado,
    d$titulares$total)
  expect_identical(
    d$reemplazos$utilizado + d$reemplazos$en_cadena + d$reemplazos$al_aire,
    d$reemplazos$total)
  expect_identical(d$banco$utilizado + d$banco$disponible, d$banco$total)
})

test_that("sin filas devuelve el reparto en cero y no revienta", {
  d <- monitoreo_aulas_rol_y_estado(data.frame())
  expect_identical(d$titulares$total, 0L)
  expect_identical(d$reemplazos$al_aire, 0L)
})
