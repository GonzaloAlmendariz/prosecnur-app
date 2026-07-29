# Engine del cronograma por fases (bitacora_cronograma.R + bitacora_fases.R,
# ADR 0047).
#
# El contrato central: la fase la ELIGE el usuario. Las heurísticas por texto
# de router_plan_trabajo.R sugieren un valor inicial y nunca vuelven a pisarlo.
# Ese es el defecto que este archivo impide que vuelva.

.bitcron_plan_con <- function(...) {
  plan <- .plan_empty_plan()
  for (patch in list(...)) plan <- .bit_cron_crear(plan, patch)
  plan
}

# --- Catálogo de fases -------------------------------------------------------

test_that("el catálogo tiene las cinco fases del estudio en orden de recorrido", {
  ids <- vapply(.bit_fases_catalogo(), function(f) f$id, character(1))
  expect_equal(ids, c("muestra", "instrumento", "campo", "procesamiento", "entregables"))
  expect_equal(ids, BITACORA_FASES)
})

test_that("no hay una fase que apunte al módulo de la bitácora", {
  # El cronograma se construye DESDE la bitácora: una fase «Diseño» que apunta
  # al módulo donde el usuario ya está parado es la superficie mirándose a sí
  # misma, y no declara nada. Lo que se planifica desde acá empieza después.
  modulos <- vapply(.bit_fases_catalogo(), function(f) f$modulo, character(1))
  expect_false("diseno-estudio" %in% modulos)
})

test_that("cada fase mapea a claves de evidencia y ninguna se repite entre fases", {
  todos <- unlist(lapply(.bit_fases_catalogo(), function(f) f$evidencia), use.names = FALSE)
  # Una clave en dos fases haría ambigua la evidencia: la misma señal contaría
  # para dos ventanas distintas.
  expect_equal(length(todos), length(unique(todos)))
  expect_true(all(vapply(BITACORA_FASES, function(f) length(.bit_fase_modulos(f)) > 0L, logical(1))))
})

test_that("cada fase apunta a una parte real de la app", {
  # El sello (ícono + color del módulo) es lo que ancla la etapa a una parte
  # concreta de la app. Una fase sin módulo sería una abstracción de cronograma,
  # que es justo lo que el ADR 0047 vino a evitar.
  slugs_reales <- c("diseno-estudio", "calc-muestra", "editor-xlsform", "hojas-ruta",
                    "recopiladores", "monitoreo", "procesamiento", "dashboard")
  modulos <- vapply(.bit_fases_catalogo(), function(f) f$modulo, character(1))

  expect_true(all(nzchar(modulos)), info = "hay una fase sin módulo de identidad")
  expect_true(
    all(modulos %in% slugs_reales),
    info = paste("módulos que no existen en la app:", paste(setdiff(modulos, slugs_reales), collapse = ", "))
  )
})

test_that("dos fases no apuntan al mismo destino", {
  # Compartir MÓDULO es legítimo —Procesamiento y Entregables son dos secciones
  # del mismo— pero apuntar al mismo módulo Y a la misma sección haría que dos
  # etapas fueran indistinguibles y llevaran al mismo lugar.
  destinos <- vapply(.bit_fases_catalogo(), function(f) {
    paste0(f$modulo, "/", f$seccion)
  }, character(1))
  expect_equal(
    length(destinos), length(unique(destinos)),
    info = paste("destinos repetidos:", paste(destinos[duplicated(destinos)], collapse = ", "))
  )
})

test_that("Entregables vive en Procesamiento y el Dashboard solo suma evidencia", {
  ent <- Filter(function(f) f$id == "entregables", .bit_fases_catalogo())[[1]]
  # Analítica y Gráficos son secciones de Procesamiento: la etapa apunta ahí.
  expect_equal(ent$modulo, "procesamiento")
  expect_equal(ent$seccion, "graficos")
  # El Dashboard cuenta como evidencia pero no da identidad: es un plus.
  expect_true("dashboard" %in% ent$evidencia)
  expect_true(all(c("analitica", "graficos") %in% ent$evidencia))

  proc <- Filter(function(f) f$id == "procesamiento", .bit_fases_catalogo())[[1]]
  expect_false(any(c("analitica", "graficos") %in% proc$evidencia))
})

test_that("la identidad de la fase viaja en la vista para que el cliente resuelva el sello", {
  vista <- .bit_cron_vista_fases(list(), .plan_empty_plan())
  for (f in vista) {
    expect_true(nzchar(f$modulo), info = paste("la fase", f$id, "no declara módulo"))
    expect_true("seccion" %in% names(f))
  }
  campo <- Filter(function(f) f$id == "campo", vista)[[1]]
  expect_equal(campo$modulo, "monitoreo")
  proc <- Filter(function(f) f$id == "procesamiento", vista)[[1]]
  expect_equal(proc$modulo, "procesamiento")
  expect_equal(proc$seccion, "carga")
})

