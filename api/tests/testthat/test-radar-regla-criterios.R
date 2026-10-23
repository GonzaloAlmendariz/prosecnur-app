source("setup-load-all.R")

# Decisión del usuario (2026-10-22): el radar se dibuja con 5 a 8 criterios. Con menos cae a líneas y puntos (dumbbell; opcional:
# barras comparativas) y lo AVISA; con más de 8 sigue siendo radar pero avisa. El plan guardado (modo/vars) no se toca: el cambio es de dibujo.

.rc_fuente <- function(prefijo, n_temas, valores) {
  data <- data.frame(id = seq_along(valores[[1]]), stringsAsFactors = FALSE)
  for (k in seq_len(n_temas)) data[[paste0(prefijo, k)]] <- as.character(valores[[(k - 1L) %% length(valores) + 1L]])
  lst <- paste0("lst_", prefijo)
  vars <- paste0(prefijo, seq_len(n_temas))
  list(data = data, inst = list(
    survey = data.frame(type = c("integer", rep("select_one", n_temas)), list_name = c(NA, rep(lst, n_temas)),
                        name = c("id", vars), label = c("id", vars), stringsAsFactors = FALSE),
    choices = data.frame(list_name = lst, name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"),
                         stringsAsFactors = FALSE)))
}
.rc_sources <- function(n) {
  v <- list(c("3", "4", "3", "1", "4", "3", "3", "2"), c("3", "3", "4", "4", "1", "3", "3", "3"))
  a <- .rc_fuente("a", n, v); b <- .rc_fuente("b", n, rev(v))
  list(data_sources = list(docentes = a$data, estudiantes = b$data),
       inst_sources = list(docentes = a$inst, estudiantes = b$inst))
}
.rc_vars <- function(n) {
  setNames(lapply(seq_len(n), function(k) c(paste0("docentes$a", k), paste0("estudiantes$b", k))), paste("Tema", seq_len(n)))
}
.rc_render <- function(n, mostrar_tabla = FALSE, fallback_pocos = NULL) {
  src <- .rc_sources(n)
  data_sources <- src$data_sources; instrument_sources <- src$inst_sources
  el <- p_radar(modo = "publicos", vars = .rc_vars(n), corte = "3,4", corte_etiqueta = "Bien + Muy bien",
                mostrar_tabla = mostrar_tabla, fallback_pocos = fallback_pocos)
  avisos <- character(0)
  g <- withCallingHandlers(.render_radar_publicos(el), message = function(m) {
    avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage")
  })
  list(g = g, avisos = avisos[grepl(.PULSO_AVISO_SELLO, avisos, fixed = TRUE)])
}
.rc_es_barras <- function(g) any(vapply(g$layers, function(l) inherits(l$geom, c("GeomBar", "GeomCol")), TRUE))
.rc_es_puntos <- function(g) {
  geoms <- vapply(g$layers, function(l) class(l$geom)[1], "")
  all(c("GeomSegment", "GeomPoint") %in% geoms) && !.rc_es_barras(g) && identical(attr(g, "pulso_espec")$tipo, "pesas")
}

test_that("el texto del aviso dice el mínimo, el número de criterios y qué se dibuja", {
  expect_null(.radar_mb_aviso_ejes(5L)); expect_null(.radar_mb_aviso_ejes(8L))
  a4 <- .radar_mb_aviso_ejes(4L)
  expect_match(a4, "al menos 5 criterios", fixed = TRUE); expect_match(a4, "tiene 4", fixed = TRUE)
  expect_match(a4, "líneas y puntos comparativos", fixed = TRUE)
  expect_false(grepl("barras", a4, fixed = TRUE))
  expect_match(.radar_mb_aviso_ejes(9L), "más de 8", fixed = TRUE)
})

test_that("con 4 criterios el radar entre públicos sale como líneas y puntos y avisa", {
  r <- .rc_render(4L)
  expect_true(.rc_es_puntos(r$g))
  expect_false(.rc_es_barras(r$g))
  expect_length(r$avisos, 1L)
  expect_match(r$avisos, "al menos 5 criterios", fixed = TRUE)
  expect_match(r$avisos, "tiene 4", fixed = TRUE)
})

