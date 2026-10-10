source("setup-load-all.R")

# F6.0b.6: la cifra destacada se calcula desde la base con la regla del informe.

.base <- data.frame(titulo = c(1, 1, 2, 2, 2, 2, NA, 2, 1, 2), edad = c(22, 23, 21, 25, 22, 30, 24, NA, 22, 23))
.inst <- list(survey = data.frame(name = "titulo", type = "select_one si_no", list_name = "si_no", label = "¿Tiene título?"),
              choices = data.frame(list_name = "si_no", name = c("1", "2"), label = c("Sí", "No")), orders_list = NULL)

test_that("el porcentaje de una categoría se calcula sobre quienes respondieron, sin espacio antes de %", {
  c1 <- .cifra_desde_datos(.base, "titulo", "porcentaje", categoria = "1", rotulo = "de los egresados tiene el título")
  expect_identical(c1$valor, "33%"); expect_identical(c1$detalle, "3 de 9"); expect_equal(c1$base, 9L)
  c2 <- .cifra_desde_datos(.base, "titulo", "porcentaje", categoria = "Sí", instrumento = .inst, rotulo = "x")
  expect_identical(c2$valor, "33%")                                            # la categoría también casa por su etiqueta
})

test_that("número de respuestas, mediana con unidad y media con un decimal", {
  expect_identical(.cifra_desde_datos(.base, "titulo", "n", rotulo = "egresados encuestados")$valor, "9")
  expect_identical(.cifra_desde_datos(.base, "edad", "mediana", unidad = "años", rotulo = "edad mediana")$valor, "23 años")
  expect_identical(.cifra_desde_datos(.base, "edad", "media", rotulo = "edad media")$valor, "23.6")
})

test_that("lo que no se puede calcular se dice, no se inventa", {
  expect_error(.cifra_desde_datos(.base, "no_existe", "n", rotulo = "x"), "no está en la base")
  expect_error(.cifra_desde_datos(.base, "titulo", "porcentaje", rotulo = "x"), "indica la categoría")
  expect_error(.cifra_desde_datos(data.frame(v = c(NA, NA)), "v", "n", rotulo = "x"), "no tiene respuestas válidas")
})

test_that("las cifras calculadas arman una banda válida", {
  it <- list(.cifra_desde_datos(.base, "titulo", "n", rotulo = "egresados encuestados", icono = "users"),
             .cifra_desde_datos(.base, "edad", "mediana", unidad = "años", rotulo = "edad mediana"))
  e <- pulso_cifras(it)
  expect_true(.lam_cifras_cabe(e)); expect_identical(e$items[[2]]$valor, "23 años")
})

test_that("con peso del estudio el porcentaje y la media van ponderados, y el detalle lo dice", {
  b <- data.frame(titulo = c(1, 2, 2, 2), edad = c(20, 30, 30, 30), w = c(3, 1, 1, 1))
  attr(b, "var_peso") <- "w"
  c1 <- .cifra_desde_datos(b, "titulo", "porcentaje", categoria = "1", rotulo = "x")
  expect_identical(c1$valor, "50%")                                            # 3 de 6 por peso; sin peso sería 25%
  expect_identical(c1$detalle, "Con el peso del estudio")                         # sin una segunda base en la lámina
  expect_identical(.cifra_desde_datos(b, "edad", "media", rotulo = "x")$valor, "25.0")
  expect_identical(.cifra_desde_datos(b, "edad", "mediana", rotulo = "x")$valor, "25")       # punto medio exacto: promedia 20 y 30
})

test_that("p_cifra es un elemento de plan que entra en las ranuras de cifra de la lámina 22 y se renderiza con datos", {
  el <- p_cifra("titulo", "porcentaje", categoria = "1", rotulo = "de los egresados tiene el título", icono = "graduation-cap")
  expect_s3_class(el, "ppt_element"); expect_identical(el$.element_type, "cifra")
  expect_error(p_cifra("titulo", "porcentaje", rotulo = "x"), "indica `categoria`")
  sin <- p_cifra("titulo", "n")                                                   # sin rótulo: no es un error ni una lámina en blanco
  data_sources <- .base; instrument_sources <- .inst
  expect_message(p0 <- .render_cifra(sin), "no tiene rótulo")
  expect_identical(attr(p0, "pulso_cifra")$rotulo, "respuestas")
  data_sources <- .base; instrument_sources <- .inst
  p <- .render_cifra(el)
  expect_s3_class(p, "ggplot")
  expect_identical(attr(p, "pulso_cifra")$valor, "33%")
  s <- p_slide_cifras_y_graficos(cifra_izquierda = el, cifra_centro = p_cifra("titulo", "n", rotulo = "egresados encuestados"),
                                 cifra_derecha = p_cifra("edad", "mediana", unidad = "años", rotulo = "edad mediana"),
                                 grafico_izquierda = el, grafico_derecha = el, titulo = "El estudio en cifras")
  expect_identical(s$slots$cifra_centro$modo, "n")
})

