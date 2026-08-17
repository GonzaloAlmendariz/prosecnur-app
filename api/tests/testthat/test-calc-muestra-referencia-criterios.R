# La comparacion con el estudio anterior necesita el histórico de CRITERIOS,
# y el proyecto solo tenia el de asistencia.
#
# Medido en HSVG2026: de las 269 anclas de `criterios_anclas_historicas` —grano
# criterio x facultad, 15 criterios por 18 facultades— **252 dicen
# «incompatible» y solo 17 traen dato**, todas del mismo criterio
# (`enrolled_total`). Los otros catorce tienen CERO. La estanteria estaba y el
# dato no.
#
# Gonzalo, textual: «hay que separar criterios generales y luego el card de cada
# facultad con sus criterios especificos y todas sus cuentas y compararlos con el
# 2025, sus cuentas y sus metodos, tanto por card de facultad como por criterios
# generales».

.rc_ref <- function(...) {
  calc_muestra_referencia_criterios_normalizar(list(
    periodo = "2025-2", estudio = "HSVBG 2025",
    general = list(
      estadistico = "min(mediana, media)", n_diseno = 2500, sobremuestra = 1.5,
      seleccion = "sistematico k = N/n", tipo_docente_es_criterio = FALSE
    ),
    por_facultad = list(...)
  ))
}

.rc_fila <- function(f, ...) c(list(facultad = f), list(...))

test_that("la referencia normaliza sus filas y conserva el metodo general", {
  r <- .rc_ref(
    .rc_fila("LETRAS Y CIENCIAS HUMANAS", poblacion = 225, cuota = 25,
             aulas_sorteadas = 9, aulas_titulares = 4, piso_matriculados = 10),
    .rc_fila("CIENCIAS E INGENIERIA", poblacion = 4512, cuota = 523,
             aulas_sorteadas = 231, aulas_titulares = 39, piso_matriculados = 10)
  )
  expect_equal(r$schema, "calc_muestra_referencia_criterios_v1")
  expect_equal(length(r$por_facultad), 2L)
  expect_equal(r$periodo, "2025-2")
  # El metodo general viaja tal cual: es lo que permite comparar METODO y no
  # solo numeros.
  expect_false(r$general$tipo_docente_es_criterio)
  expect_equal(r$general$estadistico, "min(mediana, media)")
})

test_that("un campo ausente viaja como NA y NUNCA como 0", {
  # Un 0 se leeria como «medido y vale cero», que es otra afirmacion.
  r <- .rc_ref(.rc_fila("EDUCACION", poblacion = 197))
  f <- r$por_facultad[[1]]
  expect_equal(f$poblacion, 197)
  expect_true(is.na(f$aulas_titulares))
  expect_true(is.na(f$efectivas_logradas))
})

test_that("sin ninguna facultad utilizable la referencia es NULL", {
  # Una referencia vacia se leeria como «comparado y sin diferencias».
  expect_null(calc_muestra_referencia_criterios_normalizar(list(por_facultad = list())))
  expect_null(calc_muestra_referencia_criterios_normalizar(list()))
  expect_null(calc_muestra_referencia_criterios_normalizar(NULL))
  # Una fila sin nombre de facultad no cuenta.
  expect_null(calc_muestra_referencia_criterios_normalizar(
    list(por_facultad = list(list(poblacion = 100)))))
})

test_that("acepta un data.frame ademas de una lista de filas", {
  r <- calc_muestra_referencia_criterios_normalizar(list(por_facultad = data.frame(
    facultad = c("DERECHO", "GASTRONOMIA"), cuota = c(286, 16),
    stringsAsFactors = FALSE
  )))
  expect_equal(length(r$por_facultad), 2L)
  expect_equal(r$por_facultad[[1]]$cuota, 286)
})

test_that("la comparacion da hoy, antes y la diferencia POR FACULTAD", {
  ref <- .rc_ref(.rc_fila("LETRAS Y CIENCIAS HUMANAS", cuota = 25, aulas_titulares = 4))
  cmp <- calc_muestra_referencia_criterios_comparar(
    list(list(facultad = "LETRAS Y CIENCIAS HUMANAS", cuota = 26, aulas_titulares = 4)),
    ref
  )
  f <- cmp$filas[[1]]
  expect_true(cmp$con_referencia)
  expect_equal(f$campos$cuota$hoy, 26)
  expect_equal(f$campos$cuota$antes, 25)
  expect_equal(f$campos$cuota$delta, 1)
  expect_equal(f$campos$aulas_titulares$delta, 0)
})

test_that("empareja aunque el nombre venga con acentos o de otra forma", {
  ref <- .rc_ref(.rc_fila("GASTRONOMIA, HOTELERIA Y TURISMO", cuota = 16))
  cmp <- calc_muestra_referencia_criterios_comparar(
    list(list(facultad = "GASTRONOMÍA, HOTELERÍA Y TURISMO", cuota = 15)), ref)
  expect_equal(cmp$filas[[1]]$campos$cuota$delta, -1)
})

test_that("sin referencia el delta es NA, no 0", {
  # Publicar 0 inventaria una comparacion que no ocurrio.
  cmp <- calc_muestra_referencia_criterios_comparar(
    list(list(facultad = "DERECHO", cuota = 347)), NULL)
  f <- cmp$filas[[1]]
  expect_false(cmp$con_referencia)
  expect_equal(f$campos$cuota$hoy, 347)
  expect_true(is.na(f$campos$cuota$antes))
  expect_true(is.na(f$campos$cuota$delta))
  expect_false(f$en_el_estudio_anterior)
})

test_that("una facultad que existia antes y hoy no tiene aulas SALE igual", {
  # Es justo el caso que importa: callarla escondería la desaparicion.
  ref <- .rc_ref(.rc_fila("ARTES ESCENICAS", cuota = 70, aulas_titulares = 7))
  cmp <- calc_muestra_referencia_criterios_comparar(list(), ref)
  expect_equal(length(cmp$filas), 1L)
  f <- cmp$filas[[1]]
  expect_false(f$en_el_estudio_actual)
  expect_true(f$en_el_estudio_anterior)
  expect_equal(f$campos$cuota$antes, 70)
  expect_true(is.na(f$campos$cuota$hoy))
})

test_that("CONTROL: dos facultades distintas no se funden", {
  # Si el emparejamiento colapsara nombres parecidos —como paso truncando a 14
  # caracteres con las dos de Estudios Generales— toda la tabla mentiria.
  ref <- .rc_ref(
    .rc_fila("ESTUDIOS GENERALES LETRAS", cuota = 435),
    .rc_fila("ESTUDIOS GENERALES CIENCIAS", cuota = 424)
  )
  cmp <- calc_muestra_referencia_criterios_comparar(list(
    list(facultad = "ESTUDIOS GENERALES LETRAS", cuota = 389),
    list(facultad = "ESTUDIOS GENERALES CIENCIAS", cuota = 393)
  ), ref)
  expect_equal(length(cmp$filas), 2L)
  d <- vapply(cmp$filas, function(z) z$campos$cuota$delta, 1)
  expect_setequal(round(d), c(-46, -31))
})
