source("setup-load-all.R")

# Ítem 1 del checklist del catálogo: la lámina de cinco gráficos en «3+2» (por defecto) o «2+3», a elección del analista
# (`meta$disposicion`). Las ranuras se leen en orden de lectura en las dos.

.d5_inst <- function() list(
  survey = data.frame(name = paste0("q", 1:5), type = "select_one s", list_name = "s", label = paste("Pregunta", 1:5), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "s", name = c("1", "2", "3"), label = c("Sí", "No", "A veces"), stringsAsFactors = FALSE), orders_list = NULL)
.d5_data <- function() {
  set.seed(5); d <- as.data.frame(replicate(5, sample(c("1", "2", "3"), 60, TRUE)), stringsAsFactors = FALSE); names(d) <- paste0("q", 1:5); d
}
.d5_slide <- function(disposicion = NULL) {
  g <- function(v) list(graficador = "p_barras_agrupadas", args = list(var = v))
  payload <- list(titulo = "Cinco", grafico_superior_1 = g("q1"), grafico_superior_2 = g("q2"), grafico_superior_3 = g("q3"),
                  grafico_inferior_1 = g("q4"), grafico_inferior_2 = g("q5"))
  if (!is.null(disposicion)) payload$disposicion <- disposicion
  list(id = "s5", tipo = "p_slide_5_graficos_poblacion", payload = payload)
}
.d5_render <- function(slide_raw) {
  plan <- .normalize_plan(list(slides = list(slide_raw)), avisar = FALSE)
  out <- withr::local_tempfile(fileext = ".pptx", .local_envir = parent.frame())
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .d5_data(), instrumento = .d5_inst(),
                                                     plan = p_plan(slides = list(.rebuild_slide(plan$slides[[1]]))), path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}
# Posición vertical (in) de cada enunciado de panel, en orden de lectura.
.d5_preguntas <- function(x) {
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]")
  y <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:off"), "y")) / 914400
  xx <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:off"), "x")) / 914400
  data.frame(texto = xml2::xml_text(sp), x = xx, y = y, stringsAsFactors = FALSE)
}

test_that("la disposición se declara en la lámina, se valida y por defecto es «3+2»", {
  expect_identical(.slide_disposicion_5(NULL), "3+2")
  expect_identical(.slide_disposicion_5(""), "3+2")
  expect_identical(.slide_disposicion_5("2+3"), "2+3")
  e <- tryCatch(.slide_disposicion_5("4+1"), error = function(e) e)
  expect_s3_class(e, "api_error"); expect_identical(e$code, "E_REPORTE_PLAN_SPEC")
  s <- p_slide_5_graficos_poblacion(p_barras_agrupadas("q1"), p_barras_agrupadas("q2"), p_barras_agrupadas("q3"),
                                    p_barras_agrupadas("q4"), p_barras_agrupadas("q5"), disposicion = "2+3")
  expect_identical(s$meta$disposicion, "2+3")
  s <- p_slide_5_graficos_poblacion(p_barras_agrupadas("q1"), p_barras_agrupadas("q2"), p_barras_agrupadas("q3"),
                                    p_barras_agrupadas("q4"), p_barras_agrupadas("q5"), meta = list(disposicion = "2+3"))
  expect_identical(s$meta$disposicion, "2+3")
  expect_error(p_slide_5_graficos_poblacion(p_barras_agrupadas("q1"), p_barras_agrupadas("q2"), p_barras_agrupadas("q3"),
                                            p_barras_agrupadas("q4"), p_barras_agrupadas("q5"), disposicion = "5"), "disposicion")
})

test_that("el registro la ofrece como opción de la lámina y llega al catálogo de tipos", {
  arg <- Filter(function(a) identical(a$name, "disposicion"), .SLIDES_META$p_slide_5_graficos_poblacion$args)
  expect_length(arg, 1L)
  expect_identical(arg[[1]]$default, "3+2")
  expect_identical(vapply(arg[[1]]$choices, `[[`, "", "value"), c("3+2", "2+3"))
  d5 <- .graficos_tipos_catalogo()$disposiciones$p_slide_5_graficos_poblacion
  expect_identical(d5$arg, "disposicion"); expect_identical(d5$default, "3+2")
  expect_identical(vapply(d5$valores, `[[`, "", "value"), c("3+2", "2+3"))
})

test_that("«2+3» pone dos arriba y tres abajo, con la misma calle y el mismo fin que «3+2»", {
  op <- options(prosecnur.lam_disposicion_5 = "3+2"); on.exit(options(op), add = TRUE)
  a <- .lam_mixta_geo("poblacion_5")$paneles
  options(prosecnur.lam_disposicion_5 = "2+3")
  b <- .lam_mixta_geo("poblacion_5")$paneles
  ys <- function(P) vapply(P, `[[`, 0, "y"); hs <- function(P) vapply(P, `[[`, 0, "h"); ws <- function(P) vapply(P, `[[`, 0, "w")
  expect_identical(length(unique(round(ys(a)[1:3], 3))), 1L); expect_gt(ys(a)[4], ys(a)[1])
  expect_identical(length(unique(round(ys(b)[1:2], 3))), 1L); expect_identical(length(unique(round(ys(b)[3:5], 3))), 1L)
  expect_gt(ys(b)[3], ys(b)[1])
  expect_equal(ws(b)[1:2], ws(a)[4:5]); expect_equal(ws(b)[3:5], ws(a)[1:3])
  expect_equal(max(ys(b) + hs(b)), max(ys(a) + hs(a)))
  expect_equal(ys(b)[3] - (ys(b)[1] + hs(b)[1]), ys(a)[4] - (ys(a)[1] + hs(a)[1]))
})

test_that("en el render, la lámina sale nativa con la disposición pedida y las ranuras en orden de lectura", {
  for (d in c("3+2", "2+3")) {
    x <- .d5_render(.d5_slide(d))
    nm <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
    expect_true("prosecnur:grafico:mixta" %in% nm, label = d)
    p <- .d5_preguntas(x)
    expect_identical(p$texto, paste("Pregunta", 1:5), label = d)
    arriba <- if (identical(d, "3+2")) 3L else 2L
    expect_identical(sum(abs(p$y - p$y[1]) < 0.01), arriba, label = d)
    expect_true(all(diff(p$x[seq_len(arriba)]) > 0), label = d)
  }
  expect_identical(nrow(.d5_preguntas(.d5_render(.d5_slide(NULL)))), 5L)
})
