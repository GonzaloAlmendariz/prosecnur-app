# La llave de caso que declara el estudio SE IGNORA en M2 (limpieza_decision_engine.R,
# `.LIMPIEZA_IDENTIDAD_DECLARADA_ACTIVA <- FALSE`).
#
# Identificar los casos por `operational_config$identity$variables` salió de M2
# tras tres verificaciones que encontraron caminos en que una decisión guardada
# excluía a otro encuestado; pasa a una etapa propia. Estas pruebas fijan que,
# con la llave declarada, los ids de caso y los casos que afecta cada decisión
# son los de antes de M2 (columna candidata y, si no hay, número de fila).
# Encender el interruptor las pone en rojo.

.m2_sesion_llave <- function(dir, datos = .m2_datos_un_caso_dos_hallazgos()) {
  sid <- .m1_sesion(dir, datos_personas = datos)
  validacion_scope_set(sid, "Personas", "reglas_custom",
                       list(.m1_regla_edad(), .m1_regla_p4_p21()))
  sid
}

test_that("con llave declarada, los casos se siguen identificando por la columna candidata", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_llave(dir)
  withr::defer(session_delete(sid))
  .m2_declarar_llave(sid, "Personas", "caso")
  .m2_auditar(sid, "Personas")

  expect_identical(.m2_ids_marcados(sid, "Personas", "RC_001"), "u01")
  ident <- build_limpieza(validacion_scope_get(sid, "Personas"))$identificacion_casos
  expect_identical(ident$metodo, "columna_candidata")
  expect_identical(ident$columna, "respondent_id")
  expect_null(ident$llave_declarada)
  scope <- validacion_scope_get(sid, "Personas")
  decision <- list(source_id = "RC_001", action_type = "exclude_cases", status = "ready")
  expect_identical(.limpieza_target_case_ids(decision, scope), "u01")
})

test_that("con llave declarada, una decisión nueva se marca con la columna candidata y excluye a su caso", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_llave(dir)
  withr::defer(session_delete(sid))
  .m2_declarar_llave(sid, "Personas", "caso")
  .m2_auditar(sid, "Personas")
  scope <- validacion_scope_get(sid, "Personas")
  up <- .limpieza_upsert_decision(list(), list(
    source_id = "RC_001", action_type = "exclude_cases", target_case_ids = list("u03"),
    status = "ready", rationale = "x"), scope = scope)
  expect_identical(up$decision$identificacion_casos, list(metodo = "anterior", columna = "respondent_id"))
  out <- .limpieza_apply_decisions_to_data(.m2_datos_un_caso_dos_hallazgos(), scope, up$decisions)
  expect_identical(setdiff(.m2_datos_un_caso_dos_hallazgos()$respondent_id, out$data$respondent_id), "u03")
  # Un valor de la llave no es un id de caso: se rechaza.
  err <- tryCatch(.limpieza_upsert_decision(list(), list(
    source_id = "RC_001", action_type = "exclude_cases", target_case_ids = list("C03"),
    status = "ready", rationale = "x"), scope = scope), api_error = function(e) e)
  expect_identical(err$code, "E_LIMPIEZA_CASOS_INVALIDOS")
})

test_that("sin columna candidata, los casos se identifican por su número de fila", {
  df <- data.frame(edad = c(15, 20), p4 = c(1, 2))
  out <- .limpieza_identificar_casos(df, "principal")
  expect_identical(out$metodo, "numero_fila")
  expect_identical(out$ids, c("principal::row::1", "principal::row::2"))
})

# --- Marcas `llave_declarada` guardadas: se resuelven como antes de M2 ------
# Solo pueden existir en un estado armado a mano (el interruptor nunca estuvo
# encendido en una versión publicada). Se resuelven con el método anterior,
# igual que una decisión sin marca: el mismo encuestado que excluía HEAD.

.m2_base_dos_espacios <- function() data.frame(
  `_id` = as.character(10:1), n_cuest = as.character(1:10),
  edad = c(15, 18, 20, 30, 22, 16, 25, 26, 40, 19),
  check.names = FALSE, stringsAsFactors = FALSE
)
.m2_cfg_llave <- list(identity = list(enabled = TRUE, variables = list("n_cuest")))
.m2_llave <- list(metodo = "llave_declarada", variables = list("n_cuest"))
.m2_dec_llave <- function(objetivo = "3") list(
  id = "PD_001", source_id = "RC_001", action_type = "exclude_cases",
  target_case_ids = as.list(objetivo), status = "ready", rationale = "x",
  identificacion_casos = .m2_llave
)

