# El sync de criterios al workspace (calc_muestra_criterios_sync_workspace.R).
#
# La UI compara el marco contra estudio$workspace$aulas_config; una config
# aplicada por API construia el marco sin aterrizar ahi y el chip «criterios
# cambiados» quedaba en ambar perpetuo. Construir es el momento de verdad:
# al guardar el marco, la copia del workspace se alinea.

test_that("el sync alinea criterios y orden docente sin tocar lo demas", {
  sid <- session_create()
  session_set(sid, "calc_muestra_estudio", list(
    workspace = list(aulas_config = list(
      criterios_seleccion = list(courseLevelRanges = list()),
      alumnos_por_ch_decision = list(schema = "calc_muestra_alumnos_por_ch_decision_v1",
                                     estadistico_default = "p25"),
      n_aulas = 30
    ))
  ))
  config <- list(
    criterios_seleccion = list(courseLevelRanges = list(DERECHO = list(list(min = 0, max = 0)))),
    teacher_type_orden = list("docente_ordinario")
  )
  expect_true(.cm_criterios_sincronizar_workspace(sid, config))
  ws <- session_get(sid)$calc_muestra_estudio$workspace$aulas_config
  expect_identical(ws$criterios_seleccion$courseLevelRanges$DERECHO[[1]]$min, 0)
  expect_identical(ws$teacher_type_orden, list("docente_ordinario"))
  # La decision confirmada y el resto del workspace quedan INTACTOS.
  expect_identical(ws$alumnos_por_ch_decision$estadistico_default, "p25")
  expect_identical(ws$n_aulas, 30)
})

test_that("sin estudio o sin workspace no hace nada y lo dice", {
  sid <- session_create()
  expect_false(.cm_criterios_sincronizar_workspace(sid, list(criterios_seleccion = list())))
  session_set(sid, "calc_muestra_estudio", list(sin_workspace = TRUE))
  expect_false(.cm_criterios_sincronizar_workspace(sid, list(criterios_seleccion = list())))
})
