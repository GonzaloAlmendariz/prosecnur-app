# Certeza de cobertura: cuántas aulas para que la cuota se alcance con la
# probabilidad exigida, medida simulando el sorteo real.
#
# Los marcos de acá son deterministas a propósito: con aulas del mismo tamaño y
# padrones disjuntos, CUALQUIER combinación de n aulas rinde exactamente lo
# mismo, así que el mínimo correcto se puede escribir a mano y el test no
# depende de la semilla. Los casos con traslape rompen esa simetría justo donde
# la fórmula por promedio se equivoca.

certeza_base_disjunta <- function(n_aulas = 12L, por_aula = 20L, facultad = "FAC1") {
  aulas <- sprintf("A%02d", seq_len(n_aulas))
  filas <- lapply(seq_along(aulas), function(i) {
    inicio <- (i - 1L) * por_aula + 1L
    data.frame(
      student_id = paste0("d", seq(inicio, inicio + por_aula - 1L)),
      aula_id = aulas[[i]],
      curso_id = paste0("C", i),
      curso = paste("Curso", aulas[[i]]),
      horario = "L 8",
      facultad = facultad,
      programa = "P1",
      sexo = "F",
      edad = 20,
      condicion = "regular",
      nivel = "pregrado",
      modalidad = "presencial",
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, filas)
}

# Mismo tamaño por aula, pero todas comparten el mismo pozo de estudiantes: dos
# aulas de 20 ya no dan 40 personas distintas. Es el traslape que el divisor
# `cuota / (tamaño × τ)` no puede ver.
certeza_base_traslapada <- function(n_aulas = 12L, por_aula = 20L, pozo = 60L,
                                    facultad = "FAC1") {
  aulas <- sprintf("A%02d", seq_len(n_aulas))
  filas <- lapply(seq_along(aulas), function(i) {
    inicio <- ((i - 1L) * 5L) %% (pozo - por_aula + 1L) + 1L
    data.frame(
      student_id = paste0("p", seq(inicio, inicio + por_aula - 1L)),
      aula_id = aulas[[i]],
      curso_id = paste0("C", i),
      curso = paste("Curso", aulas[[i]]),
      horario = "L 8",
      facultad = facultad,
      programa = "P1",
      sexo = "F",
      edad = 20,
      condicion = "regular",
      nivel = "pregrado",
      modalidad = "presencial",
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, filas)
}

certeza_cfg <- function(engine = "sistematico_pps", seed = 4242L) {
  calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(
      seed = seed,
      n_aulas = 4L,
      replacement_waves = 0L,
      selector_engine = engine,
      strata_cols = list("faculty"),
      monte_carlo_n = 0L,
      simulation_runs = 0L
    )
  ))
}

certeza_estrato <- function(cuota, tau = 1, aulas_formula = 1L, label = "FAC1") {
  list(list(label = label, cuota = cuota, tau = tau, aulas_formula = aulas_formula))
}

certeza_fila <- function(resultado) resultado$filas[[1L]]

test_that("con aulas iguales y disjuntas el minimo es exactamente la division entera hacia arriba", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)

  # 12 aulas x 20 alumnos disjuntos, tau = 1, cuota 100 -> 5 aulas exactas.
  res <- calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 100, aulas_formula = 2L),
    corridas = 40L
  )
  fila <- certeza_fila(res)

  expect_equal(fila$aulas_certeza, 5L)
  expect_equal(fila$probabilidad_certeza, 1)
  expect_true(fila$alcanzable)
  expect_false(fila$agotado)
  expect_equal(fila$disponibles, 12L)
  expect_equal(fila$base_conteo, "estudiantes_unicos")
})

test_that("la brecha se mide contra la formula declarada, en los dos sentidos", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)

  corta <- certeza_fila(calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 100, aulas_formula = 3L), corridas = 40L
  ))
  expect_equal(corta$aulas_formula, 3L)
  expect_equal(corta$brecha, 2L)
  expect_lt(corta$probabilidad_formula, 0.95)

  # La fórmula pide de más: la búsqueda baja hasta el verdadero mínimo y la
  # brecha sale negativa. Sin este caso el motor solo sabría pedir más aulas.
  sobra <- certeza_fila(calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 100, aulas_formula = 9L), corridas = 40L
  ))
  expect_equal(sobra$aulas_certeza, 5L)
  expect_equal(sobra$brecha, -4L)
  expect_equal(sobra$probabilidad_formula, 1)
})

