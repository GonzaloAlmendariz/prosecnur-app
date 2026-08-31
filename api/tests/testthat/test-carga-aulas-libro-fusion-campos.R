# La fusion del libro puede CORREGIR lo que el libro posee, aunque el plan ya
# tenga valor. Regla dictada el 2026-08-24: la app manda, pero «tiene que ser
# robusta a actualizarse desde el Excel» en la agenda y el registro. El caso
# que la probaba en falso: `scheduled_moment` viajaba al libro y volvia leido,
# pero no estaba en AULAS_LIBRO_CAMPOS_PROPIOS, asi que una correccion de
# horario hecha en el Excel se descartaba en silencio si el plan ya traia uno.

test_that("una correccion de scheduled_moment hecha en el libro pisa la del plan", {
  previo <- list(list(
    operational_code = "CH 1",
    label = "Aula 01",
    scheduled_date = "2026-09-08",
    scheduled_moment = "2026-09-08 10:00"
  ))
  del_libro <- list(list(
    operational_code = "CH 1",
    scheduled_moment = "2026-09-08 12:00"
  ))
  fusion <- aulas_libro_fusionar_plan(previo, del_libro)
  fila <- fusion$plan[[1]]
  expect_identical(fila$scheduled_moment, "2026-09-08 12:00")
})

test_that("un scheduled_moment vacio en el libro no blanquea el del plan", {
  previo <- list(list(operational_code = "CH 1", scheduled_moment = "2026-09-08 10:00"))
  del_libro <- list(list(operational_code = "CH 1", scheduled_moment = ""))
  fusion <- aulas_libro_fusionar_plan(previo, del_libro)
  expect_identical(fusion$plan[[1]]$scheduled_moment, "2026-09-08 10:00")
})

test_that("scheduled_moment esta declarado entre los campos que el libro posee", {
  expect_true("scheduled_moment" %in% AULAS_LIBRO_CAMPOS_PROPIOS)
})
