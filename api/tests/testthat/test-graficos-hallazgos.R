source("setup-load-all.R")

# Hallazgos clave (especificación CCSS del 2026-11-04, §2): la cifra coincide con la de la lámina de su pregunta, lleva
# el intervalo de 95% con el diseño (el de la suma en un Top Two Box), dice su base si difiere, la comparación
# automática es la tarjeta de mayor prioridad frente al resto, el texto escrito a mano se avisa (y si contradice la
# prueba, como contradicción), el gráfico de apoyo solo dibuja grupos comparables y las láminas nativas salen en sus
# dos modos. Fixture sintético: 40 aulas de 10 casos.

# ---- Fixture ---------------------------------------------------------------------------------------------------------

# «q» depende del área; «t» (Sí/No) sube con el nivel; «h» solo la responden quienes trabajan; «e» (escala de 4) es
# plana; el nivel 10 tiene 2 aulas (no comparable).
.hz_base <- function() {
  set.seed(2026)
  aula <- rep(sprintf("a%02d", 1:40), each = 10)
  na <- as.integer(sub("a", "", aula))
  area <- ifelse(na <= 20, "1", "2")
  niv <- ifelse(na >= 39, "10", c("6", "7", "8", "9")[((na - 1L) %% 4L) + 1L])
  sexo <- rep(c("1", "1", "2", "2"), 100)
  z <- rep(c("1", "2"), 200)   # exactamente la mitad en cada aula, área, nivel y sexo: ninguna diferencia
  q <- ifelse(stats::runif(400) < ifelse(area == "1", 0.7, 0.2), "1", "2")
  t <- ifelse(stats::runif(400) < c(`6` = 0.2, `7` = 0.3, `8` = 0.35, `9` = 0.8, `10` = 0.5)[niv], "1", "2")
  h <- ifelse(t == "1", sample(c("1", "2", "3"), 400, replace = TRUE), NA_character_)
  e <- sample(c("1", "2", "3", "4"), 400, replace = TRUE)
  data.frame(aula = aula, area = area, niv = niv, sexo = sexo, q = q, t = t, h = h, e = e, z = z, stringsAsFactors = FALSE)
}
.hz_inst <- function() list(
  survey = data.frame(name = c("area", "niv", "sexo", "q", "t", "h", "e", "z"),
                      type = c("select_one ar", "select_one nv", "select_one sx", "select_one qq", "select_one sn", "select_one hh", "select_one ee", "select_one qq"),
                      list_name = c("ar", "nv", "sx", "qq", "sn", "hh", "ee", "qq"),
                      label = c("Área", "Nivel", "Sexo", "Pregunta q", "¿Trabajas?", "Dedicación", "Escala e", "Pregunta z"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("ar", "ar", rep("nv", 5), "sx", "sx", "qq", "qq", "sn", "sn", "hh", "hh", "hh", rep("ee", 4)),
                       name = c("1", "2", "6", "7", "8", "9", "10", "1", "2", "1", "2", "1", "2", "1", "2", "3", "1", "2", "3", "4"),
                       label = c("Economía y Finanzas", "Ciencias políticas y sociales", "Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9",
                                 "Nivel 10", "Mujer", "Hombre", "Sí", "No", "Sí", "No", "Tiempo completo", "Medio tiempo", "Por horas",
                                 "Nada", "Poco", "Bastante", "Mucho"), stringsAsFactors = FALSE),
  orders_list = list(
    q = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Pregunta q"),
    z = list(names = c("1", "2"), labels = c("Sí", "No"), label = "Pregunta z"),
    t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "¿Trabajas?"),
    h = list(names = c("1", "2", "3"), labels = c("Tiempo completo", "Medio tiempo", "Por horas"), label = "Dedicación"),
    e = list(names = c("1", "2", "3", "4"), labels = c("Nada", "Poco", "Bastante", "Mucho"), label = "Escala e")))
.hz_regla <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  r
}
.hz_fuente <- function(d = .hz_base()) .sig_fuente(d, .hz_inst())
.hz_sig <- function() list(regla = .hz_regla(), familia = NULL, m = 500L, cruces = c("area", "niv", "sexo"))
.hz_rot <- list(area = "Área", niv = "Nivel", sexo = "Sexo")
.hz_cifras <- function() list(
  list(var = "q", fila = "Sí", texto = "dice que sí a q"),
  list(var = "t", fila = "Sí", texto = "trabaja de forma remunerada"),
  list(var = "e", top2box = c("Bastante", "Mucho"), texto = "valora e como bastante o mucho"),
  list(var = "h", filas = c("Tiempo completo", "Medio tiempo"), texto = "de quienes trabajan lo hace medio tiempo o más"))
