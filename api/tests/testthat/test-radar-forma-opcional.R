source("setup-load-all.R")

# Pedido del usuario (2026-10-23): el analista elige la forma del radar entre públicos. `forma` = auto (defecto: radar con
# 5 a 8 criterios, `fallback_pocos` con menos) | puntos (líneas y puntos siempre) | radar (aunque haya 3 o 4) | barras.

.rf_fuente <- function(prefijo, n_temas, valores) {
  data <- data.frame(id = seq_along(valores[[1]]), stringsAsFactors = FALSE)
  for (k in seq_len(n_temas)) data[[paste0(prefijo, k)]] <- as.character(valores[[(k - 1L) %% length(valores) + 1L]])
  lst <- paste0("lst_", prefijo); vars <- paste0(prefijo, seq_len(n_temas))
  list(data = data, inst = list(
    survey = data.frame(type = c("integer", rep("select_one", n_temas)), list_name = c(NA, rep(lst, n_temas)),
                        name = c("id", vars), label = c("id", vars), stringsAsFactors = FALSE),
    choices = data.frame(list_name = lst, name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"),
                         stringsAsFactors = FALSE)))
}
.rf_sources <- function(n) {
  v <- list(c("3", "4", "3", "1", "4", "3", "3", "2"), c("3", "3", "4", "4", "1", "3", "3", "3"))
  a <- .rf_fuente("a", n, v); b <- .rf_fuente("b", n, rev(v))
  list(data_sources = list(docentes = a$data, estudiantes = b$data), inst_sources = list(docentes = a$inst, estudiantes = b$inst))
}
.rf_vars <- function(n) {
  setNames(lapply(seq_len(n), function(k) c(paste0("docentes$a", k), paste0("estudiantes$b", k))), paste("Tema", seq_len(n)))
}
.rf_render <- function(n, ...) {
  src <- .rf_sources(n); data_sources <- src$data_sources; instrument_sources <- src$inst_sources
  el <- p_radar(modo = "publicos", vars = .rf_vars(n), corte = "3,4", corte_etiqueta = "Bien", mostrar_tabla = FALSE, ...)
  avisos <- character(0)
  g <- withCallingHandlers(.render_radar_publicos(el), message = function(m) {
    avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage")
  })
  list(g = g, avisos = avisos[grepl(.PULSO_AVISO_SELLO, avisos, fixed = TRUE)])
}
.rf_barras <- function(g) any(vapply(g$layers, function(l) inherits(l$geom, c("GeomBar", "GeomCol")), TRUE))
.rf_puntos <- function(g) identical(attr(g, "pulso_espec")$tipo, "pesas") && !.rf_barras(g)
.rf_radar <- function(g) !.rf_barras(g) && !.rf_puntos(g)
.rf_eje <- function(g) unname(attr(g, "pulso_espec")$eje[c("lo", "hi")])

test_that("forma auto (y sin forma) conserva la regla: radar con 6, líneas y puntos con 4", {
  expect_null(p_radar(modo = "publicos", vars = .rf_vars(6L), corte = "3,4")$forma)
  expect_null(p_radar(modo = "publicos", vars = .rf_vars(6L), corte = "3,4", forma = "auto")$forma)
  expect_true(.rf_radar(.rf_render(6L)$g))
  expect_true(.rf_radar(.rf_render(6L, forma = "auto")$g))
  expect_true(.rf_puntos(.rf_render(4L, forma = "auto")$g))
  expect_true(.rf_barras(.rf_render(4L, forma = "auto", fallback_pocos = "barras")$g))
})

test_that("forma puntos dibuja líneas y puntos con 6 criterios y respeta el eje elegido", {
  r <- .rf_render(6L, forma = "puntos", eje_pocos = "personalizado", eje_pocos_min = 60, eje_pocos_max = 100)
  expect_true(.rf_puntos(r$g)); expect_equal(.rf_eje(r$g), c(60, 100))
  expect_length(r$avisos, 0L)
  expect_equal(.rf_eje(.rf_render(6L, forma = "puntos", eje_pocos = "0-100")$g), c(0, 100))
  expect_true(.rf_puntos(.rf_render(3L, forma = "puntos")$g))
  # más de 8: sigue el aviso existente (límite suave), sin abortar
  r9 <- .rf_render(9L, forma = "puntos")
  expect_true(.rf_puntos(r9$g)); expect_match(r9$avisos, "más de 8", fixed = TRUE)
})

