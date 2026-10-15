source("setup-load-all.R")

# W6 / decisión D6 (Gonzalo, checklist-revamp-informe-graficos-2026-10-14): cuántas figuras Word sale de una
# multiapilada se elige por lámina (`word_multiapiladas` del slot), con un valor del informe debajo
# (`w_presets$chart_options$multiapiladas_word`). Sin ninguno rige «automático» = el corte de siempre: `var` una figura
# por barra, `var_cruce` una por tema. La lámina del PPT no cambia.

.wmm_likert <- function() {
  codes <- c("1", "2", "3", "4", "5")
  labels <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo",
              "Totalmente de acuerdo")
  data.frame(list_name = "likert5", name = codes, label = labels, stringsAsFactors = FALSE)
}

.wmm_inst <- function(vars = c(p1 = "Atención recibida", p2 = "Tiempo de espera", p3 = "Trato del personal")) {
  list(
    survey = data.frame(name = names(vars), type = "select_one likert5", list_name = "likert5", label = unname(vars),
                        stringsAsFactors = FALSE),
    choices = .wmm_likert(),
    orders_list = NULL
  )
}

.wmm_data <- function(n = 40, vars = c("p1", "p2", "p3"), semilla = 1) {
  set.seed(semilla)
  as.data.frame(stats::setNames(lapply(vars, function(v) as.character(sample(1:5, n, replace = TRUE))), vars),
                stringsAsFactors = FALSE)
}

# render_meta de las figuras Word de un plan (el mismo camino que `reporte_word_plan`, sin escribir el docx)
.wmm_charts <- function(grafico, data = .wmm_data(), instrumento = .wmm_inst(), chart_options = NULL) {
  wp <- if (is.null(chart_options)) w_presets() else w_presets(chart_options = chart_options)
  meta <- reporte_ppt_plan(
    data = data, instrumento = instrumento,
    plan = list(diapo_001 = p_slide_1_grafico(grafico = grafico)),
    presets = .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), wp),
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE
  )$render_meta
  Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
}
.wmm_titulos <- function(charts) vapply(charts, function(m) as.character(m$title %||% NA_character_), "")

.wmm_var <- function(...) p_barras_multiapiladas(modo = "var", vars = c("p1", "p2", "p3"), titulo = "Satisfacción", ...)

.wmm_multiactor <- function(...) {
  p_barras_multiapiladas(
    modo = "var_cruce", titulo = "Gestión institucional",
    vars = list(acuerdo = c("docentes$p1", "estudiantes$p1"), espera = c("docentes$p2", "estudiantes$p2")),
    titulos_grupo = c(acuerdo = "Atención recibida", espera = "Tiempo de espera"), ...
  )
}
.wmm_multi_data <- function() list(docentes = .wmm_data(30, semilla = 2), estudiantes = .wmm_data(50, semilla = 3))
.wmm_multi_inst <- function() list(docentes = .wmm_inst(), estudiantes = .wmm_inst())

titulos_var_hoy <- c("Satisfacción — Atención recibida", "Satisfacción — Tiempo de espera",
                     "Satisfacción — Trato del personal")
titulos_temas_hoy <- c("Gestión institucional — Atención recibida", "Gestión institucional — Tiempo de espera")

test_that("modo var: sin decisión sale como siempre (una figura por barra); cada modo explícito, sus figuras", {
  skip_if_not_installed("officer")
  hoy <- .wmm_charts(.wmm_var())
  expect_length(hoy, 3L)
  expect_identical(.wmm_titulos(hoy), titulos_var_hoy)

  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = "por_barra"))), titulos_var_hoy)
  uno <- .wmm_charts(.wmm_var(word_multiapiladas = "un_grafico"))
  expect_length(uno, 1L)
  expect_identical(.wmm_titulos(uno), "Satisfacción")   # el título de la lámina
  tema <- .wmm_charts(.wmm_var(word_multiapiladas = "por_tema"))   # un solo tema: todas las barras juntas
  expect_identical(.wmm_titulos(tema), "Satisfacción")
  # La figura única lleva las tres barras: su espec tiene tres filas.
  expect_identical(NROW(attr(uno[[1]]$plot_word, "pulso_espec")$filas), 3L)
  # «Como el informe» desde la tarjeta llega vacío y es «sin decidir».
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = ""))), titulos_var_hoy)
})

