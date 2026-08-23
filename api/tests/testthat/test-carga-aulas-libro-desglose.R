# Que el libro diga QUE metio, no solo cuanto.
#
# El aviso decia «Libro de 700 aulas», y 700 no son 700 visitas: son 193
# cursos-horario que se van a visitar y 507 reservas que solo entran si una
# titular cae. Un total a secas pone dos cosas distintas bajo la misma palabra.
#
# Es el mismo efecto colateral que ya dejo «Libro de 2616 aulas» sobre un libro
# de 190: aquello se arreglo filtrando el banco y ajustando el TOTAL, sin
# revisar que ese total seguia llamandose «aulas». Al cambiar lo que se cuenta
# hay que revisar quien lo cuenta.

.libro_fila <- function(codigo, rol, titular = NULL, orden = NULL) {
  list(
    operational_code = codigo,
    sample_role = rol,
    titular_operational_code = titular %||% codigo,
    replacement_order = orden %||% 0L,
    faculty = "DERECHO",
    course_name = "CURSO",
    label = tolower(gsub(" ", "", codigo))
  )
}

test_that("el libro declara cuantas visitas y cuantas reservas metio", {
  unidades <- c(
    list(.libro_fila("CH 1", "titular")),
    list(.libro_fila("R 1.1", "chain_reserve", "CH 1", 1L)),
    list(.libro_fila("R 1.2", "chain_reserve", "CH 1", 2L)),
    list(.libro_fila("CH 2", "titular")),
    list(.libro_fila("R 2.1", "chain_reserve", "CH 2", 1L))
  )
  destino <- tempfile(fileext = ".xlsx")
  on.exit(unlink(destino), add = TRUE)

  escrito <- aulas_libro_generar(unidades, destino)

  expect_equal(attr(escrito, "titulares"), 2L)
  expect_equal(attr(escrito, "reservas"), 3L)
  # El desglose tiene que sumar el total, o el consumidor no puede fiarse de el
  # y cae al total a secas —que es justo lo que hace el aviso.
  expect_equal(
    attr(escrito, "titulares") + attr(escrito, "reservas"),
    attr(escrito, "unidades")
  )
})

test_that("el banco sin usar no entra ni al total ni al desglose", {
  # Un extra sin parte ni control es capacidad, no plan: contarlo como reserva
  # prometeria un colchon que no esta reservado para nadie.
  unidades <- c(
    list(.libro_fila("CH 1", "titular")),
    list(.libro_fila("R 1.1", "chain_reserve", "CH 1", 1L)),
    list(.libro_fila("EXTRA 1", "extra_reserve_pool")),
    list(.libro_fila("EXTRA 2", "extra_reserve_pool"))
  )
  destino <- tempfile(fileext = ".xlsx")
  on.exit(unlink(destino), add = TRUE)

  escrito <- aulas_libro_generar(unidades, destino)

  expect_equal(attr(escrito, "titulares"), 1L)
  expect_equal(attr(escrito, "reservas"), 1L)
  expect_equal(attr(escrito, "unidades"), 2L)
})

test_that("un libro solo de titulares declara cero reservas, no NA", {
  # El consumidor decide con `titulares + reservas == unidades`; un NA rompe la
  # comparacion y el aviso caeria al total sin motivo.
  unidades <- list(.libro_fila("CH 1", "titular"), .libro_fila("CH 2", "titular"))
  destino <- tempfile(fileext = ".xlsx")
  on.exit(unlink(destino), add = TRUE)

  escrito <- aulas_libro_generar(unidades, destino)

  expect_equal(attr(escrito, "titulares"), 2L)
  expect_equal(attr(escrito, "reservas"), 0L)
  expect_false(is.na(attr(escrito, "reservas")))
})