.hz_modelo <- function(...) {
  el <- p_slide_hallazgos(cifras = .hz_cifras(), rotulos = .hz_rot, cortos = list(`Economía y Finanzas` = "Econ. y Fin."), ...)$slots$plot
  suppressMessages(.halla_modelo(el, .hz_fuente(), .hz_sig()))
}
.hz_kpi <- function(espec, texto) espec$kpis[[which(vapply(espec$kpis, `[[`, "", "texto") == texto)]]

# ---- La cifra --------------------------------------------------------------------------------------------------------

test_that("la cifra es la proporción de la fila sobre su base, la misma que cuenta la tabla de frecuencias", {
  espec <- .hz_modelo()
  d <- .hz_base()
  k <- .hz_kpi(espec, "trabaja de forma remunerada")
  expect_equal(k$valor, 100 * mean(d$t == "1"))
  expect_identical(k$cifra, .tarjetas_pct(100 * mean(d$t == "1")))
  kh <- .hz_kpi(espec, "de quienes trabajan lo hace medio tiempo o más")
  expect_equal(kh$valor, 100 * mean(d$h[!is.na(d$h)] %in% c("1", "2")))
  expect_identical(kh$n, sum(!is.na(d$h)))
  expect_identical(kh$base, paste0("Base de ", sum(!is.na(d$h))))   # la base difiere de la lámina: se dice
  expect_null(k$base)
})

test_that("el intervalo es el del diseño por aula; en una suma de filas, el de la suma", {
  espec <- .hz_modelo()
  d <- .hz_base()
  k <- .hz_kpi(espec, "valora e como bastante o mucho")
  y <- as.numeric(d$e %in% c("3", "4"))
  iv <- .intervalo_diseno(y, cluster = d$aula)
  expect_equal(k$intervalo$inferior, iv$inferior); expect_equal(k$intervalo$superior, iv$superior)
  expect_identical(k$intervalo_texto, .intervalo_texto(iv))
  i3 <- .intervalo_diseno(as.numeric(d$e == "3"), d$aula); i4 <- .intervalo_diseno(as.numeric(d$e == "4"), d$aula)
  expect_lt(iv$superior - iv$inferior, (i3$superior - i3$inferior) + (i4$superior - i4$inferior))
})

# ---- La comparación --------------------------------------------------------------------------------------------------

test_that("auto: con dos grupos van los dos con ▲ y ▼; con más, el grupo que más difiere y la cifra del resto", {
  espec <- .hz_modelo()
  kq <- .hz_kpi(espec, "dice que sí a q")
  expect_identical(kq$comparacion$estado, "diferencia")
  expect_identical(kq$comparacion$cruce, "area")
  expect_identical(vapply(kq$comparacion$partes, `[[`, "", "dir"), c("up", "down"))
  expect_match(kq$comparacion$partes[[1]]$texto, "^Econ\\. y Fin\\. [0-9]+%$")
  kt <- .hz_kpi(espec, "trabaja de forma remunerada")
  expect_identical(kt$comparacion$cruce, "niv")
  expect_length(kt$comparacion$partes, 1L)
  expect_match(kt$comparacion$partes[[1]]$texto, "^Nivel 9: [0-9]+%$")
  expect_match(kt$comparacion$cola, "^frente al [0-9]+% del resto$")
})

test_that("sin diferencias dice por qué cruces se probó; sin cruces probados no dice nada", {
  el <- p_slide_hallazgos(cifras = list(list(var = "z", fila = "Sí", texto = "dice que sí a z")), rotulos = .hz_rot)$slots$plot
  kz <- suppressMessages(.halla_modelo(el, .hz_fuente(), .hz_sig()))$kpis[[1]]
  expect_identical(kz$comparacion$estado, "sin_diferencias")
  expect_identical(kz$comparacion$partes[[1]]$texto, "Sin diferencias por área, nivel ni sexo")
  el <- p_slide_hallazgos(cifras = list(list(var = "e", top2box = c("Bastante", "Mucho"), texto = "valora e")), cruces = "no_existe")$slots$plot
  sig <- .hz_sig(); sig$cruces <- character(0)
  espec0 <- suppressMessages(.halla_modelo(el, .hz_fuente(), sig))
  expect_null(espec0$kpis[[1]]$comparacion)
  expect_identical(.halla_lista_ni(c("Área", "Nivel", "Sexo")), "área, nivel ni sexo")
})

