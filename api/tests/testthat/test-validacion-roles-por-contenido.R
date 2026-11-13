# Candidatas de los roles del caso por contenido (validacion_roles_por_contenido.R).
#
# Ítem 24 del checklist de validación del practicante: "Quién recolectó"
# proponía `fecha_entrevista` por su nombre y la identidad proponía el nombre
# de la persona encuestada.

.roles_base_digitada <- function(n = 60L) withr::with_seed(24, {
  dias <- sprintf("%02d.10.2026", 1:10)
  nombres <- c("ANA", "LUIS", "ROSA", "JUAN", "CARMEN", "PEDRO", "ELENA", "JORGE")
  apellidos <- c("PEREZ", "DIAZ", "VEGA", "QUISPE", "MAMANI", "ROJAS", "TORRES", "FLORES")
  data.frame(
    nro_encuesta = sprintf("%04d", seq_len(n)),
    # Único por fila (como la llave), pero es el nombre de la persona.
    nombre_encuestado = paste(nombres[(seq_len(n) - 1L) %% 8L + 1L],
                              apellidos[((seq_len(n) - 1L) %/% 8L) %% 8L + 1L], "GARCIA"),
    fecha_entrevista = sample(dias, n, TRUE),
    encuestador = sample(c("Maria Lopez", "Carlos Ruiz", "Lucia Soto", "Diego Paz"), n, TRUE),
    p1 = sample(c("1", "2", "3", "4", "5"), n, TRUE),
    edad = as.character(sample(18:70, n, TRUE)),
    stringsAsFactors = FALSE
  )
})

test_that("una fecha no se propone como quien recolectó aunque su nombre diga entrevista", {
  d <- .roles_base_digitada()
  out <- identidad_candidatas(d)
  agentes <- vapply(out$agentes, `[[`, "", "variable")
  expect_false("fecha_entrevista" %in% agentes)
  expect_identical(agentes[1], "encuestador")
  expect_match(out$agentes[[1]]$porque, "se repiten entre casos", fixed = TRUE)
})

test_that("la fecha se propone porque se lee como fecha, con su formato", {
  d <- .roles_base_digitada()
  out <- identidad_candidatas(d)
  fechas <- vapply(out$fechas, `[[`, "", "variable")
  expect_identical(fechas, "fecha_entrevista")
  expect_match(out$fechas[[1]]$porque, "dd.mm.aaaa", fixed = TRUE)
  expect_match(out$fechas[[1]]$porque, "60 de 60", fixed = TRUE)
})

test_that("la llave es única por fila y no es un dato personal", {
  d <- .roles_base_digitada()
  out <- identidad_candidatas(d)
  llaves <- vapply(out$llaves, `[[`, "", "variable")
  expect_identical(llaves[1], "nro_encuesta")
  expect_false("nombre_encuestado" %in% llaves)
  expect_identical(out$llaves[[1]]$porque, "Un valor distinto en cada uno de los 60 casos.")
})

test_that("toda candidata dice su causa", {
  out <- identidad_candidatas(.roles_base_digitada())
  causas <- unlist(lapply(c(out$llaves, out$agentes, out$fechas), `[[`, "porque"))
  expect_true(length(causas) >= 3L)
  expect_true(all(nzchar(causas)))
})

test_that("el periodo de campo se propone sobre una fecha dd.mm.aaaa", {
  d <- data.frame(fecha = c(rep(sprintf("%02d.10.2026", 1:10), each = 20), "15.03.2026"),
                  stringsAsFactors = FALSE)
  p <- reglas_semilla_periodo(d)
  expect_length(p, 1L)
  expect_identical(p[[1]]$semilla$columna, "fecha")
  expect_identical(p[[1]]$semilla$n_casos_afectados, 1L)
})
