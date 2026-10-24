source("setup-load-all.R")

# CCSS Perfil 2026 (láminas 6, 30, 31, 64 y 14, 21, 22, 54): con la base interna «default» la lámina decía «325 default» sobre
# cada barra y «Base: 397 default» en el pie. «default» es el nombre INTERNO de la base y no se ve nunca; una base con nombre
# propio («docentes») sí se nombra.

.bd_fuente <- function(n_si, n_no) {
  list(data = data.frame(id = seq_len(n_si + n_no), p19 = c(rep("Sí", n_si), rep("No", n_no)),
                         niv = rep(c("I", "II", "III"), length.out = n_si + n_no), stringsAsFactors = FALSE),
       inst = list(survey = data.frame(type = c("integer", "select_one sn", "select_one niv"), name = c("id", "p19", "niv"),
                                       label = c("id", "¿Participa en la malla curricular?", "Nivel"), stringsAsFactors = FALSE),
                   choices = data.frame(list_name = c("sn", "sn", "niv", "niv", "niv"), name = c("Sí", "No", "I", "II", "III"),
                                        label = c("Sí", "No", "I", "II", "III"), stringsAsFactors = FALSE)))
}
.bd_textos <- function(out) {
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
}
.bd_render <- function(grafico, base_a = "default") {
  a <- .bd_fuente(150, 92); b <- .bd_fuente(10, 5)
  data <- stats::setNames(list(a$data, b$data), c(base_a, "docentes"))
  inst <- stats::setNames(list(a$inst, b$inst), c(base_a, "docentes"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = data, instrumento = inst,
    plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = "Malla curricular")), path_ppt = out, mensajes_progreso = FALSE)))
  .bd_textos(out)
}

test_that(".base_nombre_visible oculta «default» y deja los nombres propios", {
  expect_identical(.base_nombre_visible("default"), "")
  expect_identical(.base_nombre_visible(" Default "), "")
  expect_identical(.base_nombre_visible(NULL), "")
  expect_identical(.base_nombre_visible("docentes"), "docentes")
})

test_that("barras categóricas de la base «default»: ni rótulo «N default» ni «Base: N default»", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  tx <- .bd_render(p_barras_categoricas("default$niv"))
  expect_false(any(grepl("default", tx, ignore.case = TRUE)), info = paste(tx, collapse = " | "))
  expect_true(any(grepl("^Base: 242", tx)), info = paste(tx, collapse = " | "))
})

test_that("dicotómica de la base «default»: el pie no dice «default»", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  tx <- .bd_render(p_dicotomica("default$p19"))
  expect_false(any(grepl("default", tx, ignore.case = TRUE)), info = paste(tx, collapse = " | "))
  expect_true(any(grepl("^Base: 242", tx)), info = paste(tx, collapse = " | "))
})

test_that("una base con nombre propio sí se nombra en el pie", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  tx <- .bd_render(p_dicotomica("docentes$p19"))
  expect_true(any(grepl("^Base: 15 docentes", tx)), info = paste(tx, collapse = " | "))
})