test_that("una comparación escrita a mano no se verifica y se avisa; si contradice la prueba, se avisa como contradicción", {
  cifra <- function(comp) list(list(var = "q", fila = "Sí", texto = "dice que sí a q", comparacion = comp))
  el <- p_slide_hallazgos(cifras = cifra("84% si se suma «poco»"), rotulos = .hz_rot)$slots$plot
  expect_message(espec <- .halla_modelo(el, .hz_fuente(), .hz_sig()), "el motor no la verifica")
  expect_identical(espec$kpis[[1]]$comparacion$estado, "manual")
  el2 <- p_slide_hallazgos(cifras = cifra("Sin diferencias entre grupos"), rotulos = .hz_rot)$slots$plot
  expect_message(.halla_modelo(el2, .hz_fuente(), .hz_sig()), "contradice la prueba")
  el3 <- p_slide_hallazgos(cifras = list(list(var = "q", fila = "Sí", texto = "dice que sí", comparacion = FALSE)))$slots$plot
  expect_null(suppressMessages(.halla_modelo(el3, .hz_fuente(), .hz_sig()))$kpis[[1]]$comparacion)
})

test_that("una cifra sin texto toma uno de la fila y avisa; un índice sin definir se avisa", {
  el <- p_slide_hallazgos(cifras = list(list(var = "q", fila = "Sí")))$slots$plot
  expect_message(espec <- .halla_modelo(el, .hz_fuente(), .hz_sig()), "no tiene texto")
  expect_identical(espec$kpis[[1]]$texto, "respondió «Sí»")
  el2 <- p_slide_hallazgos(cifras = list(list(var = "q", fila = "Sí", texto = "índice de q")))$slots$plot
  expect_message(.halla_modelo(el2, .hz_fuente(), .hz_sig()), "índice")
})

# ---- Modos y gráfico de apoyo ------------------------------------------------------------------------------------------

test_that("el modo «cifras» admite hasta seis y el modo con gráficos hasta tres; lo demás se avisa y no se dibuja", {
  siete <- rep(list(list(var = "q", fila = "Sí", texto = "q")), 7)
  el <- p_slide_hallazgos(cifras = siete)$slots$plot
  expect_message(espec <- .halla_modelo(el, .hz_fuente(), .hz_sig()), "hasta 6 cifras")
  expect_length(espec$kpis, 6L)
  el2 <- p_slide_hallazgos(cifras = siete[1:4], modo = "cifras_con_graficos")$slots$plot
  expect_message(espec2 <- .halla_modelo(el2, .hz_fuente(), .hz_sig()), "hasta 3 cifras")
  expect_length(espec2$kpis, 3L)
  expect_error(p_slide_hallazgos(), "al menos una cifra")
})

test_that("el gráfico por cruce solo dibuja grupos comparables, con la marca del que difiere y la línea del total", {
  cifras <- list(list(var = "t", fila = "Sí", texto = "trabaja",
                      grafico = list(graficador = "p_barras_agrupadas", args = list(var = "t", cruces = "niv"))))
  el <- p_slide_hallazgos(cifras = cifras, modo = "cifras_con_graficos", rotulos = .hz_rot)$slots$plot
  espec <- suppressMessages(.halla_modelo(el, .hz_fuente(), .hz_sig()))
  g <- espec$kpis[[1]]$grafico
  expect_false("Nivel 10" %in% g$filas$rotulo)          # 20 casos en 2 aulas: no se compara ni se dibuja
  expect_identical(g$n_fuera, 1L)
  expect_match(g$notas, "Nivel 10")
  expect_identical(g$filas$dir[g$filas$rotulo == "Nivel 9"], "up")
  expect_equal(g$total, espec$kpis[[1]]$valor)
  expect_match(g$base, "^Base: 400\\. Casos por nivel: ")
  expect_match(espec$nota, "No se muestran los grupos", fixed = TRUE)
  malo <- list(list(var = "t", fila = "Sí", texto = "t", grafico = list(graficador = "p_histograma", args = list(var = "t"))))
  el2 <- p_slide_hallazgos(cifras = malo, modo = "cifras_con_graficos")$slots$plot
  expect_message(espec2 <- .halla_modelo(el2, .hz_fuente(), .hz_sig()), "familia «categorías»")
  expect_null(espec2$kpis[[1]]$grafico)
})

