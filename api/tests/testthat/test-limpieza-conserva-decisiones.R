# Recargar el instrumento no puede costar las decisiones ya tomadas.
#
# `.invalidate_processing_state()` vacía el workspace de validación de la base
# porque plan y auditoría se compilan del XLSForm. Las decisiones de limpieza no
# dependen del instrumento por igual: `exclude_cases` se ancla en
# `target_case_ids` —la data, que en una recarga de instrumento no cambió—, las
# que escriben sobre una variable se anclan en `target_variable`, e
# `ignore_rule` en una regla.
#
# Se conservan todas las que tienen un ancla identificable y la comprobación se
# pospone a la rehidratación, que es el único momento en que existen a la vez el
# instrumento nuevo y el catálogo de reglas.
#
# Lo que NO puede pasar es que vuelvan solas al borrador. `.limpieza_simulate()`
# aplica todo el draft en estado `ready` sin mirar la cola, así que una decisión
# cuyo ancla desapareció se aplicaría sin figurar en ninguna pantalla.

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

# Catálogo de reglas y variables del instrumento, ambos simulados: el primero
# sale de la auditoría y el segundo de leer el XLSForm.
.cons_mock <- function(reglas = "R1", variables = c("P1", "P2")) {
  local_mocked_bindings(
    .limpieza_rule_catalog = function(scope) {
      data.frame(id_regla = reglas, n_inconsistencias = 3L, stringsAsFactors = FALSE)
    },
    .limpieza_variables_del_instrumento = function(sid, base_nombre = NULL) variables,
    .package = "prosecnurapp",
    .env = parent.frame()
  )
}

test_that("sobrevive todo lo que tiene ancla; lo malformado no", {
  conservables <- prosecnurapp:::.limpieza_decisiones_conservables(list(
    .cons_decision("d1"),
    .cons_decision("d2", action_type = "replace_value", variable = "P1"),
    .cons_decision("d3", action_type = "impute_value", variable = "P2"),
    .cons_decision("d4", action_type = "ignore_rule"),
    .cons_decision("d5", action_type = "recode_map", variable = "P3"),
    .cons_decision("d6", action_type = "nullify_fields", variable = "P4"),
    # Sin ancla no hay nada que rehidratar después.
    .cons_decision("x1", casos = character(0)),
    .cons_decision("x2", action_type = "replace_value"),
    .cons_decision("x3", action_type = "ignore_rule", source_id = ""),
    .cons_decision("x4", action_type = "accion_que_no_existe", variable = "P1")
  ))
  expect_equal(vapply(conservables, function(d) d$id, character(1)),
               c("d1", "d2", "d3", "d4", "d5", "d6"))
})

test_that("el filtro y el aplicador leen la misma lista de acciones", {
  # Si alguien agrega una acción sólo en el aplicador, la cuarentena la dejaría
  # volver sin comprobar su variable. La constante es la única fuente.
  acciones <- prosecnurapp:::.LIMPIEZA_ACCIONES_SOBRE_VARIABLE
  expect_true(all(c("replace_value", "impute_value", "recode_map", "set_value",
                    "nullify_fields", "normalize_value", "adjust_select_multiple",
                    "complete_select_multiple_hierarchy") %in% acciones))
  expect_false("exclude_cases" %in% acciones)
  expect_false("ignore_rule" %in% acciones)
})

