# =============================================================================
# Una EXTRA es cabeza de su propia cadena
# (2026-09-16, con el operativo publicando a diario)
# =============================================================================
#
# Gonzalo: «el botón de traer respuestas actualiza la data de la app pero ya no
# actualiza el Sheets». El aviso, una vez que dejó de quedar tapado, decía la
# causa entera:
#
#   «1 fila(s) del plan irían al Sheets sin su código de cadena
#    (titular_operational_code): EXTRA 36»
#
# EXTRA 36 fue el PRIMER refuerzo con parte de campo. La convención está
# declarada en los tests desde el 2026-08-31 —«un extra activado es cabeza de
# su propia cadena: lleva su propio código como `titular_operational_code`»—
# pero nadie se la escribía: el sorteo le pone `operational_code` y deja el otro
# campo vacío. Mientras la extra duerme no se nota; en cuanto recibe parte,
# `E_AULAS_LIBRO_SIN_CADENAS` la rechaza y **se cae la publicación entera**, no
# sólo su fila. El Sheets del operativo llevaba días congelado.
#
# El guard NO se toca: lo que protege —que el libro publicado se pueda
# regenerar— sigue siendo cierto y sigue haciendo falta. Lo que se arregla es
# que la cabeza de cadena de la extra exista.

.mecc_fila <- function(cod, rol, titular = "", aula = NULL) {
  list(classroom_id = aula %||% tolower(gsub(" ", "", cod)),
       operational_code = cod, sample_role = rol,
       titular_operational_code = titular,
       faculty = "ARTE", course_name = "C", label = "Aula",
       eligible_n = 30, enrolled_total = 34, expected_valid = 20)
}

test_that("al normalizar, cada extra recibe su propio código como cabeza de cadena", {
  plan <- monitoreo_aulas_normalize_plan(list(
    .mecc_fila("CH 1", "titular"),
    .mecc_fila("EXTRA 1", "extra_reserve_pool"),
    .mecc_fila("EXTRA 2", "extra_reserve_pool")
  ))
  txt <- function(u, k) trimws(as.character(u[[k]] %||% "")[1])
  ex <- Filter(function(u) identical(txt(u, "sample_role"), "extra_reserve_pool"), plan)
  expect_identical(length(ex), 2L)
  expect_identical(vapply(ex, function(u) txt(u, "titular_operational_code"), character(1)),
                   c("EXTRA 1", "EXTRA 2"))
})

test_that("una extra que YA trae cabeza de cadena no se pisa", {
  # Las hay activadas por la app, que ya la escriben. Reescribirlas sería
  # inventar por encima de una decisión registrada.
  #
  # **La cabeza guardada tiene que ser DISTINTA de su propio código** para que
  # esto pruebe algo: con «EXTRA 9» → «EXTRA 9» el test pasaba igual pisando y
  # sin pisar, y el mutante que rellena siempre sobrevivía. Una extra agrupada
  # bajo un titular es la forma en que se ve la diferencia.
  plan <- monitoreo_aulas_normalize_plan(list(
    .mecc_fila("CH 7", "titular", titular = "CH 7"),
    .mecc_fila("EXTRA 9", "extra_reserve_pool", titular = "CH 7")))
  txt <- function(u, k) trimws(as.character(u[[k]] %||% "")[1])
  ex <- Filter(function(u) identical(txt(u, "operational_code"), "EXTRA 9"), plan)[[1]]
  expect_identical(txt(ex, "titular_operational_code"), "CH 7")
})

test_that("una reserva de CADENA sin titular NO se rellena: eso sí está roto", {
  # Es el contraejemplo que impide arreglar esto rellenando todo lo vacío. Una
  # reserva de cadena reemplaza a alguien; sin saber a quién, el libro publicado
  # cuenta una cadena por reserva —«Aulas del diseño» sumó 1.372 donde iban 170
  # el 2026-09-12— y no se puede regenerar. Darle su propio código la haría
  # pasar el guard y volvería a romper la cuenta, en silencio.
  plan <- monitoreo_aulas_normalize_plan(list(
    .mecc_fila("CH 1", "titular"),
    .mecc_fila("R 1.1", "chain_reserve")))
  txt <- function(u, k) trimws(as.character(u[[k]] %||% "")[1])
  r <- Filter(function(u) identical(txt(u, "sample_role"), "chain_reserve"), plan)[[1]]
  expect_identical(txt(r, "titular_operational_code"), "")
})

test_that("con el plan normalizado, una extra con parte ya no tumba la publicación", {
  # El mismo caso del contrato de `test-monitoreo-aulas-libro-estructura.R`,
  # pero pasando por el normalizador: ahí se rechaza —y debe seguir
  # rechazándose, porque la fila llega sin cabeza— y aquí ya no hace falta.
  plan <- monitoreo_aulas_normalize_plan(list(
    .mecc_fila("CH 1", "titular", titular = "CH 1"),
    .mecc_fila("EXTRA 1", "extra_reserve_pool")))
  partes <- list(list(operational_code = "EXTRA 1", observed_students = 10,
                      effective_surveys = 8))
  expect_identical(length(prosecnurapp:::.calg_reservas_sin_cadena(plan, partes = partes)), 0L)
  path <- withr::local_tempfile(fileext = ".xlsx")
  expect_no_error(aulas_libro_generar(plan, path, partes = partes))
})

test_that("y una reserva de cadena rota lo sigue tumbando", {
  # El guard no se ha aflojado: lo que cambió es que la extra ya no es un caso
  # roto, no que el guard mire para otro lado.
  plan <- monitoreo_aulas_normalize_plan(list(
    .mecc_fila("CH 1", "titular", titular = "CH 1"),
    .mecc_fila("R 1.1", "chain_reserve")))
  partes <- list(list(operational_code = "R 1.1", observed_students = 10,
                      effective_surveys = 8))
  path <- withr::local_tempfile(fileext = ".xlsx")
  err <- tryCatch(aulas_libro_generar(plan, path, partes = partes), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_CADENAS")
})

test_that("darle cabeza a la extra NO cambia lo que cuenta por cadena", {
  # La cuenta que el guard existe para proteger. Todo el que agrupa cadenas lo
  # hace con `ifelse(nzchar(titular), titular, codigo)`, así que la extra ya se
  # agrupaba consigo misma: lo que cambia es que ahora lo dice. Medido sobre el
  # operativo, «Aulas del diseño» daba 174 antes y 174 después, facultad por
  # facultad.
  crudo <- list(
    .mecc_fila("CH 1", "titular"),
    .mecc_fila("R 1.1", "chain_reserve", titular = "CH 1"),
    .mecc_fila("EXTRA 1", "extra_reserve_pool"))
  antes <- prosecnurapp:::.calan_ejes(crudo)
  despues <- prosecnurapp:::.calan_ejes(monitoreo_aulas_normalize_plan(crudo))
  cadenas <- function(e) sort(unique(e$cadena[!e$es_extra]))
  expect_identical(cadenas(antes), cadenas(despues))
  expect_identical(sum(!antes$es_extra), sum(!despues$es_extra))
})
