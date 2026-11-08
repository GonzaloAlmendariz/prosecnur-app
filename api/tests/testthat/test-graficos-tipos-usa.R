source("setup-load-all.R")

# Selector por intención (ADR 0135): cada tipo de gráfico dice qué datos usa. `cruce` sale de los args; `pregunta`,
# `publicos` y `padron`, de la tabla de graficos_tipos_usa.R, que este test contrasta con lo que los args sí afirman.

.usa_args_con <- function(nm, nombre) any(vapply(.GRAFICADORES_META[[nm]]$args, function(a) identical(a$name, nombre), TRUE))

test_that("ningún graficador del registro queda sin `usa`, y la tabla no nombra graficadores que no existen", {
  sin_usa <- setdiff(names(.GRAFICADORES_META), names(.GRAFICOS_TIPOS_USA))
  expect_identical(sin_usa, character(0), info = "Declara su fila en .GRAFICOS_TIPOS_USA (graficos_tipos_usa.R).")
  expect_identical(setdiff(names(.GRAFICOS_TIPOS_USA), names(.GRAFICADORES_META)), character(0))
  cat <- .graficos_tipos_catalogo()
  for (g in cat$graficadores) {
    expect_identical(names(g$usa), c("pregunta", "publicos", "padron", "cruce"), info = g$name)
    expect_true(g$usa$pregunta %in% .GRAFICOS_USA_PREGUNTAS, info = g$name)
    expect_true(g$usa$publicos %in% .GRAFICOS_USA_PUBLICOS, info = g$name)
    expect_type(g$usa$padron, "logical"); expect_type(g$usa$cruce, "logical")
  }
})

test_that("la tabla no contradice a los args: la regla usa escalas, `bases` admite varios públicos, el padrón es de la cobertura", {
  for (nm in names(.GRAFICADORES_META)) {
    u <- .graficos_tipos_usa(nm)
    if (.usa_args_con(nm, "regla")) expect_identical(u$pregunta, "escala", info = nm)   # el universo de la regla (ADR 0135 §5)
    if (.usa_args_con(nm, "bases")) expect_false(identical(u$publicos, "uno"), info = nm)
  }
  con_padron <- names(Filter(function(nm) isTRUE(.graficos_tipos_usa(nm)$padron), stats::setNames(nm = names(.GRAFICADORES_META))))
  expect_identical(con_padron, "p_cobertura")
})

test_that("`cruce` sale de los args: un arg cruce, cruces o grupo que pide una variable", {
  expect_true(.graficos_tipos_usa("p_barras_agrupadas")$cruce)    # cruces
  expect_true(.graficos_tipos_usa("p_histograma")$cruce)          # grupo
  expect_true(.graficos_tipos_usa("p_dumbbell")$cruce)            # cruce opcional: entre grupos de una base
  expect_false(.graficos_tipos_usa("p_panorama")$cruce)
  expect_false(.graficos_tipos_usa("p_pie")$cruce)
  expect_false(.graficos_usa_cruce_de_args(list(list(name = "cruce", tipo_input = "codigos_list"))))
})

test_that("las láminas de resumen dicen que usan escalas y cuántos públicos", {
  expect_identical(.graficos_tipos_usa("p_panorama")[c("pregunta", "publicos")], list(pregunta = "escala", publicos = "uno_o_varios"))
  expect_identical(.graficos_tipos_usa("p_fortalezas")$publicos, "uno")
  expect_identical(.graficos_tipos_usa("p_significancia_publicos")$publicos, "varios")
  expect_identical(.graficos_tipos_usa("p_nube_palabras")$pregunta, "abierta")
  expect_identical(.graficos_tipos_usa("p_boxplot")$pregunta, "numerica")
  expect_null(.graficos_tipos_usa("p_no_existe"))
})

test_that("el JSON versionado lleva `usa` por graficador (padrón y cruce como booleanos)", {
  ruta <- file.path(.app_api_dir(), "inst", "catalogos", "graficos_tipos.json")
  if (!file.exists(ruta)) ruta <- file.path("..", "..", "inst", "catalogos", "graficos_tipos.json")
  j <- jsonlite::fromJSON(ruta, simplifyVector = FALSE)
  por <- stats::setNames(j$graficadores, vapply(j$graficadores, `[[`, "", "name"))
  expect_identical(por$p_cobertura$usa, list(pregunta = "cualquiera", publicos = "uno_o_varios", padron = TRUE, cruce = FALSE))
  expect_identical(por$p_barras_apiladas$usa, list(pregunta = "escala", publicos = "uno", padron = FALSE, cruce = TRUE))
})
