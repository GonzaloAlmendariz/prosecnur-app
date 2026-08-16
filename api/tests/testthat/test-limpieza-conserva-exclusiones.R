# Recargar el instrumento no puede costar las exclusiones ya decididas.
#
# `.invalidate_processing_state()` vacía el workspace de validación de la base
# porque plan y auditoría se compilan del XLSForm. Pero una decisión de excluir
# casos se ancla en `target_case_ids` —la data—, y en una recarga de instrumento
# la data no cambió: sigue siendo aplicable.
#
# Lo que NO puede pasar es que vuelva sola al borrador. `.limpieza_simulate()`
# aplica todo el draft en estado `ready` sin mirar la cola, así que una decisión
# cuya regla desapareció se aplicaría sin aparecer en ninguna pantalla. Va a
# cuarentena y sólo vuelve cuando su regla reaparece.

.cons_decision <- function(id, action_type = "exclude_cases", casos = c("C1"),
                           source_id = "R1", variable = NULL) {
  d <- list(
    id = id, source_type = "instrument_rule", source_id = source_id,
    scope = "case_subset", action_type = action_type,
    target_case_ids = as.list(casos), status = "ready",
    rationale = "motivo interno que no debe viajar"
  )
  if (!is.null(variable)) d$target_variable <- variable
  d
}

