# =============================================================================
# Sexo y carrera: se describen, no se exigen
# =============================================================================
#
# Decisión 2 del plan del eje declarable (2026-09-17): la cuota es por el eje y
# es DURA; sexo y carrera son referenciales — dicen a quién estamos alcanzando y
# sirven de marco de comparación.
#
# **La prueba central es de AUSENCIA**, y eso es raro y hay que decirlo: lo que
# se defiende es que este bloque NO publique un umbral, un desvío ni una brecha.
# Un «desvío del 8 % en ECONOMÍA» en rojo convierte en incumplimiento algo que el
# estudio nunca prometió, y el operativo gasta llamadas persiguiendo una cuota
# que no existe.

.mcr_cfg <- function() list(quotas = list(category_profiles = data.frame(
  role = c("sex", "sex", "program", "program", "program", "level"),
  label = c("Sexo", "Sexo", "Programa", "Programa", "Programa", "Nivel"),
  source_role = rep("", 6), column = c("sex", "sex", rep("program", 3), "level"),
  raw = c("F", "M", "ECONOMÍA", "SOCIOLOGÍA", "FINANZAS", "7"),
  count = c(421L, 379L, 358L, 17L, 97L, 244L),
  unit_label = rep("estudiantes", 6), stringsAsFactors = FALSE)))

.mcr_resueltas <- function() data.frame(
  codigo = c("1", "2", "3", "4", "5"),
  nivel = c(7L, 7L, 8L, 9L, NA_integer_),
  carrera = c("ECONOMÍA", "ECONOMÍA", "SOCIOLOGÍA", "FINANZAS", ""),
  sexo = c("F", "M", "F", "F", ""),
  resuelto = c(TRUE, TRUE, TRUE, TRUE, FALSE),
  motivo = c("", "", "", "", "codigo_no_en_padron"),
  stringsAsFactors = FALSE)

test_that("publica las dos composiciones y NINGUN umbral", {
  r <- monitoreo_aulas_composicion_referencial(.mcr_cfg(), .mcr_resueltas())
  expect_identical(r$caracter, "referencial")
  plano <- paste(names(unlist(r)), collapse = " ")
  # Lo que NO puede aparecer. Si un día hace falta una alarma, será una decisión
  # con su ADR, y esta prueba es la que obliga a tomarla en vez de colarla.
  for (prohibido in c("umbral", "tolerancia", "desvio", "brecha", "cumple",
                      "alerta", "aviso_desvio")) {
    expect_false(grepl(prohibido, plano, fixed = TRUE), info = prohibido)
  }
  # Y sí las dos cifras que el panel existe para enseñar.
  sexo <- r$dimensiones$sexo
  expect_identical(sexo$poblacion_total, 800L)
  expect_identical(sexo$obtenidas_total, 4L)
})

test_that("el porcentaje de cada lado sale de SU propio total", {
  r <- monitoreo_aulas_composicion_referencial(.mcr_cfg(), .mcr_resueltas())
  f <- Filter(function(x) identical(x$categoria, "F"), r$dimensiones$sexo$filas)[[1]]
  expect_identical(f$poblacion, 421L)
  expect_identical(f$poblacion_pct, 52.6)   # 421 de 800
  expect_identical(f$obtenidas, 3L)
  expect_identical(f$obtenidas_pct, 75)     # 3 de 4, no 3 de 800
})

test_that("sólo se describe a quien RESOLVIÓ, y a quien acreditó", {
  # De los que no cruzaron no sabemos ni su sexo ni su carrera: contarlos como
  # categoría vacía inventaría una barra.
  r <- monitoreo_aulas_composicion_referencial(.mcr_cfg(), .mcr_resueltas())
  expect_identical(r$personas, 4L)
  cats <- vapply(r$dimensiones$sexo$filas, function(f) f$categoria, character(1))
  expect_false("" %in% cats)
  # Y la máscara manda: se describe a quien entró a una celda, no a quien
  # respondió — la segunda población incluye duplicados y gente sin eje.
  r2 <- monitoreo_aulas_composicion_referencial(
    .mcr_cfg(), .mcr_resueltas(), cuenta = c(TRUE, FALSE, TRUE, FALSE, TRUE))
  expect_identical(r2$personas, 2L)
  expect_identical(r2$dimensiones$sexo$obtenidas_total, 2L)
})

test_that("sin cruce lo DICE, en vez de publicar ceros con voz de medición", {
  # Sin `resueltas` el cruce no se intentó: `sin_padron` (2026-09-24), que
  # también es un vacío declarado y no ceros.
  r <- monitoreo_aulas_composicion_referencial(.mcr_cfg())
  expect_identical(r$fuente, "sin_padron")
  expect_identical(r$personas, 0L)
  # El denominador sigue ahí: la población se conoce desde el marco, lo que
  # falta es lo recogido.
  expect_identical(r$dimensiones$carrera$poblacion_total, 472L)
  expect_identical(r$dimensiones$carrera$obtenidas_total, 0L)
})

test_that("una categoria que aparece sólo en lo recogido no se pierde", {
  # Pasa de verdad: el padrón puede traer una carrera que el marco no contó (una
  # matrícula nueva). Esconderla diría que esas personas no existen.
  res <- .mcr_resueltas()
  res$carrera[[1]] <- "ANTROPOLOGÍA"
  r <- monitoreo_aulas_composicion_referencial(.mcr_cfg(), res)
  cats <- vapply(r$dimensiones$carrera$filas, function(f) f$categoria, character(1))
  expect_true("ANTROPOLOGÍA" %in% cats)
  nueva <- Filter(function(f) identical(f$categoria, "ANTROPOLOGÍA"), r$dimensiones$carrera$filas)[[1]]
  expect_identical(nueva$poblacion, 0L)
  expect_identical(nueva$obtenidas, 1L)
})

test_that("el orden de las filas lo fija la POBLACION, no lo recogido", {
  # Si ordenara por lo obtenido, las barras bailarían con cada sincronización.
  r <- monitoreo_aulas_composicion_referencial(.mcr_cfg(), .mcr_resueltas())
  pobs <- vapply(r$dimensiones$carrera$filas, function(f) f$poblacion, numeric(1))
  expect_identical(pobs, sort(pobs, decreasing = TRUE))
})

test_that("una config sin perfiles del marco no revienta ni inventa", {
  r <- monitoreo_aulas_composicion_referencial(list(), .mcr_resueltas())
  expect_identical(r$dimensiones$sexo$poblacion_total, 0L)
  # Lo recogido sigue describiéndose: es la mitad que sí se conoce.
  expect_identical(r$dimensiones$sexo$obtenidas_total, 4L)
  expect_identical(monitoreo_aulas_composicion_referencial(list())$fuente, "sin_padron")
})

test_that("sin cruce intentado dice sin_padron, no «todavía» (HSVG26ULT2, 2026-09-24)", {
  expect_identical(monitoreo_aulas_composicion_referencial(list(), resueltas = NULL)$fuente, "sin_padron")
})
