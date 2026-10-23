source("setup-load-all.R")

# W6 / decisión D6 (Gonzalo, checklist-revamp-informe-graficos-2026-10-14): cuántas figuras Word sale de una
# multiapilada se elige por lámina (`word_multiapiladas` del slot), con un valor del informe debajo
# (`w_presets$chart_options$multiapiladas_word`). Sin ninguno rige «automático» = el corte de siempre: `var` una figura
# por barra, `var_cruce` una por tema. La lámina del PPT no cambia.
# N8b (2026-10-22): «sin decisión» ya no es ese corte sino «mismo actor y misma escala»; el corte de antes es
# `automatico` EXPLÍCITO en el informe (`.wmm_antes`). Las pruebas de abajo que describían el corte de siempre como
# default pasan a pedirlo explícito; el default nuevo se prueba al final (N8b).
# Criterio B (usuario, 2026-10-22) reemplaza al «mismo actor y escala» como default: una figura por premisa, la misma
# premisa con varios actores en una figura con una fila por actor, y un actor solo repetido en varias premisas con la misma
# escala en una batería (enunciados en el eje Y). Los tests de N8/N8b que asumían que temas DISTINTOS de los mismos actores
# comparten figura pasan a esperar una figura por premisa; el banco de 14 casos vive en test-word-criterio-banco.R.
.wmm_antes <- list(multiapiladas_word = "automatico")

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
.wmm_nfilas <- function(charts) vapply(charts, function(m) NROW(attr(m$plot_word, "pulso_espec")$filas), 1L)

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

test_that("modo var: 'automatico' explícito sale como antes (una figura por barra); cada modo explícito, sus figuras", {
  skip_if_not_installed("officer")
  hoy <- .wmm_charts(.wmm_var(), chart_options = .wmm_antes)
  expect_length(hoy, 3L)
  expect_identical(.wmm_titulos(hoy), titulos_var_hoy)

  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = "por_barra"))), titulos_var_hoy)
  uno <- .wmm_charts(.wmm_var(word_multiapiladas = "un_grafico"))
  expect_length(uno, 1L)
  expect_identical(.wmm_titulos(uno), .WORD_TITULO_VACIO)   # D-b: sin título declarado la figura única sale sin título, no con el de la lámina
  tema <- .wmm_charts(.wmm_var(word_multiapiladas = "por_tema"))   # un solo tema: todas las barras juntas
  expect_identical(.wmm_titulos(tema), "Satisfacción")
  # La figura única lleva las tres barras: su espec tiene tres filas.
  expect_identical(NROW(attr(uno[[1]]$plot_word, "pulso_espec")$filas), 3L)
  # «Como el informe» desde la tarjeta llega vacío y es «sin decidir»: rige el default (N8b), no el corte de antes.
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = ""), chart_options = .wmm_antes)), titulos_var_hoy)
  expect_length(.wmm_charts(.wmm_var(word_multiapiladas = "")), 1L)
})

test_that("modo var_cruce multiactor: automático = por tema; por barra = tema + público; un gráfico = una figura con temas", {
  skip_if_not_installed("officer")
  hoy <- .wmm_charts(.wmm_multiactor(), .wmm_multi_data(), .wmm_multi_inst(), chart_options = .wmm_antes)
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
  expect_length(.wmm_charts(ml(), chart_options = .wmm_antes), 3L)       # 'automatico' explícito: una por barra de cada bloque
  expect_length(.wmm_charts(ml()), 2L)                                   # N8b, default: el bloque de dos barras junto (misma escala) y el de una
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
  hoy <- cuenta(.wmm_var(word_multiapiladas = "por_barra"))   # N8b: el corte de antes, pedido por el slot (el default ya junta)
  uno <- cuenta(.wmm_var(word_multiapiladas = "un_grafico"))
  # «Cómo leer este informe» trae sus propias figuras de ejemplo: lo que cambia con el modo es la diferencia.
  expect_identical(hoy$figuras - uno$figuras, 2L)
  expect_identical(hoy$imagenes - uno$imagenes, 2L)
})

# F2 (Renzo/Arte, 2026-10-22): valor nuevo del informe `un_grafico_mismo_publico`. El default «automatico» no cambia.
.wmm_mono <- function(...) p_barras_multiapiladas(modo = "var", vars = c("docentes$p1", "docentes$p2", "docentes$p3"),
                                                  titulo = "Gestión", ...)
