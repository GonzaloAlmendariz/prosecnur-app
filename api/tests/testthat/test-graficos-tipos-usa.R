source("setup-load-all.R")

# Selector por intención (ADR 0135): cada tipo de gráfico dice qué datos usa. `cruce` sale de los args; `pregunta`,
# `publicos` y `padron`, de la tabla de graficos_tipos_usa.R, que este test contrasta con lo que los args sí afirman.

.usa_preg <- function(nm) as.character(.graficos_tipos_usa(nm)$pregunta)   # sin la clase AsIs del I()
.usa_args_con <- function(nm, nombre) any(vapply(.GRAFICADORES_META[[nm]]$args, function(a) identical(a$name, nombre), TRUE))

test_that("ningún graficador del registro queda sin `usa`, y la tabla no nombra graficadores que no existen", {
  sin_usa <- setdiff(names(.GRAFICADORES_META), names(.GRAFICOS_TIPOS_USA))
  expect_identical(sin_usa, character(0), info = "Declara su fila en .GRAFICOS_TIPOS_USA (graficos_tipos_usa.R).")
  expect_identical(setdiff(names(.GRAFICOS_TIPOS_USA), names(.GRAFICADORES_META)), character(0))
  cat <- .graficos_tipos_catalogo()
  for (g in cat$graficadores) {
    expect_identical(names(g$usa), c("pregunta", "publicos", "padron", "cruce"), info = g$name)
    preg <- as.character(g$usa$pregunta)
    expect_gte(length(preg), 1L)
    expect_true(all(preg %in% .GRAFICOS_USA_PREGUNTAS), info = g$name)
    expect_false(anyDuplicated(preg) > 0L, info = g$name)
    # «cualquiera» va solo: no se combina con un tipo concreto.
    if ("cualquiera" %in% preg) expect_identical(preg, "cualquiera", info = g$name)
    expect_true(g$usa$publicos %in% .GRAFICOS_USA_PUBLICOS, info = g$name)
    expect_type(g$usa$padron, "logical"); expect_type(g$usa$cruce, "logical")
  }
})

test_that("la tabla no contradice a los args: la regla usa escalas, `bases` admite varios públicos, el padrón es de la cobertura", {
  for (nm in names(.GRAFICADORES_META)) {
    u <- .graficos_tipos_usa(nm)
    if (.usa_args_con(nm, "regla")) expect_identical(.usa_preg(nm), "escala", info = nm)   # el universo de la regla (ADR 0135 §5)
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
  expect_identical(.usa_preg("p_panorama"), "escala")
  expect_identical(.graficos_tipos_usa("p_panorama")$publicos, "uno_o_varios")
  expect_identical(.graficos_tipos_usa("p_fortalezas")$publicos, "uno")
  expect_identical(.graficos_tipos_usa("p_significancia_publicos")$publicos, "varios")
  expect_identical(.usa_preg("p_nube_palabras"), "abierta")
  expect_identical(.usa_preg("p_boxplot"), "numerica")
  expect_null(.graficos_tipos_usa("p_no_existe"))
})

test_that("`pregunta` dice todo lo que el gráfico acepta, el tipo principal primero", {
  # Las barras agrupadas y el ranking también dibujan una múltiple; el radar y la tabla abren sus opciones (modo `sm`).
  expect_identical(.usa_preg("p_barras_agrupadas"), c("opcion_unica", "multiple"))
  expect_identical(.usa_preg("p_lollipop"), c("opcion_unica", "multiple"))
  expect_identical(.usa_preg("p_radar"), c("escala", "multiple"))
  expect_identical(.usa_preg("p_tabla"), c("escala", "multiple"))
  # El modo `sm` del radar y la tabla existe en sus args: si se retira, la tabla miente.
  modos <- function(nm) {
    a <- Filter(function(x) identical(x$name, "modo"), .GRAFICADORES_META[[nm]]$args)
    vapply(a[[1]]$choices %||% list(), function(ch) as.character(ch$value %||% ch), character(1))
  }
  expect_true("sm" %in% modos("p_radar")); expect_true("sm" %in% modos("p_tabla"))
  expect_identical(.usa_preg("p_cifra"), "cualquiera")
})

test_that("el JSON versionado lleva `usa` por graficador (padrón y cruce como booleanos)", {
  ruta <- file.path(.app_api_dir(), "inst", "catalogos", "graficos_tipos.json")
  if (!file.exists(ruta)) ruta <- file.path("..", "..", "inst", "catalogos", "graficos_tipos.json")
  j <- jsonlite::fromJSON(ruta, simplifyVector = FALSE)
  por <- stats::setNames(j$graficadores, vapply(j$graficadores, `[[`, "", "name"))
  # `pregunta` es siempre arreglo, también con un solo tipo (el `I()` le gana al `auto_unbox`).
  expect_identical(por$p_cobertura$usa, list(pregunta = list("cualquiera"), publicos = "uno_o_varios", padron = TRUE, cruce = FALSE))
  expect_identical(por$p_barras_apiladas$usa, list(pregunta = list("escala"), publicos = "uno", padron = FALSE, cruce = TRUE))
  expect_identical(por$p_lollipop$usa$pregunta, list("opcion_unica", "multiple"))
})
