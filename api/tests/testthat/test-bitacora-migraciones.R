# Migración del estado de Bitácora (bitacora_migraciones.R, ADR 0047).
#
# Este archivo es el que impide que abrir un .pulso de un estudio real destruya
# datos. Los tres invariantes declarados en el encabezado del engine:
#   1. Idempotencia — migrar dos veces == migrar una.
#   2. Aditividad — ningún campo preexistente se pierde ni cambia de valor.
#   3. Totalidad — tras migrar no quedan tareas ni entradas a medias.

# Sesión v1 realista: así se veía `plan_trabajo` antes del ADR 0047 (importado
# de un Excel, con los campos de provenencia de grilla) y así una entrada de
# bitácora escrita a mano.
.bitmig_sesion_v1 <- function() {
  list(
    plan_trabajo = list(
      ok = TRUE,
      schema = "plan_trabajo_v1",
      title = "Cronograma ACG",
      source = list(file_id = "f1", original_name = "crono.xlsx", uploaded_at = "", sheets = list("Hoja1")),
      updated_at = "2026-07-01T10:00:00Z",
      tasks = list(
        list(
          id = "task_001", sheet = "Hoja1", row = 7L, phase = "Fase 2",
          activity = "Levantamiento en campo", responsible = "Equipo A",
          product = "Base cruda", status = "active", kind = "fieldwork_window",
          start_date = "2026-03-01", end_date = "2026-03-20",
          start_time = "", end_time = "",
          start_day_index = 5L, end_day_index = 24L, duration_days = 20L,
          grid_start_col = 9L, grid_end_col = 28L,
          sync_targets = list("monitoreo"), notes = "coordinar con UMP"
        ),
        list(
          id = "task_002", sheet = "Hoja1", row = 12L, phase = "Fase 3",
          activity = "Entrega de informe final", responsible = "Coordinación",
          product = "Informe", status = "planned", kind = "milestone",
          start_date = "2026-04-05", end_date = "2026-04-05",
          start_time = "", end_time = "",
          start_day_index = 40L, end_day_index = 40L, duration_days = 1L,
          grid_start_col = 44L, grid_end_col = 44L,
          sync_targets = list("reportes"), notes = ""
        )
      ),
      phases = list("Fase 2", "Fase 3"),
      milestones = list(),
      windows = list(),
      warnings = list()
    ),
    diseno_estudio_bitacora = list(
      list(
        id = "b1", module_id = "monitoreo", tone = "riesgo",
        title = "Cuota de Ate en rojo", body = "Faltan 40 encuestas.",
        occurred_at = "2026-03-10T09:00:00Z", created_at = "2026-03-10T09:00:00Z",
        updated_at = "", tags = list("campo")
      )
    )
  )
}

test_that("migrar un .pulso v1 conserva todos los campos originales", {
  antes <- .bitmig_sesion_v1()
  despues <- .bitacora_migrar_estado(antes)

  t_antes <- antes$plan_trabajo$tasks[[1]]
  t_despues <- despues$plan_trabajo$tasks[[1]]
  for (campo in names(t_antes)) {
    expect_identical(
      t_despues[[campo]], t_antes[[campo]],
      info = paste("la migración cambió el campo preexistente:", campo)
    )
  }

  e_antes <- antes$diseno_estudio_bitacora[[1]]
  e_despues <- despues$diseno_estudio_bitacora[[1]]
  for (campo in names(e_antes)) {
    expect_identical(
      e_despues[[campo]], e_antes[[campo]],
      info = paste("la migración cambió el campo preexistente de la entrada:", campo)
    )
  }

  # Y el plan conserva su identidad: título, fuente y fases no se tocan.
  expect_equal(despues$plan_trabajo$title, "Cronograma ACG")
  expect_equal(despues$plan_trabajo$phases, list("Fase 2", "Fase 3"))
  expect_equal(despues$plan_trabajo$source$original_name, "crono.xlsx")
})

test_that("migrar es idempotente", {
  una <- .bitacora_migrar_estado(.bitmig_sesion_v1())
  dos <- .bitacora_migrar_estado(una)
  expect_identical(una, dos)
})

test_that("tras migrar, ninguna tarea ni entrada queda a medias", {
  s <- .bitacora_migrar_estado(.bitmig_sesion_v1())

  campos_tarea <- c("priority", "priority_rank", "tags", "reminders", "links",
                    "blocked_by", "archived_at", "kind_manual", "fase",
                    "fase_manual", "temporal_kind")
  for (t in s$plan_trabajo$tasks) {
    for (campo in campos_tarea) {
      expect_true(campo %in% names(t), info = paste("tarea", t$id, "sin", campo))
    }
  }

  for (e in s$diseno_estudio_bitacora) {
    for (campo in c("revisions", "archived_at", "links")) {
      expect_true(campo %in% names(e), info = paste("entrada", e$id, "sin", campo))
    }
  }
})

test_that("la forma temporal se deriva bien del plan importado", {
  s <- .bitacora_migrar_estado(.bitmig_sesion_v1())
  # Campo del 1 al 20 de marzo es un rango; la entrega del 5 de abril, un punto.
  expect_equal(s$plan_trabajo$tasks[[1]]$temporal_kind, "rango")
  expect_equal(s$plan_trabajo$tasks[[2]]$temporal_kind, "punto")
})

test_that("el plan queda declarando la versión nueva", {
  s <- .bitacora_migrar_estado(.bitmig_sesion_v1())
  expect_equal(s$plan_trabajo$schema, "plan_trabajo_v3")
  expect_equal(.bit_version_de(s$plan_trabajo, "plan_trabajo"), 3L)
})