test_that("modo var_cruce multiactor: automático = por tema; por barra = tema + público; un gráfico = una figura con temas", {
  skip_if_not_installed("officer")
  hoy <- .wmm_charts(.wmm_multiactor(), .wmm_multi_data(), .wmm_multi_inst())
  expect_identical(.wmm_titulos(hoy), titulos_temas_hoy)
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_multiactor(word_multiapiladas = "por_tema"), .wmm_multi_data(),
                                            .wmm_multi_inst())), titulos_temas_hoy)

  barra <- .wmm_charts(.wmm_multiactor(word_multiapiladas = "por_barra"), .wmm_multi_data(), .wmm_multi_inst())
  expect_identical(.wmm_titulos(barra), c(
    "Gestión institucional — Atención recibida — Docentes",
    "Gestión institucional — Atención recibida — Estudiantes",
    "Gestión institucional — Tiempo de espera — Docentes",
    "Gestión institucional — Tiempo de espera — Estudiantes"
  ))
  expect_true(all(vapply(barra, function(m) NROW(attr(m$plot_word, "pulso_espec")$filas), 1L) == 1L))

  uno <- .wmm_charts(.wmm_multiactor(word_multiapiladas = "un_grafico"), .wmm_multi_data(), .wmm_multi_inst())
  expect_length(uno, 1L)
  expect_identical(.wmm_titulos(uno), "Gestión institucional")
  espec <- attr(uno[[1]]$plot_word, "pulso_espec")
  expect_identical(NROW(espec$filas), 4L)
  expect_setequal(unique(espec$filas$grupo_titulo), c("Atención recibida", "Tiempo de espera"))
  # La escala Word dibuja los temas como rótulo propio sobre sus barras.
  g <- .word_grafico(uno[[1]]$plot_word)
  expect_identical(attr(g, "renderer"), "escala")
  rotulos <- unlist(lapply(g$layers, function(l) l$aes_params$label %||% l$data$label %||% character(0)))
  expect_true(all(c("Atención recibida", "Tiempo de espera") %in% rotulos))
})

test_that("la escala Word sin temas (o con uno) sale idéntica: el rótulo de tema sólo aparece con dos o más", {
  f1 <- data.frame(grupo_id = NA_character_, grupo_titulo = NA_character_, stringsAsFactors = FALSE)[rep(1, 3), ]
  expect_null(.word_escala_grupos(f1, c(1, 1, 1)))
  f2 <- data.frame(grupo_id = "a", grupo_titulo = "A", stringsAsFactors = FALSE)[rep(1, 2), ]
  expect_null(.word_escala_grupos(f2, c(1, 1)))
  f3 <- data.frame(grupo_id = c("a", "a", "b"), grupo_titulo = c("Tema A", "Tema A", "Tema B"), stringsAsFactors = FALSE)
  g <- .word_escala_grupos(f3, c(1, 1, 1))
  expect_identical(g$cabeceras$texto, c("Tema A", "Tema B"))
  expect_true(all(diff(g$ys) < 0))                               # filas de arriba abajo
  expect_true(g$cabeceras$y[1] > g$ys[1] && g$cabeceras$y[2] < g$ys[2] && g$cabeceras$y[2] > g$ys[3])
  expect_equal(g$tot, 3 + 2 * (0.35 + 0.34))
})

test_that("el valor del informe rige cuando la lámina no decide; la lámina manda sobre el informe", {
  skip_if_not_installed("officer")
  expect_length(.wmm_charts(.wmm_var(), chart_options = list(multiapiladas_word = "un_grafico")), 1L)
  expect_length(.wmm_charts(.wmm_var(), chart_options = list(multiapiladas_word = "automatico")), 3L)
  expect_length(.wmm_charts(.wmm_var(word_multiapiladas = "por_barra"),
                            chart_options = list(multiapiladas_word = "un_grafico")), 3L)
  expect_length(.wmm_charts(.wmm_multiactor(), .wmm_multi_data(), .wmm_multi_inst(),
                            chart_options = list(multiapiladas_word = "por_barra")), 4L)
})

test_that("multilista: el modo de la lámina vale para cada bloque; sin decisión, como siempre", {
  skip_if_not_installed("officer")
  ml <- function(...) p_barras_multiapiladas(modo = "multilista", titulo = "Bloques", bloques = list(
    list(modo = "var", vars = c("p1", "p2")),
    list(modo = "var", vars = c("p3"))
  ), ...)
  expect_length(.wmm_charts(ml()), 3L)                                   # hoy: una por barra de cada bloque
  expect_length(.wmm_charts(ml(word_multiapiladas = "por_barra")), 3L)
  expect_length(.wmm_charts(ml(word_multiapiladas = "un_grafico")), 2L)  # cada bloque entero en su figura
  expect_length(.wmm_charts(ml(), chart_options = list(multiapiladas_word = "por_tema")), 2L)
})

