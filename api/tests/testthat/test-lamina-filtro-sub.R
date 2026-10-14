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

test_that("la escala de la subpregunta no hereda una columna Top Two Box sin respuestas (aviso sin salida)", {
  skip_if_not_installed("officer")
  fx <- .fsub_fixture(); msgs <- character()
  withCallingHandlers(
    reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = tempfile(fileext = ".pptx"), mensajes_progreso = FALSE,
                     # Como la hereda la app del preset de apiladas: encendida y sin respuestas declaradas.
                     plan = list(p_slide_1_grafico(p_filtro_subpregunta("inter", habilita = "Sí", subpregunta = "util", grafico_sub = "escala",
                                                                        overrides = list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box")), titulo = "x"))),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { msgs <<- c(msgs, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  expect_false(any(grepl("Top Two Box", msgs)), info = paste(msgs, collapse = "\n"))
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


# F1: el filtro dicotómico como torta o dona (Gonzalo, 2026-10-14: «sólo para filtros dicotómicos»), con su conector; con más
# respuestas cae a barras con su llave y lo avisa.
test_that("F1: con un filtro de dos respuestas la torta y la dona salen nativas con su conector", {
  skip_if_not_installed("officer")
  for (gf in c("torta", "dona")) {
    r <- .fsub_render(p_filtro_subpregunta("inter", habilita = "Sí", subpregunta = "util", grafico_filtro = gf))
    expect_true("prosecnur:grafico:filtro_sub" %in% r$nombres, info = gf)
    expect_equal(sum(r$nombres == "conector"), 3L, info = gf)
    expect_true(any(r$nombres == if (gf == "torta") "torta:porcion" else "dona:porcion"), info = gf)
  }
})

test_that("F1: con más de dos respuestas la torta cae a barras con su llave y lo avisa", {
  skip_if_not_installed("officer")
  fx <- .fsub_fixture(); msgs <- character(); out <- tempfile(fileext = ".pptx")
  withCallingHandlers(
    reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
                     plan = list(p_slide_1_grafico(p_filtro_subpregunta("lab", habilita = c("Dependiente", "Independiente"), subpregunta = "rel",
                                                                        grafico_filtro = "torta"), titulo = "x"))),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { msgs <<- c(msgs, conditionMessage(w)); invokeRestart("muffleWarning") })
  nombres <- xml2::xml_attr(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), "//p:cNvPr"), "name")
  expect_false(any(nombres == "torta:porcion")); expect_true("llave" %in% nombres)
  expect_true(any(grepl("va sólo con dos", msgs)), info = paste(msgs, collapse = "\n"))
})

# La dependencia entre los dos gráficos de una lámina (Gonzalo, 2026-10-14: «la dependencia no es un tipo de gráfico sino que
# cuando hay dos gráficos en un solo slide se puede establecer dependencia entre gráficos»): la lámina de dos gráficos que la
# declara se compone con la llave y el dependiente lleva la base de quienes lo habilitan; los dos conservan su tipo.
test_that("una lámina de dos gráficos con dependencia se compone con su llave y la base de quienes habilitan", {
  skip_if_not_installed("officer")
  s <- list(id = "x", tipo = "p_slide_2_graficos", payload = list(titulo = "Situación y relación",
    izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "lab")),
    derecha = list(graficador = "p_barras_agrupadas", args = list(var = "rel")),
    meta = list(dependencia = list(de = "izquierda", habilita = list("Dependiente", "Independiente")))))
  conv <- .dependencia_como_lamina(s)
  expect_identical(conv$tipo, "p_slide_1_grafico")
  expect_identical(conv$payload$grafico$graficador, "p_filtro_subpregunta")
  expect_identical(conv$payload$grafico$args$disposicion, "costado")
  expect_null(conv$payload$meta$dependencia)
  sin <- s; sin$payload$meta <- NULL
  expect_identical(.dependencia_como_lamina(sin), sin)                                  # sin dependencia, la lámina no cambia
  fx <- .fsub_fixture(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = .graficos_rebuild_slide_json(s)))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"); textos <- xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
  expect_true("prosecnur:grafico:filtro_sub" %in% nombres); expect_true("llave" %in% nombres)
  n_hab <- sum(fx$df$lab %in% c("1", "2"))
  expect_true(any(grepl(sprintf("Sólo los %d que respondieron", n_hab), textos, fixed = TRUE)), info = paste(textos, collapse = " | "))
})
