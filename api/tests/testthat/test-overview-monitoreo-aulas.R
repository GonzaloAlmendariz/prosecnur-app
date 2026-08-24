# La tarjeta del homepage tiene que ver el trabajo del modulo que describe.
#
# `.overview_monitoreo_facts` leia `s$monitoreo_snapshot`, que es donde guardan
# su corte las familias que sincronizan con una plataforma. El perfil de
# cursos-horario guarda el suyo en `monitoreo_aulas_snapshot`.
#
# Medido el 2026-08-23 sobre el estudio de 193: el generico estaba VACIO y el de
# aulas traia `synced_at` y un tablero con 700 unidades y 193 titulares, asi que
# la tarjeta salia con `has_snapshot = FALSE` —«Sin corte», «Sin sincronizar»—
# sobre un modulo con trabajo dentro.

test_that("la familia aulas lee su propio snapshot cuando el generico esta vacio", {
  s <- list(
    monitoreo_snapshot = list(),
    monitoreo_aulas_snapshot = list(
      synced_at = "2026-08-23T04:48:25Z",
      dashboard = list(kpis = list(
        total_aulas = 700L, aulas_titulares = 193L, aulas_aplicadas = 0L,
        respuestas_total = 0L, respuestas_validas = 0L,
        brechas = 193L, quota_cells_pending = 30L
      ))
    )
  )
  f <- prosecnurapp:::.overview_monitoreo_facts(s, "aulas_universitarias")
  expect_true(f$has_snapshot)
})

test_that("se elige por CONTENIDO: una clave generica vacia no gana", {
  # `%||%` conservaria la lista vacia y no miraria la otra. Mismo defecto que el
  # rescate del libro en el router.
  s <- list(monitoreo_snapshot = list(), monitoreo_aulas_snapshot = list(
    synced_at = "2026-08-23T04:48:25Z", dashboard = list(kpis = list(aulas_titulares = 193L))
  ))
  expect_true(prosecnurapp:::.overview_monitoreo_facts(s, "aulas_universitarias")$has_snapshot)
  # Y si el generico SI trae algo, manda el generico: es el de la plataforma.
  s2 <- s
  s2$monitoreo_snapshot <- list(synced_at = "2026-01-01T00:00:00Z", dashboard = list(kpis = list()))
  expect_true(prosecnurapp:::.overview_monitoreo_facts(s2, "aulas_universitarias")$has_snapshot)
})

test_that("una brecha antes de salir a campo NO es una alerta", {
  # `brechas` + `quota_cells_pending` son 223 en un estudio sin una sola
  # aplicacion: son TODAS. «223 por revisar» sobre un modulo donde no hay nada
  # que revisar es la forma mas rapida de que nadie mire las alertas cuando de
  # verdad las haya.
  base <- list(monitoreo_snapshot = list(), monitoreo_aulas_snapshot = list(
    synced_at = "2026-08-23T04:48:25Z",
    dashboard = list(kpis = list(
      aulas_titulares = 193L, aulas_aplicadas = 0L, respuestas_total = 0L,
      brechas = 193L, quota_cells_pending = 30L
    ))
  ))
  expect_identical(prosecnurapp:::.overview_monitoreo_facts(base, "aulas_universitarias")$alerts, 0L)

  # En cuanto hay campo, las mismas cifras SI son alertas.
  con_campo <- base
  con_campo$monitoreo_aulas_snapshot$dashboard$kpis$aulas_aplicadas <- 12L
  expect_identical(
    prosecnurapp:::.overview_monitoreo_facts(con_campo, "aulas_universitarias")$alerts, 223L
  )

  # Y por respuestas tambien, no solo por aulas registradas.
  con_respuestas <- base
  con_respuestas$monitoreo_aulas_snapshot$dashboard$kpis$respuestas_total <- 40L
  expect_identical(
    prosecnurapp:::.overview_monitoreo_facts(con_respuestas, "aulas_universitarias")$alerts, 223L
  )
})
