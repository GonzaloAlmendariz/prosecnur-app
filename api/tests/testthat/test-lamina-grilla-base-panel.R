# Frente C (CCSS Perfil 2026, `p_slide_4_graficos`): el pie de la cuadrícula decía «Base: 397 respuestas. Base: 56
# respuestas. Base: 396 respuestas…», concatenado. Con bases iguales va una sola «Base:»; si difieren, cada panel lleva la
# suya bajo su enunciado («56 respuestas») y el pie no las junta. La base es la de respuestas válidas de esa pregunta, sin
# ponderar: este frente no cambia ninguna cifra, sólo dónde se escribe.

.bp_lams <- function(plan) {
  car <- c("A", "B", "C")
  n <- 120
  df <- data.frame(x1 = rep(car, 40), x2 = rep(c("S", "N"), 60), x3 = c(rep(c("S", "N"), c(30, 26)), rep(NA, n - 56)),
                   x4 = c(rep(car, c(40, 40, 30)), rep(NA, n - 110)), stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "lc", name = car, label = car), data.frame(list_name = "ls", name = c("S", "N"), label = c("Sí", "No")))
  inst <- list(survey = data.frame(name = paste0("x", 1:4), type = c("select_one lc", "select_one ls", "select_one ls", "select_one lc"),
                                   list_name = c("lc", "ls", "ls", "lc"), label = c("Uno", "Dos", "Tres", "Cuatro"), stringsAsFactors = FALSE),
               choices = ch, orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.bp_txt <- function(x, nombre) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre)))

test_that("con bases distintas cada panel lleva la suya y el pie no las concatena", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  x <- .bp_lams(list(a = p_slide_4_graficos(p_donut("x1"), p_donut("x3"), p_donut("x2"), p_donut("x4"), titulo = "Bases distintas")))[[1]]
  base <- paste(.bp_txt(x, "Base lamina"), collapse = "")
  expect_lte(lengths(regmatches(base, gregexpr("Base:", base))), 1L)
  expect_false(grepl("56", base))
  expect_setequal(.bp_txt(x, "panel:base"), c("120 respuestas", "56 respuestas", "120 respuestas", "110 respuestas"))
})

test_that("con bases iguales va una sola «Base:» y los paneles no la repiten", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  x <- .bp_lams(list(a = p_slide_4_graficos(p_donut("x1"), p_donut("x2"), p_donut("x1"), p_donut("x2"), titulo = "Bases iguales")))[[1]]
  # CCSS-15 (2026-10-24, cambio deliberado): sin sufijo declarado en el preset de base el pie es «Base: N» en todas las rutas
  # (graficos_base_pie_forma.R); antes esta ruta agregaba «respuestas» por su cuenta.
  expect_identical(paste(.bp_txt(x, "Base lamina"), collapse = ""), "Base: 120")
  expect_length(.bp_txt(x, "panel:base"), 0L)
})

test_that("p_slide_2_graficos con bases distintas: cada panel la suya, el pie sin concatenar", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  x <- .bp_lams(list(a = p_slide_2_graficos(p_donut("x1"), p_donut("x3"), titulo = "Dos bases")))[[1]]
  base <- paste(.bp_txt(x, "Base lamina"), collapse = "")
  expect_lte(lengths(regmatches(base, gregexpr("Base:", base))), 1L)
  expect_setequal(.bp_txt(x, "panel:base"), c("120 respuestas", "56 respuestas"))
})

test_that("la base que declaró el analista manda", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  x <- .bp_lams(list(a = p_slide_4_graficos(p_donut("x1"), p_donut("x3"), p_donut("x2"), p_donut("x4"), titulo = "Declarada",
                                            base = "Base: 120 estudiantes")))[[1]]
  expect_identical(paste(.bp_txt(x, "Base lamina"), collapse = ""), "Base: 120 estudiantes")
})
