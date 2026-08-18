# El banco de extras: el segundo nivel de respaldo del diseño.

test_that("agrega los extras por facultad con su composicion", {
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "DERECHO",
         eligible_n = 30, sex_top_1 = "F", sex_top_1_n = 20, sex_top_2 = "M", sex_top_2_n = 10),
    list(operational_code = "EXTRA 1", sample_role = "extra_reserve_pool", faculty = "DERECHO",
         stratum = "DERECHO / F / G4", eligible_n = 40,
         sex_top_1 = "F", sex_top_1_n = 28, sex_top_2 = "M", sex_top_2_n = 12),
    list(operational_code = "EXTRA 2", sample_role = "extra_reserve_pool", faculty = "DERECHO",
         stratum = "DERECHO / F / G4", eligible_n = 20,
         sex_top_1 = "M", sex_top_1_n = 15, sex_top_2 = "F", sex_top_2_n = 5),
    list(operational_code = "EXTRA 3", sample_role = "extra_reserve_pool", faculty = "ARTE",
         stratum = "ARTE / F / G1", eligible_n = 10,
         sex_top_1 = "F", sex_top_1_n = 9, sex_top_2 = "M", sex_top_2_n = 1)
  )
  b <- monitoreo_aulas_banco_extras(plan)

  # El titular NO entra en el banco.
  expect_identical(b$total, 3L)
  expect_identical(b$elegibles, 70L)
  # 28 + 5 + 9. El orden de los tramos no importa: manda la ETIQUETA, no la
  # posicion, y `EXTRA 2` trae al hombre primero justo para probarlo.
  expect_identical(b$mujeres, 42L)
  expect_identical(b$hombres, 28L)

  # Por facultad, la que mas extras tiene primero: la pregunta es «¿de esta me
  # queda algo?», no «¿como se llama?».
  expect_identical(vapply(b$por_facultad, function(f) f$faculty, character(1)), c("DERECHO", "ARTE"))
  expect_identical(b$por_facultad[[1]]$extras, 2L)
  expect_identical(b$por_facultad[[1]]$mujeres, 33L)
})

test_that("reconoce las etiquetas de sexo en sus dos idiomas", {
  # El estudio real trae `F`/`M` y los fixtures sinteticos `Mujer`/`Hombre`.
  # Mirar solo uno dejaba la mitad de los estudios con el desglose en cero.
  con <- function(e1, e2) monitoreo_aulas_banco_extras(list(list(
    operational_code = "EXTRA 1", sample_role = "extra_reserve_pool", faculty = "X",
    eligible_n = 10, sex_top_1 = e1, sex_top_1_n = 7, sex_top_2 = e2, sex_top_2_n = 3)))

  expect_identical(con("F", "M")$mujeres, 7L)
  expect_identical(con("Mujer", "Hombre")$mujeres, 7L)
  expect_identical(con("Mujer", "Hombre")$hombres, 3L)
})

test_that("un plan sin extras devuelve el banco vacio, no un error", {
  expect_identical(monitoreo_aulas_banco_extras(list())$total, 0L)
  expect_identical(
    monitoreo_aulas_banco_extras(list(list(operational_code = "CH 1", sample_role = "titular")))$total,
    0L
  )
})

test_that("el dashboard publica el banco", {
  # Con la forma que el normalizador acepta de verdad: `classroom_id`,
  # `collection_unit_id` y `expected_valid` incluidos. Una fila mas corta sale
  # descartada y el dashboard recibe un plan vacio.
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "CH 1", classroom_id = "u1", collection_unit_id = "u1",
         label = "A", course_name = "C1", faculty = "DERECHO", stratum = "DERECHO / F / G4",
         sample_role = "titular", eligible_n = 30, expected_valid = 21, sample_status = "agendada"),
    list(operational_code = "EXTRA 1", classroom_id = "u2", collection_unit_id = "u2",
         label = "B", course_name = "C2", faculty = "DERECHO", stratum = "DERECHO / F / G4",
         sample_role = "extra_reserve_pool", eligible_n = 40, expected_valid = 28,
         sex_top_1 = "F", sex_top_1_n = 28, sex_top_2 = "M", sex_top_2_n = 12,
         sample_status = "en_reserva")
  ))
  db <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan))
  expect_identical(db$banco_extras$total, 1L)
  expect_identical(db$banco_extras$por_facultad[[1]]$faculty, "DERECHO")
  expect_identical(db$banco_extras$mujeres, 28L)
})

test_that("el banco no cuenta como aulas por debajo de su meta", {
  # Eran DOS denominadores para la misma palabra: el KPI contaba sobre el plan
  # entero y la lista que ese KPI resume sobre el plan seguido. Sobre el estudio
  # real la diferencia eran las 639 del banco —2 615 contra 1 976—, que son
  # respaldo del estrato y no aulas que alguien vaya a visitar.
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "CH 1", classroom_id = "u1", collection_unit_id = "u1",
         label = "A", course_name = "C1", faculty = "DERECHO", stratum = "DERECHO / F / G4",
         sample_role = "titular", eligible_n = 30, expected_valid = 21, sample_status = "agendada"),
    list(operational_code = "EXTRA 1", classroom_id = "u2", collection_unit_id = "u2",
         label = "B", course_name = "C2", faculty = "DERECHO", stratum = "DERECHO / F / G4",
         sample_role = "extra_reserve_pool", eligible_n = 40, expected_valid = 28,
         sample_status = "en_reserva")
  ))
  db <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan))

  # El KPI y la lista que resume tienen que decir lo MISMO. Ese es el aserto que
  # se pone rojo si alguien vuelve a contar sobre el plan entero.
  expect_identical(db$kpis$brechas, length(db$brechas))
  # Y el banco no esta en ninguno de los dos.
  expect_identical(db$kpis$brechas, 1L)
})
