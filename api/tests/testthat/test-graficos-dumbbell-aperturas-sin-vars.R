source("setup-load-all.R")

# ADR 0135 (prueba con Arte, 2026-11-07): la lámina «Aperturas internas» (contraste del resumen con `cruce` = dedicación,
# grupos TC y TPA, regla «mayor diferencia») abortaba el preview con «con `cruce`, `vars` debe traer al menos una
# pregunta». Con `cruce` + `regla` y sin `vars`, los temas son las preguntas de escala de la base del cruce, sin la
# propia pregunta del cruce. Sin regla, el borrador sigue vacío.

.av_rotulos <- c("Conozco los reglamentos", "La biblioteca atiende", "Los docentes dominan su materia", "Hay salud oportuna",
                 "La tutoría orienta", "Los laboratorios están equipados")
.av_inst <- function(k) {
  survey <- data.frame(name = c(paste0("p", seq_len(k)), "dedicacion"),
                       type = c(rep("select_one lk", k), "select_one ded"), list_name = c(rep("lk", k), "ded"),
                       label = c(.av_rotulos[seq_len(k)], "Dedicación"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c(rep("lk", 5), "ded", "ded"), name = c("1", "2", "3", "4", "9", "1", "2"),
                        label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo",
                                  "Sin información", "Tiempo completo", "Tiempo parcial"), stringsAsFactors = FALSE)
  list(survey = survey, choices = choices, orders_list = NULL)
}
.av_base <- function(n, ttb) {
  set.seed(n)
  d <- as.data.frame(lapply(ttb, function(t) {
    k <- round(n * t); sample(c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k)))
  }), stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(ttb))
  d$dedicacion <- rep(c("1", "2"), length.out = n)
  d
}
# Estudiantes va primero (cuatro preguntas): una apertura de docentes que cayera en la primera base contaría cuatro.
.av_fuentes <- function() {
  ds <- list(estudiantes = .av_base(200, c(.82, .64, .91, .38)),
             docentes = .av_base(120, c(.88, .72, .95, .52, .66, .58)))
  list(data_sources = ds, inst_sources = list(estudiantes = .av_inst(4), docentes = .av_inst(6)))
}
.av_args <- function(...) utils::modifyList(list(corte = list("3", "4"), cruce = "docentes$dedicacion", grupos = list("1", "2"),
                                                 estilo = "resumen", regla = list(tipo = "mayor_diferencia", n = 3)), list(...))

test_that("constructor: con cruce y regla, sin vars, los temas son la base del cruce", {
  el <- p_dumbbell(corte = c("3", "4"), cruce = "docentes$dedicacion", grupos = c("1", "2"),
                   regla = list(tipo = "mayor_diferencia", n = 10))
  expect_identical(el$.element_type, "dumbbell")
  expect_identical(el$vars, list("docentes$*"))
  expect_identical(el$overrides$estilo, "resumen")
  expect_identical(el$regla$tipo, "mayor_diferencia")
  # Sin base en el cruce queda `$*`: no cae en la primera base.
  expect_identical(p_dumbbell(corte = "4", cruce = "dedicacion", grupos = c("1", "2"), regla = list(tipo = "todas"))$vars, list("$*"))
  # Sin regla el constructor sigue pidiendo las preguntas; el borrador del plan es un gráfico vacío, sin abortar.
  expect_error(p_dumbbell(corte = "4", cruce = "docentes$dedicacion", grupos = c("1", "2")), "al menos una pregunta")
  g <- .rebuild_graf(list(graficador = "p_dumbbell", args = .av_args(regla = NULL)))
  expect_identical(g$.element_type, "ggplot_raw")
  g2 <- .rebuild_graf(list(graficador = "p_dumbbell", args = .av_args(vars = list(), regla = list(tipo = ""))))
  expect_identical(g2$.element_type, "ggplot_raw")
  # `vars: []` de la UI junto a la regla: no es una ref faltante, el contraste toma la base del cruce.
  g3 <- .rebuild_graf(list(graficador = "p_dumbbell", args = .av_args(vars = list())))
  expect_identical(g3$vars, list("docentes$*"))
})

test_that("conteo: las seis preguntas de escala de docentes, sin la del cruce ni la primera base", {
  src <- .av_fuentes()
  r <- .regla_preguntas_conteo("p_dumbbell", .av_args(), src)
  expect_identical(r$total, 6L)
  expect_length(r$seleccionadas, 3L)
  expect_identical(r$texto_regla, "Se muestran las 3 de mayor diferencia, de 6 preguntas de escala.")
  expect_false(any(grepl("Dedicación", vapply(r$candidatas, `[[`, "", "etiqueta"))))
  # El mismo conteo que con vars = docentes$* explícito.
  b <- .regla_preguntas_conteo("p_dumbbell", .av_args(vars = list("docentes$*")), src)
  expect_identical(r$seleccionadas, b$seleccionadas)
  expect_identical(r$texto_regla, b$texto_regla)
})

test_that("la pregunta del cruce queda fuera aunque sea de escala", {
  src <- .av_fuentes()
  r <- .regla_preguntas_conteo("p_dumbbell", .av_args(cruce = "docentes$p1", grupos = list("3", "4"),
                                                      regla = list(tipo = "todas")), src)
  expect_identical(r$total, 5L)
  expect_false("Conozco los reglamentos" %in% vapply(r$candidatas, `[[`, "", "etiqueta"))
})

test_that("render: la lámina se arma desde la base del cruce con su nota (payload del plan, sin sesión)", {
  skip_if_not_installed("officer")
  src <- .av_fuentes()
  g <- .rebuild_graf(list(graficador = "p_dumbbell", args = .av_args()))
  expect_identical(g$.element_type, "dumbbell")
  plan <- p_plan(slides = list(p_slide_1_grafico(g, titulo = "Aperturas internas")))
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  e <- attr(out$rendered[[1]], "pulso_espec")
  expect_false(is.null(e))
  expect_identical(e$texto_regla, "Se muestran las 3 de mayor diferencia, de 6 preguntas de escala.")
})

test_that("HTTP: el conteo responde 200 con el payload de Arte (cruce + regla, sin vars)", {
  skip_if_not_installed("plumber")
  src <- .av_fuentes()
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(estudiantes = list(nombre = "estudiantes"), docentes = list(nombre = "docentes")),
                                   active_base = "estudiantes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", src$inst_sources)
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  body <- '{"graficador": "p_dumbbell", "args": {"corte": ["3", "4"], "cruce": "docentes$dedicacion", "grupos": ["1", "2"],
            "estilo": "resumen", "vars": [], "regla": {"tipo": "mayor_diferencia", "n": 3}}}'
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/graficos/resumenes/regla", QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = crudo, postBody = body, CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  out <- jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE)
  expect_identical(as.integer(r$status), 200L)
  expect_identical(out$total, 6L)
  expect_length(out$seleccionadas, 3L)
})