.wmm_mono_charts <- function(grafico, modo = "un_grafico_mismo_publico") {
  .wmm_charts(grafico, .wmm_multi_data(), .wmm_multi_inst(), chart_options = if (!is.null(modo)) list(multiapiladas_word = modo))
}
.wmm_rotulos <- function(m) as.character(attr(m$plot_word, "pulso_espec")$filas$rotulo)

test_that("un_grafico_mismo_publico: un var de un solo público sale en una figura; el default sigue por barra", {
  skip_if_not_installed("officer")
  nuevo <- .wmm_mono_charts(.wmm_mono())
  expect_length(nuevo, 1L)
  expect_identical(NROW(attr(nuevo[[1]]$plot_word, "pulso_espec")$filas), 3L)
  expect_length(.wmm_mono_charts(.wmm_mono(), "automatico"), 3L)   # N8b: el corte de antes, explícito
  expect_length(.wmm_mono_charts(.wmm_mono(), NULL), 1L)           # N8b: el default ya junta una sola fuente de igual escala
  # varios públicos: se comporta como automático (una figura por barra)
  multi <- p_barras_multiapiladas(modo = "var", vars = c("docentes$p1", "estudiantes$p1"), titulo = "Gestión")
  expect_length(.wmm_mono_charts(multi), 2L)
})

test_that("un_grafico_mismo_publico: el título por barra no antepone la lámina; con 'automatico' (antes) sí", {
  skip_if_not_installed("officer")
  multi <- p_barras_multiapiladas(modo = "var", vars = c("docentes$p1", "estudiantes$p1"), titulo = "Gestión")
  expect_identical(.wmm_titulos(.wmm_mono_charts(multi)), c("Atención recibida", "Atención recibida"))
  expect_identical(.wmm_titulos(.wmm_mono_charts(multi, "automatico")),
                   c("Gestión — Atención recibida", "Gestión — Atención recibida"))
})

test_that("un_grafico_mismo_publico: la figura de una variable rotula el público al costado de la barra", {
  skip_if_not_installed("officer")
  multi <- p_barras_multiapiladas(modo = "var", vars = c("docentes$p1", "estudiantes$p1"), titulo = "Gestión")
  nuevo <- .wmm_mono_charts(multi)
  expect_identical(vapply(nuevo, function(m) .wmm_rotulos(m), ""), c("Docentes", "Estudiantes"))
  hoy <- .wmm_mono_charts(multi, "automatico")
  expect_identical(vapply(hoy, function(m) .wmm_rotulos(m), ""), c("", ""))
})

test_that("un_grafico_mismo_publico: el slot de la lámina manda sobre el informe", {
  skip_if_not_installed("officer")
  expect_length(.wmm_mono_charts(.wmm_mono(word_multiapiladas = "por_barra")), 3L)
  expect_identical(.wmm_titulos(.wmm_mono_charts(.wmm_mono(word_multiapiladas = "por_barra")))[1], "Gestión — Atención recibida")
  expect_length(.wmm_mono_charts(.wmm_mono(word_multiapiladas = "un_grafico"), "un_grafico_mismo_publico"), 1L)
})

test_that("un_grafico_mismo_publico es válido en el informe y no en la lámina; otros valores siguen en 400", {
  expect_identical(.word_multi_modo_normalizar("un_grafico_mismo_publico", "el informe", admite_automatico = TRUE),
                   "un_grafico_mismo_publico")
  expect_true(.word_multi_validar_export(list(slides = list()),
                                         list(chart_options = list(multiapiladas_word = "un_grafico_mismo_publico"))))
  e <- tryCatch(.word_multi_validar_export(list(slides = list()), list(chart_options = list(multiapiladas_word = "x"))),
                error = function(e) e)
  expect_identical(e$status, 400L)
  expect_identical(e$code, "E_REPORTE_PLAN_SPEC")
  e2 <- tryCatch(.wmm_var(word_multiapiladas = "un_grafico_mismo_publico"), error = function(e) e)
  expect_identical(e2$status, 400L)
})

