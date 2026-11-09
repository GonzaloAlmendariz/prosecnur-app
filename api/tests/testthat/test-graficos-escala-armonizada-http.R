source("setup-load-all.R")

# ADR 0135, oleada 9 y re-revisiones de 095e70b66 / bd32813f0: la escala del resumen alinea por posición escalas
# compatibles (acuerdo y satisfacción de cuatro puntos), deja fuera con aviso la de tema no reconocido (frecuencia),
# avisa la exclusión que no está en la leyenda y el tope de 20 filas de la lámina nativa. Los unitarios
# (test-graficos-escala-armonizada.R) lo prueban sobre `.regla_preguntas_de_elemento`; aquí se exige que el endpoint de
# conteo `POST /api/graficos/resumenes/regla` lleve el conteo y los cuatro avisos hasta la respuesta JSON, leyendo las
# fuentes de una sesión real (sin sesión compartida la prueba HTTP no prueba nada). Datos sintéticos, sin red.

.eh_listas <- list(
  lk = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
  sat = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "Sin información"),
  frec = c("Nunca", "Casi nunca", "Casi siempre", "Siempre", "Sin información"),
  conf = c("Nada de confianza", "Poca confianza", "Bastante confianza", "Mucha confianza", "No sabe")
)
.eh_codigos <- function(lista) c(as.character(seq_len(length(.eh_listas[[lista]]) - 1L)), "9")

#' Instrumento con una batería por lista (cada lista es «de escala» por batería)
.eh_inst <- function(por_lista) {
  vars <- unlist(lapply(names(por_lista), function(l) paste0(l, "_", seq_len(por_lista[[l]]))))
  listas <- rep(names(por_lista), unlist(por_lista))
  ch <- do.call(rbind, lapply(names(.eh_listas), function(l) data.frame(list_name = l, name = .eh_codigos(l),
                                                                          label = .eh_listas[[l]], stringsAsFactors = FALSE)))
  list(survey = data.frame(name = vars, type = paste("select_one", listas), list_name = listas,
                           label = paste("Pregunta", vars), stringsAsFactors = FALSE),
       choices = ch, orders_list = NULL)
}

#' 20 casos por pregunta: `pos` en los dos niveles positivos, 2 en la especial y el resto en los negativos
.eh_columna <- function(lista, pos) {
  cods <- .eh_codigos(lista)
  c(rep(cods[3:4], length.out = pos), rep(cods[5L], 2L), rep(cods[1:2], length.out = 18L - pos))
}

.eh_base <- function(por_lista, pos = NULL) {
  inst <- .eh_inst(por_lista)
  vars <- inst$survey$name; listas <- inst$survey$list_name
  pos <- pos %||% (seq_along(vars) + 3L)
  d <- as.data.frame(stats::setNames(lapply(seq_along(vars), function(i) .eh_columna(listas[i], pos[i])), vars),
                     stringsAsFactors = FALSE)
  list(data = d, inst = inst)
}

#' Sesión con las fuentes de Gráficos; `bases` es una lista nombrada de `.eh_base()`
.eh_sesion <- function(bases) {
  sid <- session_create()
  nombres <- names(bases)
  session_set(sid, "estudio", list(bases = stats::setNames(lapply(nombres, function(b) list(nombre = b)), nombres),
                                   active_base = nombres[length(nombres)],
                                   processing_mode = if (length(nombres) > 1L) "multibase" else "simple"))
  session_set(sid, "rp_data_sources", lapply(bases, `[[`, "data"))
  session_set(sid, "rp_inst_sources", lapply(bases, `[[`, "inst"))
  sid
}

.eh_http <- function(sid, body) {
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

.eh_avisos <- function(r) as.character(unlist(r$body$avisos))

test_that("HTTP (a): acuerdo y satisfacción de cuatro puntos en una base cuentan juntas, sin avisos de exclusión", {
  sid <- .eh_sesion(list(arte = .eh_base(list(lk = 4L, sat = 3L)))); on.exit(session_delete(sid), add = TRUE)
  r <- .eh_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["arte$*"], "estilo": "resumen",
                       "regla": {"tipo": "todas"}}}')
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$body$ok))
  expect_identical(r$body$total, 7L)
  expect_length(r$body$candidatas, 7L)
  expect_true(any(grepl("^arte\\$sat_", vapply(r$body$candidatas, `[[`, "", "tema"))))
  expect_identical(r$body$texto_regla, "Se muestran las 7 preguntas de escala.")
  expect_true(is.list(r$body$avisos))
  expect_false(any(grepl("fuera", .eh_avisos(r))))
})