test_that("los siete targets heredados mapean a una fase sin dejar ninguno afuera", {
  # `.plan_task_targets` solo puede producir estos siete valores. Si alguno
  # cayera fuera de la tabla, un .pulso viejo quedaría con tareas sin clasificar.
  legacy <- c("monitoreo", "reportes", "carga", "calc-muestra", "editor-xlsform",
              "validacion", "plan-trabajo")
  for (t in legacy) {
    fase <- .bit_fase_de_targets(list(t))
    expect_true(
      fase %in% BITACORA_FASES,
      info = paste("el target heredado", t, "no mapea a una fase válida")
    )
  }
  expect_equal(.bit_fase_de_targets(list("monitoreo")), "campo")
  expect_equal(.bit_fase_de_targets(list("reportes")), "entregables")
  expect_equal(.bit_fase_de_targets(list("carga")), "procesamiento")
  # Analítica es salida, no tubería: un .pulso viejo con ese target aterriza en
  # Entregables, no en Procesamiento.
  expect_equal(.bit_fase_de_targets(list("analitica")), "entregables")
  # El fallback de la regex cae en Campo —donde arranca lo que se planifica de
  # verdad— y nunca se descarta la tarea: eso dejaría el cronograma con huecos.
  expect_equal(.bit_fase_de_targets(list("plan-trabajo")), "campo")
  expect_equal(.bit_fase_de_targets(list()), "campo")
  expect_equal(.bit_fase_de_targets(NULL), "campo")
  # Una tarea que apuntaba al propio módulo de la bitácora tampoco describe una
  # etapa: cae en el mismo fallback.
  expect_equal(.bit_fase_de_targets(list("diseno-estudio")), "campo")
})

# --- La inversión: la fase elegida manda -------------------------------------

test_that("la fase elegida sobrevive a una edición aunque el texto diga otra cosa", {
  # Regresión del defecto raíz: la actividad dice "campo", así que la regex de
  # `.plan_task_targets` querría monitoreo → fase Campo. El usuario dijo
  # Procesamiento y eso tiene que ganar, hoy y en la próxima edición.
  plan <- .bit_cron_crear(.plan_empty_plan(), list(
    activity = "Depuración de la base de campo",
    fase = "procesamiento",
    start_date = "2026-03-21",
    end_date = "2026-03-30"
  ))
  id <- plan$tasks[[1]]$id
  expect_equal(plan$tasks[[1]]$fase, "procesamiento")
  expect_true(plan$tasks[[1]]$fase_manual)

  plan <- .bit_cron_editar(plan, id, list(responsible = "Equipo B"))
  expect_equal(plan$tasks[[1]]$fase, "procesamiento")

  plan <- .bit_cron_editar(plan, id, list(activity = "Trabajo de campo en Ate"))
  expect_equal(plan$tasks[[1]]$fase, "procesamiento")
})

test_that("sin fase declarada, la heurística sí sugiere y se puede corregir", {
  plan <- .bit_cron_crear(.plan_empty_plan(), list(
    activity = "Levantamiento en campo",
    start_date = "2026-03-01",
    end_date = "2026-03-20"
  ))
  id <- plan$tasks[[1]]$id
  expect_equal(plan$tasks[[1]]$fase, "campo")
  expect_false(plan$tasks[[1]]$fase_manual)

  plan <- .bit_cron_editar(plan, id, list(fase = "muestra"))
  expect_equal(plan$tasks[[1]]$fase, "muestra")
  expect_true(plan$tasks[[1]]$fase_manual)
})

test_that("declarar la fase reescribe los sync_targets y con ellos la ventana", {
  plan <- .bit_cron_crear(.plan_empty_plan(), list(
    activity = "Depuración",
    fase = "procesamiento",
    start_date = "2026-03-21",
    end_date = "2026-03-30"
  ))
  # Procesamiento deja la base limpia y codificada; Analítica y Gráficos
  # producen salidas y pertenecen a Entregables.
  targets <- unlist(plan$tasks[[1]]$sync_targets, use.names = FALSE)
  expect_setequal(targets, c("carga", "validacion", "codificacion"))
  # Las ventanas de `.plan_windows` siguen vivas porque se alimentan de targets.
  modulos <- vapply(plan$windows, function(w) w$module_id, character(1))
  expect_true("validacion" %in% modulos)
})

