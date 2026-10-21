source("setup-load-all.R")

# Checklist de la matriz de HSyVbG (2026-10-21): lo que la matriz de Ulises
# destapó en el comparativo. Fixture sintético, sin datos de cliente.
#   A1/A2  una fila de misma escala entra sin armonización guardada; una de
#          escalas distintas sin armonizar se declara omitida, no se calla.
#   A3     la opción de selección múltiple (dummy 0/1) cuenta el 0 en el N.
#   A4     el sello del instrumento no depende de la colación del sistema.

.ai_inst <- function(var, codigos, etiquetas, lista = paste0("l_", var)) {
  list(
    survey = data.frame(type = paste("select_one", lista), name = var, label = var,
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = lista, name = codigos, label = etiquetas,
                         stringsAsFactors = FALSE))
}

.ai_fila <- function(etiqueta, variables, armonizacion = NULL) {
  f <- list(seccion = "", etiqueta_estandar = etiqueta, variables = variables,
            cantidad = length(variables))
  if (!is.null(armonizacion)) f$armonizacion <- armonizacion
  f
}

test_that("A1: una fila de misma escala sin armonización entra con la identidad", {
  insts <- list(a = .ai_inst("sexo_a", c("1", "2"), c("Mujer", "Hombre")),
                b = .ai_inst("sexo_b", c("1", "2"), c("mujer", "HOMBRE")))
  equiv <- list(filas = list(.ai_fila("Sexo", list(a = "sexo_a", b = "sexo_b"))))
  r <- .armz_completar_implicitas(equiv, insts, c("a", "b"))
  arm <- r$equiv$filas[[1]]$armonizacion
  expect_equal(vapply(arm$escala, `[[`, "", "codigo"), c("1", "2"))
  expect_equal(vapply(arm$escala, `[[`, "", "etiqueta"), c("Mujer", "Hombre"))
  expect_true(all(vapply(arm$por_base, function(e) isTRUE(e$comparable) && !length(e$mapa), NA)))
  expect_length(r$omitidas, 0)

  # Y llega al libro: apilada con datos, cuenta como cualquier fila armonizada.
  datos <- list(a = data.frame(sexo_a = c(1, 1, 2)), b = data.frame(sexo_b = c(2, 2, 1, 1)))
  ap <- armonizada_apilar(datos, r$equiv$filas, periodos = c("a", "b"), insts = insts)
  m <- armonizada_modelo_frecuencias(ap)
  expect_equal(unname(m$preguntas[[1]]$periodos$a$n), c(2, 1))
  expect_equal(unname(m$preguntas[[1]]$periodos$b$n), c(2, 2))
})

test_that("A2: escalas distintas sin armonizar se declaran omitidas con motivo", {
  insts <- list(a = .ai_inst("ing_a", c("1", "2"), c("Hasta 2019", "Desde 2020")),
                b = .ai_inst("ing_b", c("1", "2"), c("Desde 2023", "Hasta 2022")))
  equiv <- list(filas = list(
    .ai_fila("Año de ingreso", list(a = "ing_a", b = "ing_b")),
    # Una propuesta sin confirmar no es una decisión: ni entra ni se reporta.
    c(.ai_fila("Propuesta", list(a = "ing_a", b = "ing_b")), list(sugerida = TRUE))))
  r <- .armz_completar_implicitas(equiv, insts, c("a", "b"))
  expect_null(r$equiv$filas[[1]]$armonizacion)
  expect_length(r$omitidas, 1)
  o <- r$omitidas[[1]]
  expect_equal(o$motivo, "sin_armonizar")
  expect_equal(o$fila, "Año de ingreso")
  expect_match(.armz_motivo_omision(o), "Armonizar")
  expect_equal(.comparativo_motivo_corto("sin_armonizar"), "Sin armonizar")
})

