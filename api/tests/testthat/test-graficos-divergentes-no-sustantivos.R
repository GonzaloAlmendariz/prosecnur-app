source("setup-load-all.R")

# ADR 0135 §3: un solo detector de «Sin información» para la escala (resumen y recetario, lámina 71). El 9 «No tengo
# información suficiente» de una 1-5 se pintaba como el verde más oscuro (lado de acuerdo) y el reparto contaba seis
# niveles, así que «Ni uno ni otro» dejaba de ser el punto medio. Ahora el reparto, el punto medio y el Top Two Box se
# calculan sobre las opciones sustantivas; la no sustantiva va a su columna. El denominador sigue siendo el total de
# respondientes (con «Sin información» dentro), como dice el pie del mazo de Arte.

.dns_fuentes <- function(cods, labs, cnts, especial = NULL) {
  d <- as.data.frame(lapply(cnts, function(cn) rep(cods, cn)), stringsAsFactors = FALSE)
  ch <- data.frame(list_name = "lk", name = cods, label = labs, stringsAsFactors = FALSE)
  if (!is.null(especial)) ch$especial <- especial
  inst <- list(survey = data.frame(name = names(cnts), type = "select_one lk", list_name = "lk",
                                   label = paste("Afirmación", names(cnts)), stringsAsFactors = FALSE),
               choices = ch, orders_list = NULL,
               listas_ordinales_declaradas = "lk")   # una pregunta sola: la escala la declara el estudio (ADR 0135, punto 5)
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

test_that("el detector: metadata, 90-99 y rótulo de no respuesta; el rango de códigos no decide", {
  cods <- c("1", "2", "3", "4", "5", "9")
  expect_identical(.divergentes_especiales(c(.dns_lik5, "No tengo información suficiente"), cods),
                   c(rep(FALSE, 5), TRUE))
  # U6 (tercera revisión de 31db92ae2): el 9 con un rótulo sustantivo queda como nivel; la salida es choices$especial.
  expect_identical(.divergentes_especiales(c(.dns_lik5, "Otra cosa"), cods), rep(FALSE, 6))
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
  # Estilo resumen: la columna del no sustantivo se rotula «Sin información» (ADR 0135, D3); el recetario conserva el de la lista.
  expect_identical(e$categorias$rotulo, c(.dns_lik5[-3], "Sin información"))
  expect_identical(e$categorias$lado, c("neg", "neg", "pos", "pos", "sin_inf"))
  expect_identical(.dns_espec(src, estilo = "recetario", excluir_opciones = "3")$categorias$rotulo, c(.dns_lik5[-3], "No tengo información suficiente"))
})

test_that("una escala sin no sustantivos sale como antes: reparto posicional sobre todos sus niveles", {
  skip_if_not_installed("ggplot2")
  src <- .dns_fuentes(as.character(1:5), .dns_lik5, list(a = c(3, 5, 7, 10, 15)))
  e <- .dns_espec(src)
  expect_identical(e$categorias$lado, c("neg", "neg", "neu", "pos", "pos"))
  expect_equal(e$total_pos / 10^e$decimales, 63)
})

# ---- Revisión metodológica de 68f9f0e7c (H1, H2, H3, H5) ----------------------

test_that("H1: en una escala, «Ninguna» o «Ninguno» es su extremo, no Sin información (códigos de texto)", {
  skip_if_not_installed("ggplot2")
  src <- .dns_fuentes(c("ninguna", "poca", "algo", "bastante", "mucha"),
                      c("Ninguna confianza", "Poca confianza", "Algo de confianza", "Bastante confianza", "Mucha confianza"),
                      list(a = c(10, 5, 5, 10, 10)))
  e <- .dns_espec(src)
  expect_identical(e$categorias$lado, c("neg", "neg", "neu", "pos", "pos"))
  expect_equal(e$total_pos / 10^e$decimales, 50)
  src2 <- .dns_fuentes(c("ninguno", "pocos", "algunos", "todos"), c("Ninguno", "Pocos", "Algunos", "Todos"), list(a = c(4, 4, 6, 6)))
  expect_identical(.dns_espec(src2)$categorias$lado, c("neg", "neg", "pos", "pos"))
  expect_false(any(.divergentes_especiales(c("Ninguno", "Uno", "Dos o tres", "Más de tres"))))
  # La regla no elige por «Sin información» una pregunta que no la tiene.
  el <- p_barras_divergentes(vars = "b$*", orden = "declarado", regla = list(tipo = "mayor_sin_info", n = 1))
  ind <- .regla_preguntas_indicadores(el, src)$indicadores
  expect_equal(ind$sin_info, 0)
})

test_that("H2: una escala con hueco (1, 2, 4, 5) es una sola escala: dos niveles por lado", {
  skip_if_not_installed("ggplot2")
  expect_false(any(.divergentes_especiales(c("a", "b", "d", "e"), c("1", "2", "4", "5"))))
  src <- .dns_fuentes(c("1", "2", "4", "5"), c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo"),
                      list(a = c(5, 5, 10, 10)))
  e <- .dns_espec(src)
  expect_identical(e$categorias$lado, c("neg", "neg", "pos", "pos"))
  # Detrás del hueco, el 9 sale por su rótulo, no por su código.
  expect_identical(.divergentes_especiales(c("a", "b", "d", "e", "No sé"), c("1", "2", "4", "5", "9")), c(rep(FALSE, 4), TRUE))
  expect_false(any(.divergentes_especiales(c("a", "b", "d", "e", "x"), c("1", "2", "4", "5", "9"))))
})

test_that("H3: la metadata de la lista manda (choices$especial)", {
  skip_if_not_installed("ggplot2")
  cods <- c("1", "2", "3", "4", "5", "9")
  # El 9 declarado de la escala («no»): es un nivel más, no Sin información.
  src <- .dns_fuentes(cods, c(.dns_lik5, "No tengo información suficiente"), list(a = c(2, 3, 5, 10, 10, 10)),
                      especial = c("no", "no", "no", "no", "no", "no"))
  expect_false("sin_inf" %in% .dns_espec(src)$categorias$lado)
  # Un 3 declarado especial dentro del rango sale de los lados.
  src2 <- .dns_fuentes(cods, c(.dns_lik5, "No tengo información suficiente"), list(a = c(2, 3, 5, 10, 10, 10)),
                       especial = c("", "", "si", "", "", ""))
  expect_identical(.dns_espec(src2)$categorias$lado, c("neg", "neg", "sin_inf", "pos", "pos", "sin_inf"))
  expect_identical(.divergentes_especiales(c(.dns_lik5, "x"), cods, sustantivos = "9"), rep(FALSE, 6))
})

test_that("H5: sobre qué es el porcentaje lo dice el aviso al analista; el pie, sólo la base (Gonzalo, 2026-11-09)", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  src <- .dns_fuentes(c("1", "2", "3", "4", "5", "9"), c(.dns_lik5, "No tengo información suficiente"),
                      list(a = c(2, 3, 5, 10, 10, 10)))
  pie_de <- function(el) {
    expect_true(!is.null(.dns_espec(src)))
    out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
    plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala")))
    avisos <- character(0)
    withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                          path_ppt = out, mensajes_progreso = FALSE)),
                        message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
    x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
    sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Base lamina']]")
    list(pie = paste(xml2::xml_text(sp), collapse = " "), avisos = paste(avisos, collapse = "\n"))
  }
  r <- pie_de(p_barras_divergentes(vars = "b$a", estilo = "resumen"))
  expect_match(r$pie, "^Base: 40 b$")
  expect_match(r$avisos, "Porcentaje sobre el total de respondientes.", fixed = TRUE)
  expect_match(pie_de(p_barras_divergentes(vars = "b$a", estilo = "resumen", excluir_opciones = "9"))$avisos,
               "Porcentaje sobre quienes respondieron, sin contar las respuestas excluidas.", fixed = TRUE)
  expect_identical(.dns_espec(src)$nota_porcentaje, "Porcentaje sobre el total de respondientes.")
  expect_null(.dns_espec(src, estilo = "recetario")$nota_porcentaje)
})

