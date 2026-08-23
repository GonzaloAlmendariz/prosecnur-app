# Monitoreo sabia de que sorteo venia su plan y no lo comparaba con el vigente.
#
# Recopiladores ya tenia esa comparacion —con su aviso y su boton de rehacer— y
# Monitoreo no, aunque es DONDE SE MIRA EL AVANCE DEL CAMPO. Se re-sortea,
# Recopiladores avisa y Monitoreo sigue ensenando el avance de un plan que ya no
# existe.

.origen_sesion <- function(plan_run = "", vigente = "", filas = NULL) {
  sel <- list()
  if (nzchar(vigente)) sel$selection_run_id <- vigente
  if (!is.null(filas)) sel$selection <- filas
  list(
    monitoreo_config = list(aulas_universitarias = list(selection_run_id = plan_run)),
    calc_muestra_aulas_selection = sel
  )
}

test_that("dos corridas distintas se declaran desfasadas", {
  v <- monitoreo_aulas_origen_vigente(.origen_sesion("sel_aulas_A", "sel_aulas_B"))
  expect_true(v$desfasado)
  expect_identical(v$plan_run_id, "sel_aulas_A")
  expect_identical(v$selection_run_id, "sel_aulas_B")
})

test_that("la misma corrida no es desfase", {
  v <- monitoreo_aulas_origen_vigente(.origen_sesion("sel_aulas_A", "sel_aulas_A"))
  expect_false(v$desfasado)
})

test_that("un plan sin corrida no se acusa de nada", {
  # El plan traido por libro no trae `selection_run_id`. Marcarlo seria acusarlo
  # por no tener el campo, no por estar viejo.
  expect_false(monitoreo_aulas_origen_vigente(.origen_sesion("", "sel_aulas_B"))$desfasado)
})

test_that("sin sorteo vigente tampoco", {
  expect_false(monitoreo_aulas_origen_vigente(.origen_sesion("sel_aulas_A", ""))$desfasado)
  expect_false(monitoreo_aulas_origen_vigente(list())$desfasado)
})

test_that("la corrida tambien se lee de las filas de la seleccion", {
  # Es la forma que usa `.collection_source_vigente()`; si aqui no se aceptara,
  # las dos superficies discreparian sobre cual es el sorteo vigente.
  filas <- data.frame(selection_run_id = rep("sel_aulas_B", 3), stringsAsFactors = FALSE)
  v <- monitoreo_aulas_origen_vigente(.origen_sesion("sel_aulas_A", "", filas))
  expect_identical(v$selection_run_id, "sel_aulas_B")
  expect_true(v$desfasado)
})

test_that("filas con corridas mezcladas no deciden nada", {
  # Una seleccion con dos corridas dentro no dice cual es la vigente; inventarla
  # produciria un desfase falso o lo taparia.
  filas <- data.frame(selection_run_id = c("sel_aulas_B", "sel_aulas_C"), stringsAsFactors = FALSE)
  v <- monitoreo_aulas_origen_vigente(.origen_sesion("sel_aulas_A", "", filas))
  expect_identical(v$selection_run_id, "")
  expect_false(v$desfasado)
})
