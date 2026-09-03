# Las bandas de «Plan del día» en Sheets (dictado 2026-09-03: «Plan del día
# también está muy feo») — derivadas del contenido real: selector B20 en navy,
# cabeceras en azul claro, totales de jornada en neutro cálido y los
# pendientes de jornadas anteriores en el rojo suave. Los strings son los de
# los renderers: si uno cambia un rótulo, este archivo lo dice.

.tpdf_filas <- function() {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "a", sample_role = "titular",
         operational_status = "agendada", scheduled_date = "2026-09-10",
         scheduled_time = "10:00", faculty = "DERECHO",
         teacher = "Docente Uno", course_name = "Curso Uno"),
    list(operational_code = "CH 2", classroom_id = "b", sample_role = "titular",
         operational_status = "agendada", scheduled_date = "2026-08-01",
         scheduled_time = "09:00", faculty = "DERECHO",
         teacher = "Docente Dos", course_name = "Curso Dos")
  )
  # Un parte rendido fija el CORTE del estudio (determinismo sin reloj): con
  # él, la jornada de agosto sin parte cae a «Pendientes de jornadas
  # anteriores», que es la sección cuya banda este test clava.
  partes <- list(list(operational_code = "CH 1", intento = 1L,
                      observed_students = 20, effective_surveys = 18,
                      applied_by = "Ana", applied_date = "2026-09-10"))
  listado <- .malp_df_a_values(aulas_libro_hoja_plan_dia(plan, partes = partes))
  .mapds_con_selector(listado)
}

test_that("las bandas del plan del día se derivan del contenido publicado", {
  rows <- .tpdf_filas()
  reqs <- monitoreo_aulas_plan_dia_formato_requests(9L, rows)
  expect_gt(length(reqs), 3L)
  for (r in reqs) {
    expect_identical(r$repeatCell$fields, "userEnteredFormat(backgroundColor,textFormat)")
  }
  primeras <- vapply(rows, function(row) trimws(as.character(row[[1]] %||% "")), character(1))
  filas_banda <- vapply(reqs, function(r) r$repeatCell$range$startRowIndex + 1L, integer(1))

  # El selector: sus dos títulos en navy.
  expect_true(which(primeras == "VER EL DÍA:")[1] %in% filas_banda)
  expect_true(which(primeras == "PLAN DEL DÍA ELEGIDO")[1] %in% filas_banda)
  # TODAS las cabeceras de tabla (área del selector y listado) ganan banda.
  cabeceras <- which(primeras == "FECHA AGENDADA")
  expect_gte(length(cabeceras), 2L)
  expect_true(all(cabeceras %in% filas_banda))
  # El cierre de cada jornada y la sección de pendientes, también.
  expect_true(all(which(primeras == "Total de la jornada") %in% filas_banda))
  expect_true(which(primeras == "Pendientes de jornadas anteriores")[1] %in% filas_banda)
  # Una fila-aula normal NO se tiñe.
  fila_aula <- which(primeras == "2026-09-10")[1]
  if (!is.na(fila_aula)) expect_false(fila_aula %in% filas_banda)
})

test_that("sin filas no hay requests; el vacío no inventa bandas", {
  expect_identical(monitoreo_aulas_plan_dia_formato_requests(9L, list()), list())
})
