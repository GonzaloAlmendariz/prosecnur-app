source("setup-load-all.R")

# ADR 0135, punto 5 (prueba con Arte): el contraste entre públicos sin preguntas elegidas arma sus temas solo con
# `bases` (o con las dos bases del estudio), y el conteo dice qué falta sin filtrar el nombre interno del elemento.

.ca_rotulos <- c("Conozco los reglamentos", "La biblioteca atiende", "Los docentes dominan su materia", "Hay salud oportuna",
                 "La tutoría orienta", "Los laboratorios están equipados")
.ca_inst <- function() list(
  survey = data.frame(name = paste0("p", seq_along(.ca_rotulos)), type = "select_one lk", list_name = "lk",
                      label = .ca_rotulos, stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
.ca_base <- function(n, ttb) {
  set.seed(n)
  d <- as.data.frame(lapply(ttb, function(t) {
    k <- round(n * t); sample(c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k)))
  }), stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(ttb)); d
}
.ca_fuentes <- function(tres = TRUE) {
  ds <- list(docentes = .ca_base(115, c(.88, .72, .95, .52, .66, .58)),
             estudiantes = .ca_base(279, c(.82, .64, .91, .38, .55, .47)))
  if (tres) ds$administrativos <- .ca_base(85, c(.79, .69, .84, .49, .60, .41))
  list(data_sources = ds, inst_sources = stats::setNames(rep(list(.ca_inst()), length(ds)), names(ds)))
}
.ca_falla <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) list(code = e$code, msg = conditionMessage(e)))

test_that("sin corte el conteo pide el indicador y no nombra el elemento interno", {
  src <- .ca_fuentes()
  f <- .ca_falla(.regla_preguntas_conteo("p_dumbbell", list(bases = list("docentes", "estudiantes"),
                                                            regla = list(tipo = "mayor_diferencia", n = 3)), src))
  expect_identical(f$code, "E_REGLA_PREGUNTAS_INVALIDA")
  expect_identical(f$msg, "Falta el indicador: elige qué respuestas cuentan.")
  f2 <- .ca_falla(.regla_preguntas_conteo("p_panorama", list(vars = list("docentes$*")), src))
  expect_identical(f2$msg, "Falta el indicador: elige qué respuestas cuentan.")
  f3 <- .ca_falla(.regla_preguntas_conteo("p_barras_agrupadas", list(var = "docentes$p1"), src))
  expect_false(grepl("ggplot|p_barras", f3$msg))
})

test_that("con `bases` el contraste empareja por nombre y firma: el mismo conteo que vars = base$*", {
  src <- .ca_fuentes()
  regla <- list(tipo = "mayor_diferencia", n = 3)
  a <- .regla_preguntas_conteo("p_dumbbell", list(bases = list("docentes", "estudiantes"), corte = list("3", "4"), regla = regla), src)
  b <- .regla_preguntas_conteo("p_dumbbell", list(vars = list(T = list("docentes$*", "estudiantes$*")), corte = list("3", "4"),
                                                  regla = regla), src)
  expect_identical(a$total, 6L)
  expect_length(a$seleccionadas, 3L)
  expect_identical(a$seleccionadas, b$seleccionadas)
  expect_identical(a$texto_regla, "Se muestran las 3 de mayor diferencia, de 6 preguntas comunes.")
  # Sin regla, unas bases declaradas implican la regla «comunes».
  el <- p_dumbbell(bases = c("docentes", "estudiantes"), corte = c("3", "4"))
  expect_identical(el$regla$tipo, "comunes"); expect_identical(el$overrides$estilo, "resumen")
  expect_identical(el$vars, list(`Preguntas comunes` = c("docentes$*", "estudiantes$*")))
})

test_that("con tres públicos y sin indicar el par, el contraste pide elegirlo", {
  src <- .ca_fuentes()
  f <- .ca_falla(.regla_preguntas_conteo("p_dumbbell", list(corte = list("3", "4"), regla = list(tipo = "comunes")), src))
  expect_identical(f$code, "E_REGLA_PREGUNTAS_INVALIDA")
  expect_identical(f$msg, "El contraste compara dos públicos: elige cuáles.")
  f2 <- .ca_falla(p_dumbbell(bases = c("docentes", "estudiantes", "administrativos"), corte = "4"))
  expect_identical(f2$msg, "El contraste compara dos públicos: elige cuáles.")
  # Con dos bases en el estudio, la regla sin temas toma esas dos.
  r <- .regla_preguntas_conteo("p_dumbbell", list(corte = list("3", "4"), regla = list(tipo = "comunes")), .ca_fuentes(tres = FALSE))
  expect_identical(r$total, 6L)
  # Sin temas, sin bases y sin regla, el constructor lo dice; el borrador del plan sigue siendo un gráfico vacío.
  expect_error(p_dumbbell(corte = "4"), "bases")
  expect_identical(.rebuild_graf(list(graficador = "p_dumbbell", args = list(corte = list("4"))))$.element_type, "ggplot_raw")
})

