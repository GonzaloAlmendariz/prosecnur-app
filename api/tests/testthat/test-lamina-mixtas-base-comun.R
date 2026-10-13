# G9 (Gonzalo, 2026-10-13): en la lámina de 4 gráficos, si los cuatro hablan del mismo público con el mismo n, cada
# panel no repite su «N respuestas»: basta la base en la esquina de la lámina. Si los n difieren, cada uno conserva el suyo.

.mb_inst <- function() list(
  survey = data.frame(name = c("p1", "p2", "p3"), type = c("select_one sn", "select_one l2", "select_one l3"),
                      list_name = c("sn", "l2", "l3"), label = c("¿Tiene título?", "Año", "Sueldo"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("sn", "sn", "l2", "l2", "l2", "l3", "l3", "l3", "l3"), name = c("1", "2", "a", "b", "c", "x", "y", "z", "w"),
                       label = c("Sí", "No", "2023", "2024", "2025", "Bajo", "Medio", "Alto", "Muy alto"), stringsAsFactors = FALSE),
  orders_list = NULL)

.mb_lamina <- function(dat) {
  plan <- list(b = p_slide_4_graficos(p_barras_agrupadas("p2"), p_barras_agrupadas("p3"), p_barras_agrupadas("p3"), p_barras_categoricas("p1"), titulo = "Perfil"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = .mb_inst(), plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  function(n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
}

test_that("mismo público y mismo n: sin base en cada panel, una sola en la esquina de la lámina", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(p1 = rep(c("1", "2"), c(31, 69)), p2 = rep(c("a", "b", "c"), c(20, 50, 30)), p3 = rep(c("x", "y", "z", "w"), 25),
                    stringsAsFactors = FALSE)
  txt <- .mb_lamina(dat)
  expect_length(txt("panel:base"), 0L)
  expect_match(txt("Base lamina"), "100")
})

test_that("con n distintos cada panel conserva el suyo", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(p1 = rep(c("1", "2"), c(31, 69)), p2 = c(rep(c("a", "b", "c"), c(20, 50, 20)), rep(NA, 10)), p3 = rep(c("x", "y", "z", "w"), 25),
                    stringsAsFactors = FALSE)
  txt <- .mb_lamina(dat)
  expect_gt(length(txt("panel:base")), 0L)
})

test_that("el público común exige el mismo n y la misma base de origen", {
  e <- function(n) structure(list(tipo = "escala"), n = n)
  local_mocked_bindings(.lam_es_cifra = function(e) FALSE, .espec_n_base = function(e) attr(e, "n"))
  expect_true(.lam_mixta_publico_comun(list(e(100), e(100)), list(list(var = "docentes$p1"), list(var = "docentes$p2"))))
  expect_false(.lam_mixta_publico_comun(list(e(100), e(90)), list(list(var = "p1"), list(var = "p2"))))
  expect_false(.lam_mixta_publico_comun(list(e(100), e(100)), list(list(var = "docentes$p1"), list(var = "estudiantes$p1"))))
  expect_false(.lam_mixta_publico_comun(list(e(100)), list(list(var = "p1"))))
})
