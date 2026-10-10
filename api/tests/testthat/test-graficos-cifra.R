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
  expect_match(c1$detalle, "peso del estudio", fixed = TRUE)
  expect_identical(.cifra_desde_datos(b, "edad", "media", rotulo = "x")$valor, "25.0")
  expect_identical(.cifra_desde_datos(b, "edad", "mediana", rotulo = "x")$valor, "20")
})

test_that("p_cifra es un elemento de plan que entra en las ranuras de cifra de la lámina 22 y se renderiza con datos", {
  el <- p_cifra("titulo", "porcentaje", categoria = "1", rotulo = "de los egresados tiene el título", icono = "graduation-cap")
  expect_s3_class(el, "ppt_element"); expect_identical(el$.element_type, "cifra")
  expect_error(p_cifra("titulo", "porcentaje", rotulo = "x"), "indica `categoria`")
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
  expect_match(x, 'sz="4400"', fixed = TRUE)                                  # tres cifras: 44 pt, como la 171 del recetario
})