test_that("el render arma la lámina desde `bases` (payload del plan, sin sesión)", {
  skip_if_not_installed("officer")
  src <- .ca_fuentes()
  g <- .rebuild_graf(list(graficador = "p_dumbbell", args = list(bases = list("docentes", "estudiantes"), corte = list("3", "4"),
                                                                regla = list(tipo = "mayor_diferencia", n = 3))))
  expect_identical(g$.element_type, "dumbbell")
  plan <- p_plan(slides = list(p_slide_1_grafico(g, titulo = "Contraste"),
                               p_slide_1_grafico(p_dumbbell(corte = c("3", "4"), regla = list(tipo = "comunes")), titulo = "Sin par")))
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  e <- attr(out$rendered[[1]], "pulso_espec")
  expect_false(is.null(e))
  expect_identical(e$texto_regla, "Se muestran las 3 de mayor diferencia, de 6 preguntas comunes.")
  # La segunda no tiene par con tres públicos: no se dibuja con datos inventados.
  expect_null(attr(out$rendered[[2]], "pulso_espec"))
})

.ca_http <- function(sid, body) {
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

test_that("HTTP: tres públicos, sin vars y sin corte, el conteo responde 400 con un mensaje para el analista", {
  skip_if_not_installed("openxlsx")
  src <- .ca_fuentes()
  x <- tempfile(fileext = ".xlsx"); on.exit(unlink(x), add = TRUE)
  i <- .ca_inst()
  openxlsx::write.xlsx(list(survey = i$survey[, c("type", "name", "label")], choices = i$choices[, c("list_name", "name", "label")]), x)
  inst <- suppressMessages(reporte_instrumento(x))
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes"),
                                                administrativos = list(nombre = "administrativos")),
                                   active_base = "administrativos", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", list(docentes = inst, estudiantes = inst, administrativos = inst))
  msg <- function(r) r$body$error$message %||% r$body$message %||% ""
  r <- .ca_http(sid, '{"graficador": "p_dumbbell", "args": {"estilo": "resumen", "regla": {"tipo": "mayor_diferencia", "n": 3}}}')
  expect_identical(r$status, 400L)
  expect_identical(msg(r), "Falta el indicador: elige qué respuestas cuentan.")
  r2 <- .ca_http(sid, '{"graficador": "p_dumbbell", "args": {"corte": ["3", "4"], "regla": {"tipo": "mayor_diferencia", "n": 3}}}')
  expect_identical(r2$status, 400L)
  expect_identical(msg(r2), "El contraste compara dos públicos: elige cuáles.")
  r3 <- .ca_http(sid, '{"graficador": "p_dumbbell", "args": {"bases": ["docentes", "estudiantes"], "corte": ["3", "4"],
                  "estilo": "resumen", "regla": {"tipo": "mayor_diferencia", "n": 3}}}')
  expect_identical(r3$status, 200L)
  expect_identical(r3$body$total, 6L)
  expect_length(r3$body$seleccionadas, 3L)
  expect_false(any(grepl("ggplot", c(msg(r), msg(r2)))))
})

test_that("`bases` está en el registro y sobrevive al guardado del plan, al .pulso, al rearmado, al conteo y al render", {
  skip_if_not_installed("officer")
  # Registro: lo sirve a la UI con su tipo y su grupo.
  servidos <- .normalize_args_for_ui(.GRAFICADORES_META$p_dumbbell$args)
  b <- Filter(function(a) identical(a$name, "bases"), servidos)
  expect_length(b, 1L)
  expect_identical(b[[1]]$tipo_input, "codigos_list"); expect_identical(b[[1]]$label, "Públicos que se comparan")
  expect_true("bases" %in% names(formals(p_dumbbell)))
  # El plan como lo guarda el editor.
  graf <- list(graficador = "p_dumbbell", args = list(bases = list("docentes", "estudiantes"), corte = list("3", "4"),
                                                      estilo = "resumen", regla = list(tipo = "mayor_diferencia", n = 3)))
  plan <- list(slides = list(list(id = "s-con", tipo = "p_slide_1_grafico", payload = list(titulo = "Contraste", grafico = graf))))
  cfg <- .graficos_normalize_config(list(plan = plan))
  expect_identical(unlist(cfg$plan$slides[[1]]$payload$grafico$args$bases), c("docentes", "estudiantes"))
  # Guardar y reabrir el .pulso.
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "graficos_config", cfg)
  dest <- tempfile(fileext = ".pulso"); on.exit(unlink(dest), add = TRUE)
  suppressMessages(build_pulso(sid, dest, project_name = "contraste", allow_empty_overwrite = TRUE))
  r <- suppressMessages(load_pulso(dest)); on.exit(session_delete(r$session_id), add = TRUE)
  g2 <- session_get(r$session_id)$graficos_config$plan$slides[[1]]$payload$grafico
  expect_identical(unlist(g2$args$bases), c("docentes", "estudiantes"))
  # Rearmado (.clean_rebuild_args dentro de .rebuild_graf), conteo y render leen el par.
  src <- .ca_fuentes()
  el <- .rebuild_graf(jsonlite::fromJSON(jsonlite::toJSON(g2, auto_unbox = TRUE), simplifyVector = FALSE))
  expect_identical(el$vars, list(`Preguntas comunes` = c("docentes$*", "estudiantes$*")))
  cn <- .regla_preguntas_conteo("p_dumbbell", g2$args, src)
  expect_identical(cn$total, 6L); expect_length(cn$seleccionadas, 3L)
  s <- .rebuild_slide(session_get(r$session_id)$graficos_config$plan$slides[[1]])
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = p_plan(slides = list(s)),
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  expect_identical(attr(out$rendered[[1]], "pulso_espec")$texto_regla, "Se muestran las 3 de mayor diferencia, de 6 preguntas comunes.")
})
