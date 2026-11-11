# Marca de una decisión y aplicación por fila original (M2, segunda
# verificación independiente). Escenarios h, b4, b5 y f de su prueba de ataque,
# más el invariante de casos excluidos y la deuda b2/b3 fijada como está.

.mf_ev <- function(tablas, reglas) {
  res <- tibble::tibble(
    id_regla = vapply(reglas, `[[`, "", "id"),
    tabla = vapply(reglas, `[[`, "", "tabla"),
    flag = vapply(reglas, `[[`, "", "flag"),
    n_inconsistencias = vapply(reglas, function(r) sum(tablas[[r$tabla]][[r$flag]], na.rm = TRUE), 0)
  )
  list(resumen = res, datos_tablas = tablas, datos = tablas$principal)
}
.mf_exc <- function(id, objetivo, marca = NULL, src = "R1") {
  d <- list(id = id, source_id = src, action_type = "exclude_cases",
            target_case_ids = as.list(objetivo), status = "ready", rationale = "x")
  if (!is.null(marca)) d$identificacion_casos <- marca
  d
}
.mf_base_b <- function() data.frame(`_index` = 1:6, nombre = c("A", "B", "C", "D", "E", "F"),
                                    edad = c(10, 20, 30, 40, 50, 60), check.names = FALSE)
.mf_base_c <- function() data.frame(`_id` = as.character(10:1), n_cuest = as.character(1:10),
                                    edad = 1:10, check.names = FALSE, stringsAsFactors = FALSE)
.mf_marca_id <- list(metodo = "anterior", columna = "_id")

# --- h: volver a guardar no reescribe la marca ------------------------------
# Con la identidad declarada apagada, la marca anota la columna candidata con
# que se tomaron los casos. Si una recarga trae la base sin esa columna, la
# decisión no se aplica a nadie (nunca pasa a la siguiente columna) y volver a
# guardarla con los mismos casos conserva marca y casos.

test_that("(h) volver a guardar una exclusión cuya columna ya no está no la redirige a otro caso", {
  df <- .mf_base_c(); df$`_id` <- NULL; df$`_uuid` <- paste0("X", 1:10); df$f <- TRUE
  ev <- .mf_ev(list(principal = df), list(list(id = "R1", tabla = "principal", flag = "f")))
  d <- .mf_exc("PD_1", "3", .mf_marca_id); d$status <- "draft"
  scope <- list(evaluacion = ev, limpieza_draft = list(d))
  up <- .limpieza_upsert_decision(scope$limpieza_draft, list(
    id = "PD_1", source_id = "R1", action_type = "exclude_cases",
    target_case_ids = list("3"), status = "ready", rationale = "Revisado"), scope = scope)
  expect_identical(up$decision$identificacion_casos, .mf_marca_id)
  scope$limpieza_draft <- up$decisions
  out <- .limpieza_apply_decisions_to_data(df, scope, up$decisions)
  expect_identical(nrow(out$data), 10L)
  expect_identical(out$impact$cases_excluded, 0L)
  expect_true(any(grepl("PD_1 no se aplica", out$warnings, fixed = TRUE)))
  a <- .limpieza_decisiones_con_aplicabilidad(up$decisions, scope)
  expect_false(a[[1]]$aplicable)
  expect_identical(a[[1]]$motivo_no_aplicable, "columna_ausente")
})

test_that("(h) por HTTP: pasar a lista con los mismos casos conserva la marca", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir, datos_personas = .m2_datos_un_caso_dos_hallazgos())
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  pr <- .m1_router()
  r1 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/limpieza/decision",
                 body = '{"source_id":"RC_001","action_type":"exclude_cases","target_case_ids":["u01"],"status":"draft","base_nombre":"Personas"}')
  expect_identical(r1$status, 200L)
  marca <- r1$body$decision$identificacion_casos
  expect_identical(marca$columna, "respondent_id")
  r2 <- .m1_http(pr, sid, "POST", "/api/validacion/v2/limpieza/decision",
                 body = sprintf('{"id":"%s","source_id":"RC_001","action_type":"exclude_cases","target_case_ids":["u01"],"status":"ready","rationale":"Revisado","base_nombre":"Personas"}',
                                r1$body$decision$id))
  expect_identical(r2$status, 200L)
  expect_identical(r2$body$decision$identificacion_casos, marca)
  expect_true(r2$body$decision_draft[[1]]$aplicable)
})

