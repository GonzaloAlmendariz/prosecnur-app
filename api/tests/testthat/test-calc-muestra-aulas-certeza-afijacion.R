# La afijación por facultad no puede contestar la pregunta de la certeza.
#
# `.cm_certeza_evaluar` mide un candidato fijando `sim_selector$n_aulas <- n`,
# pero `.cm_aulas_quota_estratos` da PRECEDENCIA a `selector$faculty_targets`
# sobre `n_aulas`. Con targets en la config, cada evaluación sorteaba el número
# del target y no el candidato: la curva de rendimiento salía plana y la
# búsqueda —que baja mientras la probabilidad siga alcanzando— certificaba en
# 1 aula. Medido el 2026-08-27 sobre el marco HSVG2026 de 1.447 aulas: 11 de
# 15 facultades certificaron en exactamente 1 y el total dio 64 contra 165.
#
# No se veía porque en el flujo natural se certifica ANTES de sortear, cuando
# la config todavía no tiene targets. Muerde al RE-certificar sobre un proyecto
# ya sorteado, donde la config de sesión arrastra los targets del sorteo
# anterior.
#
# El fixture es determinista a propósito: aulas del mismo tamaño con padrones
# disjuntos, así que CUALQUIER combinación de n aulas rinde exactamente 20n y
# el mínimo se escribe a mano sin depender de la semilla. Los targets rompen el
# empate en los DOS sentidos —uno que sobra (12) y uno que ahoga (2)— porque
# cada uno produce un síntoma distinto: el primero certificaba en 1, el segundo
# declaraba el marco agotado.

.cza_afij_base <- function(n_aulas = 12L, por_aula = 20L) {
  facultades <- list(list(fac = "FAC1", pref = "a"), list(fac = "FAC2", pref = "b"))
  do.call(rbind, lapply(facultades, function(f) {
    do.call(rbind, lapply(seq_len(n_aulas), function(i) {
      inicio <- (i - 1L) * por_aula + 1L
      data.frame(
        student_id = paste0(f$pref, seq(inicio, inicio + por_aula - 1L)),
        aula_id = sprintf("%s-A%02d", f$fac, i),
        curso_id = sprintf("%s-C%d", f$fac, i),
        curso = sprintf("Curso %s %d", f$fac, i),
        horario = "L 8",
        facultad = f$fac,
        programa = "P1",
        sexo = "F",
        edad = 20,
        condicion = "regular",
        nivel = "pregrado",
        modalidad = "presencial",
        stringsAsFactors = FALSE
      )
    }))
  }))
}

.cza_afij_cfg <- function(targets = NULL) {
  selector <- list(
    seed = 4242L,
    n_aulas = 4L,
    replacement_waves = 0L,
    selector_engine = "sistematico_pps",
    strata_cols = list("faculty"),
    monte_carlo_n = 0L,
    simulation_runs = 0L
  )
  if (!is.null(targets)) selector$faculty_targets <- targets
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = selector
  ))
}

# FAC1: 12 aulas x 20 alumnos disjuntos, tau = 1, cuota 100 -> 5 aulas exactas.
.cza_afij_estratos <- function() {
  list(list(label = "FAC1", cuota = 100, tau = 1, aulas_formula = 2L))
}

.cza_afij_fila <- function(cfg, frame) {
  calc_muestra_aulas_certeza(frame, cfg, .cza_afij_estratos(), corridas = 40L)$filas[[1L]]
}

test_that("la certeza da el mismo minimo con y sin faculty_targets en la config", {
  frame <- calc_muestra_aulas_construir(base_madre = .cza_afij_base(), config = .cza_afij_cfg())

  limpia <- .cza_afij_fila(.cza_afij_cfg(), frame)
  # Un target que SOBRA: sorteaba 12 aulas para cada candidato, el rendimiento
  # salia plano en 240 y la busqueda bajaba hasta 1.
  sobra <- .cza_afij_fila(.cza_afij_cfg(list(FAC1 = 12L, FAC2 = 3L)), frame)
  # Un target que AHOGA: sorteaba 2 aulas siempre, nunca llegaba a la cuota y
  # el estrato se declaraba agotado con 12 aulas disponibles que si alcanzan.
  ahoga <- .cza_afij_fila(.cza_afij_cfg(list(FAC1 = 2L)), frame)

  expect_equal(limpia$aulas_certeza, 5L)
  expect_equal(sobra$aulas_certeza, limpia$aulas_certeza)
  expect_equal(ahoga$aulas_certeza, limpia$aulas_certeza)
  expect_true(sobra$alcanzable)
  expect_true(ahoga$alcanzable)
  expect_false(ahoga$agotado)
})

