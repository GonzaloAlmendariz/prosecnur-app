source("setup-load-all.R")

# ADR 0141 (ROT-2): ranking de rótulos largos y nombres cortos del mazo. `plan$rotulos_cortos$preguntas` vale en todo
# gráfico que rotula una pregunta por su variable; precedencia: el gráfico > el mazo > otro gráfico (E4) > instrumento.
# Es de Gráficos: Analítica conserva su revisión de etiquetas y este mapa no la lee ni la escribe.

.rcp_largo_p1 <- "La institución cuenta con mecanismos efectivos para recoger y atender las opiniones de sus estudiantes"
.rcp_largo_p2 <- "Los docentes publican sus horarios de atención con anticipación suficiente"
.rcp_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")

.rcp_inst <- function() list(
  survey = data.frame(name = c("p1", "p2", "sexo"), type = c("select_one esc", "select_one esc", "select_one sx"),
                      list_name = c("esc", "esc", "sx"), label = c(.rcp_largo_p1, .rcp_largo_p2, "Sexo"),
                      stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("esc", 4), "sx", "sx"), name = c(as.character(1:4), "1", "2"),
                       label = c(.rcp_niv, "Mujer", "Hombre"), stringsAsFactors = FALSE),
  orders_list = NULL, label_col_survey = "label", label_col_choices = "label", lang = "es")

.rcp_df <- function(n = 90) {
  set.seed(4)
  data.frame(p1 = sample(.rcp_niv, n, TRUE), p2 = sample(.rcp_niv, n, TRUE), sexo = sample(c("Mujer", "Hombre"), n, TRUE),
             stringsAsFactors = FALSE)
}

.rcp_plan <- function(rotulos = NULL) {
  p <- list(slides = list(
    list(id = "s1", tipo = "p_slide_1_grafico", payload = list(grafico = list(graficador = "p_barras_apiladas",
         args = list(var = "docentes$p1")))),
    list(id = "s2", tipo = "p_slide_1_grafico", payload = list(grafico = list(graficador = "p_barras_apiladas",
         args = list(var = "docentes$p1", overrides = list(etiquetas_vars = list(`docentes$p2` = "Horarios (E4)")))))),
    list(id = "s3", tipo = "p_slide_1_grafico", payload = list(grafico = list(graficador = "p_barras_categoricas",
         args = list(var = "docentes$sexo")))),
    list(id = "s4", tipo = "p_slide_resumen", payload = list(grafico = list(graficador = "p_divergentes_resumen",
         args = list(var = "docentes$*"))))))
  if (!is.null(rotulos)) p$rotulos_cortos <- rotulos
  p
}

test_that("precedencia de los cuatro niveles: gráfico > mazo > otro gráfico > instrumento", {
  plan <- .rcp_plan(list(`Totalmente en desacuerdo` = "TD", preguntas = list(`docentes$p1` = "Escucha (mazo)",
                                                                                `docentes$p2` = "Horarios (mazo)")))
  # 4. sin contexto: el instrumento (no hay override).
  expect_null(.rotulos_preguntas_vigentes("docentes"))
  # 3. sólo E4 (el plan sin `preguntas`): el nombre de otro gráfico.
  withr::with_options(list(prosecnur.sig_informe = .nombres_cortos_en_contexto(NULL, .rcp_plan())), {
    m <- .rotulos_preguntas_vigentes("docentes")
    expect_identical(m$p2, "Horarios (E4)"); expect_null(m$p1)
  })
  withr::local_options(prosecnur.sig_informe = .nombres_cortos_en_contexto(NULL, plan))
  # 2. el mazo gana a E4.
  m <- .rotulos_preguntas_vigentes("docentes")
  expect_identical(m$p1, "Escucha (mazo)"); expect_identical(m$p2, "Horarios (mazo)")
  # La calificada de otra base no se cuela.
  expect_null(.rotulos_preguntas_vigentes("estudiantes")$p1)
  # 1. el «Nombre corto de la pregunta» de ESE gráfico gana a todo.
  withr::with_options(list(prosecnur.plan_etiquetas_cortas = list(p1 = "Escucha (este gráfico)")), {
    expect_identical(.rotulos_preguntas_vigentes("docentes")$p1, "Escucha (este gráfico)")
    expect_identical(.rotulos_preguntas_vigentes("docentes")$p2, "Horarios (mazo)")
  })
  # Las láminas de resumen: el mazo va antes que E4 cuando el rótulo es el del instrumento.
  instrument_sources <- list(docentes = .rcp_inst())
  expect_identical(.resumen_rotulo_corto("docentes$p2", .rcp_largo_p2), "Horarios (mazo)")
  expect_identical(.resumen_rotulo_corto("docentes$p2", "Rótulo escrito aquí"), "Rótulo escrito aquí")
})

