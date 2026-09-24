# «Esas aulas agendadas, ¿cuáles son?» (Gonzalo, 2026-09-24).

test_that("el detalle ordena por fecha y hora, y lee el sexo del padrón", {
  u <- function(cod, fecha, hora, s1, n1, s2, n2) list(
    operational_code = cod, course_name = paste("Curso", cod), section = "",
    scheduled_date = fecha, scheduled_time = hora, schedule = "LUN 08:00-10:00",
    scheduled_venue = "A406", eligible_n = n1 + n2,
    sex_top_1 = s1, sex_top_1_n = n1, sex_top_2 = s2, sex_top_2_n = n2)
  d <- .mapm_detalle_agendadas(list(
    u("CH 3", "2026-09-15", "8:00 am", "F", 10, "M", 2),
    u("CH 2", "2026-09-14", "6:45 pm", "M", 21, "F", 8),
    u("CH 1", "2026-09-14", "11:00 am", "Mujer", 7, "", 0)
  ))
  expect_identical(vapply(d, `[[`, "", "codigo"), c("CH 1", "CH 2", "CH 3"))
  expect_equal(d[[2]]$hombres, 21)
  expect_equal(d[[2]]$mujeres, 8)
  expect_equal(d[[1]]$mujeres, 7)
  expect_equal(d[[1]]$hombres, 0)
})

test_that("sin sexo en el padrón no inventa ceros", {
  d <- .mapm_detalle_agendadas(list(list(operational_code = "CH 9", eligible_n = 20)))
  expect_true(is.na(d[[1]]$hombres))
  expect_true(is.na(d[[1]]$mujeres))
})

test_that("la proyección publica tantas agendadas como cuenta", {
  plan <- list(
    list(operational_code = "CH 1", faculty = "DERECHO", eligible_n = 30,
         sample_status = "AGENDADA", scheduled_date = "2026-09-30", scheduled_time = "9:00 am",
         sex_top_1 = "F", sex_top_1_n = 20, sex_top_2 = "M", sex_top_2_n = 10),
    list(operational_code = "CH 2", faculty = "DERECHO", eligible_n = 25,
         sample_status = "EN CONTACTO", scheduled_date = "")
  )
  cuotas <- list(facultades = list(list(facultad = "DERECHO", cuota = 40, cuota_M = 15,
                                        cuota_F = 25, tau = 0.5)))
  o <- monitoreo_aulas_proyeccion_metas(plan, cuotas = cuotas)
  expect_length(o, 1L)
  expect_identical(o[[1]]$aulas_agendadas, length(o[[1]]$agendadas))
  expect_identical(o[[1]]$agendadas[[1]]$codigo, "CH 1")
})
