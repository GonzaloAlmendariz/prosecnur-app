source("setup-load-all.R")

# Catálogo, ronda 3: un `grupos` de las aperturas que no está en el cruce cortaba el informe entero al armar el plan
# ("p_dumbbell(): `grupos` debe traer entre dos y cuatro grupos del cruce"). Ahora sólo esa lámina sale con "Sin datos" y su
# aviso, que dice el código y la etiqueta de cada grupo.

.dgp_sources <- function() {
  set.seed(11); n <- 200
  d <- data.frame(sexo = rep(c("1", "2"), each = n / 2), a = c(rep("4", 80), rep("1", 20), rep("4", 50), rep("1", 50)),
                  b = sample(c("1", "2", "3", "4"), n, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("sexo", "a", "b"), type = c("select_one sx", "select_one esc", "select_one esc"),
                                   label = c("Sexo", "Pregunta A", "Pregunta B"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sx", "sx", rep("esc", 4)), name = c("1", "2", "1", "2", "3", "4"),
                                    label = c("Mujer", "Hombre", "Nada", "Poco", "Algo", "Mucho"), stringsAsFactors = FALSE))
  list(data_sources = list(b1 = d), inst_sources = list(b1 = inst))
}
.dgp_slide <- function(id, grupos) list(id = id, tipo = "p_slide_1_grafico", payload = list(titulo = id, grafico = list(
  graficador = "p_dumbbell", args = list(vars = list("b1$a", "b1$b"), corte = list("4"), estilo = "resumen", cruce = "b1$sexo", grupos = grupos))))

test_that("el mensaje dice el código y su etiqueta", {
  m <- .dumbbell_grupos_explicar("b1$sexo", c("Mujer", "Hombre"), c("1", "2"), c("Mujer", "Hombre"))
  expect_match(m, '"Mujer" es la etiqueta del código "1"', fixed = TRUE)
  expect_match(m, '"Hombre" es la etiqueta del código "2"', fixed = TRUE)
  expect_match(m, 'Los grupos se eligen por su código: "1" = Mujer, "2" = Hombre.', fixed = TRUE)
  expect_match(.dumbbell_grupos_explicar("b1$sexo", "7", c("1", "2"), c("Mujer", "Hombre")), 'llegaron 1; "7" no es un código del cruce', fixed = TRUE)
  expect_false(isTRUE(.aviso_tiene_jerga(m)))   # el aviso no lo descarta como jerga
  # Quien llama al constructor directamente sigue recibiendo su error.
  expect_error(p_dumbbell(vars = list("b1$a"), corte = "4", cruce = "b1$sexo", grupos = "1"), "dos grupos")
})

test_that("un plan con un grupo que no existe exporta las demás láminas y la mala sale con su aviso", {
  src <- .dgp_sources()
  plan <- .normalize_plan(list(slides = list(.dgp_slide("bien", list("1", "2")), .dgp_slide("uno", list("7")),
                                             .dgp_slide("etiquetas", list("Mujer", "Hombre")))), avisar = FALSE)
  sl <- lapply(plan$slides, .rebuild_slide)   # antes: error al armar la segunda
  expect_identical(sl[[2]]$slots$plot$.element_type %||% sl[[2]]$slots[[2]]$.element_type %||%
                     unlist(lapply(sl[[2]]$slots, function(x) if (is.list(x)) x$.element_type))[1], "dumbbell_grupos_invalidos")
  out <- withr::local_tempfile(fileext = ".pptx")
  msgs <- testthat::capture_messages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                                                       plan = p_plan(slides = sl), path_ppt = out, mensajes_progreso = FALSE)))
  expect_length(.pptx_slide_paths(out), 3L)
  expect_identical(.pptx_lamina_estado(.pptx_leer_parte(out, .pptx_slide_paths(out)[1])), "nativa")
  expect_true(any(grepl('Aperturas por grupo: las aperturas comparan entre dos y cuatro grupos distintos y llegaron 1; "7" no es un código', msgs, fixed = TRUE)))
  expect_true(any(grepl('"Mujer" es la etiqueta del código "1"', msgs, fixed = TRUE)))
  expect_true(any(grepl("sale con «Sin datos»", msgs, fixed = TRUE)))
})

test_that("catálogo, ronda 4: el aviso de una lámina que se reintenta sale una vez por (lámina, texto)", {
  src <- .dgp_sources()
  plan <- .normalize_plan(list(slides = list(.dgp_slide("bien", list("1", "2")), .dgp_slide("uno", list("7")), .dgp_slide("otro", list("8")))), avisar = FALSE)
  out <- withr::local_tempfile(fileext = ".pptx")
  msgs <- testthat::capture_messages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                                                       plan = p_plan(slides = lapply(plan$slides, .rebuild_slide)), path_ppt = out, mensajes_progreso = FALSE)))
  ap <- grep("PULSO-AVISO.*Aperturas por grupo", msgs, value = TRUE)
  expect_identical(length(ap), length(unique(ap)))
  expect_identical(length(ap), 2L)   # una por lámina mala
  # Fuera del render no se deduplica nada.
  expect_identical(length(testthat::capture_messages({ .pulso_aviso("x"); .pulso_aviso("x") })), 2L)
})