.cons_sesion <- function(draft = list(), preservadas = NULL) {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  validacion <- list(
    plan_result = list(plan = data.frame(ID = "R1")),
    evaluacion = list(resumen = data.frame(x = 1)),
    reglas_custom = list(),
    limpieza_draft = draft,
    limpieza_artifacts = list(files = list("algo")),
    limpieza_preservadas = preservadas %||% list()
  )
  s$estudio <- list(bases = list(default = list(
    nombre = "default", xlsform_file_id = "XLS1", data_file_id = "DATA",
    original_xlsform_file_id = "XLS1", original_data_file_id = "DATA",
    data_ext = "xlsx", n_filas = 103L, validacion = validacion
  )))
  s$files <- list(DATA = list(file_id = "DATA", ext = "xlsx"),
                  DATA2 = list(file_id = "DATA2", ext = "xlsx"),
                  XLS1 = list(file_id = "XLS1", ext = "xlsx"),
                  XLS2 = list(file_id = "XLS2", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s
  sid
}

.cons_scope <- function(sid) prosecnurapp:::validacion_scope_get(sid, "default")

test_that("solo sobrevive lo que se ancla en casos, no en variables ni reglas", {
  conservables <- prosecnurapp:::.limpieza_decisiones_conservables(list(
    .cons_decision("d1"),
    .cons_decision("d2", action_type = "replace_value", variable = "P1"),
    .cons_decision("d3", action_type = "impute_value", variable = "P2"),
    .cons_decision("d4", action_type = "ignore_rule"),
    .cons_decision("d5", action_type = "recode_map", variable = "P3"),
    .cons_decision("d6", action_type = "nullify_fields", variable = "P4"),
    # Una exclusión sin casos no dice nada aplicable.
    .cons_decision("d7", casos = character(0))
  ))
  expect_equal(vapply(conservables, function(d) d$id, character(1)), "d1")
})

test_that("recargar el instrumento conserva las exclusiones y borra el resto", {
  sid <- .cons_sesion(draft = list(
    .cons_decision("d1", casos = c("C1", "C2")),
    .cons_decision("d2", action_type = "replace_value", variable = "P1")
  ))
  prosecnurapp:::estudio_replace_base_files(sid, "default", xlsform_file_id = "XLS2")
  scope <- .cons_scope(sid)

  # El workspace se vació: plan y auditoría se compilan del instrumento.
  expect_null(scope$plan_result)
  expect_null(scope$evaluacion)
  expect_length(scope$limpieza_artifacts %||% list(), 0L)
  # Pero la exclusión no se perdió, y NO volvió al borrador.
  expect_length(scope$limpieza_draft %||% list(), 0L)
  expect_length(scope$limpieza_preservadas, 1L)
  expect_equal(scope$limpieza_preservadas[[1L]]$id, "d1")
})

test_that("recargar la data no conserva nada: los casos ya no son los mismos", {
  sid <- .cons_sesion(draft = list(.cons_decision("d1")))
  prosecnurapp:::estudio_replace_base_files(sid, "default", data_file_id = "DATA2",
                                            data_ext = "xlsx", n_filas = 250L)
  scope <- .cons_scope(sid)
  expect_length(scope$limpieza_preservadas %||% list(), 0L)
  expect_length(scope$limpieza_draft %||% list(), 0L)
})

test_that("dos recargas seguidas no pierden lo que conservó la primera", {
  sid <- .cons_sesion(draft = list(.cons_decision("d1")))
  prosecnurapp:::estudio_replace_base_files(sid, "default", xlsform_file_id = "XLS2")
  expect_length(.cons_scope(sid)$limpieza_preservadas, 1L)
  prosecnurapp:::estudio_replace_base_files(sid, "default", xlsform_file_id = "XLS1")
  preservadas <- .cons_scope(sid)$limpieza_preservadas
  expect_length(preservadas, 1L)
  expect_equal(preservadas[[1L]]$id, "d1")
})

test_that("la cuarentena vuelve al borrador solo cuando su regla reaparece", {
  sid <- .cons_sesion(preservadas = list(
    .cons_decision("d1", source_id = "R1"),
    .cons_decision("d2", source_id = "R_QUE_YA_NO_ESTA")
  ))
  # `.limpieza_rule_catalog()` sale de la auditoría; se simula un catálogo que
  # sólo contiene R1.
  local_mocked_bindings(
    .limpieza_rule_catalog = function(scope) {
      data.frame(id_regla = "R1", n_inconsistencias = 3L, stringsAsFactors = FALSE)
    },
    .package = "prosecnurapp"
  )
  prosecnurapp:::.limpieza_rehidratar_preservadas(sid, "default")
  scope <- .cons_scope(sid)

  expect_equal(vapply(scope$limpieza_draft, function(d) d$id, character(1)), "d1")
  # La huérfana no se aplica ni desaparece: sigue declarada.
  expect_equal(vapply(scope$limpieza_preservadas, function(d) d$id, character(1)), "d2")
})

test_that("sin auditoría no se rehidrata nada: no hay catálogo contra el que mirar", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = list(
    nombre = "default", xlsform_file_id = "XLS1", data_file_id = "DATA",
    validacion = list(evaluacion = NULL, limpieza_draft = list(),
                      limpieza_preservadas = list(.cons_decision("d1")))
  )))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  prosecnurapp:::.limpieza_rehidratar_preservadas(sid, "default")
  scope <- .cons_scope(sid)
  expect_length(scope$limpieza_draft %||% list(), 0L)
  expect_length(scope$limpieza_preservadas, 1L)
})

test_that("el payload declara la cuarentena: si no, el analista la cree perdida", {
  sid <- .cons_sesion(preservadas = list(
    .cons_decision("d1", casos = c("C1", "C2")),
    .cons_decision("d2", casos = c("C2", "C3"))
  ))
  # Sin auditoría: es el estado justo después de recargar el instrumento, que
  # es cuando el analista necesita ver que sus exclusiones no se perdieron.
  scope <- .cons_scope(sid)
  scope$evaluacion <- NULL
  payload <- prosecnurapp:::build_limpieza(scope, sid = sid, base_nombre = "default")
  expect_equal(payload$exclusiones_preservadas$n, 2L)
  # Los casos se cuentan sin repetir: C2 está en las dos decisiones.
  expect_equal(payload$exclusiones_preservadas$n_casos, 3L)

  vacio <- prosecnurapp:::build_limpieza(list(), sid = sid, base_nombre = "default")
  expect_equal(vacio$exclusiones_preservadas$n, 0L)
})