# D-b (usuario, 2026-10-22): la figura única de un `var` (un_grafico / un_grafico_mismo_publico) lleva el título que el
# analista declara en `word_titulo_figura`; sin declarar sale sin título. `automatico`, `por_barra` y `por_tema` no cambian.
test_that("D-b: la figura única lleva el título declarado y, sin declarar, ninguno", {
  skip_if_not_installed("officer")
  vacio <- .WORD_TITULO_VACIO
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = "un_grafico"))), vacio)
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = "un_grafico", word_titulo_figura = "  Mi título "))),
                   "Mi título")
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_titulo_figura = ""), chart_options = list(multiapiladas_word = "un_grafico"))), vacio)
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_titulo_figura = "Otro"), chart_options = list(multiapiladas_word = "un_grafico"))), "Otro")
  expect_identical(.wmm_titulos(.wmm_mono_charts(.wmm_mono())), vacio)
  expect_identical(.wmm_titulos(.wmm_mono_charts(.wmm_mono(word_titulo_figura = "Gestión interna"))), "Gestión interna")
  # dos láminas distintas pueden quedar sin título sin error
  expect_length(.wmm_charts(p_barras_multiapiladas(modo = "var", vars = c("p2", "p3"), word_multiapiladas = "un_grafico")), 1L)
})

test_that("D-b: automático, por barra y por tema no cambian aunque haya título declarado", {
  skip_if_not_installed("officer")
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_titulo_figura = "X"), chart_options = .wmm_antes)), titulos_var_hoy)
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = "por_barra", word_titulo_figura = "X"))), titulos_var_hoy)
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_var(word_multiapiladas = "por_tema", word_titulo_figura = "X"))), "Satisfacción")
  expect_identical(.wmm_titulos(.wmm_mono_charts(.wmm_mono(word_titulo_figura = "X"), "automatico")),
                   paste("Gestión —", c("Atención recibida", "Tiempo de espera", "Trato del personal")))
  # var_cruce no cambia: sigue con el título de la lámina
  expect_identical(.wmm_titulos(.wmm_charts(.wmm_multiactor(word_multiapiladas = "un_grafico"), .wmm_multi_data(),
                                            .wmm_multi_inst())), "Gestión institucional")
})

test_that("D-b: el título de la figura única está en la ficha del slot y se normaliza", {
  nombres <- vapply(.GRAFICADORES_META$p_barras_multiapiladas$args, function(a) a$name, "")
  expect_true("word_titulo_figura" %in% nombres)
  expect_null(.word_titulo_figura_normalizar(NULL)); expect_null(.word_titulo_figura_normalizar(" "))
  expect_identical(.word_titulo_figura_normalizar(" a "), "a")
})

# N8 (usuario, 2026-10-22): «para Word se suelen agrupar cuando son un mismo actor». Valor nuevo del informe
# `un_grafico_mismo_actor`: en un var_cruce (o un bloque var_cruce de multilista), los temas CONSECUTIVOS con exactamente
# el mismo conjunto de actores van en UNA figura (los temas como cabeceras dentro de la figura). Sólo el Word; el
# default «automatico» (una figura por tema) y los demás valores no cambian.
.wmm_actor_vc <- function(vars, ...) p_barras_multiapiladas(
  modo = "var_cruce", titulo = "Gestión", vars = vars,
  titulos_grupo = c(t1 = "Tema uno", t2 = "Tema dos", t3 = "Tema tres")[names(vars)], ...)
.wmm_actor_ml <- function(vars, ...) p_barras_multiapiladas(
  modo = "multilista", titulo = "Bloques", bloques = list(
    list(modo = "var_cruce", vars = vars, titulos_grupo = c(t1 = "Tema uno", t2 = "Tema dos", t3 = "Tema tres")[names(vars)])), ...)
.wmm_actor_charts <- function(grafico, modo = "un_grafico_mismo_actor") {
  .wmm_charts(grafico, .wmm_multi_data(), .wmm_multi_inst(), chart_options = if (!is.null(modo)) list(multiapiladas_word = modo))
}
.wmm_mismo <- list(t1 = c("docentes$p1", "estudiantes$p1"), t2 = c("docentes$p2", "estudiantes$p2"),
                   t3 = c("docentes$p3", "estudiantes$p3"))

