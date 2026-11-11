# Cifras de Hallazgos con grano declarado (E3 y E6 de la revisión metodológica
# de M2): en una hija los registros no se cuentan como encuestados, las copias
# de la tabla principal no aparecen como otra tabla y sin reglas evaluadas el
# conteo es cero, no vacío.

.cg_ev <- function(tablas, reglas) {
  res <- if (length(reglas)) tibble::tibble(
    id_regla = vapply(reglas, `[[`, "", "id"),
    tabla = vapply(reglas, `[[`, "", "tabla"),
    flag = vapply(reglas, `[[`, "", "flag"),
    n_inconsistencias = vapply(reglas, function(r) sum(tablas[[r$tabla]][[r$flag]], na.rm = TRUE), 0)
  ) else tibble::tibble(id_regla = character(), tabla = character(), flag = character(),
                        n_inconsistencias = numeric())
  list(resumen = res, datos_tablas = tablas, datos = tablas$principal)
}

.cg_tabla <- function(cf, t) Filter(function(x) identical(x$tabla, t), cf$por_tabla)

test_that("E3: en una hija que hereda el id del envío, registros y encuestados no se mezclan", {
  madre <- data.frame(`_uuid` = c("A", "B", "C"), x = 1:3, f0 = c(FALSE, TRUE, FALSE), check.names = FALSE)
  hija <- data.frame(`_uuid` = c("A", "A", "A", "B", "C", "C"), `_index` = 1:6, y = 1:6,
                     f = c(TRUE, TRUE, TRUE, FALSE, TRUE, FALSE), check.names = FALSE)
  ev <- .cg_ev(list(principal = madre, rep = hija),
               list(list(id = "R0", tabla = "principal", flag = "f0"),
                    list(id = "RH", tabla = "rep", flag = "f")))
  cf <- .limpieza_cifras_hallazgos(list(evaluacion = ev))
  rep <- .cg_tabla(cf, "rep")[[1]]
  expect_identical(rep$nivel, "registro")
  expect_identical(rep$n_registros, 6L)
  expect_identical(rep$n_hallazgos, 4L)
  expect_identical(rep$n_registros_con_hallazgos, 4L)
  expect_identical(rep$n_encuestados_con_hallazgos, 2L)   # A y C
  expect_identical(rep$n_registros_sin_encuestado, 0L)
  expect_null(rep$n_casos_con_hallazgos)
  pri <- .cg_tabla(cf, "principal")[[1]]
  expect_identical(pri$nivel, "encuestado")
  expect_identical(pri$n_registros, 3L)
  expect_identical(pri$n_encuestados_con_hallazgos, 1L)   # B
  # Cabecera: encuestados con un hallazgo propio o en alguno de sus registros.
  expect_identical(cf$n_encuestados_con_hallazgos, 3L)
  expect_identical(cf$n_casos_evaluados, 3L)
  expect_identical(cf$n_hallazgos, 5L)
  expect_identical(cf$n_hallazgos, sum(vapply(cf$por_tabla, `[[`, 0L, "n_hallazgos")))
  expect_identical(cf$n_reglas_evaluadas, 2L)
})

test_that("E3: un registro hijo se lleva a su encuestado por _parent_index, y si no se puede, se dice aparte", {
  madre <- data.frame(`_index` = 1:3, `_uuid` = c("A", "B", "C"), check.names = FALSE)
  hija <- data.frame(`_parent_index` = c(1, 1, 3, 9), `_index` = 1:4, f = c(TRUE, TRUE, TRUE, TRUE),
                     check.names = FALSE)
  ev <- .cg_ev(list(principal = madre, rep = hija), list(list(id = "RH", tabla = "rep", flag = "f")))
  cf <- .limpieza_cifras_hallazgos(list(evaluacion = ev))
  rep <- .cg_tabla(cf, "rep")[[1]]
  expect_identical(rep$n_registros_con_hallazgos, 4L)
  expect_identical(rep$n_encuestados_con_hallazgos, 2L)
  expect_identical(rep$n_registros_sin_encuestado, 1L)
  expect_identical(cf$n_encuestados_con_hallazgos, 2L)
  expect_identical(cf$n_registros_sin_encuestado, 1L)
})

test_that("E6: sin reglas evaluadas hay cero hallazgos, distinto de no tener auditoría", {
  df <- data.frame(respondent_id = "a")
  cf <- .limpieza_cifras_hallazgos(list(evaluacion = .cg_ev(list(principal = df), list())))
  expect_identical(cf$n_hallazgos, 0L)
  expect_identical(cf$n_encuestados_con_hallazgos, 0L)
  expect_identical(cf$n_reglas_evaluadas, 0L)
  expect_null(.limpieza_cifras_hallazgos(list(evaluacion = NULL)))
  # La tarjeta y la vista previa dicen el mismo cero.
  expect_identical(.limpieza_total_hallazgos(.cg_ev(list(principal = df), list())), 0L)
})

test_that("la copia de la tabla principal no aparece como otra tabla, ni en las cifras ni en el caso", {
  base <- data.frame(response_id = sprintf("R%d", 1:4), edad = c(10, 20, 30, 40),
                     `.__fila_origen__` = 1:4, check.names = FALSE)
  principal <- base[-2, ]; principal$f <- principal$edad > 25
  copia <- base
  otra <- data.frame(curso = c("X", "Y"), stringsAsFactors = FALSE)
  ev <- .cg_ev(list(principal = principal, data = copia, `CURSO Y HORARIO` = otra),
               list(list(id = "R1", tabla = "principal", flag = "f")))
  cf <- .limpieza_cifras_hallazgos(list(evaluacion = ev))
  expect_identical(vapply(cf$por_tabla, `[[`, "", "tabla"), c("principal", "CURSO Y HORARIO"))
  # Auditoría anterior a la fila de origen: la copia se reconoce por sus ids.
  sin <- lapply(ev$datos_tablas, function(t) { t$`.__fila_origen__` <- NULL; t })
  ev2 <- ev; ev2$datos_tablas <- sin; ev2$datos <- sin$principal
  cf2 <- .limpieza_cifras_hallazgos(list(evaluacion = ev2))
  expect_identical(vapply(cf2$por_tabla, `[[`, "", "tabla"), c("principal", "CURSO Y HORARIO"))
  expect_identical(.limpieza_tablas_alias(ev2), "data")
})

test_that("GET /caso no lista la copia de la tabla principal en en_otras_tablas", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  ev <- validacion_scope_get(sid, "Personas")$evaluacion
  ev$datos_tablas$datos <- ev$datos_tablas$principal   # la hoja original de un Excel
  validacion_scope_set(sid, "Personas", "evaluacion", ev)
  rc <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso", query = "base_nombre=Personas&id=u01")
  expect_identical(rc$status, 200L)
  expect_length(rc$body$en_otras_tablas, 0L)
})

test_that("el resumen de la limpieza dice hallazgos con su nombre", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir, datos_personas = .m2_datos_un_caso_dos_hallazgos())
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad(), .m1_regla_p4_p21()))
  .m2_auditar(sid, "Personas")
  b <- build_limpieza(validacion_scope_get(sid, "Personas"), sid = sid, base_nombre = "Personas")
  expect_identical(b$summary$total_hallazgos, 2L)
  expect_identical(b$summary$total_hallazgos, b$cifras_hallazgos$n_hallazgos)
  # El nombre anterior sigue al lado, con el mismo número, para el cliente que lo lee.
  expect_identical(b$summary$total_casos_afectados, b$summary$total_hallazgos)
  expect_identical(b$cifras_hallazgos$n_encuestados_con_hallazgos, 1L)
})