test_that("compatibilidad: un rotulos_cortos guardado (sólo opciones) se lee igual y `preguntas` no es una opción", {
  viejo <- list(`Totalmente en desacuerdo` = "TD", `Totalmente de acuerdo` = "TA")
  expect_identical(.rotulos_cortos_mapa(viejo), c(`Totalmente en desacuerdo` = "TD", `Totalmente de acuerdo` = "TA"))
  nuevo <- c(viejo, list(preguntas = list(`docentes$p1` = "Escucha")))
  expect_identical(.rotulos_cortos_mapa(nuevo), .rotulos_cortos_mapa(viejo))
  expect_identical(.rotulos_cortos_mapa(c(TD = "x")), c(TD = "x"))   # un vector nombrado, como antes
  expect_length(.rotulos_cortos_preguntas(viejo), 0L)
  expect_identical(.rotulos_cortos_preguntas(nuevo), list(`docentes$p1` = "Escucha"))
  # La regla inclusiva y el reemplazo siguen aplicándose a las opciones, no a la clave reservada.
  expect_identical(.rotulos_cortos_aplicar(c("Totalmente de acuerdo", "preguntas"), .rotulos_cortos_mapa(nuevo)), c("TA", "preguntas"))
})

test_that("el ranking ordena del rótulo más largo al más corto, con los cortos guardados y los usos por lámina", {
  sources <- list(list(name = "docentes", variables = .graficos_extract_vars_from_inst(.rcp_inst(), data = .rcp_df(), source_name = "docentes")))
  plan <- .rcp_plan(list(`Totalmente en desacuerdo` = "TD", preguntas = list(`docentes$p2` = "Horarios")))
  r <- .graficos_rotulos_ranking(sources, plan)
  expect_true(r$ok); expect_identical(r$scope, "graficos")
  b <- r$bases[[1]]
  expect_identical(b$base, "docentes")
  expect_identical(vapply(b$preguntas, `[[`, "", "ref"), c("docentes$p1", "docentes$p2", "docentes$sexo"))
  largos <- vapply(b$preguntas, function(x) x$largo, integer(1))
  expect_false(is.unsorted(rev(largos)))
  expect_identical(b$preguntas[[1]]$usos, 2L)          # p1 en s1 y s2; el comodín de s4 no suma
  expect_null(b$preguntas[[1]]$corto)                   # nada se acorta solo
  expect_identical(b$preguntas[[2]]$corto, "Horarios")
  expect_identical(b$preguntas[[2]]$corto_en_grafico, "Horarios (E4)")
  expect_identical(b$preguntas[[2]]$usos, 0L)
  et <- vapply(b$opciones, `[[`, "", "etiqueta")
  expect_identical(et[1], "Totalmente en desacuerdo")
  expect_false(is.unsorted(rev(vapply(b$opciones, function(x) x$largo, integer(1)))))
  expect_identical(b$opciones[[1]]$corto, "TD")
  expect_identical(b$opciones[[1]]$codigo, "1")
  expect_identical(b$opciones[[1]]$usos, 2L)
  expect_identical(b$opciones[[which(et == "Mujer")]]$usos, 1L)
  expect_null(b$opciones[[which(et == "Mujer")]]$corto)
})