test_that("el gráfico de ancho completo lleva el intervalo de cada opción y la nota de las que difieren", {
  el <- p_slide_hallazgos(cifras = .hz_cifras()[1:2], modo = "cifras_con_graficos", rotulos = .hz_rot,
                          grafico_ancho = list(graficador = "p_barras_agrupadas", args = list(var = "h")))$slots$plot
  espec <- suppressMessages(.halla_modelo(el, .hz_fuente(), .hz_sig()))
  g <- espec$grafico_ancho
  expect_setequal(g$filas$rotulo, c("Tiempo completo", "Medio tiempo", "Por horas"))
  expect_true(all(g$filas$inferior <= g$filas$p & g$filas$p <= g$filas$superior))
  expect_type(g$nota_lado, "character")
  expect_null(espec$kpis[[1]]$grafico)   # con gráfico ancho, las cifras van sin gráfico propio
})

test_that("el gráfico de apoyo sin cruce va en el orden del instrumento; mayor_menor lo ordena por frecuencia", {
  # La base trae «e» con los códigos en otro orden: la escala no debe leerse desarmada (CCSS v7.6, hallazgos 2).
  d <- .hz_base(); d$e[1:3] <- c("4", "3", "2")
  apoyo <- function(ov = NULL) {
    a <- list(var = "e"); if (!is.null(ov)) a$overrides <- ov
    el <- p_slide_hallazgos(cifras = .hz_cifras()[1:2], modo = "cifras_con_graficos", rotulos = .hz_rot,
                            grafico_ancho = list(graficador = "p_barras_agrupadas", args = a))$slots$plot
    suppressMessages(.halla_modelo(el, .hz_fuente(d), .hz_sig()))$grafico_ancho$filas
  }
  expect_identical(apoyo()$rotulo, c("Nada", "Poco", "Bastante", "Mucho"))
  f <- apoyo(list(orden_barras = "mayor_menor"))
  expect_identical(f$p, sort(f$p, decreasing = TRUE))
})

# ---- Artefactos ------------------------------------------------------------------------------------------------------

.hz_render <- function(slide) {
  old <- options(prosecnur.sig_informe = .hz_sig()); on.exit(options(old), add = TRUE)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .hz_base(), instrumento = .hz_inst(), plan = list(a = slide), path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  list(nombres = xml2::xml_attr(xml2::xml_find_all(xml, "//p:cNvPr"), "name"), textos = xml2::xml_text(xml2::xml_find_all(xml, "//a:t")))
}

test_that("PPT, modo «cifras»: tarjetas con la cifra, la barra del intervalo, la comparación, la leyenda, la nota y la base", {
  skip_if_not_installed("officer")
  r <- .hz_render(p_slide_hallazgos(cifras = .hz_cifras(), titulo = "Hallazgos clave", rotulos = .hz_rot, base = "Base: 400 casos."))
  expect_true(all(c("prosecnur:grafico:hallazgos", "hallazgo:tarjeta", "hallazgo:cifra", "hallazgo:barra:intervalo", "hallazgo:barra:cifra",
                    "hallazgo:comparacion", "prosecnur:leyenda_diferencias", "Nota significancia", "Base lamina") %in% r$nombres))
  expect_true(any(grepl("con 95% de confianza$", r$textos)))
  expect_true("Base: 400 casos." %in% r$textos)
  expect_false(any(grepl("Fuente", r$textos, fixed = TRUE)))
})

test_that("PPT, modo con gráficos: el gráfico de apoyo con su línea de total; y la variante de ancho completo", {
  skip_if_not_installed("officer")
  cifras <- list(list(var = "t", fila = "Sí", texto = "trabaja", grafico = list(graficador = "p_barras_agrupadas", args = list(var = "t", cruces = "niv"),
                                                                               titulo = "Trabaja, según nivel")))
  r <- .hz_render(p_slide_hallazgos(cifras = cifras, modo = "cifras_con_graficos", etiqueta = "Capítulo 4", titulo = "Experiencia laboral",
                                    rotulos = .hz_rot))
  expect_true(all(c("hallazgo:grafico:barra", "hallazgo:grafico:barra:difiere", "hallazgo:grafico:total", "hallazgo:grafico:titulo") %in% r$nombres))
  expect_true(any(grepl("^Total [0-9]+%$", r$textos)))
  expect_true("CAPÍTULO 4" %in% r$textos)
  r2 <- .hz_render(p_slide_hallazgos(cifras = .hz_cifras()[1:3], modo = "cifras_con_graficos", titulo = "Experiencia laboral", rotulos = .hz_rot,
                                     grafico_ancho = list(graficador = "p_barras_agrupadas", args = list(var = "h"), titulo = "Dedicación")))
  expect_true(all(c("hallazgo:grafico:intervalo", "hallazgo:grafico:punto", "hallazgo:grafico:eje", "hallazgo:grafico:nota") %in% r2$nombres))
})