test_that("N8: tres temas del mismo actor van en una figura con el valor nuevo; con automático, una por tema", {
  skip_if_not_installed("officer")
  for (mk in list(.wmm_actor_vc, .wmm_actor_ml)) {
    expect_length(.wmm_actor_charts(mk(.wmm_mismo), "automatico"), 3L)   # N8b: ausente ya no es una por tema; lo es 'automatico'
    # criterio B: temas DISTINTOS de los mismos actores ya no comparten figura; una figura por premisa (fila por actor)
    uno <- .wmm_actor_charts(mk(.wmm_mismo), NULL)
    expect_length(uno, 3L)
    expect_identical(.wmm_nfilas(uno), c(2L, 2L, 2L))
    expect_identical(.wmm_titulos(uno), c("Tema uno", "Tema dos", "Tema tres"))   # orden de los temas, enunciado como título
    expect_length(.wmm_actor_charts(mk(.wmm_mismo)), 3L)                          # el alias vale lo mismo que el default
    # 'un_grafico' del slot sí junta los tres temas en una figura (cabeceras de tema)
    junto <- .wmm_charts(mk(.wmm_mismo, word_multiapiladas = "un_grafico"), .wmm_multi_data(), .wmm_multi_inst())
    expect_length(junto, 1L)
    expect_identical(unique(as.character(attr(junto[[1]]$plot_word, "pulso_espec")$filas$grupo_titulo)), c("Tema uno", "Tema dos", "Tema tres"))
  }
})

test_that("N8: temas con actores distintos no se agrupan; sólo se juntan los consecutivos con el mismo conjunto", {
  skip_if_not_installed("officer")
  distintos <- list(t1 = c("docentes$p1", "estudiantes$p1"), t2 = "estudiantes$p2", t3 = "docentes$p3")
  expect_length(.wmm_actor_charts(.wmm_actor_vc(distintos)), 3L)
  mixto <- list(t1 = "docentes$p1", t2 = c("estudiantes$p2", "docentes$p2"), t3 = c("docentes$p3", "estudiantes$p3"))
  ch <- .wmm_actor_charts(.wmm_actor_vc(mixto))   # criterio B: t2 y t3 son premisas distintas aunque tengan los mismos actores
  expect_length(ch, 3L)
  expect_identical(vapply(ch, function(m) NROW(attr(m$plot_word, "pulso_espec")$filas), 1L), c(1L, 2L, 2L))
  # no reordena: docentes, estudiantes, docentes son tres corridas
  alterna <- list(t1 = "docentes$p1", t2 = "estudiantes$p2", t3 = "docentes$p3")
  expect_length(.wmm_actor_charts(.wmm_actor_vc(alterna)), 3L)
})

test_that("N8: el slot de la lámina manda sobre el informe", {
  skip_if_not_installed("officer")
  expect_length(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo, word_multiapiladas = "por_tema")), 3L)
  expect_length(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo, word_multiapiladas = "por_barra")), 6L)
  expect_length(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo, word_multiapiladas = "un_grafico")), 1L)
})

test_that("N8: bloques var (y cruce) se comportan como con un_grafico_mismo_publico", {
  skip_if_not_installed("officer")
  expect_length(.wmm_actor_charts(.wmm_mono()), 1L)
  multi <- p_barras_multiapiladas(modo = "var", vars = c("docentes$p1", "estudiantes$p1"), titulo = "Gestión")
  expect_length(.wmm_actor_charts(multi), 1L)   # criterio B (C2): la misma premisa con dos públicos = una figura, fila por actor
  expect_identical(.wmm_rotulos(.wmm_actor_charts(multi)[[1]]), c("Docentes", "Estudiantes"))
})

test_that("N8: el valor es válido en el informe, no en la lámina; uno inválido sigue en 400", {
  expect_identical(.word_multi_modo_normalizar("un_grafico_mismo_actor", "el informe", admite_automatico = TRUE),
                   "un_grafico_mismo_actor")
  expect_true(.word_multi_validar_export(list(slides = list()),
                                         list(chart_options = list(multiapiladas_word = "un_grafico_mismo_actor"))))
  e <- tryCatch(.wmm_var(word_multiapiladas = "un_grafico_mismo_actor"), error = function(e) e)
  expect_identical(e$status, 400L)
  e2 <- tryCatch(.word_multi_validar_export(list(slides = list()), list(chart_options = list(multiapiladas_word = "mismo_actor"))),
                 error = function(e) e)
  expect_identical(e2$status, 400L)
  expect_identical(e2$code, "E_REPORTE_PLAN_SPEC")
})

