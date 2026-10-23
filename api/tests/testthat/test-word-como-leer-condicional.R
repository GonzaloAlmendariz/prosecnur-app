source("setup-load-all.R")

# Gonzalo, 2026-10-22: «No va por defecto, va solo si en ppt van 2.» Cada explicación de «Cómo leer este informe» (Top Two
# Box, Bottom Two Box, una misma escala, cifras pequeñas) entra al Word sólo si el recurso que explica aparece en al menos
# 2 láminas del PPT del mismo plan. Con `como_leer` ausente o «auto» manda el conteo; un valor explícito sigue mandando.

.cc_cab <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")
.cc_espec <- function(top2 = TRUE, bottom = FALSE, chicas = FALSE) {
  p <- if (chicas) c(2, 1, 93, 3, 1) else c(10, 20, 40, 25, 5)
  ej <- data.frame(actor = "Todos", N = 120, p1 = p[1], p2 = p[2], p3 = p[3], p4 = p[4], p5 = p[5])
  ej[paste0("p", 1:5)] <- ej[paste0("p", 1:5)] / 100
  preparar_escala(ej, "actor", "N", paste0("p", 1:5), stats::setNames(.cc_cab, paste0("p", 1:5)),
                  colores_grupos = stats::setNames(unname(.std_paleta("likert")), .cc_cab), orden = "declarado",
                  barra_extra_preset = if (top2) "top2box" else "ninguno", top2box_labels = .cc_cab[3:4],
                  columna_bottom2box = bottom, bottom2box_labels = .cc_cab[1:2])
}
.cc_plot <- function(...) { p <- ggplot2::ggplot(); attr(p, "pulso_espec") <- .cc_espec(...); p }
.cc_chart <- function(titulo, ...) list(kind = "chart", title = titulo, plot_word = .cc_plot(...))
.cc_meta <- function(charts) c(list(list(kind = "title_doc", title = "Estudio de prueba"),
                                    list(kind = "section", title = "RESULTADOS", meta = list(word_heading_level = 1L))), charts)
.cc_xml <- function(meta, opciones = list()) {
  f <- tempfile(fileext = ".docx"); .word_documento(meta, f, opciones = opciones)
  d <- tempfile(); utils::unzip(f, exdir = d)
  paste(readLines(file.path(d, "word", "document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
}

test_that("el helper cuenta láminas del PPT: 0, 1, 2 y 3 apariciones de Top Two Box", {
  sec <- function(n) .word_como_leer_auto(.cc_meta(c(
    replicate(n, .cc_chart("con", top2 = TRUE), simplify = FALSE),
    replicate(3L - n, .cc_chart("sin", top2 = FALSE), simplify = FALSE))))
  expect_false("top_two_box" %in% sec(0)); expect_false("top_two_box" %in% sec(1))
  expect_true("top_two_box" %in% sec(2));  expect_true("top_two_box" %in% sec(3))
})

test_that("cada recurso se cuenta por separado: Bottom Two Box, escalas y cifras pequeñas", {
  m <- .cc_meta(list(.cc_chart("a", top2 = TRUE, bottom = TRUE, chicas = TRUE), .cc_chart("b", top2 = TRUE, bottom = TRUE)))
  s <- .word_como_leer_auto(m)
  expect_setequal(s, c("top_two_box", "bottom_two_box", "misma_escala", "redondeo", "bases_chicas"))   # sólo una lámina con cifras chicas
  s3 <- .word_como_leer_auto(.cc_meta(list(.cc_chart("a", chicas = TRUE), .cc_chart("b", chicas = TRUE, top2 = FALSE))))
  expect_true("cifras_pequenas" %in% s3); expect_false("top_two_box" %in% s3)
})

test_that("ningún recurso en 2 láminas: character(0); 2 de Top Two Box: top2 + redondeo + bases", {
  expect_identical(.word_como_leer_auto(.cc_meta(list(.cc_chart("a", top2 = TRUE, bottom = TRUE, chicas = TRUE)))), character(0))
  s <- .word_como_leer_auto(.cc_meta(list(.cc_chart("a", top2 = TRUE), .cc_chart("b", top2 = TRUE))))
  expect_true(all(c("top_two_box", "redondeo", "bases_chicas") %in% s))
  xml <- .cc_xml(.cc_meta(list(.cc_chart("a", top2 = TRUE))))
  expect_false(grepl("Cómo leer este informe", xml, fixed = TRUE))   # ni capítulo ni recuadro
})

test_that("el recuadro final no menciona Top Two Box si la sección no entra", {
  skip_if_not_installed("officer")
  m <- .cc_meta(list(.cc_chart("a", top2 = FALSE), .cc_chart("b", top2 = FALSE)))
  expect_false(grepl("Top Two Box es la suma", .cc_xml(m), fixed = TRUE))
  expect_match(.cc_xml(m, list(como_leer = TRUE)), "Top Two Box es la suma", fixed = TRUE)
})

test_that("sin escalas no hay secciones y el capítulo no se escribe", {
  expect_identical(.word_como_leer_auto(.cc_meta(list())), character(0))
})

test_that("documento: 1 Top Two Box no lleva la sección; 2 sí; ausente y «auto» son lo mismo", {
  skip_if_not_installed("officer")
  uno <- .cc_xml(.cc_meta(list(.cc_chart("a", top2 = TRUE), .cc_chart("b", top2 = FALSE))))
  expect_false(grepl("Cómo se calcula el Top Two Box", uno, fixed = TRUE))
  expect_match(uno, "Cómo leer este informe", fixed = TRUE)          # redondeo y bases chicas siguen (hay escalas)
  dos <- .cc_xml(.cc_meta(list(.cc_chart("a", top2 = TRUE), .cc_chart("b", top2 = TRUE))))
  expect_match(dos, "Cómo se calcula el Top Two Box", fixed = TRUE)
  auto <- .cc_xml(.cc_meta(list(.cc_chart("a", top2 = TRUE), .cc_chart("b", top2 = TRUE))), list(como_leer = "auto"))
  expect_match(auto, "Cómo se calcula el Top Two Box", fixed = TRUE)
})

test_that("como_leer explícito manda sobre el conteo", {
  skip_if_not_installed("officer")
  m <- .cc_meta(list(.cc_chart("a", top2 = TRUE)))
  expect_match(.cc_xml(m, list(como_leer = TRUE)), "Cómo se calcula el Top Two Box", fixed = TRUE)
  expect_match(.cc_xml(m, list(como_leer = "top_two_box")), "Cómo se calcula el Top Two Box", fixed = TRUE)
  expect_false(grepl("Cómo leer este informe", .cc_xml(m, list(como_leer = FALSE)), fixed = TRUE))
})
