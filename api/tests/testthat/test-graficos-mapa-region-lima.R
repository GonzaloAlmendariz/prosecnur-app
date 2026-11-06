# CCSS Perfil 2026: en una lista de departamentos (lugar de nacimiento de madres y padres, «¿en qué otra región del Perú?»)
# «Lima» es el departamento entero y no Lima Metropolitana (especificación aprobada, 2026-11-03, que reemplaza la «Región
# Lima» de M11); las áreas de otra respuesta del filtro van rayadas por grupo, sin mezclar Lima Metropolitana y el Callao
# con Lima provincias; y las tasas llevan punto decimal (B17). Fixture sintético.

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

test_that("en una lista de departamentos, «Lima» a secas es el departamento entero: Lima provincias se pinta igual", {
  deps <- c("Áncash", "Callao", "Cusco", "Junín", "Lima", "Loreto")
  e <- .mrl_espec(.mrl_fx(deps, c(rep("Junín", 20), rep("Cusco", 15), rep("Lima", 2), rep("Áncash", 8))))
  a <- e$areas
  expect_identical(a$n[a$clave == "15M"], 2L)
  expect_identical(a$n[a$clave == "15P"], 0L)
  expect_identical(a$nombre[a$clave == "15M"], "Lima (departamento)")   # nunca «Lima Metropolitana»: la lista no la separa
  expect_identical(a$color[a$clave == "15P"], a$color[a$clave == "15M"])
  expect_true("Lima (departamento)" %in% e$lista$nombre)
  expect_null(e$zona)
})

test_that("las áreas de otra respuesta van rayadas por grupo y lo que cae en ellas pasa a «otros», sin pintarse", {
  deps <- c("Áncash", "Callao", "Cusco", "Junín", "Lima", "Loreto")
  carto <- .mapa_distribucion_cartografia("peru")
  fx <- .mrl_fx(deps, c(rep("Junín", 20), rep("Cusco", 15), rep("Lima", 2), rep("Áncash", 8)))
  f <- .mapa_distribucion_casar(.mapa_distribucion_calcular(fx$data, fx$inst, "reg"), carto, "peru")
  grupos <- .mapa_dist_otra_grupos(list(`Lima Metropolitana y Callao` = c("Lima Metropolitana", "Callao"), `Lima provincias` = "Lima provincias"))
  e <- .espec_mapa_distribucion(f, carto, "peru", otra_respuesta = grupos)
  expect_identical(e$otra_grupos, list(c("15M", "07"), "15P"))
  expect_true(all(e$areas$otra[e$areas$clave %in% c("15M", "07", "15P")]))
  expect_identical(e$areas$n[e$areas$clave == "15M"], 0L)
  expect_identical(e$extra$n, 2L)                                   # los 2 «Lima» siguen en la base, en «otros»
  expect_identical(e$base, 45L)
  expect_identical(e$leyenda_extras$texto, c("Sin encuestados", "Lima Metropolitana y Callao", "Lima provincias"))
  f2 <- .lam_mapa_dist_filas(e, 3L)
  expect_identical(f2$nombre[nrow(f2)], "Otras regiones (2)")       # Áncash + los «Lima» fuera del mapa
  expect_identical(f2$cifra[nrow(f2)], "10 (22%)")
  # Una lista simple es un solo grupo con su rótulo.
  expect_identical(.mapa_dist_otra_grupos(c("Lima", "Callao"))[[1]]$rotulo, "Lima y Callao")
  expect_identical(.mapa_dist_otra_grupos(c("Lima"), "Lima Metropolitana y Callao")[[1]]$rotulo, "Lima Metropolitana y Callao")
})

test_that("la escala de personas y el porcentaje con decimal bajo 1 %", {
  cl <- .mapa_distribucion_clases("conteo", "peru", unidad = "personas")
  expect_identical(cl$rotulos, c("1–5", "6–10", "11–20", "21–50", "51 o más"))
  expect_identical(cl$clase(c(1, 5, 6, 50, 51, 175)), c(1L, 1L, 2L, 4L, 5L, 5L))
  expect_identical(.mapa_dist_pct(c(2, 1, 295), 400), c("0.5%", "0.2%", "74%"))
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
    g <- .mapa_dist_panel_gg(e, 6, 4.4, .mapa_dist_pt("lamina"))
    capa <- Filter(function(l) identical(l$aes_params$label, "Océano Pacífico") || identical(l$data$label, "Océano Pacífico"), g$layers)
    as.numeric(ggplot2::layer_data(g, which(vapply(g$layers, identical, TRUE, capa[[1]])))$x)
  }
  expect_null(e$zona)
  expect_lt(x_oceano(e), 0.3)   # 16 px del borde; con el recuadro va a 212 px, a su derecha
})

test_that("`juntar` suma el distrito del Callao al de Lima en un mapa, y «Carmen de La Legua-Reynoso» casa con su distrito", {
  carto <- .mapa_distribucion_cartografia("lima_callao")
  lima <- data.frame(codigo = c("1", "2"), etiqueta = c("Los Olivos", "Callao"), n = c(10L, 1L), porcentaje = 1)
  callao <- data.frame(codigo = c("1", "3"), etiqueta = c("Callao", "Carmen de La Legua-Reynoso"), n = c(12L, 1L), porcentaje = 1)
  f <- rbind(.mapa_distribucion_casar(lima, carto, "lima_callao"), .mapa_distribucion_casar(callao, carto, "lima_callao"))
  expect_false(any(is.na(f$clave)))
  e <- .espec_mapa_distribucion(f, carto, "lima_callao")
  expect_identical(e$base, 24L)
  expect_identical(e$lista$n[e$lista$nombre == "Callao"], 13L)   # el «Callao» de las dos listas, un solo distrito
  expect_identical(nrow(e$extra), 0L)
  expect_identical(p_mapa_distribucion("dist", juntar = "callao_dist")$juntar, "callao_dist")
})