test_that("una sesión sin estado de bitácora sobrevive intacta", {
  # Un proyecto que nunca abrió el módulo no tiene ninguna de las dos claves;
  # la migración no debe inventarlas ni fallar.
  s <- .bitacora_migrar_estado(list(id = "sid1", rp_data = NULL))
  expect_equal(s$id, "sid1")
  expect_null(s$plan_trabajo)
  expect_null(s$diseno_estudio_bitacora)

  expect_null(.bitacora_migrar_estado(NULL))
})

test_that("un plan a medias no rompe la migración", {
  # Estado corrupto plausible: plan sin `tasks` y con una tarea que no es lista.
  s <- .bitacora_migrar_estado(list(
    plan_trabajo = list(schema = "plan_trabajo_v1", title = "x")
  ))
  expect_equal(s$plan_trabajo$tasks, list())
  expect_equal(s$plan_trabajo$schema, "plan_trabajo_v3")

  s2 <- .bitacora_migrar_estado(list(
    plan_trabajo = list(schema = "plan_trabajo_v1", tasks = list("no soy una tarea"))
  ))
  expect_equal(s2$plan_trabajo$tasks[[1]], "no soy una tarea")
})

test_that(".bit_version_de lee la versión declarada y trata lo ilegible como v1", {
  expect_equal(.bit_version_de(list(schema = "plan_trabajo_v1"), "plan_trabajo"), 1L)
  expect_equal(.bit_version_de(list(schema = "plan_trabajo_v7"), "plan_trabajo"), 7L)
  # Sin campo `schema` es lo que había antes de que el campo existiera.
  expect_equal(.bit_version_de(list(), "plan_trabajo"), 1L)
  expect_equal(.bit_version_de(list(schema = "otra_cosa_v3"), "plan_trabajo"), 1L)
  expect_equal(.bit_version_de(NULL, "plan_trabajo"), 1L)
})

test_that("los saltos se detienen si falta la función del tramo", {
  # Pedir destino v5 con solo el salto 1→2 debe dejar el objeto en v2, no
  # marcarlo como v5 mintiendo sobre lo que se aplicó.
  out <- .bit_migrar_por_saltos(
    list(schema = "plan_trabajo_v1", tasks = list()),
    "plan_trabajo", 5L, list("1" = .bit_salto_plan_1_2)
  )
  expect_equal(out$schema, "plan_trabajo_v2")
})

test_that("las revisiones se ordenan de más reciente a más vieja y se acotan", {
  revs <- lapply(1:15, function(i) {
    list(revised_at = sprintf("2026-03-%02dT10:00:00Z", i), title = paste("v", i), body = "x")
  })
  out <- .bit_revisiones(revs)
  expect_length(out, BITACORA_MAX_REVISIONES)
  expect_equal(out[[1]]$revised_at, "2026-03-15T10:00:00Z")
  # El recorte descarta lo más viejo, no lo último editado.
  expect_equal(out[[BITACORA_MAX_REVISIONES]]$revised_at, "2026-03-06T10:00:00Z")
})

test_that("una revisión sin marca de tiempo se descarta", {
  # Sin `revised_at` no hay forma de ubicarla en el historial; guardarla sería
  # mostrar "qué decía antes" sin poder decir cuándo.
  expect_length(.bit_revisiones(list(list(title = "sin fecha"))), 0L)
})

# --- Salto 2 -> 3: se retira la fase «Diseño» --------------------------------

test_that("una tarea que estaba en Diseño pasa a Campo, no se queda sin fase", {
  # Descartarla o dejarla en "" dejaría el cronograma con filas que el
  # compositor no sabe dónde poner.
  plan <- .bit_salto_plan_2_3(list(
    schema = "plan_trabajo_v2",
    tasks = list(list(id = "t1", activity = "Kickoff", fase = "diseno"))
  ))
  expect_equal(plan$tasks[[1]]$fase, "campo")
})

test_that("las tareas de las otras fases no se tocan", {
  plan <- .bit_salto_plan_2_3(list(
    schema = "plan_trabajo_v2",
    tasks = list(
      list(id = "t1", activity = "Campo", fase = "campo"),
      list(id = "t2", activity = "Informe", fase = "entregables")
    )
  ))
  expect_equal(vapply(plan$tasks, function(t) t$fase, character(1)), c("campo", "entregables"))
})

test_that("la fase fijada a mano se respeta: queda fijada en el destino nuevo", {
  # Reasignar y además reabrirla a la adivinanza sería perder dos veces la
  # decisión del usuario.
  plan <- .bit_salto_plan_2_3(list(
    schema = "plan_trabajo_v2",
    tasks = list(list(id = "t1", activity = "Kickoff", fase = "diseno", fase_manual = TRUE))
  ))
  expect_equal(plan$tasks[[1]]$fase, "campo")
  expect_true(plan$tasks[[1]]$fase_manual)
})

test_that("un .pulso viejo con fase Diseño abre migrado y sin fases inválidas", {
  s <- .bitacora_migrar_estado(list(plan_trabajo = list(
    schema = "plan_trabajo_v1",
    tasks = list(list(id = "t1", activity = "Kickoff", sync_targets = list("plan-trabajo")))
  )))
  fases <- vapply(s$plan_trabajo$tasks, function(t) calc_str(t$fase, ""), character(1))
  expect_true(all(fases %in% c(BITACORA_FASES, "")))
  expect_false("diseno" %in% fases)
})
