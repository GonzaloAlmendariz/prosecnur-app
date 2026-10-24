source("setup-load-all.R")

# CCSS Perfil 2026 (láminas 14, 21, 22 y 54): `p_dicotomica(titulo = "Gestión del colegio")` mostraba el enunciado completo
# terminado en «(Recodificada)». El `titulo` del gráfico manda; sin él, el enunciado sale sin el sufijo.

.dt_textos_de <- function(grafico) {
  n_si <- 150; n_no <- 92
  data <- data.frame(id = seq_len(n_si + n_no), p19 = c(rep("Sí", n_si), rep("No", n_no)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(type = c("integer", "select_one sn"), name = c("id", "p19"),
                                   label = c("id", "¿Participa en la malla curricular? (Recodificada)"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sn", name = c("Sí", "No"), label = c("Sí", "No"), stringsAsFactors = FALSE))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = data, instrumento = inst,
    plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = "Malla curricular")), path_ppt = out, mensajes_progreso = FALSE)))
  xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), "//a:t"))
}

test_that(".lam_quitar_sufijo_recodificada quita sólo el sufijo final", {
  expect_identical(.lam_quitar_sufijo_recodificada("¿Pregunta? (Recodificada)"), "¿Pregunta?")
  expect_identical(.lam_quitar_sufijo_recodificada("¿Pregunta (recodificada) intermedia?"), "¿Pregunta (recodificada) intermedia?")
})

test_that("p_dicotomica con `titulo` muestra ese título y no el enunciado", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  tx <- .dt_textos_de(p_dicotomica("p19", titulo = "Gestión del colegio"))
  expect_true("Gestión del colegio" %in% tx, info = paste(tx, collapse = " | "))
  expect_false(any(grepl("Recodificada|¿Participa", tx)), info = paste(tx, collapse = " | "))
})

test_that("p_dicotomica sin `titulo` muestra el enunciado sin «(Recodificada)»", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  tx <- .dt_textos_de(p_dicotomica("p19"))
  expect_true("¿Participa en la malla curricular?" %in% tx, info = paste(tx, collapse = " | "))
  expect_false(any(grepl("Recodificada", tx)))
})
