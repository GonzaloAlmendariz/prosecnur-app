source("setup-load-all.R")

# CCSS Perfil 2026 (p_slide_6_graficos_poblacion): con paneles de bases distintas (378, 300, 397) el pie de la lámina decía
# «Base: 397 respuestas», un denominador que no es el de todos. La composición aplica ahora la regla de las grillas
# (`.lam_grilla_base`, lamina_grilla_nativa.R): bases iguales, una sola «Base:»; distintas, cada panel la suya y el pie no afirma ninguna.

.cb_render <- function(con_na) {
  set.seed(3)
  n <- 400
  a <- sample(c("Uno", "Dos", "Tres"), n, TRUE); b <- sample(c("Uno", "Dos", "Tres"), n, TRUE)
  if (con_na) b[1:100] <- NA
  dat <- data.frame(id = seq_len(n), a = a, b = b, stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(type = c("integer", "select_one l", "select_one l"), name = c("id", "a", "b"),
                                   label = c("id", "Pregunta A", "Pregunta B"), list_name = c(NA, "l", "l"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "l", name = c("Uno", "Dos", "Tres"), label = c("Uno", "Dos", "Tres"), stringsAsFactors = FALSE))
  g <- function(v) p_barras_categoricas(v)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(s = p_slide_6_graficos_poblacion(g("a"), g("b"), g("a"), g("b"), g("a"), g("b"), titulo = "Seis")))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  vapply(xml2::xml_find_all(x, "//p:sp"), function(s) paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t")), collapse = ""), "")
}

test_that("con bases distintas el pie no afirma una base común", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  t <- .cb_render(TRUE)
  expect_false(any(grepl("^Base:", t)), info = paste(t[grepl("Base", t)], collapse = " | "))
  expect_true(any(grepl("300 respuestas", t)) && any(grepl("400 respuestas", t)))
})

test_that("con bases iguales el pie lleva una sola «Base:»", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  t <- .cb_render(FALSE)
  expect_equal(sum(grepl("^Base: 400", t)), 1L, info = paste(t[grepl("Base", t)], collapse = " | "))
})
