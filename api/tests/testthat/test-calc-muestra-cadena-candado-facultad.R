# El candado de la cadena de reemplazos: celda, facultad o libre.
#
# Hasta 2026-08-16 habia dos: `max_complete_chains_by_cell` exigia la CELDA
# entera —facultad x sexo x tamano— desde la segunda reserva, y cualquier otra
# estrategia dejaba el pool LIBRE tras agotarla. Ninguno de los dos es el del
# operativo que se quiere replicar.
#
# Medido sobre las 170 cadenas de 2025: NINGUNA mezcla facultades y 148 mezclan
# tamanos. El reemplazo tenia que ser de la misma facultad y punto; el tamano
# podia variar, y en el 87% de los casos vario.
#
# Con el candado de celda, 44 de 84 celdas no pueden sostener una cadena de 11
# —no hay tantas aulas dentro de una celda tan fina—. Con el de facultad el pool
# pasa a ser la facultad entera, asi que la cadena llega hasta donde el cupo
# alcance en vez de cortarse por el ancho de la celda.

# Un titular de la celda A1 (Derecho, chica) con tres tipos de candidato:
#   idx 1  misma celda      -> lo toma cualquier candado
#   idx 2  misma facultad   -> lo toma "facultad" y "libre", no "celda"
#   idx 3  otra facultad    -> solo lo toma "libre"
.cad_ctx <- function() list(
  tit = list(stratum = "A1", faculty = "DERECHO"),
  cand = list(
    n = 3L,
    stratum = c("A1", "A2", "B1"),
    faculty = c("DERECHO", "DERECHO", "PSICOLOGIA")
  )
)

.cad_elegir <- function(candado, disponibles = c(TRUE, TRUE, TRUE), puntajes = c(1, 5, 9)) {
  ctx <- .cad_ctx()
  .cm_aulas_pick_chain_reserve_idx(
    i = 1L,
    tit_ctx = ctx$tit,
    cand_ctx = ctx$cand,
    avail_mask = disponibles,
    score_vec = puntajes,
    has_stratum = TRUE,
    has_faculty = TRUE,
    candado = candado
  )
}

test_that("con la celda disponible los tres candados eligen lo mismo", {
  # El candado solo decide que pasa cuando la celda se AGOTA; mientras haya algo
  # dentro, no hay diferencia entre estrategias.
  for (candado in c("celda", "facultad", "libre")) {
    expect_identical(.cad_elegir(candado), 1L)
  }
})

test_that("agotada la celda, el candado de facultad se queda en la facultad", {
  # EL caso. Sin la celda, «facultad» toma el aula de otro tamano de la misma
  # facultad —idx 2— aunque la de otra facultad puntue mas alto (9 contra 5).
  sin_celda <- c(FALSE, TRUE, TRUE)
  expect_identical(.cad_elegir("facultad", sin_celda), 2L)

  # «libre» tambien la prefiere: el pool de facultad se agota antes de abrirse.
  expect_identical(.cad_elegir("libre", sin_celda), 2L)

  # Desde 2026-08-21 «celda» tampoco corta: agotada la celda sigue por la
  # facultad. Gonzalo: «las aulas no pueden quedarse sin reemplazos sólo porque
  # no hay reemplazos que tienen el mismo estrato».
  expect_identical(.cad_elegir("celda", sin_celda), 2L)
})

test_that("agotada la facultad NINGUN candado cruza a otra", {
  # Antes «libre» sí cruzaba, y con `min_replacements_per_titular = 1` esa era
  # la rama por la que salía la PRIMERA reserva de cada titular. Gonzalo,
  # 2026-08-21: «esos reemplazos sí o sí tienen que ser de la misma facultad,
  # ojo». La cuota se reparte por facultad: un aula de otra repone una cuota
  # que no es la que se perdió.
  solo_otra_facultad <- c(FALSE, FALSE, TRUE)
  expect_true(is.na(.cad_elegir("libre", solo_otra_facultad)))
  expect_true(is.na(.cad_elegir("facultad", solo_otra_facultad)))
  expect_true(is.na(.cad_elegir("celda", solo_otra_facultad)))
})

test_that("sin nada disponible ningun candado inventa una reserva", {
  nada <- c(FALSE, FALSE, FALSE)
  for (candado in c("celda", "facultad", "libre")) {
    expect_true(is.na(.cad_elegir(candado, nada)))
  }
})