test_that("A1: una variable libre (sin lista) en todas las bases no se arma como escala", {
  libre <- function(v) list(survey = data.frame(type = "integer", name = v, label = v),
                            choices = data.frame(list_name = character(0), name = character(0),
                                                 label = character(0)))
  equiv <- list(filas = list(.ai_fila("Edad", list(a = "e_a", b = "e_b"))))
  r <- .armz_completar_implicitas(equiv, list(a = libre("e_a"), b = libre("e_b")), c("a", "b"))
  expect_null(r$equiv$filas[[1]]$armonizacion)
  expect_equal(r$omitidas[[1]]$motivo, "sin_armonizar")
})

test_that("A3: el 0 de una dummy cuenta en el N y no imprime fila", {
  esc1 <- list(escala = list(list(codigo = "1", etiqueta = "Angustia")),
               por_base = list(a = list(comparable = TRUE, mapa = stats::setNames(list(), character(0)))))
  fila <- .ai_fila("Emociones: Angustia", list(a = "p25_1"), esc1)
  insts <- list(a = .ai_inst("p25_1", c("0", "1"), c("No", "Sí")))
  datos <- list(a = data.frame(p25_1 = c(1, 1, 1, 0, 0, 0, 0, 0, 0, 0, NA, NA)))
  ap <- armonizada_apilar(datos, list(fila), periodos = "a", insts = insts)
  p <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]$periodos$a
  expect_equal(unname(p$n), 3)
  expect_equal(p$N, 10)                       # los 2 NA (no se les preguntó) no cuentan
  expect_equal(unname(p$pct), 0.3)
  expect_equal(ap$preguntas[[1]]$sin_mapa$a$n_sin_mapa, 0)

  # Una escala de una categoría sobre una variable que no es 0/1 no se toca:
  # el 2 sigue sin mapa y se avisa.
  datos2 <- list(a = data.frame(p25_1 = c(1, 1, 2, 2)))
  ap2 <- armonizada_apilar(datos2, list(fila), periodos = "a", insts = insts)
  p2 <- armonizada_modelo_frecuencias(ap2)$preguntas[[1]]$periodos$a
  expect_equal(p2$N, 2)
  expect_equal(ap2$preguntas[[1]]$sin_mapa$a$n_sin_mapa, 2)
})

test_that("A4: el sello del instrumento no depende de la colación del sistema", {
  nombres <- c("P25.1_R", "p25_1", "_uuid", "P11/99", "Árbol", "zeta", "Z1", "a_1", "A_2")
  inst <- list(survey = data.frame(type = "text", name = nombres, stringsAsFactors = FALSE))
  inst_rev <- list(survey = data.frame(type = "text", name = rev(nombres), stringsAsFactors = FALSE))
  previo <- Sys.getlocale("LC_COLLATE")
  withr::defer(Sys.setlocale("LC_COLLATE", previo))
  Sys.setlocale("LC_COLLATE", "C")
  en_c <- .equiv_sello_instrumento(inst)
  sistema_c <- .equiv_sello_instrumento(inst, orden = "sistema")
  ok <- suppressWarnings(nzchar(Sys.setlocale("LC_COLLATE", "en_US.UTF-8")))
  skip_if_not(ok, "sin locale en_US.UTF-8 para comparar colaciones")
  expect_equal(.equiv_sello_instrumento(inst), en_c)
  expect_equal(.equiv_sello_instrumento(inst_rev), en_c)
  # El orden del sistema sí cambia con la colación: de ahí el defecto.
  expect_false(identical(.equiv_sello_instrumento(inst, orden = "sistema"), sistema_c))
})