test_that("con fallback_pocos = 'barras' los 4 criterios siguen saliendo como barras comparativas", {
  r <- .rc_render(4L, fallback_pocos = "barras")
  expect_true(.rc_es_barras(r$g))
  expect_false(.rc_es_puntos(r$g))
  expect_length(r$avisos, 1L)
  expect_match(r$avisos, "barras comparativas", fixed = TRUE)
  expect_match(r$avisos, "tiene 4", fixed = TRUE)
})

test_that("el fallback no pide otra cosa que 'puntos' o 'barras'", {
  expect_error(p_radar(modo = "publicos", vars = .rc_vars(4L), corte = "3,4", fallback_pocos = "torta"), "fallback_pocos")
  expect_null(p_radar(modo = "publicos", vars = .rc_vars(4L), corte = "3,4")$fallback_pocos)
})

test_that("con 5 y con 8 criterios sigue siendo radar y no avisa", {
  for (n in c(5L, 8L)) {
    r <- .rc_render(n)
    expect_false(.rc_es_barras(r$g), info = n)
    expect_false(.rc_es_puntos(r$g), info = n)
    expect_length(r$avisos, 0L)
  }
})

test_that("con 9 criterios sigue siendo radar y avisa que puede no leerse bien", {
  r <- .rc_render(9L)
  expect_false(.rc_es_barras(r$g))
  expect_length(r$avisos, 1L)
  expect_match(r$avisos, "más de 8", fixed = TRUE)
})

test_that("los puntos llevan las mismas cifras que el radar, en el orden declarado y con los públicos como series", {
  src <- .rc_sources(4L)
  d <- .radar_mb_datos(.rc_vars(4L), "3,4", src)
  g <- .radar_mb_puntos(d, indicador = "Bien + Muy bien")
  espec <- attr(g, "pulso_espec")
  expect_equal(sort(c(espec$a, espec$b)), sort(as.numeric(d$valor)))
  expect_equal(espec$rotulos, as.character(levels(d$eje)))
  expect_equal(espec$grupos, .radar_mb_capitalizar(levels(d$grupo)))
  expect_false(isTRUE(espec$mostrar_diferencia))
})

test_that("las barras llevan las mismas cifras que el radar y los públicos en su orden", {
  src <- .rc_sources(4L)
  d <- .radar_mb_datos(.rc_vars(4L), "3,4", src)
  g <- .radar_mb_barras(d, indicador = "Bien + Muy bien")
  datos_g <- g$data
  expect_equal(sort(as.numeric(datos_g$valor)), sort(as.numeric(d$valor)))
})

test_that("la validación del plan avisa en `warnings` sin tocar el plan", {
  plan <- list(slides = list(list(id = "s1", tipo = "p_slide_1_grafico", payload = list(
    titulo = "Competencias", grafico = list(graficador = "p_radar",
      args = list(modo = "publicos", vars = .rc_vars(4L), corte = "3,4"))))))
  antes <- plan
  v <- .validar_plan_json(plan)
  expect_true(any(grepl("al menos 5 criterios", v$warnings, fixed = TRUE)))
  expect_true(any(grepl("tiene 4", v$warnings, fixed = TRUE)))
  expect_identical(plan, antes)
  plan$slides[[1]]$payload$grafico$args$vars <- .rc_vars(5L)
  expect_false(any(grepl("criterios", .validar_plan_json(plan)$warnings, fixed = TRUE)))
  plan$slides[[1]]$payload$grafico$args$vars <- .rc_vars(9L)
  expect_true(any(grepl("más de 8", .validar_plan_json(plan)$warnings, fixed = TRUE)))
})

# Decisión del usuario (2026-10-22): con pocos criterios el eje de líneas y puntos se acerca a los datos, y es configurable
# (`eje_pocos` = auto | 0-100 | personalizado, con `eje_pocos_min` / `eje_pocos_max`).
.rc_datos_altos <- function(n = 4L) {
  ej <- paste("Tema", seq_len(n))
  v <- c(90, 92, 85, 86, 94, 96, 96, 91)
  data.frame(eje = factor(rep(ej, 2), levels = ej), grupo = factor(rep(c("docentes", "estudiantes"), each = n)),
             valor = rep(v, length.out = 2 * n), n = rep(c(115, 279), each = n))
}
.rc_eje <- function(g) unname(attr(g, "pulso_espec")$eje[c("lo", "hi")])

