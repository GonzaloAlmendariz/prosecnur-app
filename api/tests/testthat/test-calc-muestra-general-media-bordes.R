# Rechazo del verificador sobre H21/H24 (2026-09-24): seis bordes de la media,
# de la asignación y del marco con columnas propuestas.

.mb_comp <- function(tecnica = "prob_estratificado", N_h = c(3000L, 2000L), ...) {
  est <- lapply(seq_along(N_h), function(i) list(label = LETTERS[i], N = N_h[[i]]))
  calc_muestra_normalize_componente(list(tecnica = tecnica, id = "c1",
    marco = list(marco_validado = sum(N_h), universo_bruto = sum(N_h), marco_contactable = sum(N_h),
                 estado = "validado", estratos = est),
    parametros = utils::modifyList(list(tipo_indicador = "media", cv = 1, e = .05, deff = 1,
                                        tasa_respuesta = 1, oversample_pct = 0, n_minimo_estrato = 0L), list(...))))
}

test_that("1: la precisión por estrato de una media es el error RELATIVO del estrato", {
  r <- calc_muestra_calcular_componente(.mb_comp())
  for (d in r$distribucion_estratos) {
    esperado <- .cm_general_error_media(d$n, d$N, 1, 1.96, 1)
    expect_equal(d$precision_e, esperado, tolerance = 1e-10, info = d$estrato)
  }
})

test_that("2: con una media la asignación publicada es la que se aplica (proporcional)", {
  r <- calc_muestra_calcular_componente(.mb_comp(asignacion = "neyman"))
  expect_identical(r$asignacion, "proporcional")
  expect_match(r$advertencia, "media")
})

test_that("3: un cv fuera de rango se corrige declarándolo", {
  comp <- .mb_comp(tecnica = "prob_aleatorio_simple", cv = 15)
  expect_true("cv" %in% vapply(comp$avisos_parametros, `[[`, "", "param"))
})

test_that("4: un MAS con columna de estrato no sortea con un piso oculto", {
  set.seed(4)
  N_h <- c(4000L, 900L, 60L, 40L)
  marco <- data.frame(codigo = sprintf("H%05d", seq_len(sum(N_h))), distrito = rep(c("A", "B", "C", "D"), N_h))
  comp <- calc_muestra_normalize_componente(list(id = "c1", tecnica = "prob_aleatorio_simple",
    parametros = list(e = .05, tasa_respuesta = 1, oversample_pct = 0)))
  est <- calc_muestra_normalize_estudio(list(componentes = list(comp)))
  dec <- calc_muestra_general_declarar_marco(est, NULL, "c1", marco, "f", columnas = list(id = "codigo", estrato = "distrito"))
  sel <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, "c1", marco, semilla = 1L)
  pis <- sel$corrida$estratos$pi
  # Estratificación implícita proporcional: la π es casi igual en todos (Kish ≈ 1).
  expect_lt(max(pis) - min(pis), 0.01)
})

test_that("5: un tamaño con ceros no impide declarar el marco de un MAS (sí sortear PPS)", {
  marco <- data.frame(codigo = sprintf("U%03d", 1:50), personas = c(0, NA, 1:48))
  comp <- calc_muestra_normalize_componente(list(id = "c1", tecnica = "prob_aleatorio_simple",
    parametros = list(e = .1, tasa_respuesta = 1, oversample_pct = 0)))
  est <- calc_muestra_normalize_estudio(list(componentes = list(comp)))
  dec <- calc_muestra_general_declarar_marco(est, NULL, "c1", marco, "f", columnas = list(id = "codigo", tamano = "personas"))
  expect_identical(dec$marco$N, 50L)
  expect_identical(as.integer(dec$marco$tamanos_invalidos), 2L)
  err <- tryCatch(calc_muestra_general_seleccionar(dec$estudio, dec$estado, "c1", marco, metodo = "pps"),
                  api_error = function(e) e)
  expect_identical(err$code, "E_CALC_MUESTRA_GENERAL_MARCO")
})

test_that("6: sin inferencia permitida, una media se calcula como media", {
  comp <- calc_muestra_normalize_componente(list(tecnica = "prob_aleatorio_simple",
    marco = list(marco_validado = 5000L, estado = "no_definido"),
    parametros = list(tipo_indicador = "media", cv = 2, e = .05)))
  r <- calc_muestra_calcular_componente(comp)
  expect_identical(as.integer(r$n_teorico), .cm_general_n_media(5000L, 2, 1.96, .05, 1))
})