test_that("la curva es monotona y cada punto trae su rendimiento", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)
  fila <- certeza_fila(calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 100, aulas_formula = 2L), corridas = 40L
  ))

  aulas <- vapply(fila$curva, function(p) p$aulas, integer(1))
  probs <- vapply(fila$curva, function(p) p$probabilidad, numeric(1))
  expect_identical(aulas, sort(aulas))
  expect_true(all(diff(probs) >= 0))
  expect_true(all(vapply(fila$curva, function(p) is.finite(p$rendimiento_medio), logical(1))))
  expect_true(all(vapply(fila$curva, function(p) is.finite(p$rendimiento_p05), logical(1))))
})

test_that("tau mas bajo exige mas aulas para la misma cuota", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)

  pleno <- certeza_fila(calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 100, tau = 1, aulas_formula = 2L), corridas = 40L
  ))
  # tau = 0.5: cada aula rinde 10, no 20 -> hacen falta 10 aulas.
  mitad <- certeza_fila(calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 100, tau = 0.5, aulas_formula = 2L), corridas = 40L
  ))

  expect_equal(pleno$aulas_certeza, 5L)
  expect_equal(mitad$aulas_certeza, 10L)
  expect_equal(mitad$tau, 0.5)
})

test_that("el traslape entre aulas pide mas aulas que la cuenta por tamano promedio", {
  cfg <- certeza_cfg()
  disjunto <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)
  traslapado <- calc_muestra_aulas_construir(base_madre = certeza_base_traslapada(), config = cfg)

  # La división por tamaño promedio da lo mismo en los dos marcos: aulas de 20
  # y cuota de 60 -> 3 aulas. Solo el conteo de únicos netos distingue.
  base_disjunta <- certeza_fila(calc_muestra_aulas_certeza(
    disjunto, cfg, certeza_estrato(cuota = 60, aulas_formula = 3L), corridas = 60L
  ))
  base_traslapada <- certeza_fila(calc_muestra_aulas_certeza(
    traslapado, cfg, certeza_estrato(cuota = 60, aulas_formula = 3L), corridas = 60L
  ))

  expect_equal(base_disjunta$aulas_certeza, 3L)
  expect_gt(base_traslapada$aulas_certeza, base_disjunta$aulas_certeza)
})

test_that("una cuota que el marco no puede dar se declara agotada, no se inventa un minimo", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)

  # 12 aulas x 20 = 240 alumnos en todo el estrato; la cuota pide 400.
  fila <- certeza_fila(calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 400, aulas_formula = 12L), corridas = 20L
  ))

  expect_false(fila$alcanzable)
  expect_true(fila$agotado)
  expect_identical(fila$motivo, "marco_agotado")
  expect_true(is.na(fila$aulas_certeza))
  expect_true(is.na(fila$brecha))
})

test_that("un estrato sin aulas en el marco se reporta, no rompe la corrida", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)

  res <- calc_muestra_aulas_certeza(
    frame, cfg,
    c(
      certeza_estrato(cuota = 100, aulas_formula = 5L, label = "FAC1"),
      certeza_estrato(cuota = 30, aulas_formula = 2L, label = "FACULTAD FANTASMA")
    ),
    corridas = 20L
  )

  expect_length(res$filas, 2L)
  fantasma <- res$filas[[2L]]
  expect_identical(fantasma$motivo, "sin_aulas_en_marco")
  expect_equal(fantasma$disponibles, 0L)
  expect_false(fantasma$alcanzable)
})

test_that("el total agrega la brecha y cuenta los estratos cortos", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)

  res <- calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 100, aulas_formula = 3L), corridas = 40L
  )

  expect_identical(res$schema, CALC_MUESTRA_AULAS_CERTEZA_SCHEMA)
  expect_equal(res$nivel, 0.95)
  expect_equal(res$total$aulas_formula, 3L)
  expect_equal(res$total$aulas_certeza, 5L)
  expect_equal(res$total$brecha, 2L)
  expect_equal(res$total$estratos_cortos, 1L)
  expect_equal(res$total$estratos_agotados, 0L)
})

test_that("el nivel exigido es un parametro, no una constante escondida", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_traslapada(), config = cfg)

  exigente <- calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 60, aulas_formula = 3L), nivel = 0.99, corridas = 60L
  )
  laxo <- calc_muestra_aulas_certeza(
    frame, cfg, certeza_estrato(cuota = 60, aulas_formula = 3L), nivel = 0.5, corridas = 60L
  )

  expect_equal(exigente$nivel, 0.99)
  expect_equal(laxo$nivel, 0.5)
  expect_gte(certeza_fila(exigente)$aulas_certeza, certeza_fila(laxo)$aulas_certeza)
})

test_that("sin estratos con cuota el motor falla con codigo de API, no en silencio", {
  cfg <- certeza_cfg()
  frame <- calc_muestra_aulas_construir(base_madre = certeza_base_disjunta(), config = cfg)

  expect_error(
    calc_muestra_aulas_certeza(frame, cfg, list()),
    class = "api_error"
  )
})
