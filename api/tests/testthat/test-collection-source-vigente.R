# El plan congelado contra el sorteo vigente.
#
# El plan de recolección se siembra UNA vez y re-sortear no lo regenera, así que
# un proyecto puede tener materiales de una corrida y una selección de otra.
# Medido en HSVG2026 el 2026-08-22: plan del 1 de agosto con 2.468 unidades y
# códigos «AULA n», selección del 21 con 2.616 filas y códigos «CH n». La
# pantalla sólo mostraba `source_ref$module` —«calc-muestra»— que nunca cambia,
# así que nada delataba los veinte días de diferencia.

test_that("declara el desfase cuando el plan viene de otra corrida", {
  s <- list(calc_muestra_aulas_selection = list(
    selection = data.frame(selection_run_id = rep("sel_aulas_20260821160928_bf10d14c", 3),
                           stringsAsFactors = FALSE)))
  estado <- list(plan = list(source_ref = list(run_id = "sel_aulas_20260801211224_e32c240d")))
  v <- prosecnurapp:::.collection_source_vigente(s, estado)
  expect_true(v$desfasado)
  expect_equal(v$plan_run_id, "sel_aulas_20260801211224_e32c240d")
  expect_equal(v$selection_run_id, "sel_aulas_20260821160928_bf10d14c")
})

test_that("no declara desfase cuando el plan es de la corrida vigente", {
  run <- "sel_aulas_20260821160928_bf10d14c"
  s <- list(calc_muestra_aulas_selection = list(
    selection = data.frame(selection_run_id = run, stringsAsFactors = FALSE)))
  v <- prosecnurapp:::.collection_source_vigente(s, list(plan = list(source_ref = list(run_id = run))))
  expect_false(v$desfasado)
})

test_that("sin seleccion vigente no inventa un veredicto", {
  # Un proyecto que aun no ha sorteado tiene plan sembrado desde otro sitio; ahi
  # no hay con que comparar y decir «desfasado» seria una alarma falsa.
  v <- prosecnurapp:::.collection_source_vigente(
    list(), list(plan = list(source_ref = list(run_id = "sel_aulas_20260801211224_x"))))
  expect_false(v$desfasado)
  expect_equal(v$selection_run_id, "")
})

test_that("sin plan ni seleccion devuelve NULL en vez de un objeto vacio", {
  expect_null(prosecnurapp:::.collection_source_vigente(list(), list()))
})

test_that("el payload de estado lleva el veredicto", {
  estado <- list(schema = "x", state_revision = 1L, plan = list(source_ref = list(run_id = "a")))
  p <- prosecnurapp:::.collection_payload(estado, source_vigente = list(desfasado = TRUE))
  expect_true(p$source_vigente$desfasado)
})