test_that("la lámina 22 con cifras sale nativa: banda de cifras con sus valores y los dos gráficos en paneles", {
  set.seed(1); n <- 60
  df <- data.frame(titulo = sample(c("1", "2"), n, TRUE), edad = sample(20:30, n, TRUE), sector = sample(c("1", "2", "3"), n, TRUE))
  inst <- list(survey = data.frame(name = c("titulo", "edad", "sector"), type = c("select_one si_no", "integer", "select_one sec"),
                                   list_name = c("si_no", NA, "sec"), label = c("¿Tiene título?", "Edad", "Sector")),
               choices = data.frame(list_name = c("si_no", "si_no", "sec", "sec", "sec"), name = c("1", "2", "1", "2", "3"),
                                    label = c("Sí", "No", "Privado", "Público", "Independiente")), orders_list = NULL)
  s <- p_slide_cifras_y_graficos(
    cifra_izquierda = p_cifra("titulo", "n", rotulo = "egresados encuestados"),
    cifra_centro = p_cifra("edad", "mediana", unidad = "años", rotulo = "edad mediana"),
    cifra_derecha = p_cifra("titulo", "porcentaje", categoria = "1", rotulo = "tiene el título"),
    grafico_izquierda = p_barras_categoricas("titulo"), grafico_derecha = p_barras_categoricas("sector"), titulo = "El estudio en cifras")
  out <- tempfile(fileext = ".pptx")
  suppressMessages(reporte_ppt_plan(data = df, instrumento = inst, plan = p_plan(slides = list(s)), path_ppt = out, mensajes_progreso = FALSE))
  expect_identical(.preview_partes(out)$partes[[1]]$estado, "nativa")
  x <- .pptx_leer_parte(out, .pptx_slide_paths(out)[1])
  valores <- regmatches(x, gregexpr('(?s)name="cifra:valor".*?<a:t>[^<]*</a:t>', x, perl = TRUE))[[1]]
  expect_length(valores, 3L)
  expect_match(valores[1], ">60<", fixed = TRUE)
  # K15: la p171 dibuja sus tres cifras a 32 pt (python-pptx; recetario_m2c.R:170, `cifra(..., size = 32)`), no a 44.
  expect_match(x, 'sz="3200"', fixed = TRUE)
})

test_that("la mediana es la de cada formato: el PPT trunca datos enteros como su histograma y el Word no", {
  c1 <- .cifra_desde_datos(data.frame(edad = c(22, 23, 24, 25, 23, 24)), "edad", "mediana", rotulo = "x")
  expect_identical(c1$valor, "23"); expect_identical(c1$valor_word, "23.5")
  expect_identical(.cifra_desde_datos(data.frame(edad = c(22.5, 23, 24, 25, 23, 24)), "edad", "mediana", rotulo = "x")$valor, "23.5")
  expect_equal(.cifra_mediana_ponderada(c(22, 23, 24, 25, 23, 24), rep(2, 6)), stats::median(c(22, 23, 24, 25, 23, 24)))
})