test_that("una marca de llave guardada se lee con la columna candidata, como antes", {
  scope <- list(operational_config = .m2_cfg_llave, limpieza_draft = list(.m2_dec_llave()))
  out <- .limpieza_apply_decisions_to_data(.m2_base_dos_espacios(), scope, list(.m2_dec_llave()))
  # "3" es el `_id` de n_cuest 8.
  expect_identical(setdiff(.m2_base_dos_espacios()$n_cuest, out$data$n_cuest), "8")
  expect_true(.limpieza_decisiones_con_aplicabilidad(list(.m2_dec_llave()),
    list(evaluacion = list(datos_tablas = list(principal = .m2_base_dos_espacios()))))[[1]]$aplicable)
})

test_that("con decisiones de marcas distintas, todas se leen con la columna candidata", {
  anterior <- list(id = "PD_002", source_id = "RC_001", action_type = "exclude_cases",
                   target_case_ids = list("1"), status = "ready", rationale = "x")
  decs <- list(.m2_dec_llave("3"), anterior)
  scope <- list(operational_config = .m2_cfg_llave, limpieza_draft = decs)
  out <- .limpieza_apply_decisions_to_data(.m2_base_dos_espacios(), scope, decs)
  expect_setequal(setdiff(.m2_base_dos_espacios()$n_cuest, out$data$n_cuest), c("8", "10"))
})

# --- h4 y h4b de la tercera verificación, en su versión igual a HEAD ---------

.m2_rota <- function() { df <- .m2_base_dos_espacios(); df$n_cuest[10] <- "9"; df$f <- TRUE; df }
.m2_scope_rota <- function(decs) list(
  evaluacion = list(resumen = tibble::tibble(id_regla = "RC_001", tabla = "principal", flag = "f",
                                             n_inconsistencias = 10),
                    datos_tablas = list(principal = .m2_rota()), datos = .m2_rota()),
  operational_config = .m2_cfg_llave, limpieza_draft = decs)

test_that("(h4) quitar un caso de una decisión: los ids se leen con la columna candidata, como HEAD", {
  sc <- .m2_scope_rota(list(.m2_dec_llave(c("3", "5"))))
  up <- .limpieza_upsert_decision(sc$limpieza_draft, list(id = "PD_001", source_id = "RC_001",
          action_type = "exclude_cases", target_case_ids = list("3"), status = "ready", rationale = "x"),
          scope = sc)
  expect_identical(up$decision$identificacion_casos, list(metodo = "anterior", columna = "_id"))
  sc$limpieza_draft <- up$decisions
  out <- .limpieza_apply_decisions_to_data(.m2_rota(), sc, up$decisions)
  expect_identical(setdiff(.m2_rota()$`_id`, out$data$`_id`), "3")
})

test_that("(h4b) agregar un caso a una decisión: igual que HEAD", {
  sc <- .m2_scope_rota(list(.m2_dec_llave("3")))
  up <- .limpieza_upsert_decision(sc$limpieza_draft, list(id = "PD_001", source_id = "RC_001",
          action_type = "exclude_cases", target_case_ids = list("3", "4"), status = "ready", rationale = "x"),
          scope = sc)
  sc$limpieza_draft <- up$decisions
  out <- .limpieza_apply_decisions_to_data(.m2_rota(), sc, up$decisions)
  expect_setequal(setdiff(.m2_rota()$`_id`, out$data$`_id`), c("3", "4"))
})

# --- f2b de la tercera verificación: regla entera sobre una hija sin la llave --

test_that("(f2b) decisión de la regla entera de una hija con llave declarada excluye al caso, como HEAD", {
  pr <- data.frame(`_uuid` = paste0("U", 1:4), n_cuest = c("1", "2", "3", "4"), edad = 1:4,
                   check.names = FALSE, stringsAsFactors = FALSE)
  hi <- data.frame(`_uuid` = c("U1", "U2", "U2", "U3"), item = 1:4, f_h = c(FALSE, TRUE, FALSE, FALSE),
                   check.names = FALSE, stringsAsFactors = FALSE)
  ev <- list(resumen = tibble::tibble(id_regla = "RH", tabla = "rep", flag = "f_h", n_inconsistencias = 1),
             datos_tablas = list(principal = pr, rep = hi), datos = pr)
  g <- list(id = "PD_1", source_id = "RH", action_type = "exclude_cases", status = "ready", rationale = "x")
  sc <- list(evaluacion = ev, operational_config = .m2_cfg_llave, limpieza_draft = list(g))
  out <- .limpieza_apply_decisions_to_data(pr, sc, list(g))
  expect_identical(setdiff(pr$`_uuid`, out$data$`_uuid`), "U2")
  expect_identical(out$impact$cases_excluded, 1L)
})

test_that("la llave declarada de una base no toca los ids de su hermana ni los propios", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_llave(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Hogares", "reglas_custom", list(.m1_regla_edad()))
  .m2_declarar_llave(sid, "Personas", "caso")
  .m2_auditar(sid, "Personas")
  .m2_auditar(sid, "Hogares")
  expect_identical(.m2_ids_marcados(sid, "Personas", "RC_001"), "u01")
  expect_true(all(grepl("^u", .m2_ids_marcados(sid, "Hogares", "RC_001"))))
})