test_that("con targets en la config la curva sigue escalando con el n pedido", {
  # Sin esto, un arreglo que corrigiera el numero publicado sin corregir la
  # simulacion pasaria: lo que estaba roto es la curva, no el minimo.
  frame <- calc_muestra_aulas_construir(base_madre = .cza_afij_base(), config = .cza_afij_cfg())
  fila <- .cza_afij_fila(.cza_afij_cfg(list(FAC1 = 12L, FAC2 = 3L)), frame)

  rendimientos <- vapply(fila$curva, function(p) p$rendimiento_medio, numeric(1))
  efectivas <- vapply(fila$curva, function(p) p$aulas_efectivas, numeric(1))
  pedidas <- vapply(fila$curva, function(p) as.numeric(p$aulas), numeric(1))

  expect_gt(length(unique(rendimientos)), 1L)
  # Padrones disjuntos de 20 y tau = 1: cada aula pedida rinde exactamente 20.
  expect_equal(rendimientos, pedidas * 20)
  expect_equal(efectivas, pedidas)
})

test_that("el saneo quita la afijacion por sus dos nombres y no toca el resto", {
  limpio <- .cm_certeza_selector_sin_afijacion(list(
    n_aulas = 7L,
    seed = 11L,
    faculty_targets = list(fac1 = 3L),
    afijacion_facultades = list(fac2 = 4L),
    strata_cols = list("faculty")
  ))

  expect_null(limpio$faculty_targets)
  expect_null(limpio$afijacion_facultades)
  expect_identical(limpio$n_aulas, 7L)
  expect_identical(limpio$seed, 11L)
  expect_identical(limpio$strata_cols, list("faculty"))
})

test_that("el detector marca la curva que no responde al n y solo esa", {
  plana <- list(
    list(aulas = 2L, aulas_efectivas = 12),
    list(aulas = 3L, aulas_efectivas = 12),
    list(aulas = 4L, aulas_efectivas = 12)
  )
  escala <- list(
    list(aulas = 2L, aulas_efectivas = 2),
    list(aulas = 3L, aulas_efectivas = 3)
  )
  # Deficit constante por descuento secuencial o docente unico: las efectivas
  # van por debajo de las pedidas pero SE MUEVEN. No es el defecto.
  con_deficit <- list(
    list(aulas = 3L, aulas_efectivas = 2),
    list(aulas = 4L, aulas_efectivas = 3)
  )

  expect_true(.cm_certeza_sorteo_insensible(plana))
  expect_false(.cm_certeza_sorteo_insensible(escala))
  expect_false(.cm_certeza_sorteo_insensible(con_deficit))
  expect_false(.cm_certeza_sorteo_insensible(plana[1L]))
  expect_false(.cm_certeza_sorteo_insensible(list()))
})

test_that("sin el saneo el motor avisa en vez de publicar un minimo mudo", {
  # Verifica las dos cosas a la vez: que el saneo es LO QUE repara (mockeado a
  # la identidad vuelve el sintoma) y que el aviso sale del motor de verdad,
  # con las cifras que dejan ubicar el problema.
  frame <- calc_muestra_aulas_construir(base_madre = .cza_afij_base(), config = .cza_afij_cfg())
  cfg <- .cza_afij_cfg(list(FAC1 = 12L, FAC2 = 3L))

  testthat::local_mocked_bindings(
    .cm_certeza_selector_sin_afijacion = function(selector) selector
  )

  expect_warning(
    fila <- .cza_afij_fila(cfg, frame),
    "se probaron 1 a 2 aulas y el sorteo devolvio 12"
  )
  expect_equal(fila$aulas_certeza, 1L)
})
