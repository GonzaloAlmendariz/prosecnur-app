# CCSS Perfil 2026 (revisión v3, M11 y B17): en «¿en qué otra región del Perú?» la opción «Lima» es la región Lima y no
# Lima Metropolitana, y las tasas del mapa llevan punto decimal (es-PE). Fixture sintético.

.mrl_fx <- function(deps, resp) {
  inst <- list(survey = data.frame(name = "reg", type = "select_one lr", list_name = "lr", label = "Otra región", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lr", name = as.character(seq_along(deps)), label = deps, stringsAsFactors = FALSE),
               orders_list = NULL)
  list(data = data.frame(reg = as.character(match(resp, deps)), stringsAsFactors = FALSE), inst = inst)
}

.mrl_espec <- function(fx) {
  carto <- .mapa_distribucion_cartografia("peru")
  f <- .mapa_distribucion_calcular(fx$data, fx$inst, "reg")
  .espec_mapa_distribucion(.mapa_distribucion_casar(f, carto, "peru"), carto, "peru")
}

test_that("M11: en una lista de departamentos, «Lima» a secas es la región Lima, con ese nombre y en Lima provincias", {
  deps <- c("Áncash", "Callao", "Cusco", "Junín", "Lima", "Loreto")
  e <- .mrl_espec(.mrl_fx(deps, c(rep("Junín", 20), rep("Cusco", 15), rep("Lima", 2), rep("Áncash", 8))))
  a <- e$areas
  expect_identical(a$n[a$clave == "15P"], 2L)
  expect_identical(a$n[a$clave == "15M"], 0L)
  expect_identical(a$nombre[a$clave == "15P"], "Región Lima")
  expect_true("Región Lima" %in% e$ranking$nombre)
  expect_false("Lima Metropolitana" %in% e$ranking$nombre)
  expect_null(e$zona)   # Lima pesa el 4 % de la base: sin recuadro (M12)
})

test_that("M11: si la lista separa Lima Metropolitana, «Lima» a secas sigue siendo Lima Metropolitana", {
  expect_false(.mapa_lima_es_region(c("Lima", "Lima provincias", "Cusco")))
  expect_false(.mapa_lima_es_region(c("Lima Metropolitana", "Lima provincias")))
  expect_false(.mapa_lima_es_region(NULL))
  expect_true(.mapa_lima_es_region(c("Cusco", "Lima", "Callao")))
  deps <- c("Lima", "Lima provincias", "Cusco")
  a <- .mrl_espec(.mrl_fx(deps, c("Lima", "Lima", "Cusco")))$areas
  expect_identical(a$n[a$clave == "15M"], 2L)
  expect_identical(a$nombre[a$clave == "15M"], "Lima Metropolitana")
})

test_that("B17: las tasas y los cortes del mapa llevan punto decimal", {
  expect_identical(.mapa_dist_num(5.8), "5.8")
  expect_identical(.mapa_dist_num(c(0.5, 12)), c("0.5", "12.0"))
  expect_false(any(grepl(",", .mapa_distribucion_clases("tasa", "lima_callao")$rotulos, fixed = TRUE)))
})

test_that("sin el recuadro de la zona de Lima, «Océano Pacífico» va en la esquina del mar y no sobre el sur del Perú", {
  deps <- c("Áncash", "Callao", "Cusco", "Junín", "Lima", "Loreto")
  e <- .mrl_espec(.mrl_fx(deps, c(rep("Junín", 20), rep("Cusco", 15), rep("Lima", 2), rep("Áncash", 8))))
  x_oceano <- function(e) {
    g <- .mapa_dist_panel_gg(e, 3.6, 3.4, .mapa_dist_pt("lamina"))
    capa <- Filter(function(l) identical(l$aes_params$label, "Océano Pacífico") || identical(l$data$label, "Océano Pacífico"), g$layers)
    as.numeric(ggplot2::layer_data(g, which(vapply(g$layers, identical, TRUE, capa[[1]])))$x)
  }
  expect_null(e$zona)
  expect_lt(x_oceano(e), 0.3)   # 16 px del borde; con el recuadro va a 212 px, a su derecha
})