# N8b (usuario, 2026-10-22): «haz que agrupar por mismo actor y misma escala sea el comportamiento por defecto del Word
# para todos los informes (con enunciados en el eje Y cuando hay un solo actor), y deja 'automático' como opción para
# el comportamiento anterior». Ausente = criterio nuevo; `automatico` explícito = una figura por tema/por barra; el slot
# por lámina sigue mandando. Escalas: p1 y p2 usan likert5; p3 usa sat4 (otra leyenda).
.wmm_sat4 <- function() data.frame(list_name = "sat4", name = c("1", "2", "3", "4"),
                                  label = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho"),
                                  stringsAsFactors = FALSE)
.wmm_inst_mix <- function(p3 = "sat4") {
  nm <- c("p1", "p2", "p3")
  list(survey = data.frame(name = nm, type = paste("select_one", c("likert5", "likert5", p3)),
                           list_name = c("likert5", "likert5", p3), label = c("Atención recibida", "Tiempo de espera", "Trato del personal"),
                           stringsAsFactors = FALSE),
       choices = rbind(.wmm_likert(), .wmm_sat4()), orders_list = NULL)
}
.wmm_data_mix <- function(n = 40, semilla = 1) {
  set.seed(semilla)
  data.frame(p1 = as.character(sample(1:5, n, TRUE)), p2 = as.character(sample(1:5, n, TRUE)),
             p3 = as.character(sample(1:4, n, TRUE)), stringsAsFactors = FALSE)
}
# Un bloque con dos escalas no cabe en UNA lámina del PPT (avisa «no comparten una escala»); aquí sólo se mira el Word.
.wmm_mix_charts <- function(grafico, chart_options = NULL) {
  suppressWarnings(.wmm_charts(grafico, list(docentes = .wmm_data_mix(30, 2), estudiantes = .wmm_data_mix(50, 3)),
                               list(docentes = .wmm_inst_mix(), estudiantes = .wmm_inst_mix()), chart_options = chart_options))
}
.wmm_nfilas <- function(charts) vapply(charts, function(m) NROW(attr(m$plot_word, "pulso_espec")$filas), 1L)

test_that("N8b/B: sin valor de informe ni de slot, una figura por premisa y su enunciado de título; el declarado sólo rige en la batería", {
  skip_if_not_installed("officer")
  uno <- .wmm_actor_charts(.wmm_actor_vc(.wmm_mismo), NULL)
  expect_length(uno, 3L)
  expect_identical(.wmm_nfilas(uno), c(2L, 2L, 2L))
  expect_identical(.wmm_titulos(uno), c("Tema uno", "Tema dos", "Tema tres"))   # C5: el enunciado, sin antepuesto de lámina
  # un título declarado no pisa el enunciado de una figura de una premisa (C5)
  expect_identical(.wmm_titulos(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo, word_titulo_figura = "Mi figura"), NULL)),
                   c("Tema uno", "Tema dos", "Tema tres"))
  # el alias del N8 vale lo mismo que el default
  expect_length(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo), "un_grafico_mismo_actor"), 3L)
  # y en la batería de un actor sí manda
  solo <- list(t1 = "docentes$p1", t2 = "docentes$p2")
  expect_identical(.wmm_titulos(.wmm_actor_charts(.wmm_actor_vc(solo, word_titulo_figura = "Mi figura"), NULL)), "Mi figura")
})

test_that("N8b/B: una escala distinta es otra figura (con aviso); no se reordena nada", {
  skip_if_not_installed("officer")
  vars <- list(t1 = c("docentes$p1", "estudiantes$p1"), t2 = c("docentes$p2", "estudiantes$p2"),
               t3 = c("docentes$p3", "estudiantes$p3"))
  ch <- .wmm_mix_charts(.wmm_actor_vc(vars))
  expect_length(ch, 3L)
  expect_identical(.wmm_nfilas(ch), c(2L, 2L, 2L))   # criterio B: una por premisa (t3, sat4, además es otra escala)
  # escala-actor-escala: tres figuras
  alterna <- list(t1 = c("docentes$p1", "estudiantes$p1"), t2 = c("docentes$p3", "estudiantes$p3"),
                  t3 = c("docentes$p2", "estudiantes$p2"))
  expect_length(.wmm_mix_charts(.wmm_actor_vc(alterna)), 3L)
  # 'automatico' explícito: una por tema, como antes
  expect_length(.wmm_mix_charts(.wmm_actor_vc(vars), list(multiapiladas_word = "automatico")), 3L)
})

