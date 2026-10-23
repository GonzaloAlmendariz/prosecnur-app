source("setup-load-all.R")

# Arte, Word v3 (Gráficos 74, 76 y 84): una Sí/No suelta (`p_dicotomica`, una variable) salía titulada con la sección de la
# lámina («Formulación del perfil de egreso») y no con su pregunta, mientras el PPT la muestra. Criterio B: la figura de UNA
# premisa lleva su enunciado como título. Una figura de varias variables conserva el título de la lámina.

.tp_inst <- function(label) {
  list(survey = data.frame(name = "p13", type = "select_one si_no", list_name = "si_no", label = label, stringsAsFactors = FALSE),
       choices = data.frame(list_name = "si_no", name = c("1", "2"), label = c("Sí", "No"), stringsAsFactors = FALSE),
       orders_list = NULL)
}
.tp_data <- function(n_si, n_no) data.frame(p13 = c(rep("1", n_si), rep("2", n_no)), stringsAsFactors = FALSE)
.tp_titulos <- function(plan) {
  data <- list(docentes = .tp_data(47, 5), estudiantes = .tp_data(160, 12))
  instrumento <- list(docentes = .tp_inst("¿Conoce el servicio de salud?"), estudiantes = .tp_inst("¿Conoce el servicio de salud?"))
  meta <- reporte_ppt_plan(data = data, instrumento = instrumento, plan = plan, presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
                           solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta
  vapply(Filter(function(m) identical(m$kind %||% "chart", "chart"), meta), function(m) as.character(m$title %||% NA_character_), "")
}

test_that("una dicotomía de una variable lleva su pregunta como título de la figura, no la sección de la lámina", {
  skip_if_not_installed("cowplot")
  t <- .tp_titulos(list(diapo_001 = p_slide_1_grafico(titulo = "FORMULACIÓN DEL PERFIL DE EGRESO", grafico = p_dicotomica(var = "estudiantes$p13"))))
  expect_identical(t, "¿Conoce el servicio de salud?")
})

test_that("una barra categórica de una variable también lleva su pregunta", {
  skip_if_not_installed("cowplot")
  t <- .tp_titulos(list(diapo_001 = p_slide_1_grafico(titulo = "ORGANIZACIÓN Y ACTUALIZACIÓN CURRICULAR", grafico = p_barras_agrupadas(var = "docentes$p13"))))
  expect_identical(t, "¿Conoce el servicio de salud?")
})

test_that("sin título de lámina el título sigue siendo la pregunta (como antes)", {
  skip_if_not_installed("cowplot")
  t <- .tp_titulos(list(diapo_001 = p_slide_1_grafico(titulo = "", grafico = p_dicotomica(var = "estudiantes$p13"))))
  expect_identical(t, "¿Conoce el servicio de salud?")
})