test_that("A5: el código que va a la categoría equivocada se avisa; dummies y variantes no", {
  esc <- list(list(codigo = "1", etiqueta = "Ingresantes hasta 2019"),
              list(codigo = "2", etiqueta = "Ingresantes en 2020-2021"),
              list(codigo = "3", etiqueta = "Ingresantes desde 2022"))
  vacio <- stats::setNames(list(), character(0))
  fila <- .ai_fila("Año de ingreso", list(a = "ing_a", b = "ing_b"), list(
    escala = esc, por_base = list(a = list(comparable = TRUE, mapa = vacio),
                                  b = list(comparable = TRUE, mapa = vacio))))
  insts <- list(a = .ai_inst("ing_a", c("1", "2", "3"), vapply(esc, `[[`, "", "etiqueta")),
                b = .ai_inst("ing_b", c("1", "2", "3"),
                             c("Ingresantes desde 2023", "Ingresantes en 2021–2022", "Ingresantes hasta 2020")))
  mal <- .armz_codigos_mal_ubicados(fila, "b", insts$b)
  expect_equal(vapply(mal, `[[`, "", "codigo"), c("1", "3"))
  expect_equal(mal[[1]]$sugerida, "Ingresantes desde 2022")
  expect_length(.armz_codigos_mal_ubicados(fila, "a", insts$a), 0)

  datos <- list(a = data.frame(ing_a = c(1, 2, 3)), b = data.frame(ing_b = c(1, 1, 3)))
  ap <- armonizada_apilar(datos, list(fila), periodos = c("a", "b"), insts = insts)
  av <- Filter(function(x) identical(x$tipo, "codigo_mal_ubicado"), armonizada_avisos(ap))
  expect_length(av, 1)
  expect_equal(av[[1]]$base, "b")
  expect_match(av[[1]]$mensaje, "se parece más a «Ingresantes desde 2022» \\(y 1 código más\\)")

  # Con el mapa invertido declarado, nada.
  fila$armonizacion$por_base$b$mapa <- list(`1` = "3", `2` = "2", `3` = "1")
  expect_length(.armz_codigos_mal_ubicados(fila, "b", insts$b), 0)

  # Una dummy «Sí» → «Angustia» (escala de una categoría) no se acusa.
  dummy <- .ai_fila("Angustia", list(b = "d"), list(
    escala = list(list(codigo = "1", etiqueta = "Angustia")),
    por_base = list(b = list(comparable = TRUE, mapa = vacio))))
  expect_length(.armz_codigos_mal_ubicados(dummy, "b", .ai_inst("d", c("0", "1"), c("No", "Sí"))), 0)
})

test_that("A5: Likert y satisfacción no se acusan; un mapa explícito tampoco", {
  vacio <- stats::setNames(list(), character(0))
  fila <- function(etqs, mapa = vacio) .ai_fila("Escala", list(b = "v"), list(
    escala = lapply(seq_along(etqs), function(i) list(codigo = as.character(i), etiqueta = etqs[[i]])),
    por_base = list(b = list(comparable = TRUE, mapa = mapa))))
  likert <- c("Muy de acuerdo", "De acuerdo", "En desacuerdo", "Muy en desacuerdo")
  inst <- .ai_inst("v", c("1", "2", "3", "4"),
                   c("Totalmente de acuerdo", "De acuerdo", "En desacuerdo", "Totalmente en desacuerdo"))
  expect_length(.armz_codigos_mal_ubicados(fila(likert), "b", inst), 0)
  satisf <- c("Muy satisfecho", "Satisfecho", "Insatisfecho", "Muy insatisfecho")
  inst_s <- .ai_inst("v", c("1", "2", "3", "4"),
                     c("Bastante satisfecho", "Satisfecho", "Insatisfecho", "Nada satisfecho"))
  expect_length(.armz_codigos_mal_ubicados(fila(satisf), "b", inst_s), 0)
  # La inversión «1º/2º ciclo» con identidad sí; declarada código por código, no.
  ciclos <- c("1º ciclo", "2º ciclo")
  inst_c <- .ai_inst("v", c("1", "2"), c("2º ciclo", "1º ciclo"))
  expect_equal(vapply(.armz_codigos_mal_ubicados(fila(ciclos), "b", inst_c), `[[`, "", "codigo"), c("1", "2"))
  expect_length(.armz_codigos_mal_ubicados(fila(ciclos, list(`1` = "1", `2` = "2")), "b", inst_c), 0)
})