test_that("sin motor nativo y en el Word va el respaldo en ggplot con la espec; el registro declara el tipo", {
  p <- .halla_ggplot(.hz_modelo())
  expect_identical(attr(p, "pulso_espec")$tipo, "hallazgos")
  expect_identical(attr(.word_grafico(p), "renderer"), "marco")
  expect_true(.lam_dif_es(p))
  expect_true("p_slide_hallazgos" %in% .slide_names())
  expect_identical(.SLIDES_META$p_slide_hallazgos$render_key, "hallazgos")
  s <- p_slide_hallazgos(cifras = .hz_cifras(), etiqueta = "Capítulo 4")
  expect_identical(s$.slide_type, "slide_1")
  expect_identical(s$meta$antetitulo, "Capítulo 4")
})

# ---- Resumen ejecutivo (modos «resumen» y «titulares»; revisión del PPT v7.11, ítem 2) --------------------------------

.hz_caps <- function() list(
  list(titulo = "Capítulo uno", cifras = list(list(var = "q", fila = "Sí", texto = "dice que sí a q"),
                                              list(var = "z", fila = "Sí", texto = "dice que sí a z"))),
  list(titulo = "Capítulo dos", titular = "El trabajo crece con el nivel",
       cifras = list(list(var = "t", fila = "Sí", texto = "trabaja de forma remunerada"),
                     list(var = "h", filas = c("Tiempo completo", "Medio tiempo"), texto = "de quienes trabajan lo hace medio tiempo o más",
                          base_rotulo = "que trabajan"))))
.hz_resumen <- function(..., plan = list()) {
  el <- p_slide_hallazgos(rotulos = .hz_rot, cortos = list(`Economía y Finanzas` = "Econ. y Fin."), ...)$slots$plot
  suppressMessages(.halla_modelo(el, .hz_fuente(), .hz_sig(), plan))
}

test_that("resumen: el antetítulo es «Resumen ejecutivo» y la selección manual pide capítulos", {
  s <- p_slide_hallazgos(modo = "resumen", capitulos = .hz_caps())
  expect_identical(s$meta$antetitulo, "Resumen ejecutivo")
  expect_identical(s$title, "Principales hallazgos")
  expect_error(p_slide_hallazgos(modo = "resumen"), "escribe al menos un capítulo con un hallazgo completo", fixed = TRUE)
  expect_silent(p_slide_hallazgos(modo = "resumen", seleccion = "auto"))
  modos <- vapply(Filter(function(a) identical(a$name, "modo"), .SLIDES_META$p_slide_hallazgos$args)[[1]]$choices, `[[`, "", "value")
  expect_true(all(c("resumen", "titulares") %in% modos))
})

test_that("resumen: cada hallazgo es la cifra de su pregunta con su intervalo, su base si difiere y su diferencia principal", {
  e <- .hz_resumen(modo = "resumen", capitulos = .hz_caps())
  expect_identical(e$modo, "resumen")
  expect_length(e$paginas, 1L)
  expect_identical(vapply(e$paginas[[1]], `[[`, "", "titulo"), c("Capítulo uno", "Capítulo dos"))
  e0 <- .hz_modelo()
  q <- e$paginas[[1]][[1]]$kpis[[1]]
  expect_identical(q$cifra, .hz_kpi(e0, "dice que sí a q")$cifra)
  expect_identical(q$comparacion$estado, "diferencia")
  expect_identical(q$comparacion$cruce, "area")
  z <- e$paginas[[1]][[1]]$kpis[[2]]
  expect_identical(z$comparacion$estado, "sin_diferencias")
  h <- e$paginas[[1]][[2]]$kpis[[2]]
  expect_match(h$base, "^Base de [0-9]+ que trabajan$")
  expect_match(e$nota, "Cómo leer las diferencias entre grupos", fixed = TRUE)
  expect_false(grepl("Benjamini|Rao-Scott", e$nota))
  expect_length(e$kpis, 4L)   # el respaldo en ggplot (Word) lee las cifras aplanadas
  expect_s3_class(.halla_ggplot(e), "ggplot")
})