# ---- Re-revisión metodológica de afcd0f8e3 (N1, N2) ----------------------------

test_that("N1: una punta de no respuesta es Sin información por su rótulo; una sustantiva suelta es un nivel", {
  skip_if_not_installed("ggplot2")
  f <- .divergentes_especiales
  expect_identical(f(c(paste("N", 1:7), "Prefiero no responder"), c(as.character(1:7), "9")), c(rep(FALSE, 7), TRUE))
  expect_identical(f(c("a", "b", "c", "d", "Sin opinión"), c("1", "2", "3", "4", "6")), c(rep(FALSE, 4), TRUE))
  expect_identical(f(c("a", "b", "c", "No precisa"), c("1", "2", "3", "5")), c(rep(FALSE, 3), TRUE))
  expect_false(any(f(c("a", "b", "c", "d", "e", "Algo sustantivo"), c("1", "2", "3", "4", "5", "7"))))
  expect_false(any(f(c("a", "b", "d", "e"), c("1", "2", "4", "5"))))
  # Los rótulos de no respuesta también se reconocen contiguos a la escala.
  expect_identical(f(c("a", "b", "c", "d", "e", "Prefiero no decir"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
  # Ruta real 1-7 + 9: la lámina y la regla ven Sin información; el acuerdo no suma el 9.
  src <- .dns_fuentes(c(as.character(1:7), "9"), c(paste("Nivel", 1:7), "Prefiero no responder"),
                      list(a = c(2, 2, 2, 4, 4, 3, 3, 20)))
  e <- .dns_espec(src)
  expect_identical(e$categorias$lado[8], "sin_inf")
  el <- p_barras_divergentes(vars = "b$*", orden = "declarado", regla = list(tipo = "mayor_sin_info", n = 1))
  ind <- .regla_preguntas_indicadores(el, src)$indicadores
  expect_gt(ind$sin_info, 0)
  expect_equal(ind$sin_info, 50)
})

test_that("N2: «Otro» no entra a la escala aunque sea contiguo; «Ninguno» sí", {
  skip_if_not_installed("ggplot2")
  expect_identical(.divergentes_especiales(c("a", "b", "c", "d", "e", "Otro"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
  expect_true(.divergentes_especiales("Otros", NA))
  expect_false(.divergentes_especiales("Ninguna confianza", NA))
  src <- .dns_fuentes(as.character(1:6), c(.dns_lik5, "Otro"), list(a = c(2, 3, 5, 10, 10, 10)))
  expect_identical(.dns_espec(src)$categorias$lado, c("neg", "neg", "neu", "pos", "pos", "sin_inf"))
})

# ---- U6: tercera revisión metodológica de 31db92ae2 — el rango de códigos ya no decide ---------------------------

.dns_lados <- function(cods, labs, cnts) {
  e <- .dns_espec(.dns_fuentes(cods, labs, list(a = cnts)))
  list(lado = e$categorias$lado, t2b = e$total_pos / 10^e$decimales)
}

test_that("U6: escalas codificadas de dos en dos quedan enteras y se dibujan", {
  skip_if_not_installed("ggplot2")
  for (cods in list(as.character(c(1, 3, 5, 7, 9)), as.character(c(2, 4, 6, 8, 10)))) {
    expect_false(any(.divergentes_especiales(.dns_lik5, cods)))
    r <- .dns_lados(cods, .dns_lik5, c(2, 3, 5, 10, 10))
    expect_identical(r$lado, c("neg", "neg", "neu", "pos", "pos"))
    expect_equal(r$t2b, 66)   # 33 + 33: el Top Two Box suma segmentos ya redondeados (ADR 0135, supuestos)
  }
  r <- .dns_lados(c("1", "3", "5"), c("Malo", "Regular", "Bueno"), c(5, 5, 10))
  expect_identical(r$lado, c("neg", "neu", "pos"))
  expect_equal(r$t2b, 50)
  expect_identical(.dns_lados(c("1", "2", "3"), c("Bajo", "Medio", "Alto"), c(5, 5, 10))$lado, c("neg", "neu", "pos"))
})

test_that("U6: «Prefiero no responder» en el 0 y «Ninguna de las anteriores» en el 6 son Sin información", {
  skip_if_not_installed("ggplot2")
  r <- .dns_lados(as.character(0:5), c("Prefiero no responder", .dns_lik5), c(10, 2, 3, 5, 10, 10))
  expect_identical(r$lado, c("sin_inf", "neg", "neg", "neu", "pos", "pos"))
  expect_equal(r$t2b, 50)
  r <- .dns_lados(as.character(1:6), c(.dns_lik5, "Ninguna de las anteriores"), c(2, 3, 5, 10, 10, 10))
  expect_identical(r$lado, c("neg", "neg", "neu", "pos", "pos", "sin_inf"))
  expect_equal(r$t2b, 50)
  # «Ninguno» como nivel y «Ninguna confianza» siguen en la escala; «Otras veces» no es «Otro».
  expect_false(any(.divergentes_especiales(c("Ninguno", "Uno", "Dos", "Tres"), as.character(0:3))))
  expect_false(.divergentes_especiales("Ninguna confianza", "1"))
  expect_false(.divergentes_especiales("Otras veces", "6"))
  expect_true(.divergentes_especiales("Otro", "6"))
})

test_that("U6: sin n_negativas declarado el reparto parte las sustantivas por la mitad (1-7 + 9, 0-10 + 99)", {
  skip_if_not_installed("ggplot2")
  expect_null(p_barras_divergentes(vars = "b$a")$overrides$n_negativas)
  r <- .dns_lados(c(as.character(1:7), "9"), c(paste("Nivel", 1:7), "Prefiero no responder"), c(2, 2, 2, 4, 4, 3, 3, 20))
  expect_identical(r$lado, c(rep("neg", 3), "neu", rep("pos", 3), "sin_inf"))
  r <- .dns_lados(c(as.character(0:10), "99"), c(as.character(0:10), "No responde"), c(rep(2, 11), 8))
  expect_identical(r$lado, c(rep("neg", 5), "neu", rep("pos", 5), "sin_inf"))
  # 4 y 5 puntos quedan como antes (2 negativas); declarado, manda lo declarado.
  expect_identical(.dns_lados(as.character(1:4), .dns_lik5[-3], c(2, 3, 5, 10))$lado, c("neg", "neg", "pos", "pos"))
  expect_identical(.dns_lados(as.character(1:5), .dns_lik5, c(2, 3, 5, 10, 10))$lado, c("neg", "neg", "neu", "pos", "pos"))
  e <- .dns_espec(.dns_fuentes(as.character(1:5), .dns_lik5, list(a = c(2, 3, 5, 10, 10))), n_negativas = 1L, incluir_neutro = FALSE)
  expect_identical(e$categorias$lado, c("neg", "pos", "pos", "pos", "pos"))
  expect_identical(.ola4_n_negativas(NULL, 7L), 3L); expect_identical(.ola4_n_negativas(NULL, 3L), 1L)
  expect_identical(.ola4_n_negativas(2L, 7L), 2L)
})

test_that("U6: la regla de las láminas de resumen usa el mismo detector (0 «Prefiero no responder», 1,3,5,7,9)", {
  inst <- list(survey = data.frame(name = "a", type = "select_one lk", list_name = "lk", label = "A", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = as.character(0:5), label = c("Prefiero no responder", .dns_lik5),
                                    stringsAsFactors = FALSE))
  expect_identical(.regla_preguntas_escala(inst, "a")$no_sustantivo, c(TRUE, rep(FALSE, 5)))
  inst$choices$name <- c("99", as.character(c(1, 3, 5, 7, 9)))
  inst$choices$label <- c("No responde", .dns_lik5)
  expect_identical(.regla_preguntas_escala(inst, "a")$no_sustantivo, c(TRUE, rep(FALSE, 5)))
})

# ---- Cuarta revisión metodológica de 2130f7e54 (H1 regla de hermanos, H2 formas de no respuesta) ----------------

test_that("H1: una raíz ambigua es nivel si otra opción de la lista la contiene", {
  skip_if_not_installed("ggplot2")
  f <- .divergentes_especiales
  rech <- c("Rechazo totalmente", "Rechazo", "Ni acepto ni rechazo", "Acepto", "Acepto totalmente")
  expect_false(any(f(rech, as.character(1:5))))
  expect_identical(.dns_lados(as.character(1:5), rech, c(2, 2, 1, 1, 2))$lado, c("neg", "neg", "neu", "pos", "pos"))
  con <- c("No conoce nada", "Conoce poco", "Conoce algo", "Conoce bien")
  expect_identical(.dns_lados(as.character(1:4), con, c(4, 1, 1, 2))$lado, c("neg", "neg", "pos", "pos"))
  expect_false(any(f(c("No conoce", "Conoce poco", "Conoce algo", "Conoce bien"), as.character(1:4))))
  expect_false(any(f(c("Desconozco", "Conozco poco", "Conozco algo", "Conozco mucho"), as.character(1:4))))
  expect_false(any(f(c("No uso", "Uso poco", "Uso bastante", "Uso mucho"), as.character(1:4))))
  expect_false(any(f(c("No he participado", "Una vez", "Algunas veces", "Muchas veces"), as.character(1:4))))
  expect_false(any(f(c("No se cumple", "Se cumple poco", "Se cumple bastante", "Se cumple totalmente"), as.character(1:4))))
  # Sueltas, sin hermana: siguen siendo Sin información.
  expect_identical(f(c(.dns_lik5, "Rechazo"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
  expect_identical(f(c(.dns_lik5, "Desconoce"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
  expect_identical(f(c(.dns_lik5, "No conoce"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
  expect_identical(f(c(.dns_lik5, "Rechazo a responder"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
  expect_identical(f(c(.dns_lik5, "No he acudido a esos horarios"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
})

test_that("H2: NS, NR, «No opino», «No tengo opinión», «Sin respuesta» y «(No leer) No sabe» son Sin información", {
  f <- .divergentes_especiales
  for (r in c("NS", "NR", "No opino", "No tengo opinión", "Sin respuesta", "(No leer) No sabe", "No sabe/No opina", "Ns/Nc")) {
    expect_identical(f(c(.dns_lik5, r), as.character(1:6)), c(rep(FALSE, 5), TRUE), label = r)
  }
  # «No sé» suelto sí; «No se cumple» como nivel no.
  expect_true(f("No sé", "6"))
  expect_false(f("No se cumple", "1"))
})

# ---- Quinta revisión metodológica de 53c7a085e (H3 mitad negativa, H4 hermanas que ya son no respuesta) ----------

test_that("H3: una raíz ambigua al final de una escala positiva es Sin información", {
  skip_if_not_installed("ggplot2")
  f <- .divergentes_especiales
  frec <- c("Nunca", "Pocas veces", "A veces", "Siempre")
  for (x in c("No he usado el servicio", "No he participado", "No he acudido")) {
    expect_identical(f(c(frec, x), as.character(1:5)), c(rep(FALSE, 4), TRUE), label = x)
  }
  expect_identical(.dns_lados(as.character(1:5), c(frec, "No he usado el servicio"), c(2, 2, 3, 3, 10))$lado,
                   c("neg", "neg", "pos", "pos", "sin_inf"))
  expect_identical(f(c("Uso poco", "Uso bastante", "Uso mucho", "No uso"), as.character(1:4)), c(FALSE, FALSE, FALSE, TRUE))
  expect_identical(f(c("No conoce nada", "Conoce poco", "Conoce algo", "Conoce bien", "Desconoce"), as.character(1:5)),
                   c(rep(FALSE, 4), TRUE))
  # Los cuatro casos de H1 siguen enteros, también con la lista invertida (positivo → negativo).
  h1 <- list(c("Rechazo totalmente", "Rechazo", "Ni acepto ni rechazo", "Acepto", "Acepto totalmente"),
             c("Desconozco", "Conozco poco", "Conozco algo", "Conozco mucho"),
             c("No uso", "Uso poco", "Uso bastante", "Uso mucho"),
             c("No he participado", "Una vez", "Algunas veces", "Muchas veces"))
  for (x in h1) {
    expect_false(any(f(x, as.character(seq_along(x)))), label = x[1])
    expect_false(any(f(rev(x), as.character(seq_along(x)), direccion = "positivo_negativo")), label = paste("inv", x[1]))
  }
  # La lámina invertida: la tabla decide con la dirección y la especificación la respeta.
  e <- .dns_espec(.dns_fuentes(as.character(1:4), rev(h1[[3]]), list(a = c(5, 5, 5, 5))), direccion_escala = "positivo_negativo")
  expect_false("sin_inf" %in% e$categorias$lado)
})

test_that("H4: una forma que ya es no respuesta no salva a una raíz ambigua", {
  expect_identical(.divergentes_especiales(c(.dns_lik5, "Rechaza responder", "Rechazo"), as.character(1:7)), c(rep(FALSE, 5), TRUE, TRUE))
})

test_that("«Acepto» es hermana de «Rechazo»: la escala de tres puntos queda entera", {
  skip_if_not_installed("ggplot2")
  x <- c("Rechazo", "Indiferente", "Acepto")
  expect_false(any(.divergentes_especiales(x, as.character(1:3))))
  expect_identical(.dns_lados(as.character(1:3), x, c(5, 5, 10))$lado, c("neg", "neu", "pos"))
  # Suelta al final de una likert sigue siendo Sin información.
  expect_identical(.divergentes_especiales(c(.dns_lik5, "Rechazo"), as.character(1:6)), c(rep(FALSE, 5), TRUE))
})
