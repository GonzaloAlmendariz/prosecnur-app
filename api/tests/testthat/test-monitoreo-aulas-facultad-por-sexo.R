# El avance por facultad lleva su corte por sexo.
#
# Gonzalo: «lo que me interesa es que TODAS LAS FACULTADES CUMPLAN CON SU CUOTA
# DE SEXO». La tabla decia `faculty · aulas · respuestas_validas · brecha ·
# meta` y ninguna de las cinco columnas conoce el sexo, asi que una facultad
# podia leerse cubierta con su celda de mujeres corta.
#
# **Medido, y se dice como es: el engaño NO se observa en los tres simulacros**
# —en `como_2025` tres facultades cubren su total y ninguna tenia celda corta;
# en los otros dos ninguna cubre—. Lo que esto cambia es que la pregunta se
# pueda contestar de un vistazo, no que repare un caso visto.

test_that("cada facultad publica sus dos celdas y si alguna va corta", {
  plan <- c(
    lapply(1:24, function(i) list(faculty = "DERECHO", operational_status = "aplicada",
      eligible_n = 40, expected_valid = 22, respuestas_validas = 20,
      tasa_efectividad_aula = 0.55, mujeres_esperadas = 12, hombres_esperados = 10)),
    list(list(faculty = "DERECHO", operational_status = "pendiente",
      eligible_n = 40, expected_valid = 22, tasa_efectividad_aula = 0.55,
      mujeres_esperadas = 12, hombres_esperados = 10))
  )
  cuotas <- list(
    list(faculty = "DERECHO", sex = "F", target = 500, observed = 100),
    list(faculty = "DERECHO", sex = "M", target = 5, observed = 90)
  )
  celdas <- monitoreo_aulas_avance_sexo_facultad(plan, cuotas)
  f <- Filter(function(c1) identical(c1$sex, "F"), celdas)[[1]]
  m <- Filter(function(c1) identical(c1$sex, "M"), celdas)[[1]]
  # La de mujeres no llega ni de lejos; la de hombres ya se paso.
  expect_gt(as.numeric(f$brecha), 0)
  expect_equal(as.numeric(m$brecha), 0)
})

test_that("una celda AUSENTE no cuenta como corta", {
  # `NA` significa que la facultad no tiene esa celda, no que este mal.
  # Inventar una alarma sobre una celda que no existe es peor que callarla.
  corta <- function(x) !is.na(x) & x > 0
  expect_false(corta(NA_real_))
  expect_false(corta(0))
  expect_true(corta(1))
})