test_that("resumen: «También» sólo nombra un cruce distinto del de la diferencia principal y se apaga con `tambien = FALSE`", {
  ev <- list(celdas = data.frame(cruce = c("area", "area", "niv", "niv", "niv"), codigo = c("1", "2", "6", "7", "9"),
                                 etiqueta = c("Economía y Finanzas", "Ciencias", "Nivel 6", "Nivel 7", "Nivel 9"),
                                 estado = c("dif", "dif", "igual", "igual", "dif"), valor = c(20, -20, NA, NA, 17), dir = c("up", "down", NA, NA, "up"),
                                 fragil = c(FALSE, FALSE, NA, NA, FALSE), p = c(48, 23, 30, 31, 48), p_resto = c(23, 48, 33, 33, 31),
                                 n = 100, conglomerados = 10L, stringsAsFactors = FALSE), probados = c("area", "niv"))
  cx <- list(cortos = c(`Economía y Finanzas` = "Econ. y Fin."), rotulos = .hz_rot)
  auto <- .halla_comparacion_auto(ev, cx)
  t <- .halla_tambien(ev, auto, cx)
  expect_identical(auto$cruce, "area")
  expect_identical(t$texto, "Nivel 9 48%"); expect_identical(t$dir, "up"); expect_identical(t$cruce, "niv")
  ev$celdas$estado[5] <- "igual"
  expect_null(.halla_tambien(ev, auto, cx))
  e <- .hz_resumen(modo = "resumen", capitulos = .hz_caps(), tambien = FALSE)
  expect_true(all(vapply(e$kpis, function(k) is.null(k$tambien), TRUE)))
})

test_that("resumen: la paginación llega a 8 hallazgos y 4 capítulos por lámina y nunca parte un capítulo", {
  cap <- function(n, i) list(titulo = paste("C", i), kpis = replicate(n, list(), simplify = FALSE))
  p <- .halla_res_paginar(list(cap(3, 1), cap(3, 2), cap(3, 3), cap(2, 4)), 8L, 4L)
  expect_identical(lengths(lapply(p, function(pg) vapply(pg, `[[`, "", "titulo"))), c(2L, 2L))
  p2 <- .halla_res_paginar(lapply(1:5, function(i) cap(1, i)), 8L, 4L)
  expect_identical(vapply(p2, length, 0L), c(4L, 1L))
  expect_true(all(vapply(p, function(pg) sum(vapply(pg, function(c) length(c$kpis), 0L)), 0L) <= 8L))
})

test_that("resumen automático: por capítulo, la diferencia más fuerte y la cifra más rotunda sin diferencia", {
  plan <- list(
    p_slide_seccion("Uno"),
    p_slide_1_grafico(p_barras_agrupadas(var = "q"), titulo = "Pregunta q"),
    p_slide_1_grafico(p_barras_agrupadas(var = "z"), titulo = "Pregunta z"),
    p_slide_seccion("Dos"),
    p_slide_1_grafico(p_barras_agrupadas(var = "t"), titulo = "¿Trabajas?"))
  e <- .hz_resumen(modo = "resumen", seleccion = "auto", plan = plan)
  caps <- e$paginas[[1]]
  expect_identical(vapply(caps, `[[`, "", "titulo"), c("Uno", "Dos"))
  uno <- caps[[1]]$kpis
  expect_identical(uno[[1]]$var, "q"); expect_identical(uno[[1]]$comparacion$estado, "diferencia")   # la diferencia
  expect_identical(uno[[2]]$var, "z"); expect_identical(uno[[2]]$comparacion$estado, "sin_diferencias")   # la rotunda sin diferencia
  expect_true(all(vapply(e$kpis, function(k) k$fila != "No", TRUE)))   # de la dicotómica, la opción principal
})

