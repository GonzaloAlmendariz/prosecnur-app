# La efectividad al grano de FACULTAD x SEXO: la τ general promedia dos
# poblaciones que el operativo no trata igual, porque la cuota se fija por
# facultad Y sexo y la brecha se suma celda a celda.

plan_fixture <- function() {
  data.frame(
    classroom_id = c("CH 1", "CH 2", "CH 3"),
    operational_code = c("CH 1", "CH 2", "CH 3"),
    collection_unit_id = c("U1", "U2", "U3"),
    faculty = c("DERECHO", "DERECHO", "PSICOLOGÍA"),
    application_state = c("cerrando", "cerrando", "pendiente"),
    expected_valid = c(20, 30, 40),
    eligible_n = c(40, 60, 80),
    # CH 1: 30 mujeres y 10 hombres. CH 2: 20 hombres y 40 mujeres — con el
    # sexo MÁS FRECUENTE primero, que es como viaja del marco.
    sex_top_1 = c("Mujer", "Mujer", "Mujer"),
    sex_top_1_n = c(30, 40, 50),
    sex_top_2 = c("Hombre", "Hombre", "Hombre"),
    sex_top_2_n = c(10, 20, 30),
    stringsAsFactors = FALSE
  )
}

respuestas_fixture <- function() {
  data.frame(
    aula = c(rep("CH 1", 15), rep("CH 2", 20), rep("CH 3", 5)),
    sexo = c(rep("Mujer", 12), rep("Hombre", 3),
             rep("Mujer", 11), rep("Hombre", 9),
             rep("Mujer", 5)),
    stringsAsFactors = FALSE
  )
}

corre <- function(plan = plan_fixture(), resp = respuestas_fixture(), validas = NULL) {
  monitoreo_aulas_efectividad_por_sexo(
    plan, resp,
    cfg = list(source_mapping = list(sex_var = "sexo")),
    valid_response = validas %||% rep(TRUE, nrow(resp)),
    response_classroom = resp$aula
  )
}

celda <- function(out, fac, sexo) {
  Filter(function(x) grepl(fac, x$facultad, fixed = TRUE) && x$sexo == sexo, out)[[1]]
}

test_that("reparte los elegibles por la composicion del padron del aula", {
  out <- corre()
  # DERECHO aplicó CH 1 (30F/10M) y CH 2 (40F/20M).
  expect_equal(celda(out, "DERECHO", "F")$elegibles, 70L)
  expect_equal(celda(out, "DERECHO", "M")$elegibles, 30L)
})

test_that("las aulas NO aplicadas quedan fuera de las dos cuentas", {
  out <- corre()
  # PSICOLOGÍA sólo tiene CH 3, que está pendiente.
  expect_equal(length(Filter(function(x) grepl("PSICOL", x$facultad), out)), 0L)
})

test_that("las efectivas se cuentan por sexo y sólo de aulas aplicadas", {
  out <- corre()
  # CH 1: 12F + 3M. CH 2: 11F + 9M. CH 3 no cuenta: no está aplicada.
  expect_equal(celda(out, "DERECHO", "F")$efectivas, 23L)
  expect_equal(celda(out, "DERECHO", "M")$efectivas, 12L)
})

test_that("la diferencia va en PERSONAS y con signo", {
  out <- corre()
  f <- celda(out, "DERECHO", "F")
  m <- celda(out, "DERECHO", "M")
  # Esperadas: CH1 reparte 20 en 30/10 → 15F/5M; CH2 reparte 30 en 40/20 → 20F/10M.
  expect_equal(f$esperadas, 35)
  expect_equal(m$esperadas, 15)
  expect_equal(f$diferencia, 23 - 35)
  expect_equal(m$diferencia, 12 - 15)
})

test_that("publica las DOS tasas sobre el mismo denominador", {
  out <- corre()
  f <- celda(out, "DERECHO", "F")
  expect_equal(f$tasa_prevista, round(35 / 70, 4))
  expect_equal(f$tasa_observada, round(23 / 70, 4))
})

test_that("una respuesta que no cuenta no entra en su celda", {
  validas <- rep(TRUE, 40)
  validas[1:5] <- FALSE  # cinco mujeres de CH 1
  out <- corre(validas = validas)
  expect_equal(celda(out, "DERECHO", "F")$efectivas, 18L)
})

test_that("`sex_top_1` es el sexo MAS FRECUENTE, no mujeres", {
  # La trampa medida en este repo: si el aula tiene más hombres, `sex_top_1` es
  # «Hombre», y leerlo como mujeres invierte la celda entera.
  plan <- plan_fixture()
  plan$sex_top_1 <- c("Hombre", "Mujer", "Mujer")
  plan$sex_top_1_n <- c(30, 40, 50)
  plan$sex_top_2 <- c("Mujer", "Hombre", "Hombre")
  plan$sex_top_2_n <- c(10, 20, 30)
  out <- corre(plan = plan)
  # Ahora CH 1 aporta 30 hombres y 10 mujeres.
  expect_equal(celda(out, "DERECHO", "M")$elegibles, 50L)
  expect_equal(celda(out, "DERECHO", "F")$elegibles, 50L)
})

test_that("sin plan o sin aulas aplicadas devuelve vacio, no celdas en cero", {
  expect_equal(monitoreo_aulas_efectividad_por_sexo(data.frame()), list())
  plan <- plan_fixture()
  plan$application_state <- rep("pendiente", 3)
  expect_equal(corre(plan = plan), list())
})

# --- la trampa que costó un bloque vacío en el payload ------------------------

test_that("un plan SIN `application_state` no se lee como si nada estuviera aplicado", {
  # **El fallo real, y por qué el resto de tests no lo vio.** `plan_df` NO tiene
  # `application_state`: esa columna la deriva `.monitoreo_aulas_course_status()`
  # sobre su propia copia. Los fixtures de arriba la traen, o sea que tienen la
  # forma de `course_status` y no la del plan, así que pasaban en verde mientras
  # el payload publicaba una lista vacía sin que nada fallara.
  plan <- plan_fixture()
  plan$application_state <- NULL
  resp <- respuestas_fixture()

  # Sin decir cuáles están aplicadas no puede inventárselo: devuelve vacío.
  expect_equal(
    monitoreo_aulas_efectividad_por_sexo(
      plan, resp, cfg = list(source_mapping = list(sex_var = "sexo")),
      valid_response = rep(TRUE, nrow(resp)), response_classroom = resp$aula
    ),
    list()
  )

  # Con el vector explícito —que es como lo llama el motor— sí calcula.
  out <- monitoreo_aulas_efectividad_por_sexo(
    plan, resp, cfg = list(source_mapping = list(sex_var = "sexo")),
    valid_response = rep(TRUE, nrow(resp)), response_classroom = resp$aula,
    aplicada = c(TRUE, TRUE, FALSE)
  )
  expect_equal(celda(out, "DERECHO", "F")$efectivas, 23L)
})

test_that("un vector `aplicada` de otro largo no se recicla en silencio", {
  # Reciclar mandaría respuestas a la celda equivocada, que es peor que no
  # calcular: el número saldría y sería falso.
  resp <- respuestas_fixture()
  expect_equal(
    monitoreo_aulas_efectividad_por_sexo(
      plan_fixture(), resp, cfg = list(source_mapping = list(sex_var = "sexo")),
      valid_response = rep(TRUE, nrow(resp)), response_classroom = resp$aula,
      aplicada = c(TRUE)
    ),
    list()
  )
})
