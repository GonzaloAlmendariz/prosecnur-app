source("setup-load-all.R")

# Revisión metodológica de la regla de preguntas (ADR 0135), hallazgos H2, H3 y H4. La regla mide con las cifras que
# rotula la lámina; aquí se fija que el conteo, el render y /cifras dicen lo mismo:
#   H2  la diferencia de dos cifras redondeadas se vuelve a redondear (16,4 − 1,4 = 15,0, no 14,999999999999998);
#   H3  el conteo usa los presets del estudio (sus `excluir_opciones` y sus `valores_decimales`), como el render;
#   H4  el conteo dice cuándo la escala sale como imagen también por tener dos columnas «Sin información» (98 y 99).

# ---- H2: punto flotante en la diferencia --------------------------------------------------------------------------

.cp_par <- function(t, v1, v2, o) data.frame(tema = t, grupo = c("g1", "g2"), valor = c(v1, v2), sin_info = 0, orden = o,
                                             stringsAsFactors = FALSE)

test_that("H2: 16,4 − 1,4 mide 15,0 y entra en «diferencia de al menos 15» (la lámina rotula «15,0 pts»)", {
  ind <- rbind(.cp_par("A", 16.4, 1.4, 1), .cp_par("B", 70, 55, 2), .cp_par("C", 90, 20, 3))
  ev <- .regla_preguntas_evaluar(ind, list(tipo = "diferencia_minima", umbral = 15), decimales = 1L)
  expect_identical(unname(ev$metrica[["A"]]), 15)   # antes 14.999999999999998: quedaba fuera
  expect_identical(ev$temas, c("C", "A", "B"))
  expect_identical(ev$texto, "Se muestran las 3 con diferencia de al menos 15 puntos, de 3 preguntas comunes.")
  # El par más chico que delató el redondeo (1,4 − 0,4 con umbral 1).
  ev1 <- .regla_preguntas_evaluar(rbind(.cp_par("A", 1.4, 0.4, 1), .cp_par("B", 80, 50, 2)),
                                  list(tipo = "diferencia_minima", umbral = 1), decimales = 1L)
  expect_identical(ev1$temas, c("B", "A"))
})

test_that("H2: en «mayor diferencia» un empate visible lo decide el orden del instrumento, no el flotante", {
  ind <- rbind(.cp_par("A", 16.4, 1.4, 1), .cp_par("B", 70, 55, 2), .cp_par("C", 90, 20, 3))
  ev <- .regla_preguntas_evaluar(ind, list(tipo = "mayor_diferencia", n = 2), decimales = 1L)
  expect_identical(ev$temas, c("C", "A"))   # antes C, B: A perdía el empate de 15,0 por 2e-15
  # Con tres públicos la diferencia es el mayor menos el menor, con el mismo redondeo.
  tres <- data.frame(tema = rep(c("A", "B"), each = 3), grupo = rep(c("g1", "g2", "g3"), 2),
                     valor = c(16.4, 9, 1.4, 70, 60, 55), orden = rep(1:2, each = 3), stringsAsFactors = FALSE)
  ev3 <- .regla_preguntas_evaluar(tres, list(tipo = "mayor_diferencia", n = 1), decimales = 1L)
  expect_identical(unname(ev3$metrica), c(15, 15))
  expect_identical(ev3$temas, "A")
})

test_that("H2: el promedio de «extremos» no deja que el flotante rompa un empate exacto", {
  # mean(0,1; 0,2) = 0,15000000000000002 y mean(0,15; 0,15) = 0,15: empatan, y gana la primera del instrumento.
  ind <- data.frame(tema = rep(c("A", "B", "C"), each = 2), grupo = rep(c("g1", "g2"), 3),
                    valor = c(0.15, 0.15, 0.1, 0.2, 0.01, 0.01), orden = rep(1:3, each = 2), stringsAsFactors = FALSE)
  ev <- .regla_preguntas_evaluar(ind, list(tipo = "extremos", n = 1), decimales = 2L)
  expect_identical(ev$temas, c("A", "C"))
})

# ---- Fixture de la escala: una base, cuatro preguntas de una batería 1–5 con un 9 «No sabe» -------------------