# Revisión del PPT v7.23, ítem 14 (Gonzalo: «no trates al usuario de tonto»): sin encabezados CIFRA, HALLAZGO y DIFERENCIA
# PRINCIPAL, sin la nota al pie y sin la línea del intervalo. Antes este test los exigía.
test_that("PPT, modo «resumen»: tabla por capítulo con cifra, frase, pastillas, leyenda y base (sin encabezados, nota ni intervalo)", {
  skip_if_not_installed("officer")
  r <- .hz_render(p_slide_hallazgos(modo = "resumen", capitulos = .hz_caps(), titulo = "Quiénes son", rotulos = .hz_rot, base = "Base: 400 casos."))
  expect_true(all(c("prosecnur:grafico:resumen_ejecutivo", "resumen_ejecutivo:capitulo", "resumen_ejecutivo:cifra", "resumen_ejecutivo:hallazgo",
                    "resumen_ejecutivo:pastilla:texto", "resumen_ejecutivo:sin_diferencias",
                    "prosecnur:leyenda_diferencias", "Base lamina") %in% r$nombres))
  expect_false(any(c("Nota significancia", "resumen_ejecutivo:encabezado", "resumen_ejecutivo:intervalo") %in% r$nombres))
  expect_true(all(c("RESUMEN EJECUTIVO", "CAPÍTULO UNO", "dice que sí a q") %in% r$textos))
  expect_false(any(c("CIFRA", "HALLAZGO", "DIFERENCIA PRINCIPAL FRENTE AL RESTO") %in% r$textos))
  expect_false(any(grepl("Intervalo de", r$textos, fixed = TRUE)))
  expect_true(any(grepl("^Economía y Finanzas [0-9]+%$", r$textos)))   # sin `cortos`, el rótulo entero
})

test_that("PPT, modo «titulares»: un titular por capítulo, con la frase debajo", {
  skip_if_not_installed("officer")
  r <- .hz_render(p_slide_hallazgos(modo = "titulares", capitulos = .hz_caps(), titulo = "Lo principal", rotulos = .hz_rot))
  expect_true("El trabajo crece con el nivel" %in% r$textos)
  expect_true("resumen_ejecutivo:titular" %in% r$nombres)
  expect_equal(sum(r$nombres == "resumen_ejecutivo:cifra"), 2L)   # uno por capítulo
})

