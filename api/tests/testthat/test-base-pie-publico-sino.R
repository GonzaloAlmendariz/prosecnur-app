source("setup-load-all.R")

# Renzo, informe Arte v3 (2026-10-22), PPT 40, 42 y 48: la lámina Sí/No de un solo público decía «Base: 242 respuestas» mientras
# su etiqueta decía «242 estudiantes». El pie automático nombra al público de la variable (`estudiantes$p19`), como ya hacen los
# gráficos de números y de escala. El número no cambia; solo cómo se nombra a quién se pregunta.

.sp_fuente <- function(n_si, n_no, n_na = 0L) {
  list(data = data.frame(id = seq_len(n_si + n_no + n_na),
                         p19 = c(rep("Sí", n_si), rep("No", n_no), rep(NA_character_, n_na)), stringsAsFactors = FALSE),
       inst = list(survey = data.frame(type = c("integer", "select_one sn"), name = c("id", "p19"),
                                       label = c("id", "¿Participa en la actualización de la malla curricular?"), stringsAsFactors = FALSE),
                   choices = data.frame(list_name = "sn", name = c("Sí", "No"), label = c("Sí", "No"), stringsAsFactors = FALSE)))
}
.sp_textos <- function(out) {
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
}

test_that("Sí/No de un público: el pie automático dice «Base: 242 estudiantes», no «242 respuestas»", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  est <- .sp_fuente(150, 92, n_na = 8)       # 242 válidas; las 8 sin respuesta no entran a la base
  doc <- .sp_fuente(10, 5)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = list(estudiantes = est$data, docentes = doc$data), instrumento = list(estudiantes = est$inst, docentes = doc$inst),
    plan = list(a = p_slide_1_grafico(grafico = p_dicotomica("estudiantes$p19"),
                                      titulo = "Malla curricular")),
    path_ppt = out, mensajes_progreso = FALSE)))
  tx <- .sp_textos(out)
  expect_true(any(tx == "Base: 242 estudiantes"), info = paste(tx, collapse = " | "))
  expect_false(any(grepl("respuestas", tx)))
})

test_that("una base escrita en la lámina se respeta tal cual", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  est <- .sp_fuente(150, 92)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = list(estudiantes = est$data), instrumento = list(estudiantes = est$inst),
    plan = list(a = p_slide_1_grafico(grafico = p_dicotomica("estudiantes$p19"),
                                      titulo = "Malla curricular", base = "Base: 242 respuestas del cuestionario")),
    path_ppt = out, mensajes_progreso = FALSE)))
  expect_true(any(.sp_textos(out) == "Base: 242 respuestas del cuestionario"))
})
