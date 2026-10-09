source("setup-load-all.R")

# N8.15: del plan al Word del recetario por reporte_word_plan (el camino del job), de punta a punta.

.wd_inst <- function() list(
  survey = data.frame(name = "conoce", type = "select_one sino", list_name = "sino", label = "¿Conoce el servicio?", stringsAsFactors = FALSE),
  choices = data.frame(list_name = "sino", name = c("Si", "No", "NS"), label = c("Sí", "No", "No sabe"), stringsAsFactors = FALSE), orders_list = NULL)

.wd_docx <- function(...) {
  data <- list(docentes = data.frame(conoce = rep(c("Si", "No", "NS"), times = c(40, 12, 3)), stringsAsFactors = FALSE))
  plan <- list(
    diapo_001 = p_slide_portada(titulo = "ESTUDIO DE OPINIÓN SOBRE EL SERVICIO EDUCATIVO OFRECIDO POR LA CARRERA, PUCP", subtitulo = "Informe final", fecha = "Octubre de 2026"),
    diapo_002 = p_slide_seccion(titulo = "1. PERFIL DEL ENCUESTADO", introduccion_word = "Quiénes respondieron."),
    diapo_003 = p_slide_1_grafico(grafico = p_barras_agrupadas(var = "docentes$conoce")),
    diapo_004 = p_slide_tabla_tecnica(titulo = "Ficha técnica del estudio", filas = data.frame(Aspecto = c("Técnica", "Actores"), Detalle = c("Encuesta en línea", "Docentes")),
                                      pie = "Fuente: PULSO PUCP 2026.")
  )
  f <- tempfile(fileext = ".docx")
  res <- reporte_word_plan(data = data, instrumento = list(docentes = .wd_inst()), path_docx = f, presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
                           plan = plan, mensajes_progreso = FALSE, ...)
  d <- tempfile(); utils::unzip(f, exdir = d)
  list(res = res, xml = paste(readLines(file.path(d, "word", "document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = ""),
       cab = vapply(list.files(file.path(d, "word"), pattern = "^header.*\\.xml$", full.names = TRUE), function(x) paste(readLines(x, warn = FALSE, encoding = "UTF-8"), collapse = ""), ""))
}

test_that("por defecto el Word es el del recetario: portada en tipo oración, índices, capítulo con apertura, figura SEQ, tabla técnica y contraportada", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  o <- .wd_docx()
  x <- o$xml
  expect_match(x, "Estudio de opinión sobre el servicio educativo ofrecido por la carrera, PUCP", fixed = TRUE)   # tipo oración, sigla intacta
  expect_match(x, 'TOC \\o "1-2"', fixed = TRUE)
  expect_match(x, "Perfil del encuestado", fixed = TRUE); expect_match(x, 'w:sz w:val="120"', fixed = TRUE)          # apertura B
  expect_match(x, "SEQ Gráfico", fixed = TRUE); expect_match(x, "SEQ Tabla", fixed = TRUE)
  expect_match(x, "Encuesta en línea", fixed = TRUE)                                                               # la tabla técnica llega
  expect_match(x, "pulsopucp@pucp.edu.pe", fixed = TRUE)                                                           # contraportada
  expect_true(any(grepl("Estudio de opinión sobre el servicio educativo ofrecido por…", o$cab, fixed = TRUE)))     # título corto
  expect_equal(o$res$figuras, 1L); expect_equal(o$res$tablas, 1L)
  expect_false(grepl("Cómo leer este informe", x, fixed = TRUE))                                                   # sin escalas no va
})

test_that("con estilo_documento = \"clasico\" sale el Word anterior", {
  skip_if_not_installed("officer")
  x <- .wd_docx(estilo_documento = "clasico")$xml
  expect_match(x, "Gráfico Nº 1", fixed = TRUE); expect_false(grepl("SEQ Gráfico", x, fixed = TRUE))
})

test_that("tipo oración y título corto", {
  expect_identical(.word_oracion("PERFIL DEL ENCUESTADO"), "Perfil del encuestado")
  expect_identical(.word_oracion("Perfil del ACNUR"), "Perfil del ACNUR")
  expect_identical(.word_oracion("SATISFACCIÓN CON LA PUCP"), "Satisfacción con la PUCP")
  expect_identical(.word_titulo_corto("Corto"), "Corto"); expect_identical(.word_titulo_corto("Largo", "Dado"), "Dado")
  expect_lte(nchar(.word_titulo_corto(strrep("palabra ", 20))), 61L)
})

test_that("lo previo a la primera sección va en «Introducción» y «Cómo leer» justo antes de los resultados, como el recetario", {
  skip_if_not_installed("officer")
  d <- data.frame(categoria = c("A", "B"), N = c(45, 30), pct = c(.45, .30), stringsAsFactors = FALSE)
  p <- suppressWarnings(graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total")))
  rm <- list(list(kind = "title_doc", title = "Estudio de prueba"),
             list(kind = "text", title = "OBJETIVO", text = "Conocer la opinión de los públicos."),
             list(kind = "section", title = "PERFIL DEL ENCUESTADO", meta = list(word_heading_level = 1L)),
             list(kind = "chart", title = "Sexo", plot_word = p))
  f <- tempfile(fileext = ".docx")
  res <- .word_documento(rm, f, opciones = list(como_leer = TRUE))
  x <- paste(officer::docx_summary(officer::read_docx(f))$text, collapse = "\n")
  pos <- function(t) regexpr(t, x, fixed = TRUE)[1]
  expect_true(all(c(pos("Introducción"), pos("Conocer la opinión"), pos("Cómo leer este informe"), pos("Perfil del encuestado")) > 0))
  expect_lt(pos("Introducción"), pos("Conocer la opinión"))
  expect_lt(pos("Conocer la opinión"), pos("Cómo leer este informe"))
  expect_lt(pos("Cómo leer este informe"), pos("Perfil del encuestado"))
  expect_match(x, "1.1. Objetivo", fixed = TRUE)
  expect_equal(res$figuras, 3L)                                  # 2 de «Cómo leer» + 1 del plan
})

test_that("tipo oración en los casos del verificador: I+D+i, preguntas, numeración y siglas", {
  expect_identical(.word_oracion("INVESTIGACIÓN, DESARROLLO E INNOVACIÓN (I+D+i)"), "Investigación, desarrollo e innovación (I+D+i)")
  expect_identical(.word_oracion("¿CONOCE EL SERVICIO?"), "¿Conoce el servicio?")
  expect_identical(.word_oracion("1. PERFIL DEL ENCUESTADO"), "1. Perfil del encuestado")
  expect_identical(.word_oracion("APOYO DEL BID Y LA OCDE"), "Apoyo del BID y la OCDE")
  expect_identical(.word_oracion("¿Cuál es su género ?"), "¿Cuál es su género ?")        # ya en tipo oración
  expect_identical(.word_oracion("AÑO"), "AÑO")                                           # menos de 4 letras
})