test_that("la lámina 21 (cifras en columna lateral) sale nativa con sus dos cifras a 34 pt (lámina 169 del recetario)", {
  set.seed(2); n <- 80
  df <- data.frame(sexo = sample(c("1", "2"), n, TRUE), edad = sample(19:30, n, TRUE), rango = sample(c("1", "2", "3"), n, TRUE), ciclo = sample(c("5", "6", "7"), n, TRUE))
  inst <- list(survey = data.frame(name = c("sexo", "edad", "rango", "ciclo"), type = c("select_one sx", "integer", "select_one rg", "select_one cc"),
                                   list_name = c("sx", NA, "rg", "cc"), label = c("Sexo", "Edad", "Rango de edades", "Nivel curricular")),
               choices = data.frame(list_name = c("sx", "sx", "rg", "rg", "rg", "cc", "cc", "cc"), name = c("1", "2", "1", "2", "3", "5", "6", "7"),
                                    label = c("Masculino", "Femenino", "De 19 a 22", "De 23 a 26", "De 27 a 30", "Quinto", "Sexto", "Séptimo")), orders_list = NULL)
  s <- p_slide_3_graficos_poblacion_cifras(superior_izquierda = p_barras_categoricas("sexo"), derecha = p_barras_categoricas("ciclo"),
    cifra_superior = p_cifra("sexo", "n", rotulo = "estudiantes"), inferior_izquierda = p_barras_categoricas("rango"),
    cifra_inferior = p_cifra("edad", "mediana", unidad = "años", rotulo = "edad mediana"), titulo = "Perfil del estudiante en cifras")
  out <- tempfile(fileext = ".pptx")
  suppressMessages(reporte_ppt_plan(data = df, instrumento = inst, plan = p_plan(slides = list(s)), path_ppt = out, mensajes_progreso = FALSE))
  expect_identical(.preview_partes(out)$partes[[1]]$estado, "nativa")
  x <- .pptx_leer_parte(out, .pptx_slide_paths(out)[1])
  expect_equal(lengths(regmatches(x, gregexpr('name="cifra:valor"', x, fixed = TRUE))), 2L)
  expect_match(x, 'sz="3400"', fixed = TRUE)
})

test_that("las láminas de composición (21 y 22) llegan al Word: sus cifras en franja y sus gráficos como figuras", {
  set.seed(3); n <- 60
  df <- data.frame(titulo = sample(c("1", "2"), n, TRUE), edad = sample(20:30, n, TRUE), sector = sample(c("1", "2", "3"), n, TRUE))
  inst <- list(survey = data.frame(name = c("titulo", "edad", "sector"), type = c("select_one si_no", "integer", "select_one sec"),
                                   list_name = c("si_no", NA, "sec"), label = c("¿Tiene título?", "Edad", "Sector")),
               choices = data.frame(list_name = c("si_no", "si_no", "sec", "sec", "sec"), name = c("1", "2", "1", "2", "3"),
                                    label = c("Sí", "No", "Privado", "Público", "Independiente")), orders_list = NULL)
  s22 <- p_slide_cifras_y_graficos(
    cifra_izquierda = p_cifra("titulo", "n", rotulo = "egresados encuestados"),
    cifra_centro = p_cifra("edad", "mediana", unidad = "años", rotulo = "edad mediana"),
    cifra_derecha = p_cifra("titulo", "porcentaje", categoria = "1", rotulo = "tiene el título"),
    grafico_izquierda = p_barras_categoricas("titulo"), grafico_derecha = p_barras_categoricas("sector"), titulo = "El estudio en cifras")
  rm <- suppressMessages(reporte_ppt_plan(data = df, instrumento = inst, plan = p_plan(slides = list(s22)), solo_lista = TRUE,
                                          build_render_meta = TRUE, mensajes_progreso = FALSE))$render_meta
  charts <- Filter(function(e) identical(e$kind %||% "chart", "chart"), rm)
  expect_length(charts, 5L)                                                       # 3 cifras + 2 gráficos
  expect_equal(sum(vapply(charts, function(e) !is.null(attr(e$plot_word, "pulso_cifra")), TRUE)), 3L)
})

test_that("la lámina de población de 3 también llega al Word y cada entrada sabe de qué lámina viene", {
  set.seed(4); n <- 50
  df <- data.frame(a = sample(c("1", "2"), n, TRUE), b = sample(c("1", "2"), n, TRUE), c = sample(c("1", "2"), n, TRUE))
  inst <- list(survey = data.frame(name = c("a", "b", "c"), type = rep("select_one si_no", 3), list_name = rep("si_no", 3),
                                   label = c("Pregunta A", "Pregunta B", "Pregunta C")),
               choices = data.frame(list_name = c("si_no", "si_no"), name = c("1", "2"), label = c("Sí", "No")), orders_list = NULL)
  s <- p_slide_3_graficos_poblacion(p_barras_categoricas("a"), p_barras_categoricas("b"), p_barras_categoricas("c"), titulo = "Perfil")
  rm <- suppressMessages(reporte_ppt_plan(data = df, instrumento = inst, plan = p_plan(slides = list(p_slide_seccion("Uno"), s)),
                                          solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE))$render_meta
  charts <- Filter(function(e) identical(e$kind %||% "chart", "chart"), rm)
  expect_length(charts, 3L)
  expect_true(all(vapply(charts, function(e) identical(e$slide_i, 2L), TRUE)))
})

