# Pregunta filtro y subpregunta (recetario p192–p194; inventario de configuraciones, ítem 20). Por la ruta real: la lámina
# nativa sale con su llave, la subpregunta lleva la base de quienes la habilitan y no la de toda la muestra.

.fsub_fixture <- function() {
  set.seed(11)
  n <- 120
  inter <- sample(c("1", "2"), n, TRUE, prob = c(0.25, 0.75))                      # 1 = Sí participó
  lab <- sample(c("1", "2", "3", "4", "5"), n, TRUE)                               # situación laboral (1–3 trabajan)
  util <- ifelse(inter == "1", sample(c("1", "2", "3", "4"), n, TRUE), NA)        # sólo quienes participaron
  rel <- ifelse(lab %in% c("1", "2", "3"), sample(c("1", "2", "3"), n, TRUE), NA)  # sólo quienes trabajan
  df <- data.frame(inter = inter, util = util, lab = lab, rel = rel, stringsAsFactors = FALSE)
  survey <- data.frame(name = c("inter", "util", "lab", "rel"),
                       type = c("select_one sino", "select_one acuerdo", "select_one lab", "select_one rel"),
                       list_name = c("sino", "acuerdo", "lab", "rel"),
                       label = c("¿Ha participado en programas de intercambio?", "Los intercambios fortalecen mis competencias",
                                 "¿Cuál es su situación laboral actual?", "¿Qué tan relacionado está su trabajo con la carrera?"),
                       stringsAsFactors = FALSE)
  choices <- data.frame(
    list_name = c("sino", "sino", rep("acuerdo", 4), rep("lab", 5), rep("rel", 3)),
    name = c("1", "2", "1", "2", "3", "4", "1", "2", "3", "4", "5", "1", "2", "3"),
    label = c("Sí", "No", "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo",
              "Dependiente", "Independiente", "Dependiente e independiente", "Busca empleo", "No trabaja ni busca",
              "Muy relacionado", "Relacionado", "Poco relacionado"),
    stringsAsFactors = FALSE)
  inst <- list(survey = survey, choices = choices, orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)   # como lo arma la sesión: las etiquetas salen del orden del instrumento
  list(df = df, inst = inst)
}

.fsub_render <- function(grafico) {
  fx <- .fsub_fixture()
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(grafico, titulo = "Filtro y subpregunta")))))
  lam <- lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
  nombres <- unlist(lapply(lam, function(x) xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")))
  textos <- unlist(lapply(lam, function(x) xml2::xml_text(xml2::xml_find_all(x, "//a:t"))))
  list(fx = fx, nombres = nombres, textos = textos)
}

test_that("p192: filtro dicotómico arriba y la subpregunta abajo, con la base de quienes respondieron «Sí»", {
  skip_if_not_installed("officer")
  r <- .fsub_render(p_filtro_subpregunta("inter", habilita = "Sí", subpregunta = "util", grafico_sub = "escala", disposicion = "abajo"))
  expect_true("prosecnur:grafico:filtro_sub" %in% r$nombres)
  expect_true("llave" %in% r$nombres)
  n_si <- sum(r$fx$df$inter == "1")
  expect_true(any(grepl(sprintf("Sólo los %d que respondieron «Sí»", n_si), r$textos, fixed = TRUE)), info = paste(r$textos, collapse = " | "))
  expect_true(any(grepl("Los intercambios fortalecen mis competencias", r$textos, fixed = TRUE)))
})

test_that("p193: filtro dicotómico en columna y la subpregunta al costado", {
  skip_if_not_installed("officer")
  r <- .fsub_render(p_filtro_subpregunta("inter", habilita = "Sí", subpregunta = "util"))
  expect_true("prosecnur:grafico:filtro_sub" %in% r$nombres)
  expect_true("llave" %in% r$nombres)
})

test_that("p194: la llave abraza las tres respuestas que habilitan y la base suma a los tres", {
  skip_if_not_installed("officer")
  hab <- c("Dependiente", "Independiente", "Dependiente e independiente")
  r <- .fsub_render(p_filtro_subpregunta("lab", habilita = hab, subpregunta = "rel"))
  expect_true("prosecnur:grafico:filtro_sub" %in% r$nombres)
  n_trab <- sum(r$fx$df$lab %in% c("1", "2", "3"))
  expect_true(any(grepl(sprintf("Sólo los %d que respondieron", n_trab), r$textos, fixed = TRUE)), info = paste(r$textos, collapse = " | "))
})

test_that("habilitar una respuesta que el filtro no tiene no se dibuja en silencio", {
  expect_error(p_filtro_subpregunta("inter", habilita = character(0), subpregunta = "util"), "habilita")
  fx <- .fsub_fixture()
  msgs <- character()
  withCallingHandlers(
    reporte_ppt_plan(data = fx$df, instrumento = fx$inst, solo_lista = TRUE, mensajes_progreso = FALSE,
                     plan = list(p_slide_1_grafico(p_filtro_subpregunta("inter", habilita = "Tal vez", subpregunta = "util"), titulo = "x"))),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { msgs <<- c(msgs, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  expect_true(any(grepl("Tal vez", msgs)), info = paste(msgs, collapse = "\n"))
})