test_that("casos explícitos nuevos se validan contra la última auditoría", {
  df <- .mf_base_c(); df$f <- TRUE
  ev <- .mf_ev(list(principal = df), list(list(id = "R1", tabla = "principal", flag = "f")))
  scope <- list(evaluacion = ev, limpieza_draft = list())
  ok <- .limpieza_upsert_decision(list(), list(source_id = "R1", action_type = "exclude_cases",
          target_case_ids = list("4"), status = "ready", rationale = "x"), scope = scope)
  expect_identical(ok$decision$identificacion_casos, .mf_marca_id)
  err <- tryCatch(.limpieza_upsert_decision(list(), list(source_id = "R1", action_type = "exclude_cases",
                    target_case_ids = list("99"), status = "ready", rationale = "x"), scope = scope),
                  error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_LIMPIEZA_CASOS_INVALIDOS")
  expect_identical(err$status, 422)
})

test_that("(h6) sin auditoría, casos nuevos conservan la columna de la marca", {
  previa <- .mf_exc("PD_1", "3", .mf_marca_id)
  up <- .limpieza_upsert_decision(list(previa), list(id = "PD_1", source_id = "R1",
          action_type = "exclude_cases", target_case_ids = list("3", "4"), status = "ready",
          rationale = "x"), scope = list(evaluacion = NULL, limpieza_draft = list(previa)))
  expect_identical(up$decision$identificacion_casos, .mf_marca_id)
})

test_that("(p1) una columna del usuario con el nombre interno de fila sobrevive", {
  df <- .mf_base_c(); df$`.__fila__` <- paste0("U", 1:10)
  e <- .mf_exc("PD_1", "3", .mf_marca_id)
  s <- list(id = "PD_2", source_id = "R1", action_type = "set_value", target_variable = "edad",
            action_params = list(value = 999), target_case_ids = list("5"), status = "ready",
            rationale = "x", identificacion_casos = .mf_marca_id)
  out <- .limpieza_apply_decisions_to_data(df, list(limpieza_draft = list(e, s)), list(e, s))
  expect_identical(out$data$`.__fila__`, df$`.__fila__`[df$`_id` != "3"])
  expect_identical(out$data$`_id`[out$data$edad == 999], "5")
  expect_false(any(c(".__fila___", ".__case_id__") %in% names(out$data)))
})

# --- b4 y b5: una exclusión previa no corre las correcciones -------------------

test_that("(b4) con ids por posición, una exclusión previa no corre la corrección explícita", {
  df <- .mf_base_b(); df$`_index` <- NULL
  marca <- list(metodo = "anterior", columna = "posicion")
  e <- .mf_exc("PD_1", "principal::row::2", marca)
  s <- list(id = "PD_2", source_id = "R1", action_type = "set_value", target_variable = "edad",
            action_params = list(value = 999), target_case_ids = list("principal::row::4"),
            status = "ready", rationale = "x", identificacion_casos = marca)
  out <- .limpieza_apply_decisions_to_data(df, list(limpieza_draft = list(e, s)), list(e, s))
  expect_identical(setdiff(df$nombre, out$data$nombre), "B")
  expect_identical(out$data$nombre[out$data$edad == 999], "D")
  expect_false(any(c(".__fila__", ".__case_id__") %in% names(out$data)))
})

test_that("(b5) con número de fila, una exclusión previa no corre la corrección de la regla entera", {
  df <- .mf_base_b(); df$`_index` <- NULL
  df$f_r2 <- df$nombre == "D"
  ev <- .mf_ev(list(principal = df), list(list(id = "R2", tabla = "principal", flag = "f_r2")))
  e <- .mf_exc("PD_1", "principal::row::2", list(metodo = "anterior", columna = "posicion"))
  g <- list(id = "PD_2", source_id = "R2", action_type = "set_value", target_variable = "edad",
            action_params = list(value = 999), status = "ready", rationale = "x")
  out <- .limpieza_apply_decisions_to_data(df, list(evaluacion = ev, limpieza_draft = list(e, g)), list(e, g))
  expect_identical(out$data$nombre[out$data$edad == 999], "D")
})

# --- f: regla de una tabla hija ---------------------------------------------

test_that("(f) la exclusión de un caso de una regla de la hija sale de la principal y cubre la regla", {
  pr <- data.frame(`_uuid` = paste0("U", 1:4), n_cuest = c("1", "2", "3", "4"), edad = 1:4,
                   f_p = FALSE, check.names = FALSE, stringsAsFactors = FALSE)
  hi <- data.frame(`_uuid` = c("U1", "U2", "U2", "U3"), item = 1:4, f_h = c(FALSE, TRUE, FALSE, FALSE),
                   check.names = FALSE, stringsAsFactors = FALSE)
  ev <- .mf_ev(list(principal = pr, rep = hi), list(list(id = "RH", tabla = "rep", flag = "f_h")))
  scope <- list(evaluacion = ev, limpieza_draft = list())
  ids_cola <- .limpieza_rule_case_map(ev, "RH", .limpieza_identidad_caso(scope)$variables)$case_ids
  expect_identical(ids_cola, "U2")
  up <- .limpieza_upsert_decision(list(), list(source_id = "RH", action_type = "exclude_cases",
          target_case_ids = as.list(ids_cola), status = "ready", rationale = "x"), scope = scope)
  # Marca de la tabla de la regla: la hija muestra sus casos por `_uuid`.
  expect_identical(up$decision$identificacion_casos, list(metodo = "anterior", columna = "_uuid"))
  scope$limpieza_draft <- up$decisions
  out <- .limpieza_apply_decisions_to_data(pr, scope, up$decisions)
  expect_identical(setdiff(pr$`_uuid`, out$data$`_uuid`), "U2")
  expect_identical(out$impact$cases_excluded, 1L)
  expect_true(.limpieza_decisiones_con_aplicabilidad(up$decisions, scope)[[1]]$aplicable)
  q <- .limpieza_decision_coverage(scope, "RH", up$decisions, 1L)
  expect_identical(q$covered, 1L)
  expect_true(q$covers_all)
})

# --- Invariante: los casos excluidos son las filas que salen -----------------

test_that("cases_excluded y Casos_excluidos salen de las filas retiradas, no de la lista pedida", {
  df <- .mf_base_c()
  marca <- list(metodo = "anterior", columna = "_id")
  d <- .mf_exc("PD_1", c("3", "no-existe"), marca)
  out <- .limpieza_apply_decisions_to_data(df, list(limpieza_draft = list(d)), list(d))
  expect_identical(nrow(out$data), 9L)
  expect_identical(out$impact$cases_excluded, 1L)
  expect_identical(out$excluded_cases$case_id, "3")
  # Dos decisiones sobre el mismo caso: una fila retirada.
  d2 <- .mf_exc("PD_2", "3", marca)
  out2 <- .limpieza_apply_decisions_to_data(df, list(limpieza_draft = list(d, d2)), list(d, d2))
  expect_identical(out2$impact$cases_excluded, 1L)
})

# --- Deuda previa (igual que en HEAD): número de fila tras recargar ---------
# Una marca por número de fila (`_index` o posición) sigue la numeración de la
# carga, no al encuestado: si una recarga intercala filas o cambia el orden, la
# decisión llega a otra fila. Es el comportamiento de HEAD y queda así hasta
# que se decida cómo identificar casos sin llave; estas pruebas lo fijan para
# que un cambio se vea.

test_that("(b2, deuda) marca `_index`: un export renumerado lleva la exclusión a otra fila", {
  d <- .mf_exc("PD_1", "principal::idx::3", list(metodo = "anterior", columna = "_index"))
  df <- rbind(.mf_base_b()[1:2, ], data.frame(`_index` = 0, nombre = "NUEVO", edad = 99, check.names = FALSE),
              .mf_base_b()[3:6, ])
  df$`_index` <- seq_len(nrow(df))
  out <- .limpieza_apply_decisions_to_data(df, list(limpieza_draft = list(d)), list(d))
  expect_identical(setdiff(df$nombre, out$data$nombre), "NUEVO")
})

test_that("(b3, deuda) marca de posición: otro orden lleva la exclusión a otra fila", {
  d <- .mf_exc("PD_1", "principal::row::3", list(metodo = "anterior", columna = "posicion"))
  df <- .mf_base_b()[c(6, 5, 4, 3, 2, 1), ]; df$`_index` <- NULL
  out <- .limpieza_apply_decisions_to_data(df, list(limpieza_draft = list(d)), list(d))
  expect_identical(setdiff(df$nombre, out$data$nombre), "D")
})