.cp_inst <- function(cods, rotulos) list(
  survey = data.frame(name = paste0("a", 1:4), type = "select_one lk", list_name = "lk",
                      label = c("Reglamentos", "Biblioteca", "Tutoría", "Salud"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = cods, label = rotulos, stringsAsFactors = FALSE), orders_list = NULL)

.cp_fuentes <- function(cods, conteos, rotulos) {
  cols <- lapply(conteos, function(cn) rep(cods, cn))
  L <- max(lengths(cols))
  d <- as.data.frame(lapply(cols, function(x) c(x, rep(NA, L - length(x)))), stringsAsFactors = FALSE)
  list(data_sources = list(doc = d), inst_sources = list(doc = .cp_inst(cods, rotulos)))
}

.CP_LK <- c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo")

# a1 trae ocho «9»: con el 9 excluido su Top Two Box es 21/41 (10,5 + 11 unidades rotuladas = 51,2 con un decimal).
.cp_fuentes_9 <- function() .cp_fuentes(c("1", "2", "3", "4", "5", "9"),
  list(a1 = c(5, 5, 10, 11, 10, 8), a2 = c(5, 5, 9, 10, 10, 0), a3 = c(10, 10, 5, 8, 7, 0), a4 = c(2, 2, 2, 10, 10, 0)),
  c(.CP_LK, "No sabe"))

.cp_render_espec <- function(el, src, presets) {
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, presets = presets,
                                           plan = p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala"))),
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  attr(out$rendered[[1]], "pulso_espec", exact = TRUE)
}

.cp_metricas <- function(cnt) stats::setNames(vapply(cnt$candidatas, function(c) c$metrica %||% NA_real_, 0),
                                              vapply(cnt$candidatas, `[[`, "", "tema"))

# ---- H3: el conteo con los presets del estudio --------------------------------------------------------------------

test_that("H3: con un preset que excluye el 9 y pide un decimal, conteo = render = /cifras", {
  src <- .cp_fuentes_9()
  presets <- .build_presets(list(barras_divergentes = list(excluir_opciones = "9", valores_decimales = 1)))
  args <- list(vars = "doc$*", regla = list(tipo = "bajo_umbral", umbral = 51.25))
  cnt <- .regla_preguntas_conteo("p_barras_divergentes", args, src, presets)
  m <- .cp_metricas(cnt)
  # Antes, sin presets: 42 (el 9 en el denominador), 52, 38 y 76, con cero decimales.
  expect_identical(unname(m), c(51.2, 51.2, 37.5, 77))
  expect_identical(unlist(cnt$seleccionadas), c("doc$a3", "doc$a1", "doc$a2"))
  # El render con el mismo preset rotula esas cifras.
  esp <- .cp_render_espec(.rebuild_graf(list(graficador = "p_barras_divergentes", args = args)), src, presets)
  expect_identical(esp$decimales, 1L)
  expect_equal(stats::setNames(esp$total_pos / 10^esp$decimales, esp$filas),
               stats::setNames(c(37.5, 51.2, 51.2), c("Tutoría", "Reglamentos", "Biblioteca")))
  # /cifras (el cierre con hallazgos) da las mismas.
  cf <- .graficos_cifras_de_grafico("p_barras_divergentes", args, src, presets)
  t2b <- Filter(function(x) startsWith(x$clave, "t2b:"), cf$cifras)
  expect_equal(stats::setNames(vapply(t2b, `[[`, 0, "valor"), vapply(t2b, `[[`, "", "rotulo")),
               stats::setNames(c(37.5, 51.2, 51.2), paste0(c("Tutoría", "Reglamentos", "Biblioteca"), ": acuerdo")))
  # Sin presets, el conteo de siempre (el 9 cuenta en el denominador de a1 y la lámina rotula enteros).
  expect_identical(unname(.cp_metricas(.regla_preguntas_conteo("p_barras_divergentes", args, src))), c(42, 52, 38, 76))
})

test_that("H3: los decimales salen del preset y, encima, de la lámina (la mezcla del render)", {
  el <- p_barras_divergentes(vars = "doc$*", regla = list(tipo = "bajo_umbral", umbral = 50))
  expect_identical(.regla_preguntas_decimales(el, list(valores_decimales = 1)), 1L)
  el$overrides$valores_decimales <- 0L
  expect_identical(.regla_preguntas_decimales(el, list(valores_decimales = 1)), 0L)
  expect_identical(.regla_preguntas_decimales(p_barras_divergentes(vars = "doc$*"), NULL), 0L)
})

test_that("H3: «más Sin información» con un preset de un decimal mide lo que rotula la columna especial", {
  src <- .cp_fuentes_9()
  presets <- .build_presets(list(barras_divergentes = list(valores_decimales = 1)))
  args <- list(vars = "doc$*", regla = list(tipo = "mayor_sin_info", n = 1))
  cnt <- .regla_preguntas_conteo("p_barras_divergentes", args, src, presets)
  m <- .cp_metricas(cnt)
  esp <- .cp_render_espec(.rebuild_graf(list(graficador = "p_barras_divergentes", args = args)), src, presets)
  si <- rowSums(esp$unidades[, esp$categorias$lado == "sin_inf", drop = FALSE]) / 10^esp$decimales
  expect_identical(unname(m[["doc$a1"]]), unname(si[[1]]))   # 8/49: 16,3 en la lámina; antes el conteo decía 16
  expect_identical(unname(m[["doc$a1"]]), 16.3)
  expect_identical(unlist(cnt$seleccionadas), "doc$a1")
})

# ---- H4: la otra causa del respaldo ---------------------------------------------------------------------------------

.cp_fuentes_98_99 <- function(con_99 = TRUE) {
  cods <- c("1", "2", "3", "4", "5", "98", if (con_99) "99")
  conteos <- list(a1 = c(5, 5, 10, 11, 10, 3, 2), a2 = c(5, 5, 9, 10, 10, 2, 2), a3 = c(10, 10, 5, 8, 7, 2, 1),
                  a4 = c(2, 2, 2, 10, 10, 1, 1))
  if (!con_99) conteos <- lapply(conteos, function(x) x[1:6])
  .cp_fuentes(cods, conteos, c(.CP_LK, "No sabe", if (con_99) "No responde"))
}

.CP_MOTIVO_SI <- "Hay dos opciones sin información; la lámina nativa admite una y la escala sale como imagen."

test_that("H4: con 98 «No sabe» y 99 «No responde» el conteo avisa que la escala sale como imagen y no promete nativa", {
  src <- .cp_fuentes_98_99()
  args <- list(vars = "doc$*", regla = list(tipo = "bajo_umbral", umbral = 60))
  cnt <- .regla_preguntas_conteo("p_barras_divergentes", args, src)
  expect_length(cnt$seleccionadas, 3L)   # tres filas: muy bajo el tope de 20
  expect_identical(cnt$tope_filas, 20L)
  expect_false(cnt$cabe_nativa)
  expect_identical(cnt$motivo_imagen, .CP_MOTIVO_SI)
  expect_true(.CP_MOTIVO_SI %in% unlist(cnt$avisos))   # antes: ningún aviso
  # El render coincide: dos columnas especiales y la lámina nativa no cabe.
  esp <- .cp_render_espec(.rebuild_graf(list(graficador = "p_barras_divergentes", args = args)), src, NULL)
  expect_identical(sum(esp$categorias$lado == "sin_inf"), 2L)
  expect_false(.lam_divergentes_resumen_cabe(esp))
})

test_that("H4: con una sola columna «Sin información» cabe; los gráficos sin esa restricción dicen null", {
  cnt <- .regla_preguntas_conteo("p_barras_divergentes", list(vars = "doc$*", regla = list(tipo = "bajo_umbral", umbral = 60)),
                                 .cp_fuentes_98_99(con_99 = FALSE))
  expect_true(cnt$cabe_nativa)
  expect_true(is.na(cnt$motivo_imagen))
  expect_false(any(grepl("sale como imagen", unlist(cnt$avisos))))
})

test_that("H4: el aviso dice cada causa por separado", {
  expect_identical(.divergentes_aviso_tope(3, NULL, 2L), .CP_MOTIVO_SI)
  expect_identical(.divergentes_aviso_tope(3, NULL, 3L),
                   "Hay tres opciones sin información; la lámina nativa admite una y la escala sale como imagen.")
  expect_null(.divergentes_aviso_tope(20, NULL, 1L))
  ambos <- .divergentes_aviso_tope(22, "Se muestran las 22 bajo 60%, de 157 preguntas de escala.", 2L)
  expect_identical(ambos, c("22 preguntas bajo 60%; la lámina nativa admite 20 y la escala sale como imagen.", .CP_MOTIVO_SI))
})

# ---- Contrato HTTP: el endpoint prepara los presets de la vista previa y serializa los campos nuevos -----------

.cp_sesion <- function(src) {
  sid <- session_create()
  session_set(sid, "estudio", list(bases = list(doc = list(nombre = "doc")), active_base = "doc", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", src$inst_sources)
  sid
}

.cp_http <- function(sid, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/graficos/resumenes/regla", QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = crudo, postBody = body, CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: el conteo usa los presets de la configuración, como /cifras", {
  sid <- .cp_sesion(.cp_fuentes_9()); on.exit(session_delete(sid), add = TRUE)
  args <- '"args": {"vars": ["doc$*"], "regla": {"tipo": "bajo_umbral", "umbral": 51.25}}'
  con <- .cp_http(sid, paste0('{"graficador": "p_barras_divergentes", ', args,
                              ', "config": {"presets": {"barras_divergentes": {"excluir_opciones": ["9"], "valores_decimales": 1}}}}'))
  expect_identical(con$status, 200L)
  metrica <- function(r) stats::setNames(vapply(r$body$candidatas, function(c) as.numeric(c$metrica), 0),
                                         vapply(r$body$candidatas, `[[`, "", "tema"))
  expect_identical(unname(metrica(con)), c(51.2, 51.2, 37.5, 77))
  expect_identical(con$body$cabe_nativa, TRUE)
  expect_null(con$body$motivo_imagen)
  sin <- .cp_http(sid, paste0('{"graficador": "p_barras_divergentes", ', args, '}'))
  expect_identical(unname(metrica(sin)), c(42, 52, 38, 76))
})

test_that("HTTP: con dos «Sin información» responde cabe_nativa false y su motivo; un panorama, null", {
  sid <- .cp_sesion(.cp_fuentes_98_99()); on.exit(session_delete(sid), add = TRUE)
  r <- .cp_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["doc$*"], "regla": {"tipo": "bajo_umbral", "umbral": 60}}}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$cabe_nativa, FALSE)
  expect_identical(r$body$motivo_imagen, .CP_MOTIVO_SI)
  p <- .cp_http(sid, '{"graficador": "p_panorama", "args": {"vars": ["doc$*"], "corte": ["4", "5"]}}')
  expect_identical(p$status, 200L)
  expect_true("cabe_nativa" %in% names(p$body)); expect_null(p$body$cabe_nativa); expect_null(p$body$motivo_imagen)
})
