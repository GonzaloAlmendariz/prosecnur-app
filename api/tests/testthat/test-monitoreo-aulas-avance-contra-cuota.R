# El avance se mide contra la CUOTA, no contra el pronostico.
#
# Gonzalo, 2026-08-29: «el avance se mide sobre las cuotas del plan, no sobre lo
# que nosotros hemos pronosticado que va a suceder. Lo que pronosticamos nos
# sirve para el diseño, para el dimensionamiento de las aulas, pero a nosotros
# nos interesa llegar a dos mil quinientos con las cuotas que hemos establecido
# por sexo en cada facultad. Esa es nuestra meta.»
#
# Medido sobre «campo malo» ANTES: `avance_por_facultad$meta` era la suma de
# `expected_valid` —elegibles por su tasa— y daba **3.145,7** frente a una cuota
# de **2.500**. CIENCIAS E INGENIERIA publicaba «faltan 397» cuando contra su
# cuota faltan **232**.

test_that("un hombre de mas NO cubre a una mujer que falta", {
  # El caso que aparecio al hacer que las partes sumaran el total, y es REAL:
  # en «campo malo», GASTRONOMIA lleva mujeres 10 de 12 y hombres 14 de 9. El
  # total da 24 sobre una cuota de 21, asi que restando sobre el agregado la
  # facultad salia con CERO faltan — con dos mujeres todavia cortas.
  #
  # Es la doctrina del ADR 0079 aplicada al sexo: la cuota no se compensa.
  falta <- function(cuota, logrado) max(0, ceiling(cuota - logrado - 1e-9))
  por_celdas <- falta(12, 10) + falta(9, 14)
  por_total  <- falta(12 + 9, 10 + 14)
  expect_equal(por_celdas, 2)
  expect_equal(por_total, 0)
  expect_gt(por_celdas, por_total)
})

test_that("las dos celdas de una facultad suman lo que le falta", {
  # Sin esto el lector suma y no le cuadra, que es como se descubrio: en
  # pantalla, «397 respuestas faltan» con «31 mujeres» y «114 hombres» debajo.
  plan <- lapply(1:25, function(i) list(
    faculty = "DERECHO", operational_status = "aplicada", eligible_n = 40,
    expected_valid = 22, respuestas_validas = 20, tasa_efectividad_aula = 0.55,
    mujeres_esperadas = 12, hombres_esperados = 10))
  celdas <- monitoreo_aulas_avance_sexo_facultad(plan, list(
    list(faculty = "DERECHO", sex = "F", target = 100, observed = 40),
    list(faculty = "DERECHO", sex = "M", target = 60, observed = 50)
  ))
  falta <- function(sx) {
    c1 <- Filter(function(x) identical(x$sex, sx), celdas)[[1]]
    max(0, ceiling(as.numeric(c1$cuota) - as.numeric(c1$logrado) - 1e-9))
  }
  expect_equal(falta("F"), 60)
  expect_equal(falta("M"), 10)
  expect_equal(falta("F") + falta("M"), 70)
})