test_that("HTTP (a): con acuerdo en una base y satisfacción en otra, el conteo lee las dos y las alinea", {
  sid <- .eh_sesion(list(arte = .eh_base(list(lk = 4L)), ciencias = .eh_base(list(sat = 3L))))
  on.exit(session_delete(sid), add = TRUE)
  r <- .eh_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["arte$*", "ciencias$*"], "estilo": "resumen",
                       "regla": {"tipo": "todas"}}}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$total, 7L)
  temas <- vapply(r$body$candidatas, `[[`, "", "tema")
  expect_identical(sum(grepl("^arte\\$lk_", temas)), 4L)
  expect_identical(sum(grepl("^ciencias\\$sat_", temas)), 3L)
  expect_false(any(grepl("fuera", .eh_avisos(r))))
})

test_that("HTTP (b): la frecuencia no se alinea con acuerdo y la respuesta lo avisa", {
  sid <- .eh_sesion(list(arte = .eh_base(list(lk = 4L, frec = 3L)))); on.exit(session_delete(sid), add = TRUE)
  r <- .eh_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["arte$*"], "estilo": "resumen",
                       "regla": {"tipo": "todas"}}}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$total, 4L)
  expect_false(any(grepl("^arte\\$frec_", vapply(r$body$candidatas, `[[`, "", "tema"))))
  expect_true("3 preguntas quedan fuera: tienen otra escala que la mayoría, de tema no reconocido." %in% .eh_avisos(r))
})

test_that("HTTP (c): una exclusión que no está en la escala de la leyenda se avisa en la respuesta", {
  sid <- .eh_sesion(list(arte = .eh_base(list(lk = 4L, conf = 3L)))); on.exit(session_delete(sid), add = TRUE)
  r <- .eh_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["arte$*"], "estilo": "resumen",
                       "orden": "declarado", "excluir_opciones": ["No sabe"], "regla": {"tipo": "todas"}}}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$total, 7L)
  expect_true("La exclusión \"No sabe\" no está en la escala de la leyenda y no se aplica." %in% .eh_avisos(r))
  # Una exclusión que sí está en la leyenda no avisa.
  r2 <- .eh_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["arte$*"], "estilo": "resumen",
                        "orden": "declarado", "excluir_opciones": ["Sin información"], "regla": {"tipo": "todas"}}}')
  expect_identical(r2$status, 200L)
  expect_false(any(grepl("no está en la escala de la leyenda", .eh_avisos(r2))))
})

test_that("HTTP (d): la regla que elige más de 20 filas avisa el tope de la lámina nativa", {
  sid <- .eh_sesion(list(arte = .eh_base(list(lk = 22L), pos = rep(5L, 22L)))); on.exit(session_delete(sid), add = TRUE)
  r <- .eh_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["arte$*"], "estilo": "resumen",
                       "regla": {"tipo": "bajo_umbral", "umbral": 60}}}')
  expect_identical(r$status, 200L)
  expect_identical(r$body$total, 22L)
  # P5: el conteo lista sólo lo que se dibuja, y su nota es la de la lámina, en una frase (P7).
  expect_length(r$body$seleccionadas, 20L)
  expect_identical(r$body$texto_regla, "Se muestran las 20 más bajas de las 22 bajo 60%, de 22 preguntas de escala; el resto en otra lámina. Ordenado por Top Two Box, de menor a mayor.")
  expect_true(any(grepl("la lámina admite 20: se muestran las 20 más bajas de las 22 bajo 60%", .eh_avisos(r), fixed = TRUE)))   # E3
  # El tope viaja siempre, para que la UI lo muestre junto al corte y avise sin esperar al motor.
  expect_identical(r$body$tope_filas, 20L)
  expect_identical(r$body$tope_filas, .LAM_DIV_RESUMEN_MAX_FILAS)
  # Con 20 o menos elegidas no hay aviso de tope.
  r2 <- .eh_http(sid, '{"graficador": "p_barras_divergentes", "args": {"vars": ["arte$*"], "estilo": "resumen",
                        "regla": {"tipo": "bajo_umbral", "umbral": 60, "quitar": ["arte$lk_1", "arte$lk_2"]}}}')
  expect_identical(r2$status, 200L)
  expect_false(any(grepl("admite 20", .eh_avisos(r2))))
  expect_identical(r2$body$tope_filas, 20L)   # también cuando cabe
})

test_that("HTTP (d): un graficador sin tope por número de preguntas responde `tope_filas` null", {
  sid <- .eh_sesion(list(arte = .eh_base(list(lk = 6L), pos = rep(5L, 6L)))); on.exit(session_delete(sid), add = TRUE)
  r <- .eh_http(sid, '{"graficador": "p_panorama", "args": {"vars": ["arte$*"], "corte": ["3", "4"], "regla": {"tipo": "todas"}}}')
  expect_identical(r$status, 200L)
  expect_true("tope_filas" %in% names(r$body))
  expect_null(r$body$tope_filas)
  expect_true(is.na(.regla_tope_filas("p_fortalezas"))); expect_true(is.na(.regla_tope_filas("p_dumbbell")))
})