# --- Dependencias sin ciclos -------------------------------------------------

test_that("un ciclo A→B→C→A se rechaza y el mensaje nombra el camino", {
  plan <- .bitcron_plan_con(
    list(activity = "A", fase = "diseno"),
    list(activity = "B", fase = "diseno"),
    list(activity = "C", fase = "diseno")
  )
  ids <- vapply(plan$tasks, function(t) t$id, character(1))

  plan <- .bit_cron_editar(plan, ids[[2]], list(blocked_by = list(ids[[1]])))
  plan <- .bit_cron_editar(plan, ids[[3]], list(blocked_by = list(ids[[2]])))

  err <- tryCatch(
    .bit_cron_editar(plan, ids[[1]], list(blocked_by = list(ids[[3]]))),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_CICLO")
  # El mensaje usa las actividades, no los ids: el usuario no conoce task_m_9f3c.
  expect_match(conditionMessage(err), "A")
  expect_match(conditionMessage(err), "B")
  expect_match(conditionMessage(err), "C")
})

test_that("un rombo A→{B,C}→D no es un ciclo", {
  plan <- .bitcron_plan_con(
    list(activity = "A", fase = "diseno"),
    list(activity = "B", fase = "diseno"),
    list(activity = "C", fase = "diseno"),
    list(activity = "D", fase = "diseno")
  )
  ids <- vapply(plan$tasks, function(t) t$id, character(1))
  plan <- .bit_cron_editar(plan, ids[[2]], list(blocked_by = list(ids[[1]])))
  plan <- .bit_cron_editar(plan, ids[[3]], list(blocked_by = list(ids[[1]])))
  expect_silent(.bit_cron_editar(plan, ids[[4]], list(blocked_by = list(ids[[2]], ids[[3]]))))
})

test_that("una auto-dependencia se corta antes de llegar a la detección", {
  plan <- .bitcron_plan_con(list(activity = "Sola", fase = "diseno"))
  id <- plan$tasks[[1]]$id
  plan <- .bit_cron_editar(plan, id, list(blocked_by = list(id)))
  expect_equal(plan$tasks[[1]]$blocked_by, list())
})

test_that("una dependencia hacia una tarea inexistente no es un ciclo", {
  plan <- .bitcron_plan_con(list(activity = "Sola", fase = "diseno"))
  id <- plan$tasks[[1]]$id
  expect_silent(.bit_cron_editar(plan, id, list(blocked_by = list("task_fantasma"))))
})

test_that("borrar una tarea limpia las dependencias que la apuntaban", {
  plan <- .bitcron_plan_con(
    list(activity = "A", fase = "diseno"),
    list(activity = "B", fase = "diseno")
  )
  ids <- vapply(plan$tasks, function(t) t$id, character(1))
  plan <- .bit_cron_editar(plan, ids[[2]], list(blocked_by = list(ids[[1]])))
  plan <- .bit_cron_borrar(plan, ids[[1]])
  expect_equal(length(plan$tasks), 1L)
  expect_equal(plan$tasks[[1]]$blocked_by, list())
})

# --- Siembra -----------------------------------------------------------------

test_that("sembrar crea las seis fases y es idempotente", {
  plan <- .bit_cron_sembrar_fases(.plan_empty_plan())
  expect_equal(length(plan$tasks), length(BITACORA_FASES))
  fases <- vapply(plan$tasks, function(t) t$fase, character(1))
  expect_setequal(fases, BITACORA_FASES)
  expect_true(all(vapply(plan$tasks, function(t) isTRUE(t$fase_manual), logical(1))))

  otra_vez <- .bit_cron_sembrar_fases(plan)
  expect_equal(length(otra_vez$tasks), length(BITACORA_FASES))
})

test_that("sembrar un subconjunto no toca las fases ya declaradas", {
  plan <- .bit_cron_sembrar_fases(.plan_empty_plan(), c("campo", "procesamiento"))
  expect_equal(length(plan$tasks), 2L)
  plan <- .bit_cron_sembrar_fases(plan, c("campo", "entregables"))
  expect_equal(length(plan$tasks), 3L)
})

test_that("sembrar no confunde una actividad suelta con la fase declarada", {
  # Tener tareas de campo sueltas no significa que la fase Campo esté definida:
  # sembrarla sigue teniendo sentido.
  plan <- .bit_cron_crear(.plan_empty_plan(), list(activity = "Levantamiento en campo"))
  expect_false(plan$tasks[[1]]$fase_manual)
  plan <- .bit_cron_sembrar_fases(plan, c("campo"))
  expect_equal(length(plan$tasks), 2L)
})

# --- Archivar y duplicar -----------------------------------------------------

test_that("archivar saca la tarea de los derivados sin borrarla", {
  plan <- .bitcron_plan_con(list(
    activity = "Entrega de informe", fase = "entregables",
    kind = "deliverable", start_date = "2026-04-05", end_date = "2026-04-05"
  ))
  id <- plan$tasks[[1]]$id
  expect_equal(length(plan$milestones), 1L)

  plan <- .bit_cron_archivar(plan, id)
  expect_equal(length(plan$tasks), 1L)
  expect_equal(length(plan$milestones), 0L)
  expect_true(nzchar(plan$tasks[[1]]$archived_at))

  plan <- .bit_cron_archivar(plan, id, archivar = FALSE)
  expect_equal(length(plan$milestones), 1L)
  expect_equal(plan$tasks[[1]]$archived_at, "")
})

test_that("duplicar no hereda avisos disparados ni dependencias", {
  plan <- .bit_cron_crear(.plan_empty_plan(), list(
    activity = "Piloto", fase = "campo",
    start_date = "2026-03-01", end_date = "2026-03-03",
    reminders = list(list(anchor = "start", offset_minutes = -1440, state = "disparado"))
  ))
  id <- plan$tasks[[1]]$id
  plan <- .bit_cron_editar(plan, id, list(blocked_by = list("task_x")))

  plan <- .bit_cron_duplicar(plan, id)
  expect_equal(length(plan$tasks), 2L)
  copia <- plan$tasks[[2]]

  expect_match(copia$activity, "\\(copia\\)$")
  expect_false(identical(copia$id, id))
  # Un duplicado que heredara el aviso ya disparado nacería con su historial
  # consumido: nunca volvería a avisar.
  expect_equal(copia$reminders[[1]]$state, "programado")
  expect_false(identical(copia$reminders[[1]]$id, plan$tasks[[1]]$reminders[[1]]$id))
  # Heredar dependencias es la forma más fácil de crear un ciclo sin pedirlo.
  expect_equal(copia$blocked_by, list())
  expect_equal(copia$archived_at, "")
})

test_that("operar sobre una tarea que ya no existe da un error accionable", {
  plan <- .plan_empty_plan()
  err <- tryCatch(.bit_cron_archivar(plan, "task_fantasma"), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_TAREA_NO_EXISTE")
  expect_equal(err$status, 404)
})

# --- Vista por fases ---------------------------------------------------------

test_that("la vista devuelve siempre las cinco fases, tengan tareas o no", {
  s <- list()
  vista <- .bit_cron_vista_fases(s, .plan_empty_plan())
  expect_equal(length(vista), 5L)
  expect_true(all(vapply(vista, function(f) f$task_count == 0L, logical(1))))
  # El compositor necesita las vacías para que el usuario pueda darles fechas.
  expect_true(all(vapply(vista, function(f) nzchar(f$label), logical(1))))
})

test_that("la vista agrega el rango de la fase y excluye las archivadas", {
  plan <- .bitcron_plan_con(
    list(activity = "Piloto", fase = "campo", start_date = "2026-03-01", end_date = "2026-03-03"),
    list(activity = "Levantamiento", fase = "campo", start_date = "2026-03-05", end_date = "2026-03-20")
  )
  campo <- Filter(function(f) f$id == "campo", .bit_cron_vista_fases(list(), plan))[[1]]
  expect_equal(campo$task_count, 2L)
  expect_equal(campo$start_date, "2026-03-01")
  expect_equal(campo$end_date, "2026-03-20")

  plan <- .bit_cron_archivar(plan, plan$tasks[[2]]$id)
  campo <- Filter(function(f) f$id == "campo", .bit_cron_vista_fases(list(), plan))[[1]]
  expect_equal(campo$task_count, 1L)
  expect_equal(campo$end_date, "2026-03-03")
})

test_that("la evidencia de una fase se cumple con que cualquiera de sus módulos la tenga", {
  plan <- .bitcron_plan_con(list(activity = "Levantamiento", fase = "campo"))
  # Campo cubre monitoreo, hojas-ruta y recopiladores: alcanza con uno.
  sin <- Filter(function(f) f$id == "campo", .bit_cron_vista_fases(list(), plan))[[1]]
  expect_equal(sin$evidence_state, "planned_only")

  con <- Filter(
    function(f) f$id == "campo",
    .bit_cron_vista_fases(list(monitoreo_snapshot = list(x = 1)), plan)
  )[[1]]
  expect_equal(con$evidence_state, "evidence_available")
})