test_that("guardar valida: vacío, no más corto, ref desconocida (400 registrados) y avisa colisiones sin bloquear", {
  en <- function(ref) c(`docentes$p1` = .rcp_largo_p1, `docentes$p2` = .rcp_largo_p2)[ref] %||% NA_character_
  orig <- function(ref) { x <- unname(en(ref)); if (is.null(x) || is.na(x)) NA_character_ else x }
  code <- function(expr) tryCatch({ expr; NA_character_ }, api_error = function(e) e$code)
  expect_identical(code(.rotulos_cortos_guardar(NULL, list(preguntas = list(`docentes$p1` = "  ")), orig)), "E_ROTULO_CORTO_VACIO")
  expect_identical(code(.rotulos_cortos_guardar(NULL, list(preguntas = list(`docentes$p1` = .rcp_largo_p1)), orig)), "E_ROTULO_CORTO_NO_ACORTA")
  expect_identical(code(.rotulos_cortos_guardar(NULL, list(opciones = list(Mujer = "Mujeres")), orig)), "E_ROTULO_CORTO_NO_ACORTA")
  expect_identical(code(.rotulos_cortos_guardar(NULL, list(preguntas = list(`docentes$zz` = "x")), orig)), "E_ROTULO_CORTO_REF")
  expect_identical(code(.rotulos_cortos_guardar(NULL, list(), orig)), "E_BAD_JSON")
  expect_true(all(c("E_ROTULO_CORTO_VACIO", "E_ROTULO_CORTO_NO_ACORTA", "E_ROTULO_CORTO_REF", "E_GRAFICOS_ROTULOS_SCOPE") %in%
                    errores_registrados()$codigo))
  actual <- list(`Totalmente en desacuerdo` = "TD")
  r <- .rotulos_cortos_guardar(actual, list(preguntas = list(`docentes$p1` = "Escucha", `docentes$p2` = "escucha ")), orig)
  expect_identical(r$rotulos_cortos$`Totalmente en desacuerdo`, "TD")          # la sección ausente se conserva
  expect_identical(r$rotulos_cortos$preguntas, list(`docentes$p1` = "Escucha", `docentes$p2` = "escucha"))
  expect_length(r$avisos, 1L); expect_identical(r$avisos[[1]]$tipo, "preguntas"); expect_identical(r$avisos[[1]]$base, "docentes")
  # null quita la entrada; una sección vacía quita la sección.
  r2 <- .rotulos_cortos_guardar(r$rotulos_cortos, list(preguntas = list(`docentes$p1` = NULL)), orig)
  expect_null(r2$rotulos_cortos$preguntas)
  expect_identical(r2$rotulos_cortos$`Totalmente en desacuerdo`, "TD")
  expect_null(.rotulos_cortos_guardar(actual, list(opciones = list()), orig)$rotulos_cortos)
})

test_that("render: el nombre corto del mazo llega a un gráfico que no declara el suyo", {
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Una escala"))
  plan_json <- .rcp_plan(list(preguntas = list(p1 = "Escucha a sus estudiantes")))
  out <- tempfile(fileext = ".pptx")
  withr::with_options(list(prosecnur.sig_informe = .nombres_cortos_en_contexto(NULL, plan_json)),
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = .rcp_df(), instrumento = .rcp_inst(), plan = plan, path_ppt = out,
      presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE))))
  txt <- paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1])), "//a:t")), collapse = " | ")
  expect_match(txt, "Escucha a sus estudiantes", fixed = TRUE)
  expect_false(grepl("mecanismos efectivos", txt, fixed = TRUE))
  # Sin el contexto, el enunciado del instrumento: el mapa no queda puesto.
  out2 <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .rcp_df(), instrumento = .rcp_inst(), plan = plan, path_ppt = out2,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  txt2 <- paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(.pptx_leer_parte(out2, .pptx_slide_paths(out2)[1])), "//a:t")), collapse = " | ")
  expect_match(gsub("\\s+", " ", txt2), "mecanismos efectivos", fixed = TRUE)
})