# --- Que candado rige en cada ola -------------------------------------------

test_that("la primera reserva nunca esta acandalada", {
  # Con `min_replacements_per_titular = 1`, la reserva 1 sale libre pase lo que
  # pase: asi un titular de celda chica no se queda en cero.
  for (est in c("max_complete_chains_by_cell", "max_complete_chains_by_faculty", "")) {
    expect_identical(.cm_aulas_candado_de_cadena(est, depth = 1L, min_reps = 1L), "libre")
  }
})

test_that("pasada la primera, cada estrategia impone SU candado", {
  expect_identical(
    .cm_aulas_candado_de_cadena("max_complete_chains_by_faculty", depth = 2L, min_reps = 1L),
    "facultad"
  )
  expect_identical(
    .cm_aulas_candado_de_cadena("max_complete_chains_by_cell", depth = 2L, min_reps = 1L),
    "celda"
  )
  # Lo que no declara estrategia sigue con el pool libre, como antes.
  expect_identical(.cm_aulas_candado_de_cadena("", depth = 2L, min_reps = 1L), "libre")
  expect_identical(
    .cm_aulas_candado_de_cadena("estrategia_inventada", depth = 5L, min_reps = 1L),
    "libre"
  )
})

test_that("min_reps corre la frontera del candado", {
  # Con tres reservas minimas, las tres primeras salen libres.
  est <- "max_complete_chains_by_faculty"
  expect_identical(.cm_aulas_candado_de_cadena(est, depth = 3L, min_reps = 3L), "libre")
  expect_identical(.cm_aulas_candado_de_cadena(est, depth = 4L, min_reps = 3L), "facultad")
})

# --- Por la ruta que arma las cadenas ---------------------------------------

.cad_frame <- function() data.frame(
  classroom_id = paste0("CH-", 1:8),
  stratum = c("A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"),
  faculty = c(rep("DERECHO", 4), rep("PSICOLOGIA", 4)),
  eligible_n = c(40, 38, 36, 34, 32, 30, 28, 26),
  stringsAsFactors = FALSE
)

.cad_titulars <- function(frame) {
  tit <- frame[1, , drop = FALSE]
  tit$selection_slot_id <- "slot-1"
  tit
}

.cad_cadena <- function(estrategia, olas = 3L) {
  frame <- .cad_frame()
  selector <- list(
    replacement_waves = olas,
    max_replacements_per_titular = olas,
    min_replacements_per_titular = 1L,
    replacement_depth_strategy = estrategia,
    replacement_score_weights = list()
  )
  .cm_aulas_build_replacement_chains(frame, .cad_titulars(frame), selector, seed = 42L)
}

test_that("la celda ya no corta la cadena: se completa dentro de la facultad", {
  # El titular es de A1 (Derecho) y su celda tiene UNA sola aula: la suya. Antes,
  # el candado de celda dejaba la cadena en 1 y sólo el de facultad tomaba las
  # otras tres aulas de Derecho. Ahora las dos estrategias las toman: el estrato
  # es preferencia, no condición de existencia.
  por_celda <- .cad_cadena("max_complete_chains_by_cell")
  por_facultad <- .cad_cadena("max_complete_chains_by_faculty")

  expect_gt(nrow(por_celda), 1L)
  expect_identical(nrow(por_celda), nrow(por_facultad))

  # Y ninguna reserva sale de Derecho pese a quedar cuatro aulas de Psicologia
  # disponibles: la facultad es un límite duro, no una preferencia.
  expect_true(all(por_facultad$faculty == "DERECHO"))
  expect_true(all(por_celda$faculty == "DERECHO"))
})

test_that("sin estrategia declarada la cadena TAMPOCO cruza de facultad", {
  # Era el control del comportamiento viejo: el pool libre agotaba Derecho y
  # seguía en Psicologia. Ese era el agujero, no una funcionalidad.
  libre <- .cad_cadena("", olas = 6L)
  # Se detiene en las TRES aulas de Derecho disponibles. Antes pasaba de tres
  # justamente porque seguía en Psicologia: el número es la evidencia.
  expect_identical(nrow(libre), 3L)
  expect_false(any(libre$faculty == "PSICOLOGIA"))
  expect_true(all(libre$faculty == "DERECHO"))
})
