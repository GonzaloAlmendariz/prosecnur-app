# =============================================================================
# Metas por celda del eje (nivel): «¿cuántas vamos y cuántas faltan?»
# =============================================================================
#
# Gonzalo, 2026-09-23: el bloque de Metas no se montaba nunca en CCSS porque la
# proyección se armaba por facultad × sexo y las celdas del diseño son niveles.

.mpe_unidad <- function(cod, comp, aplicada = FALSE, fecha = "2026-09-28") {
  list(operational_code = cod, classroom_id = cod, faculty = "CIENCIAS SOCIALES",
       sample_role = "titular", eligible_n = sum(.cm_aulas_composicion_leer(comp)),
       level_composition = comp,
       sample_status = "agendada", scheduled_date = fecha,
       operational_status = if (aplicada) "aplicada" else "planificada")
}

.mpe_cuotas <- function() list(facultades = list(
  list(facultad = "6", faculty_key = monitoreo_aulas_eje_key("6"), cuota = 40, tau = 0.5),
  list(facultad = "9", faculty_key = monitoreo_aulas_eje_key("9"), cuota = 20, tau = 0.5)))

.mpe_avance <- function() list(facultades = list(
  list(faculty_key = monitoreo_aulas_eje_key("6"), respuestas_validas = 12),
  list(faculty_key = monitoreo_aulas_eje_key("9"), respuestas_validas = 3)))

test_that("una fila por nivel: lo que cuenta + lo agendado de ese nivel × la tasa", {
  plan <- list(.mpe_unidad("CH 1", "6:20|9:4", aplicada = TRUE),
               .mpe_unidad("CH 2", "6:30|9:10"),
               .mpe_unidad("CH 3", "9:8", fecha = ""))
  cfg <- list(eje_cuota = "nivel")
  f <- monitoreo_aulas_proyeccion_metas_eje(plan, avance_cuota = .mpe_avance(),
         efectivas = c(`CH 1` = 15), cuotas = .mpe_cuotas(), cfg = cfg, tasa = "diseno")
  por <- stats::setNames(f, vapply(f, function(x) x$facultad, ""))
  expect_true(por[["6"]]$sin_sexo)
  expect_equal(por[["6"]]$obtenidas, 12)
  # CH 2 agendada con fecha; CH 3 sin fecha NO entra.
  expect_equal(por[["6"]]$elegibles_agendados, 30)
  expect_equal(por[["6"]]$proyectadas, 15)
  expect_equal(por[["9"]]$elegibles_agendados, 10)
  expect_equal(por[["9"]]$total, 8)
  expect_false(por[["9"]]$llega)
  expect_true(is.na(por[["6"]]$meta_M))
})

test_that("la tasa obtenida es lo que cuenta sobre los elegibles de ese nivel ya aplicados", {
  plan <- list(.mpe_unidad("CH 1", "6:20|9:4", aplicada = TRUE), .mpe_unidad("CH 2", "6:30"))
  f <- monitoreo_aulas_proyeccion_metas_eje(plan, avance_cuota = .mpe_avance(),
         efectivas = c(`CH 1` = 15), cuotas = .mpe_cuotas(), cfg = list(eje_cuota = "nivel"),
         tasa = "obtenida")
  seis <- Filter(function(x) identical(x$facultad, "6"), f)[[1]]
  expect_equal(seis$tasa_obtenida, 12 / 20)
  expect_equal(seis$proyectadas, 30 * 12 / 20)
})

test_that("el payload elige la rama por eje sólo con la cuota atribuida a la persona", {
  plan <- list(.mpe_unidad("CH 1", "6:20|9:4", aplicada = TRUE))
  por_eje <- monitoreo_aulas_proyeccion_payload(plan, cuotas = .mpe_cuotas(),
               cfg = list(eje_cuota = "nivel"), avance_cuota = .mpe_avance())
  expect_true(isTRUE(por_eje$muestra_diseno[[1]]$sin_sexo))
  por_facultad <- monitoreo_aulas_proyeccion_payload(plan, cuotas = .mpe_cuotas(), cfg = list())
  expect_length(por_facultad$muestra_diseno, 0L)
})
