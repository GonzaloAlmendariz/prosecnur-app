# El banco de extras no se agenda, asi que no va al libro de campo.
#
# Medido en el estudio real: el plan de Monitoreo guarda las 2 616 unidades de la
# seleccion —190 titulares, 496 reservas y 1 930 extras— y la UI filtra el banco
# en cada panel, uno por uno. El generador del libro no lo hacia, y la hoja
# «Aulas Agendadas» salia con 2 120 filas: las 190 que hay que visitar mezcladas
# entre 1 930 de reserva que nadie agendo.
#
# Un extra ACTIVADO si tiene que salir: se aplica igual que un titular, y
# escribir solo titulares costo 22 filas en el estudio de trabajo. Por eso el
# filtro mira si tiene parte o control, no su rol a secas.

.banco_plan <- function(n_extras = 3L) {
  c(
    list(list(operational_code = "CH 1", sample_role = "titular",
              titular_operational_code = "CH 1", faculty = "SOCIALES",
              course_name = "C1", eligible_n = 30)),
    list(list(operational_code = "R 1.1", sample_role = "chain_reserve",
              titular_operational_code = "CH 1", replacement_order = 1,
              faculty = "SOCIALES", course_name = "C2", eligible_n = 25)),
    lapply(seq_len(n_extras), function(i) list(
      operational_code = sprintf("EXTRA %d", i), sample_role = "extra_reserve_pool",
      faculty = "SOCIALES", course_name = sprintf("CX%d", i), eligible_n = 20
    ))
  )
}

.codigos <- function(us) {
  vapply(us, function(u) as.character(u$operational_code %||% ""), character(1))
}

test_that("el banco sin usar no entra al libro", {
  us <- prosecnurapp:::.calg_unidades_del_libro(.banco_plan(3L))
  expect_identical(sort(.codigos(us)), sort(c("CH 1", "R 1.1")))
})

test_that("un extra CON parte de campo si entra", {
  us <- prosecnurapp:::.calg_unidades_del_libro(
    .banco_plan(3L),
    partes = list(list(operational_code = "EXTRA 2", effective_surveys = 12))
  )
  expect_true("EXTRA 2" %in% .codigos(us))
  expect_false("EXTRA 1" %in% .codigos(us))
})

test_that("un extra CON control tambien", {
  # El caso que costo 22 filas: un extra activado se aplica igual que un titular.
  us <- prosecnurapp:::.calg_unidades_del_libro(
    .banco_plan(3L),
    control = list(list(operational_code = "EXTRA 3", sent_total = 33))
  )
  expect_true("EXTRA 3" %in% .codigos(us))
})

test_that("titulares y reservas nunca se filtran", {
  # Aunque no tengan parte ni control: son el plan, no el banco.
  us <- prosecnurapp:::.calg_unidades_del_libro(.banco_plan(0L))
  expect_length(us, 2L)
})

test_that("un plan que solo trae banco sin usar no genera un libro vacio", {
  # Antes habria escrito un libro con las 1930 filas del banco; ahora lo dice.
  solo_banco <- lapply(1:3, function(i) list(
    operational_code = sprintf("EXTRA %d", i), sample_role = "extra_reserve_pool"
  ))
  path <- file.path(tempdir(), "libro_solo_banco.xlsx")
  expect_error(aulas_libro_generar(solo_banco, path), "banco de extras sin usar")
})

test_that("el generador declara cuantas unidades escribio de verdad", {
  # El aviso de la app decia «Libro de 2616 aulas» de un libro con 190: contaba
  # el plan crudo. Desde que el banco sin usar se filtra aqui, la unica cifra que
  # describe el archivo es la que devuelve quien lo escribe.
  skip_if_not_installed("openxlsx")
  path <- file.path(tempdir(), "libro_cuenta.xlsx")
  escrito <- aulas_libro_generar(.banco_plan(5L), path)
  expect_identical(as.integer(attr(escrito, "unidades")), 2L)
})

test_that("con un extra activado la cuenta lo incluye", {
  skip_if_not_installed("openxlsx")
  path <- file.path(tempdir(), "libro_cuenta2.xlsx")
  escrito <- aulas_libro_generar(
    .banco_plan(5L), path,
    control = list(list(operational_code = "EXTRA 4", sent_total = 7))
  )
  expect_identical(as.integer(attr(escrito, "unidades")), 3L)
})