test_that("forma barras dibuja barras comparativas siempre", {
  expect_true(.rf_barras(.rf_render(6L, forma = "barras")$g))
  expect_true(.rf_barras(.rf_render(4L, forma = "barras")$g))
})

test_that("forma radar: con 3 o 4 criterios dibuja el radar y avisa; con menos de 3 aborta", {
  for (n in 3:4) {
    r <- .rf_render(n, forma = "radar")
    expect_true(.rf_radar(r$g), info = n)
    expect_length(r$avisos, 1L); expect_match(tolower(r$avisos), "elegiste dibujar un radar", fixed = TRUE)
    expect_match(r$avisos, sprintf("tiene %d", n), fixed = TRUE)
  }
  expect_match(.radar_mb_aviso_ejes(2L, forma = "radar"), "al menos 3", fixed = TRUE)
  expect_error(.rf_render(2L, forma = "radar"), "al menos 3 criterios")
  expect_true(.rf_radar(.rf_render(6L, forma = "radar")$g))
  expect_length(.rf_render(6L, forma = "radar")$avisos, 0L)
})

test_that("forma se valida, y el aviso de la validación del plan la respeta", {
  expect_error(p_radar(modo = "publicos", vars = .rf_vars(4L), corte = "3,4", forma = "torta"), "forma")
  expect_null(.radar_mb_aviso_ejes(4L, forma = "puntos")); expect_null(.radar_mb_aviso_ejes(4L, forma = "barras"))
  expect_match(.radar_mb_aviso_ejes(4L), "al menos 5 criterios", fixed = TRUE)
  plan <- function(forma) list(slides = list(list(id = "s1", tipo = "p_slide_1_grafico", payload = list(
    titulo = "C", grafico = list(graficador = "p_radar",
      args = list(modo = "publicos", vars = .rf_vars(4L), corte = "3,4", forma = forma))))))
  expect_false(any(grepl("criterios", .validar_plan_json(plan("puntos"))$warnings, fixed = TRUE)))
  expect_true(any(grepl("elegiste dibujar un radar", tolower(.validar_plan_json(plan("radar"))$warnings), fixed = TRUE)))
})

test_that("la opción está declarada y llega del plan guardado al constructor (round-trip)", {
  a <- Filter(function(x) identical(x$name, "forma"), .GRAFICADORES_META$p_radar$args)
  expect_length(a, 1L)
  expect_identical(a[[1]]$tipo_input, "choice"); expect_identical(a[[1]]$default, "auto"); expect_identical(a[[1]]$label, "Forma del gráfico")
  expect_identical(vapply(a[[1]]$choices, function(x) x$value, ""), c("auto", "puntos", "radar", "barras"))
  nm <- vapply(.GRAFICADORES_META$p_radar$args, function(x) x$name, "")
  expect_true(all(c("forma", "fallback_pocos", "eje_pocos", "eje_pocos_min", "eje_pocos_max") %in% nm))
  el <- .graficos_rebuild_graf_json(list(graficador = "p_radar", args = list(
    modo = "publicos", vars = .rf_vars(6L), corte = "3,4", forma = "puntos",
    eje_pocos = "personalizado", eje_pocos_min = 60, eje_pocos_max = 100)))
  expect_identical(el$forma, "puntos"); expect_identical(el$eje_pocos, "personalizado")
  expect_equal(c(el$eje_pocos_min, el$eje_pocos_max), c(60, 100))
  el0 <- .graficos_rebuild_graf_json(list(graficador = "p_radar", args = list(modo = "publicos", vars = .rf_vars(6L), corte = "3,4")))
  expect_null(el0$forma)
})