test_that("resumen en el Word: tabla propia con su alto (no los puntos del respaldo) y se dibuja sin error en un dispositivo", {
  e <- .hz_resumen(modo = "resumen", capitulos = .hz_caps())
  g <- .halla_ggplot(e)
  expect_true(is.finite(attr(g, "alto_word")) && attr(g, "alto_word") > 1)   # el marco del Word lee `alto_word`
  tx <- unlist(lapply(suppressWarnings(ggplot2::ggplot_build(g))$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
  expect_true("CAPÍTULO UNO" %in% tx)
  # v7.23, ítem 14 (paridad con la lámina): sin encabezados de columna ni intervalo.
  expect_false(any(c("CIFRA", "HALLAZGO") %in% tx)); expect_false(any(grepl("Intervalo de", tx, fixed = TRUE)))
  f <- tempfile(fileext = ".png")
  expect_silent(suppressWarnings(ggplot2::ggsave(f, g, width = 6.27, height = attr(g, "alto_word"), dpi = 60, device = ragg::agg_png)))
  expect_true(file.exists(f))
})

# ---- Revisión del PPT v7.23 de CCSS, lámina 57 (ítem 14) -----------------------------------------------------------------

.hz_v723_kpi <- function(base = NULL, comp = NULL) list(cifra = "84%", texto = "tiene a sus padres entre quienes pagan", intervalo_texto = "81% a 88%",
                                                       base = base, comparacion = comp, tambien = NULL)

test_that("v7.23 ítem 14: el alto ganado va a las filas (cifra y frase más grandes) y bajo la frase sólo va la base distinta", {
  lz <- .lam_lienzo()
  caps <- list(list(titulo = "Uno", kpis = list(.hz_v723_kpi(), .hz_v723_kpi(base = "Base de 399"))))
  .lam_halla_res_tabla(lz, caps, 0.5, 12.8, 1.2, 6.6)
  formas <- unlist(lz$formas)
  cifra <- formas[grepl('name="resumen_ejecutivo:cifra"', formas)]
  expect_true(all(grepl('sz="2800"', cifra)))                 # con aire, 28 pt (antes 24 fijos)
  expect_false(any(grepl('name="resumen_ejecutivo:encabezado"|name="resumen_ejecutivo:intervalo"', formas)))
  expect_false(any(grepl("Intervalo de|81% a 88%", formas)))
  expect_identical(sum(grepl('name="resumen_ejecutivo:base"', formas)), 1L)
  expect_true(any(grepl("Base de 399", formas, fixed = TRUE)))
})

test_that("v7.23 ítem 14: en el Word dos pastillas que no caben lado a lado van una sobre otra (no se omite la segunda)", {
  comp <- list(estado = "diferencia", partes = list(list(texto = "Algún padre o tutor univ. 92%", dir = "up", fragil = FALSE),
                                                    list(texto = "Ningún padre o tutor univ. 72%", dir = "down", fragil = FALSE)))
  e <- list(tipo = "hallazgos", modo = "resumen", paginas = list(list(list(titulo = "Uno", kpis = list(.hz_v723_kpi(comp = comp))))))
  g <- .halla_res_ggplot(e)
  tx <- unlist(lapply(suppressWarnings(ggplot2::ggplot_build(g))$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
  expect_true(all(c("Algún padre o tutor univ. 92% ▲", "Ningún padre o tutor univ. 72% ▼") %in% tx))
  expect_false(any(grepl("Intervalo de", tx, fixed = TRUE)))
})

# ---- H3 del checklist de usabilidad del editor (2026-11-05): un capítulo escrito desde la UI -------------------------
# Los rearmados del plan JSON desenvuelven una lista de un elemento sin nombres: la lista con UN capítulo llegaba como el
# capítulo mismo y la lámina salía «Sin datos» con un aviso en código. Rojo antes del arreglo.

.hz_json_un_capitulo <- function(modo = "resumen") jsonlite::fromJSON(sprintf(
  '{"id":"h1","tipo":"p_slide_hallazgos","payload":{"modo":"%s","seleccion":"manual","capitulos":[{"titulo":"Prueba","cifras":[{"var":"q","fila":"Sí","texto":"dice que sí a q","comparacion":"auto"}]}]}}',
  modo), simplifyVector = FALSE)
.hz_registro_slides <- function() stats::setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())

test_that("H3: un solo capítulo escrito por el editor llega como lista de uno por los tres rearmados (vista previa, PPT y router)", {
  s <- .hz_json_un_capitulo()
  els <- list(
    vista_previa = .mini_rebuild_slide(s)$slots$plot,
    job = .graficos_rebuild_slide_json(s, slide_registry = .hz_registro_slides(), graficador_registry = .graf_names())$slots$plot,
    router = .rebuild_slide(s)$slots$plot)
  for (nm in names(els)) {
    caps <- els[[nm]]$capitulos
    expect_null(names(caps), label = nm)
    expect_length(caps, 1L)
    expect_identical(caps[[1]]$titulo, "Prueba", label = nm)
  }
})

test_that("H3: el resumen con un capítulo manual dibuja su hallazgo (antes, «Sin datos»)", {
  el <- .mini_rebuild_slide(.hz_json_un_capitulo())$slots$plot
  avisos <- character(0)
  local_mocked_bindings(.pulso_aviso = function(m, ...) { avisos <<- c(avisos, m); invisible(TRUE) })
  e <- .halla_modelo(el, .hz_fuente(), .hz_sig())
  expect_length(e$kpis, 1L)
  expect_identical(e$paginas[[1]][[1]]$titulo, "Prueba")
  expect_identical(e$kpis[[1]]$cifra, .hz_kpi(.hz_modelo(), "dice que sí a q")$cifra)
  expect_false(any(grepl("escribe al menos un capítulo", avisos, fixed = TRUE)))
})

test_that("H3: una sola cifra en el modo «cifras» también llega como lista de uno", {
  s <- jsonlite::fromJSON('{"id":"h2","tipo":"p_slide_hallazgos","payload":{"modo":"cifras","cifras":[{"var":"q","fila":"Sí","texto":"dice que sí a q"}]}}',
                          simplifyVector = FALSE)
  el <- .mini_rebuild_slide(s)$slots$plot
  expect_length(el$cifras, 1L)
  e <- suppressMessages(.halla_modelo(el, .hz_fuente(), .hz_sig()))
  expect_length(e$kpis, 1L)
})

test_that("H3: sin capítulos completos el aviso habla en lenguaje de analista, sin nombres de argumentos ni código", {
  avisos <- character(0)
  local_mocked_bindings(.pulso_aviso = function(m, ...) { avisos <<- c(avisos, m); invisible(TRUE) })
  el <- p_slide_hallazgos(modo = "resumen", capitulos = list(list(titulo = "Vacío", cifras = list(list(var = "no_existe", fila = "Sí")))))$slots$plot
  .halla_modelo(el, .hz_fuente(), .hz_sig())
  final <- avisos[grepl("capítulo con un hallazgo", avisos, fixed = TRUE)]
  expect_identical(final, "Resumen ejecutivo: escribe al menos un capítulo con un hallazgo completo, o elige que los proponga el motor.")
  expect_false(any(grepl("`|seleccion|capitulos|\"auto\"|;", avisos[grepl("^Resumen ejecutivo", avisos)])))
})
