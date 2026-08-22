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

# --- Rehacer el plan desde el sorteo vigente ---------------------------------
#
# `collection_state_seed` siembra una vez y no hace nada si el plan ya existe, y
# no habia camino de vuelta: por eso HSVG2026 tenia un plan de hace veinte dias
# conviviendo con otra seleccion. Rehacerlo NO es gratis —descarta despliegue y
# handoff— y por eso la funcion devuelve que se pierde, para poder avisarlo antes.

test_that("rehacer exige una seleccion vigente de la que partir", {
  # La revision se toma del propio estado: pasar una a mano hace saltar antes el
  # control de concurrencia y el test acabaria probando OTRA barrera.
  sid <- session_create()
  rev <- collection_state_get(sid)$state_revision
  expect_error(collection_state_reseed(sid, rev), "seleccion|E_COLLECTION_SIN_ORIGEN")
})

test_that("el endpoint /reseed esta montado y exige revision", {
  # El contrato del modulo: toda escritura pasa por expected_revision. Sin esto,
  # rehacer el plan pisaria una escritura concurrente sin enterarse.
  fuente <- readLines("../../R/router_recopiladores.R", warn = FALSE)
  expect_true(any(grepl("/api/recopiladores/reseed", fuente, fixed = TRUE)))
  bloque <- paste(fuente, collapse = "\n")
  expect_true(grepl("collection_state_reseed\\(session_header\\(req\\), body\\$expected_revision\\)", bloque))
})

test_that("el error de origen ausente esta registrado", {
  # Un E_* que no esta en el registro llega al cliente sin contrato.
  registro <- paste(readLines("../../R/errors_registry.R", warn = FALSE), collapse = "\n")
  expect_true(grepl("E_COLLECTION_SIN_ORIGEN", registro, fixed = TRUE))
})

# --- El veredicto viaja en TODAS las respuestas ------------------------------
#
# `source_vigente` se calculaba solo en `collection_state_get`, asi que las otras
# quince salidas del modulo —seed, plan, deployment, prepare, reconcile,
# handoff— salian sin el y el aviso de plan desfasado desaparecia en cuanto el
# front hacia cualquier cosa. Se anadio el dato donde se miro, no en todas las
# salidas: el mismo defecto que este loop lleva corrigiendo todo el dia.

test_that("ninguna salida publica devuelve el payload sin pasar por la vigencia", {
  lineas <- readLines("../../R/collection_engine.R", warn = FALSE)
  publicas <- c("collection_state_seed", "collection_plan_put", "collection_deployment_put",
                "collection_deployment_prepare", "collection_reconcile", "collection_handoff")
  for (fn in publicas) {
    ini <- which(startsWith(lineas, paste0(fn, " <- function")))
    expect_length(ini, 1L)
    cierres <- which(lineas == "}")
    fin <- min(cierres[cierres > ini])
    cuerpo <- lineas[ini:fin]
    # Cada `.collection_payload(` del cuerpo tiene que ir envuelto en el helper.
    sueltos <- sum(grepl(".collection_payload(", cuerpo, fixed = TRUE)) -
      sum(grepl(".collection_con_vigencia(.collection_payload(", cuerpo, fixed = TRUE))
    expect_equal(sueltos, 0, info = paste(fn, "tiene salidas sin vigencia"))
  }
})

test_that("el helper de vigencia no rompe un payload sin seleccion", {
  # En R, asignar NULL a un elemento de lista lo ELIMINA, asi que la clave no
  # queda presente-y-vacia: desaparece. Da igual para el cliente —ausente y null
  # se leen igual en JS— pero el test tiene que afirmarlo como es.
  sid <- session_create()
  p <- prosecnurapp:::.collection_con_vigencia(list(state = list(), ok = TRUE), sid)
  expect_null(p$source_vigente)
  expect_true(p$ok)
})