test_that("recargar el instrumento conserva las decisiones y vacía el resto", {
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
  # Las decisiones no se perdieron, y NO volvieron al borrador.
  expect_length(scope$limpieza_draft %||% list(), 0L)
  expect_equal(vapply(scope$limpieza_preservadas, function(d) d$id, character(1)),
               c("d1", "d2"))
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

test_that("vuelve al borrador lo que recupera su regla Y su variable", {
  sid <- .cons_sesion(preservadas = list(
    .cons_decision("ok_exclusion", source_id = "R1"),
    .cons_decision("ok_variable", action_type = "replace_value", variable = "P1", source_id = "R1"),
    .cons_decision("sin_regla", source_id = "R_QUE_YA_NO_ESTA"),
    .cons_decision("sin_variable", action_type = "impute_value", variable = "P_BORRADA", source_id = "R1")
  ))
  .cons_mock(reglas = "R1", variables = c("P1", "P2"))
  prosecnurapp:::.limpieza_rehidratar_preservadas(sid, "default")
  scope <- .cons_scope(sid)

  expect_equal(vapply(scope$limpieza_draft, function(d) d$id, character(1)),
               c("ok_exclusion", "ok_variable"))
  # Lo que vuelve no arrastra la marca de cuarentena.
  expect_null(scope$limpieza_draft[[1L]]$preservada_motivo)

  # Las que no pasan no se aplican ni desaparecen, y dicen por qué.
  quedan <- vapply(scope$limpieza_preservadas, function(d) d$id, character(1))
  motivos <- vapply(scope$limpieza_preservadas, function(d) d$preservada_motivo, character(1))
  expect_equal(quedan, c("sin_regla", "sin_variable"))
  expect_equal(motivos, c("regla", "variable"))
})

test_that("un instrumento ilegible no cuenta como «ninguna variable existe»", {
  sid <- .cons_sesion(preservadas = list(
    .cons_decision("exclusion", source_id = "R1"),
    .cons_decision("variable", action_type = "replace_value", variable = "P1", source_id = "R1")
  ))
  # NULL = no se pudo leer; distinto de character(0) = se leyó y no hay ninguna.
  .cons_mock(reglas = "R1", variables = NULL)
  prosecnurapp:::.limpieza_rehidratar_preservadas(sid, "default")
  scope <- .cons_scope(sid)

  # La exclusión no depende del instrumento: vuelve igual.
  expect_equal(vapply(scope$limpieza_draft, function(d) d$id, character(1)), "exclusion")
  # La otra falla cerrada y lo declara como tal, no como variable borrada.
  expect_equal(vapply(scope$limpieza_preservadas, function(d) d$preservada_motivo, character(1)),
               "instrumento")
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

test_that("rehidratar dos veces no duplica lo que ya está en el borrador", {
  sid <- .cons_sesion(draft = list(.cons_decision("d1", source_id = "R1")),
                      preservadas = list(.cons_decision("d1", source_id = "R1")))
  .cons_mock(reglas = "R1")
  prosecnurapp:::.limpieza_rehidratar_preservadas(sid, "default")
  scope <- .cons_scope(sid)
  expect_length(scope$limpieza_draft, 1L)
  expect_length(scope$limpieza_preservadas %||% list(), 0L)
})

test_that("el payload declara la cuarentena y su motivo, no sólo el número", {
  sid <- .cons_sesion(preservadas = list(
    .cons_decision("d1", casos = c("C1", "C2")),
    .cons_decision("d2", casos = c("C2", "C3"))
  ))
  # Sin auditoría: el estado justo después de recargar el instrumento, cuando el
  # analista necesita ver que su trabajo no se perdió.
  scope <- .cons_scope(sid)
  scope$evaluacion <- NULL
  payload <- prosecnurapp:::build_limpieza(scope, sid = sid, base_nombre = "default")
  expect_equal(payload$decisiones_preservadas$n, 2L)
  # Los casos se cuentan sin repetir: C2 está en las dos decisiones.
  expect_equal(payload$decisiones_preservadas$n_casos, 3L)
  # Todavía no se evaluaron: están esperando la auditoría, no rotas.
  expect_equal(payload$decisiones_preservadas$n_sin_evaluar, 2L)
  expect_equal(payload$decisiones_preservadas$n_sin_variable, 0L)

  scope$limpieza_preservadas <- list(
    utils::modifyList(.cons_decision("d1"), list(preservada_motivo = "regla")),
    utils::modifyList(.cons_decision("d2", action_type = "replace_value", variable = "P"),
                      list(preservada_motivo = "variable"))
  )
  con_motivo <- prosecnurapp:::build_limpieza(scope, sid = sid, base_nombre = "default")
  expect_equal(con_motivo$decisiones_preservadas$n_sin_regla, 1L)
  expect_equal(con_motivo$decisiones_preservadas$n_sin_variable, 1L)
  expect_equal(con_motivo$decisiones_preservadas$n_sin_evaluar, 0L)

  vacio <- prosecnurapp:::build_limpieza(list(), sid = sid, base_nombre = "default")
  expect_equal(vacio$decisiones_preservadas$n, 0L)
})

test_that("una recarga nueva borra el motivo viejo: ya no dice nada", {
  # El motivo es el veredicto contra UN instrumento. Con otro por delante la
  # variable que faltaba puede haber vuelto, y arrastrarlo dejaría a la pestaña
  # declarando una pérdida que quizá no ocurrió.
  sid <- .cons_sesion(preservadas = list(
    utils::modifyList(
      .cons_decision("d1", action_type = "impute_value", variable = "P1"),
      list(preservada_motivo = "variable")
    )
  ))
  prosecnurapp:::estudio_replace_base_files(sid, "default", xlsform_file_id = "XLS2")
  preservadas <- .cons_scope(sid)$limpieza_preservadas

  expect_length(preservadas, 1L)
  expect_null(preservadas[[1L]]$preservada_motivo)
})

test_that("todo lo que produce el builder llega al cliente", {
  # El router enumeraba campos uno por uno y `decisiones_preservadas` se quedaba
  # en el servidor: el builder lo producía, los tests lo verificaban y la
  # pestaña no lo veía nunca. Este aserto falla si alguien vuelve a enumerar.
  sid <- .cons_sesion(preservadas = list(.cons_decision("d1", casos = c("C1", "C2"))))
  scope <- .cons_scope(sid)
  scope$evaluacion <- NULL
  limpieza <- prosecnurapp:::build_limpieza(scope, sid = sid, base_nombre = "default")
  publico <- prosecnurapp:::limpieza_payload_publico(limpieza, base_nombre = "default")

  expect_true(all(names(limpieza) %in% names(publico)))
  expect_equal(publico$decisiones_preservadas$n, 1L)
  expect_true(all(c("ok", "base_nombre", "actions") %in% names(publico)))
  # El preview no puede viajar crudo: trae closures cíclicas que revientan
  # jsonlite. Sale recortado a los campos serializables.
  expect_false(identical(publico$before_after_preview, limpieza$before_after_preview))
})