test_that("N8b: con un solo actor las filas son los enunciados de cada tema, sin rótulo de actor", {
  skip_if_not_installed("officer")
  uno_solo <- list(t1 = "docentes$p1", t2 = "docentes$p2", t3 = "docentes$p3")
  ch <- .wmm_actor_charts(.wmm_actor_vc(uno_solo, top2box = TRUE, top2box_labels = c("De acuerdo", "Totalmente de acuerdo")), NULL)
  expect_length(ch, 1L)
  espec <- attr(ch[[1]]$plot_word, "pulso_espec")
  expect_identical(NROW(espec$filas), 3L)
  expect_identical(as.character(espec$filas$rotulo), c("Tema uno", "Tema dos", "Tema tres"))
  expect_false(any(grepl("Docentes", espec$filas$rotulo)))
  expect_true(all(is.na(espec$filas$grupo_titulo) | !nzchar(as.character(espec$filas$grupo_titulo))))   # sin cabeceras de tema
  expect_true(length(espec$box$cifras) > 0L)                      # Top Two Box presente
  expect_identical(.wmm_titulos(ch), .WORD_TITULO_VACIO)
  expect_identical(attr(.word_grafico(ch[[1]]$plot_word), "renderer"), "escala")
  # misma escala en 2 de 3 temas: dos figuras (2 filas y 1 fila), el actor sigue sin rotularse
  mix <- .wmm_mix_charts(.wmm_actor_vc(uno_solo))
  expect_identical(.wmm_nfilas(mix), c(2L, 1L))
  expect_false(any(grepl("Docentes", .wmm_rotulos(mix[[1]]))))          # la batería no rotula al actor
  expect_identical(.wmm_rotulos(mix[[2]]), "Docentes")                  # una barra suelta sí dice de quién es
  expect_identical(.wmm_titulos(mix)[2], "Tema tres")                   # y su título es el enunciado
  # 'automatico' explícito: el actor en el eje Y, una figura por tema
  viejo <- .wmm_actor_charts(.wmm_actor_vc(uno_solo), "automatico")
  expect_length(viejo, 3L)
  expect_identical(unique(unlist(lapply(viejo, .wmm_rotulos))), "Docentes")
})

test_that("N8b: bloque var de una sola fuente se corta en tramos consecutivos de igual escala", {
  skip_if_not_installed("officer")
  g <- p_barras_multiapiladas(modo = "var", vars = c("docentes$p1", "docentes$p2", "docentes$p3"), titulo = "Gestión")
  ch <- .wmm_mix_charts(g)
  expect_identical(.wmm_nfilas(ch), c(2L, 1L))
  expect_identical(.wmm_titulos(ch)[1], .WORD_TITULO_VACIO)      # tramo de varias barras: D-b
  expect_identical(.wmm_titulos(ch)[2], "Trato del personal")   # barra suelta: su enunciado (criterio B, C5)
  expect_length(.wmm_mix_charts(g, list(multiapiladas_word = "automatico")), 3L)
  expect_length(.wmm_mix_charts(g, list(multiapiladas_word = "por_barra")), 3L)
})

test_that("N8b: 'automatico' explícito del informe se distingue de ausente; el slot manda", {
  skip_if_not_installed("officer")
  expect_identical(.word_multi_modo_normalizar("automatico", "el informe", admite_automatico = TRUE), "automatico")
  expect_null(.word_multi_modo_normalizar("", "el informe", admite_automatico = TRUE))
  expect_identical(.word_multi_modo_resolver(list(), NULL), .WORD_MULTI_MODO_DEFAULT)
  pres <- list(base = list(args = list(word_multiapiladas = "automatico")))
  expect_identical(.word_multi_modo_resolver(list(), pres), "automatico")
  expect_identical(.word_multi_modo_resolver(list(word_multiapiladas = "por_barra"), pres), "por_barra")
  expect_length(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo, word_multiapiladas = "por_tema"), NULL), 3L)
  expect_length(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo, word_multiapiladas = "por_barra"), NULL), 6L)
  expect_length(.wmm_actor_charts(.wmm_actor_vc(.wmm_mismo, word_multiapiladas = "un_grafico"), NULL), 1L)
})
