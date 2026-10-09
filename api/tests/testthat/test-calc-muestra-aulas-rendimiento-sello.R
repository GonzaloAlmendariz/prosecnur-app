# Los tramos de rendimiento por tamaño se sellan en la config del estudio.
#
# Medido el 2026-08-28 sobre el `.pulso` del sorteo vigente de HSVG2026:
# `efectividad$fuente` decía "historico" con seis facultades selladas mientras
# `rendimiento_tramos` era NULL, o sea que el factor por facultad venía del
# histórico y el rendimiento por tamaño de la calibración embebida del código,
# sin que ninguna superficie lo dijera. ADR 0083.
#
# La vara de estos tests: **sellar declara de dónde sale un número, no lo
# cambia.** Un sello que mueva una cifra de un estudio ya construido está mal.

.rs_historico <- function(tramos = NULL, extra = list()) {
  ef <- c(list(fuente = "historico", tau_base = 1,
               por_facultad = list(list(facultad = "DERECHO", tau = 1.1,
                                        k = 14, suficiencia = "suficiente"))),
          extra)
  if (!is.null(tramos)) ef$rendimiento_tramos <- tramos
  list(efectividad = ef)
}

test_that("un estudio historico sin tramos queda sellado con los embebidos", {
  out <- calc_muestra_aulas_sellar_rendimiento(.rs_historico())
  tr <- out$efectividad$rendimiento_tramos
  expect_length(tr, 5L)
  expect_equal(vapply(tr, function(x) x$tasa, numeric(1)),
               c(0.80, 0.69, 0.56, 0.55, 0.44))
  # El ultimo tramo NO lleva un tope numerico: es el resto.
  expect_true(is.na(tr[[5]]$hasta))
})

test_that("el sello declara que esos cinco numeros NO son del historico", {
  # Es el punto entero del ADR 0083: el bloque dice "historico" y estos cinco
  # tramos no lo son. Sin esta marca el sello movería los números de sitio sin
  # reparar el rótulo que miente.
  out <- calc_muestra_aulas_sellar_rendimiento(.rs_historico())
  expect_identical(out$efectividad$rendimiento_fuente, "calibracion_embebida")
  expect_identical(out$efectividad$fuente, "historico")
})

test_that("SELLAR NO MUEVE NINGUN NUMERO: es la vara del ADR 0083", {
  # La comprobacion que importa. Se evalua el rendimiento de un barrido de
  # tamaños con la config sin sellar y con la config sellada; si difieren en un
  # solo elegible, sellar esta reescribiendo en vez de declarar.
  e <- 1:120
  sin_sello <- .cm_efectividad_rendimiento(e, NULL)
  sellada <- calc_muestra_aulas_sellar_rendimiento(.rs_historico())
  con_sello <- .cm_efectividad_rendimiento(
    e, .cm_efectividad_normalize_config(sellada$efectividad)$rendimiento_tramos
  )
  expect_identical(con_sello, sin_sello)
  # Y que el barrido no sea todo NA, que pasaria el identical sin probar nada.
  expect_true(all(is.finite(sin_sello)))
})

test_that("una declaracion del estudio manda sobre el sello", {
  propios <- list(list(hasta = 20, tasa = 0.9), list(hasta = NA_real_, tasa = 0.3))
  out <- calc_muestra_aulas_sellar_rendimiento(.rs_historico(tramos = propios))
  expect_length(out$efectividad$rendimiento_tramos, 2L)
  expect_null(out$efectividad$rendimiento_fuente)
})

test_that("sin fuente historico NO se sella, porque el normalizador lo tiraria", {
  # `.cm_efectividad_normalize_config()` solo conserva `rendimiento_tramos`
  # dentro de la rama "historico". Sellarlos con otra fuente los perderia en
  # silencio, que es el patron de la lista cerrada que se traga lo que no
  # reconoce. Ademas un estudio con otra fuente ya se declara
  # `calibracion_embebida` y no engaña a nadie.
  global <- list(efectividad = list(fuente = "tau_global", tau = 0.53))
  expect_null(calc_muestra_aulas_sellar_rendimiento(global)$efectividad$rendimiento_tramos)
  expect_null(calc_muestra_aulas_sellar_rendimiento(list())$efectividad)
})

test_that("el sello sobrevive al normalizador, ida y vuelta", {
  # El guard del defecto que casi se cuela: `.cm_efectividad_normalize_config()`
  # construye su retorno campo a campo, asi que una clave nueva que no se liste
  # ahi desaparece aunque el sellador la escriba.
  norm <- .cm_efectividad_normalize_config(
    calc_muestra_aulas_sellar_rendimiento(.rs_historico())$efectividad
  )
  expect_length(norm$rendimiento_tramos, 5L)
  expect_identical(norm$rendimiento_fuente, "calibracion_embebida")
})

test_that("sellar no despierta las piernas: siguen NA", {
  # Los tramos embebidos no declaran asistencia, respuesta ni validez, y
  # `test-calc-muestra-aulas-piernas.R` fija que un tramo sin piernas publica
  # NA en vez de un numero inventado. Si sellar las encendiera, el marco
  # empezaria a publicar una descomposicion que nadie midio.
  norm <- .cm_efectividad_normalize_config(
    calc_muestra_aulas_sellar_rendimiento(.rs_historico())$efectividad
  )
  piernas <- .cm_efectividad_piernas(c(10, 30, 60), norm$rendimiento_tramos)
  expect_true(all(is.na(piernas$asistencia)))
  expect_true(all(is.na(piernas$respuesta)))
  expect_true(all(is.na(piernas$validez)))
})

test_that("sellar dos veces deja lo mismo que sellar una", {
  una <- calc_muestra_aulas_sellar_rendimiento(.rs_historico())
  dos <- calc_muestra_aulas_sellar_rendimiento(una)
  expect_identical(dos, una)
})