test_that("por defecto el eje de líneas y puntos se acerca a los datos y los contiene con margen", {
  d <- .rc_datos_altos(); e <- .rc_eje(.radar_mb_puntos(d))
  expect_gt(e[1], 0); expect_lte(e[2], 100)
  expect_lt(e[1], min(d$valor)); expect_gte(e[2], max(d$valor))
  expect_equal(e, c(80, 100))
})

test_that("el eje por defecto avisa en el subtítulo que no empieza en 0, y solo entonces", {
  expect_match(attr(.radar_mb_puntos(.rc_datos_altos(), indicador = "Bien"), "pulso_espec")$titulo_eje, "Eje desde 80 %", fixed = TRUE)
  g0 <- .radar_mb_puntos(.rc_datos_altos(), indicador = "Bien", eje = list(tipo = "0-100"))
  expect_false(grepl("Eje desde", attr(g0, "pulso_espec")$titulo_eje %||% "", fixed = TRUE))
})

test_that("eje_pocos = '0-100' da el eje completo y 'personalizado' respeta mínimo y máximo", {
  expect_equal(.rc_eje(.radar_mb_puntos(.rc_datos_altos(), eje = list(tipo = "0-100"))), c(0, 100))
  e <- .rc_eje(.radar_mb_puntos(.rc_datos_altos(), eje = list(tipo = "personalizado", min = 60, max = 100)))
  expect_equal(e, c(60, 100))
})

test_that("p_radar guarda el eje en el slot y lo valida", {
  v <- .rc_vars(4L)
  el <- p_radar(modo = "publicos", vars = v, corte = "3,4", eje_pocos = "personalizado", eje_pocos_min = 50, eje_pocos_max = 100)
  expect_identical(el$eje_pocos, "personalizado"); expect_equal(el$eje_pocos_min, 50); expect_equal(el$eje_pocos_max, 100)
  expect_null(p_radar(modo = "publicos", vars = v, corte = "3,4")$eje_pocos)
  expect_error(p_radar(modo = "publicos", vars = v, corte = "3,4", eje_pocos = "log"), "eje_pocos")
  expect_error(p_radar(modo = "publicos", vars = v, corte = "3,4", eje_pocos = "personalizado", eje_pocos_min = 80, eje_pocos_max = 80), "eje_pocos")
  expect_error(p_radar(modo = "publicos", vars = v, corte = "3,4", eje_pocos = "personalizado", eje_pocos_min = -5, eje_pocos_max = 100), "eje_pocos")
  expect_error(p_radar(modo = "publicos", vars = v, corte = "3,4", eje_pocos = "personalizado", eje_pocos_min = 50), "eje_pocos")
})

test_that("el render del slot usa el eje elegido; con 5, 8 y 9 criterios o con barras no cambia nada", {
  src <- .rc_sources(4L); data_sources <- src$data_sources; instrument_sources <- src$inst_sources
  el <- p_radar(modo = "publicos", vars = .rc_vars(4L), corte = "3,4", mostrar_tabla = FALSE, eje_pocos = "0-100")
  expect_equal(.rc_eje(suppressMessages(.render_radar_publicos(el))), c(0, 100))
  for (n in c(5L, 8L, 9L)) {
    r <- .rc_render(n); expect_false(.rc_es_puntos(r$g), info = n)
  }
  r5 <- { src <- .rc_sources(5L); data_sources <- src$data_sources; instrument_sources <- src$inst_sources
    suppressMessages(.render_radar_publicos(p_radar(modo = "publicos", vars = .rc_vars(5L), corte = "3,4", mostrar_tabla = FALSE, eje_pocos = "0-100"))) }
  expect_false(.rc_es_puntos(r5))
  expect_true(.rc_es_barras(.rc_render(4L, fallback_pocos = "barras")$g))
})
