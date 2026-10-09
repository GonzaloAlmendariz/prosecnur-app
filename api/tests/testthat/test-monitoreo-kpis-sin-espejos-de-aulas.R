# `.monitoreo_state_payload()` copiaba tres cifras del bloque de aulas al
# `dashboard$kpis` de arriba: `aulas_total`, `aulas_aplicadas` y
# `respuestas_validas_aulas`. Nadie las leia ahi —el frontend las toma del
# BLOQUE, `aulas_universitarias_reports$kpis`, porque `railDeAulas.ts` y
# `kpisDeAulas.ts` tipan su objeto como `MonitoreoAulasDashboard`— y ninguna
# estaba declarada siquiera en `frontend/src/api/monitoreo.ts`.
#
# Se quitaron porque no eran neutras: `total_aulas` cuenta el plan CON sus
# reservas encadenadas (1.347 sobre HSVG2026, de los que 174 son titulares), asi
# que junto a `aulas_aplicadas` invitaba a leer 152 de 1.347 —un 11 % donde va un
# 87 %—. Ese error de universo ya hubo que repararlo tres veces: en el pronostico
# de cierre, en la hoja del cliente y en el badge de Registro. Este test existe
# para que no haya una cuarta.

test_that("el payload de estado NO reintroduce los espejos de aulas en `kpis`", {
  # Se mira el cuerpo de la funcion y no una respuesta HTTP porque el defecto es
  # una ASIGNACION concreta: vuelve exactamente asi, `dashboard$kpis$<campo> <-`,
  # o no vuelve. Montar una sesion completa para observarlo costaria mucho mas y
  # no distinguiria mejor.
  cuerpo <- paste(deparse(body(prosecnurapp:::.monitoreo_state_payload)), collapse = " ")
  for (campo in c("aulas_total", "aulas_aplicadas", "respuestas_validas_aulas")) {
    expect_false(
      grepl(paste0("dashboard$kpis$", campo), cuerpo, fixed = TRUE),
      info = campo
    )
  }
})

test_that("las cifras SIGUEN estando donde el frontend las lee: en el bloque", {
  # La contracara del test de arriba. Quitar el espejo no puede haberse llevado
  # el original, que es de donde `railDeAulas.ts` y `kpisDeAulas.ts` leen.
  plan <- lapply(1:3, function(i) list(
    operational_code = sprintf("CH %d", i), classroom_id = sprintf("A-%d", i),
    label = sprintf("Curso %d", i), faculty = "Derecho", wave = "M1",
    sample_role = "titular", operational_status = "agendada",
    eligible_n = 30, expected_valid = 30
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE))

  for (campo in c("total_aulas", "aulas_titulares", "aulas_aplicadas", "respuestas_validas")) {
    expect_true(campo %in% names(d$kpis), info = campo)
  }

  # Y el motivo por el que el espejo enganaba, fijado como cifra: los dos
  # universos son DISTINTOS y el rotulo tiene que elegir cual cita.
  expect_equal(d$kpis$aulas_titulares, 3L)
  expect_true(is.numeric(d$kpis$total_aulas) || is.integer(d$kpis$total_aulas))
})
