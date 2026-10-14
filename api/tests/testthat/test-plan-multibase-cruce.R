# «Una pregunta por grupos» y «Barras apiladas por grupos» en un estudio de varias bases (catálogo del recetario,
# 2026-10-14). La rama `modo = "cruce"` de multiapiladas quitaba el prefijo de `var` y volvía a resolverlo sin su base:
# con una sola base caía en la de por defecto, con varias no había a cuál y la lámina salía «Sin datos». El motor atrapa
# ese error, así que `expect_no_error` no lo ve: la prueba exige que no aparezca el aviso de lámina sin dibujar.

.mbc_fixture <- function() {
  mk <- function(n, off) {
    d <- data.frame(tutoria = as.character((seq_len(n) + off) %% 4 + 1), ciclo = as.character(seq_len(n) %% 3 + 1), stringsAsFactors = FALSE)
    attr(d$tutoria, "label") <- "La Unidad cuenta con tutoría"
    attr(d$ciclo, "label") <- "Ciclo"
    d
  }
  survey <- data.frame(name = c("tutoria", "ciclo"), type = c("select_one acuerdo", "select_one ciclo"),
                       list_name = c("acuerdo", "ciclo"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c(rep("acuerdo", 4), rep("ciclo", 3)), name = c(1:4, 1:3),
                        label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Quinto", "Sexto", "Séptimo"),
                        stringsAsFactors = FALSE)
  inst <- list(survey = survey, choices = choices, orders_list = NULL)
  list(data = list(estudiantes = mk(30, 0), docentes = mk(12, 1)), instrumento = list(estudiantes = inst, docentes = inst))
}

.mbc_avisos <- function(grafico) {
  fx <- .mbc_fixture()
  msgs <- character()
  withCallingHandlers(
    reporte_ppt_plan(data = fx$data, instrumento = fx$instrumento, plan = list(p_slide_1_grafico(grafico = grafico, titulo = "x")),
                     solo_lista = TRUE, mensajes_progreso = FALSE),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { msgs <<- c(msgs, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  msgs
}

test_that("una pregunta por grupos se dibuja con varias bases", {
  skip_if_not_installed("officer")
  m <- .mbc_avisos(p_barras_multiapiladas(modo = "cruce", var = "estudiantes$tutoria", cruces = "estudiantes$ciclo"))
  expect_false(any(grepl("no se pudo dibujar|Sin datos", m)), info = paste(m, collapse = "\n"))
})

test_that("barras apiladas por grupos se dibujan con varias bases", {
  skip_if_not_installed("officer")
  m <- .mbc_avisos(p_barras_apiladas("docentes$tutoria", cruces = "docentes$ciclo"))
  expect_false(any(grepl("no se pudo dibujar|Sin datos", m)), info = paste(m, collapse = "\n"))
})