test_that("la franja del Word junta las cifras seguidas de una misma lámina, nunca las de dos láminas", {
  cif <- function(v, r, sl) list(kind = "chart", etype = "cifra", title = r, slide_i = sl,
                                 plot_word = graficar_cifra(list(valor = v, valor_word = v, rotulo = r)))
  rm <- list(list(kind = "section", title = "Resultados"), cif("24", "edad mediana", 1L), cif("49%", "mujeres", 1L),
             cif("24", "edad mediana", 2L), cif("80", "encuestados", 2L))
  llamadas <- list()
  local_mocked_bindings(.word_franja = function(doc, valores, rotulos) { llamadas[[length(llamadas) + 1L]] <<- valores; doc })
  suppressMessages(.word_documento(rm, tempfile(fileext = ".docx")))
  expect_identical(llamadas, list(c("24", "49%"), c("24", "80")))
})

test_that("una cifra sobre una variable que falta da un solo aviso: el de la variable, no también el del rótulo", {
  data_sources <- list(base = data.frame(edad = 1:5))
  msgs <- character()
  e <- withCallingHandlers(tryCatch(.render_cifra(list(var = "sueldo", modo = "mediana")), error = function(e) e),
                           message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_s3_class(e, "error"); expect_match(conditionMessage(e), "sueldo")
  expect_false(any(grepl("rótulo", msgs)))
})

test_that("una lámina de 5 con cifras fuera del índice 5 no se junta en el Word con la cifra de la lámina siguiente", {
  set.seed(5); n <- 50
  df <- data.frame(a = sample(c("1", "2"), n, TRUE), edad = sample(20:30, n, TRUE))
  inst <- list(survey = data.frame(name = c("a", "edad"), type = c("select_one si_no", "integer"), list_name = c("si_no", NA),
                                   label = c("Pregunta A", "Edad")),
               choices = data.frame(list_name = c("si_no", "si_no"), name = c("1", "2"), label = c("Sí", "No")), orders_list = NULL)
  cf <- function(r) p_cifra("a", "n", rotulo = r)
  s5 <- p_slide_5_graficos_poblacion(cf("uno"), cf("dos"), cf("tres"), cf("cuatro"), cf("cinco"), titulo = "Cinco")
  plan <- p_plan(slides = list(p_slide_seccion("A"), p_slide_seccion("B"), p_slide_seccion("C"), s5, p_slide_1_grafico(cf("seis"))))
  rm <- suppressMessages(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, solo_lista = TRUE, build_render_meta = TRUE,
                                          mensajes_progreso = FALSE))$render_meta
  cifras <- Filter(function(e) !is.null(attr(e$plot_word, "pulso_cifra")), rm)
  expect_equal(vapply(cifras, function(e) e$slide_i, integer(1)), c(rep(4L, 5), 5L))
  llamadas <- list()
  local_mocked_bindings(.word_franja = function(doc, valores, rotulos) { llamadas[[length(llamadas) + 1L]] <<- rotulos; doc })
  suppressMessages(.word_documento(rm, tempfile(fileext = ".docx")))
  expect_length(llamadas, 2L)                                                     # el orden dentro de la lámina es el de su layout
  expect_setequal(llamadas[[1]], c("uno", "dos", "tres", "cuatro", "cinco")); expect_identical(llamadas[[2]], "seis")
})

test_that("una cifra sin número de lámina no se junta con la siguiente", {
  cif <- function(r, sl) list(kind = "chart", etype = "cifra", title = r, slide_i = sl,
                              plot_word = graficar_cifra(list(valor = "1", valor_word = "1", rotulo = r)))
  rm <- list(list(kind = "section", title = "Resultados"), cif("a", NULL), cif("b", NULL))
  llamadas <- list()
  local_mocked_bindings(.word_franja = function(doc, valores, rotulos) { llamadas[[length(llamadas) + 1L]] <<- rotulos; doc })
  suppressMessages(.word_documento(rm, tempfile(fileext = ".docx")))
  expect_identical(llamadas, list("a", "b"))
})
