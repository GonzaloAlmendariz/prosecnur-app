source("setup-load-all.R")

# ADR 0135 §3: un solo detector de «Sin información» para la escala (resumen y recetario, lámina 71). El 9 «No tengo
# información suficiente» de una 1-5 se pintaba como el verde más oscuro (lado de acuerdo) y el reparto contaba seis
# niveles, así que «Ni uno ni otro» dejaba de ser el punto medio. Ahora el reparto, el punto medio y el Top Two Box se
# calculan sobre las opciones sustantivas; la no sustantiva va a su columna. El denominador sigue siendo el total de
# respondientes (con «Sin información» dentro), como dice el pie del mazo de Arte.

.dns_fuentes <- function(cods, labs, cnts) {
  d <- as.data.frame(lapply(cnts, function(cn) rep(cods, cn)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = names(cnts), type = "select_one lk", list_name = "lk",
                                   label = paste("Afirmación", names(cnts)), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = cods, label = labs, stringsAsFactors = FALSE), orders_list = NULL)
  list(data_sources = list(b = d), inst_sources = list(b = inst))
}
.dns_espec <- function(src, estilo = "resumen", ...) {
  el <- p_barras_divergentes(vars = paste0("b$", names(src$data_sources$b)), estilo = estilo, orden = "declarado", ...)
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala")))
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  attr(out$rendered[[1]], "pulso_espec")
}
.dns_lik5 <- c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo")

test_that("el detector: código fuera de la escala, 90-99 y rótulo de no respuesta; dentro del rango nunca", {
  cods <- c("1", "2", "3", "4", "5", "9")
  expect_identical(.divergentes_especiales(c(.dns_lik5, "No tengo información suficiente"), cods),
                   c(rep(FALSE, 5), TRUE))
  # El 9 con un rótulo cualquiera: fuera del rango 1-5.
  expect_identical(.divergentes_especiales(c(.dns_lik5, "Otra cosa"), cods), c(rep(FALSE, 5), TRUE))
  # La regla de siempre (90-99 y `.DIVERGENTES_ESPECIAL`) sigue.
  expect_true(.divergentes_especiales("Lo que sea", "99"))
  expect_true(.divergentes_especiales("Sin información", NA))
  # «Ninguna vez» con código 1 abre una escala de frecuencia: es sustantiva.
  expect_false(any(.divergentes_especiales(c("Ninguna vez", "Pocas", "A veces", "Siempre"), c("1", "2", "3", "4"))))
  # Con la lista completa, excluir el medio no parte el rango: 4, 5 siguen dentro y el 9 fuera.
  expect_identical(.divergentes_especiales(c("a", "b", "d", "e", "No tengo información suficiente"), c("1", "2", "4", "5", "9"),
                                           codigos_lista = cods), c(FALSE, FALSE, FALSE, FALSE, TRUE))
})

test_that("escala impar 1-5 + 9: el 9 va a Sin información, «Ni uno ni otro» es el punto medio y el acuerdo es 4 y 5", {
  skip_if_not_installed("ggplot2")
  cods <- c("1", "2", "3", "4", "5", "9")
  src <- .dns_fuentes(cods, c(.dns_lik5, "No tengo información suficiente"),
                      list(a = c(2, 3, 5, 10, 10, 10), b = c(4, 4, 4, 4, 4, 20)))
  for (estilo in c("resumen", "recetario")) {
    e <- .dns_espec(src, estilo)
    expect_identical(e$categorias$lado, c("neg", "neg", "neu", "pos", "pos", "sin_inf"), info = estilo)
    # El 9 no es el verde más oscuro: sale con el color de lo no sustantivo, no con uno de la rampa de acuerdo.
    expect_false(e$categorias$color[6] %in% e$categorias$color[4:5], info = estilo)
    k <- 10^e$decimales
    # Sobre el total de respondientes (40): a = 10 + 10 = 50 %; Sin información 25 %; b = 4 + 4 = 20 %, Sin info 50 %.
    expect_equal(e$total_pos / k, c(50, 20), info = estilo)
    expect_equal(rowSums(e$unidades[, e$categorias$lado == "sin_inf", drop = FALSE]) / k, c(25, 50), info = estilo)
    expect_equal(e$total_neg / k, c(13, 20), info = estilo)   # 2 + 3 de 40 = 12,5 %: rotulado 5 + 8
  }
})

test_that("escala par 1-4 + 9: no hay punto medio, dos niveles por lado", {
  skip_if_not_installed("ggplot2")
  src <- .dns_fuentes(c("1", "2", "3", "4", "9"),
                      c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo",
                        "No tengo información suficiente"),
                      list(a = c(2, 3, 10, 15, 10)))
  e <- .dns_espec(src)
  expect_identical(e$categorias$lado, c("neg", "neg", "pos", "pos", "sin_inf"))
  expect_equal(e$total_pos / 10^e$decimales, 63)   # 10 + 15 de 40 = 62,5 %: rotulado 25 + 38
  # Con el rótulo «Sin información» pasaba lo mismo con el reparto: cinco niveles hacían de «De acuerdo» el neutro.
  src2 <- .dns_fuentes(c("1", "2", "3", "4", "9"),
                       c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       list(a = c(2, 3, 10, 15, 10)))
  expect_identical(.dns_espec(src2)$categorias$lado, c("neg", "neg", "pos", "pos", "sin_inf"))
})

test_that("excluir la opción del medio no convierte 4 y 5 en no sustantivas", {
  skip_if_not_installed("ggplot2")
  src <- .dns_fuentes(c("1", "2", "3", "4", "5", "9"), c(.dns_lik5, "No tengo información suficiente"),
                      list(a = c(2, 3, 5, 10, 10, 10)))
  e <- .dns_espec(src, excluir_opciones = "3")
  expect_identical(e$categorias$rotulo, c(.dns_lik5[-3], "No tengo información suficiente"))
  expect_identical(e$categorias$lado, c("neg", "neg", "pos", "pos", "sin_inf"))
})

test_that("una escala sin no sustantivos sale como antes: reparto posicional sobre todos sus niveles", {
  skip_if_not_installed("ggplot2")
  src <- .dns_fuentes(as.character(1:5), .dns_lik5, list(a = c(3, 5, 7, 10, 15)))
  e <- .dns_espec(src)
  expect_identical(e$categorias$lado, c("neg", "neg", "neu", "pos", "pos"))
  expect_equal(e$total_pos / 10^e$decimales, 63)
})