# ---- Contrato HTTP e independencia de Analítica -------------------------------------------------------------------

.rcp_sesion <- function() {
  sid <- session_create()
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes")), active_base = "docentes",
                                   processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", list(docentes = .rcp_df()))
  session_set(sid, "rp_inst_sources", list(docentes = .rcp_inst()))
  sid
}

.rcp_http <- function(sid, method, path, query = "", body = NULL) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_rotulos(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  raw_body <- if (is.null(body)) raw(0) else charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  req <- as.environment(list(REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = query, HTTP_X_PULSO_SESSION = sid,
                             HEADERS = c(`x-pulso-session` = sid, `content-type` = "application/json"),
                             CONTENT_TYPE = "application/json", HTTP_CONTENT_TYPE = "application/json",
                             rook.input = list(read = function(...) raw_body, rewind = function() invisible(0),
                                               read_lines = function(...) rawToChar(raw_body))))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: guardar y leer el ranking; Analítica no se lee ni se escribe", {
  sid <- .rcp_sesion(); on.exit(session_delete(sid), add = TRUE)
  cfg_a <- list(datos = list(label_overrides = list(p1 = "Curado en Analítica")))
  .analitica_config_set(sid, cfg_a)
  r <- .rcp_http(sid, "POST", "/api/graficos/rotulos",
                 body = list(preguntas = list(`docentes$p1` = "Escucha"), opciones = list(`Totalmente en desacuerdo` = "TD")))
  expect_identical(r$status, 200L)
  expect_identical(r$body$rotulos_cortos$preguntas$`docentes$p1`, "Escucha")
  expect_identical(r$body$rotulos_cortos$`Totalmente en desacuerdo`, "TD")
  expect_length(r$body$avisos, 0L)
  expect_identical(.graficos_config_get(sid)$plan$rotulos_cortos$preguntas$`docentes$p1`, "Escucha")
  expect_identical(.analitica_get_config(sid)$datos$label_overrides$p1, "Curado en Analítica")   # intacta
  expect_null(.analitica_get_config(sid)$rotulos_cortos)
  g <- .rcp_http(sid, "GET", "/api/graficos/rotulos/ranking", "scope=graficos")
  expect_identical(g$status, 200L)
  p <- g$body$bases[[1]]$preguntas
  expect_identical(p[[1]]$ref, "docentes$p1"); expect_identical(p[[1]]$corto, "Escucha")
  expect_identical(names(p[[1]])[1:4], c("ref", "etiqueta", "largo", "usos"))
  expect_identical(g$body$bases[[1]]$opciones[[1]]$corto, "TD")
  # El ranking no toma el rótulo curado de Analítica como corto de Gráficos.
  expect_false(any(vapply(p, function(x) identical(x$corto, "Curado en Analítica"), logical(1))))
  # scope de Analítica: 400 con su código. Validación: 400 con su código.
  e <- .rcp_http(sid, "GET", "/api/graficos/rotulos/ranking", "scope=analitica")
  expect_identical(e$status, 400L); expect_identical(e$body$error$code %||% e$body$code, "E_GRAFICOS_ROTULOS_SCOPE")
  v <- .rcp_http(sid, "POST", "/api/graficos/rotulos", body = list(preguntas = list(`docentes$p1` = "")))
  expect_identical(v$status, 400L); expect_identical(v$body$error$code %||% v$body$code, "E_ROTULO_CORTO_VACIO")
  expect_identical(.graficos_config_get(sid)$plan$rotulos_cortos$preguntas$`docentes$p1`, "Escucha")   # un rechazo no escribe
})

test_that("el endpoint queda montado en la app", {
  src <- paste(readLines(test_path("..", "..", "R", "plumber_app.R"), warn = FALSE), collapse = "\n")
  expect_match(src, "mount_graficos_rotulos(pr)", fixed = TRUE)
})