test_that("var_cruce con cruce: por tema y por barra dan una figura por variable abierta por el cruce", {
  piezas <- .word_multi_piezas(
    list(modo = "var_cruce", vars = c("p1", "p2"), cruce = "sexo", title_slide = "Por sexo",
         titulos_grupo = c(p1 = "Atención")),
    "por_tema", titulo_var = function(v) paste("Pregunta", v)
  )
  expect_identical(vapply(piezas, `[[`, "", "titulo"), c("Por sexo — Atención", "Por sexo — Pregunta p2"))
  expect_identical(lapply(piezas, function(p) p$sub$vars), list("p1", "p2"))
  expect_length(.word_multi_piezas(list(modo = "var_cruce", vars = c("p1", "p2"), cruce = "sexo"), "por_barra"), 2L)
  uno <- .word_multi_piezas(list(modo = "var_cruce", vars = c("p1", "p2"), cruce = "sexo"), "un_grafico")
  expect_length(uno, 1L)
  expect_true(isTRUE(uno[[1]]$sub$.word_con_grupos))
  expect_null(uno[[1]]$titulo)
})

test_that("un modo inválido es 400 E_REPORTE_PLAN_SPEC en la lámina, en el informe y antes de encolar", {
  e <- tryCatch(.wmm_var(word_multiapiladas = "dos_graficos"), error = function(e) e)
  expect_s3_class(e, "api_error")
  expect_identical(e$code, "E_REPORTE_PLAN_SPEC")
  expect_identical(e$status, 400L)
  e2 <- tryCatch(.apply_word_chart_presets(list(), w_presets(chart_options = list(multiapiladas_word = "x"))),
                 error = function(e) e)
  expect_identical(e2$code, "E_REPORTE_PLAN_SPEC")
  e3 <- tryCatch(.word_multi_validar_export(
    list(slides = list(list(payload = list(grafico = list(graficador = "p_barras_multiapiladas",
                                                          args = list(word_multiapiladas = "x")))))), list()),
    error = function(e) e)
  expect_identical(e3$status, 400L)
  expect_true(.word_multi_validar_export(list(slides = list()), list(chart_options = list(multiapiladas_word = "por_tema"))))
})

test_that("contrato HTTP: /word con un modo inválido en Word › Gráficos responde 400 y no encola", {
  skip_if_not_installed("plumber")
  sid <- session_create(); withr::defer(session_delete(sid))
  captura <- new.env()
  testthat::local_mocked_bindings(
    session_header = function(req) sid,
    .require_rp_data = function(sid) list(),
    .graficos_processing_sources = function(sid) list(data_sources = list(), inst_sources = list()),
    job_save_rds = function(...) tempfile(),
    .graficos_icon_registry = function(...) list(),
    .graficos_active_base_name = function(sid) "",
    .graficos_export_filename = function(...) "x",
    job_submit = function(sid, kind, func, args, ..., on_complete = NULL) { captura$args <- args; "job-wmm" },
    .package = "prosecnurapp"
  )
  pr <- mount_graficos(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  ep <- eps[[which(vapply(eps, function(e) identical(e$path, "/api/graficos/word") && "POST" %in% e$verbs, TRUE))]]
  llamar <- function(body) {
    req <- new.env(parent = emptyenv())
    req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
    res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
    out <- ep$getFunc()(req, res); attr(out, "status") <- res$status; out
  }
  plan <- list(slides = list(list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "T"))))
  r <- llamar(list(plan = plan, w_presets = list(chart_options = list(multiapiladas_word = "todo_junto"))))
  expect_identical(attr(r, "status"), 400L)
  expect_identical(r$error$code, "E_REPORTE_PLAN_SPEC")
  expect_null(captura$args)
  # El control: un valor válido encola y viaja al worker.
  r2 <- llamar(list(plan = plan, w_presets = list(chart_options = list(multiapiladas_word = "por_barra"))))
  expect_identical(captura$args$w_presets$chart_options$multiapiladas_word, "por_barra")
})

test_that("el docx del recetario cuenta una figura por pieza", {
  skip_if_not_installed("officer")
  cuenta <- function(grafico) {
    path <- withr::local_tempfile(fileext = ".docx")
    res <- reporte_word_plan(.wmm_data(), .wmm_inst(), path_docx = path,
                             presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
                             plan = list(diapo_001 = p_slide_1_grafico(grafico = grafico)), mensajes_progreso = FALSE)
    xml <- paste(readLines(unz(path, "word/document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
    list(figuras = res$figuras, imagenes = lengths(regmatches(xml, gregexpr("<pic:pic\\b", xml))))
  }
  hoy <- cuenta(.wmm_var())
  uno <- cuenta(.wmm_var(word_multiapiladas = "un_grafico"))
  # «Cómo leer este informe» trae sus propias figuras de ejemplo: lo que cambia con el modo es la diferencia.
  expect_identical(hoy$figuras - uno$figuras, 2L)
  expect_identical(hoy$imagenes - uno$imagenes, 2L)
})
