source("setup-load-all.R")

# R2 (Renzo Segura, informe de Arte, 2026-10-27: «sí, para estandarizar, así puse los demás»): toda figura del Word de UN
# solo público con UNA barra (Sí/No o escala de una premisa) lleva el nombre del público a la izquierda de la barra, como
# el Gráfico 74 («Estudiantes»). Los Gráficos 49 (Sí/No, 115 docentes) y 50 (escala que depende de él, 77 docentes) salían
# sin «Docentes»: venían de un elemento suelto (`p_barras_agrupadas` / `p_barras_apiladas`, aquí por la lámina con
# dependencia), no de una multiapilada, y su fila no tenía rótulo. Sólo presentación: bases, filtros y pies no cambian.

.wpi_fixture <- function() {
  src <- readLines(test_path("test-lamina-filtro-sub.R"))
  src <- src[seq_len(grep("^\\.fsub_render <- function", src)[1] - 1L)]
  env <- new.env(); eval(parse(text = src), envir = env)
  env$.fsub_fixture()
}

.wpi_charts <- function(slide, fuentes = c("docentes", "estudiantes")) {
  fx <- .wpi_fixture()
  data <- stats::setNames(rep(list(fx$df), length(fuentes)), fuentes)
  inst <- stats::setNames(rep(list(fx$inst), length(fuentes)), fuentes)
  meta <- suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = data, instrumento = inst, plan = list(a = slide),
    presets = .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), w_presets()),
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta))
  list(charts = Filter(function(m) identical(m$kind %||% "chart", "chart"), meta), df = fx$df)
}

.wpi_textos <- function(g) {
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
}
# «Docentes» o «Docentes (19)»: con base chica la fila dice sus casos («Casos junto al porcentaje»), como el Gráfico 74
.wpi_hay_docentes <- function(g) any(grepl("^Docentes( \\([0-9]+\\))?$", .wpi_textos(g)))
.wpi_word <- function(m) .word_grafico(m$plot_word)

test_that("el rótulo del público sale de la base de la variable, capitalizado; la base interna «default» no se nombra", {
  el <- function(...) structure(list(...), class = "ppt_element")
  expect_identical(.word_publico_una_barra(el(var = "docentes$p18")), "Docentes")
  expect_identical(.word_publico_una_barra(el(var = "estudiantes_pregrado$p1")), "Estudiantes Pregrado")   # como la fila de la multiapilada (`.pretty_source_label`)
  expect_identical(.word_publico_una_barra(el(var = "default$p18")), "")
  expect_identical(.word_publico_una_barra(el(var = "p18")), "")
  expect_identical(.word_publico_una_barra(el(var = c("docentes$p1", "estudiantes$p1"))), "")   # dos series: no aplica
  expect_identical(.word_publico_una_barra(el(var = "docentes$p1", cruces = "docentes$sexo")), "")   # cruce: varias barras
})

test_that("Sí/No suelto de un solo público: «Docentes» a la izquierda de la barra, misma letra que el Gráfico 74", {
  s <- p_slide_1_grafico(p_barras_agrupadas(var = "docentes$inter"), titulo = "Intercambio")
  o <- .wpi_charts(s)
  expect_length(o$charts, 1L)
  g <- .wpi_word(o$charts[[1]])
  expect_true(.wpi_hay_docentes(g))
  expect_lt(ggplot2::layer_scales(g)$x$get_limits()[1], 0)           # la barra cede la columna de rótulos
  expect_match(o$charts[[1]]$base, sprintf("^Base: %d", nrow(o$df)))  # la base no cambia
})

test_that("escala de una premisa suelta de un solo público: «Docentes» a la izquierda", {
  s <- p_slide_1_grafico(p_barras_apiladas(var = "docentes$util"), titulo = "Utilidad")
  o <- .wpi_charts(s)
  g <- .wpi_word(o$charts[[1]])
  expect_true(.wpi_hay_docentes(g))
})

test_that("filtro y subpregunta (lámina con dependencia): las DOS figuras llevan «Docentes»; la base de la segunda, igual", {
  s <- .graficos_rebuild_slide_json(list(id = "x", tipo = "p_slide_2_graficos_vertical", payload = list(titulo = "Intercambio",
    superior = list(graficador = "p_barras_agrupadas", args = list(var = "docentes$inter")),
    inferior = list(graficador = "p_barras_apiladas", args = list(var = "docentes$util")),
    meta = list(dependencia = list(de = "superior", habilita = list("Sí"), frase = "que participaron")))))
  o <- .wpi_charts(s)
  expect_length(o$charts, 2L)
  for (m in o$charts) expect_true(.wpi_hay_docentes(.wpi_word(m)), info = m$title)
  expect_match(o$charts[[2]]$base, sprintf("^Base: %d", sum(o$df$inter == "1")))
})

test_that("sin público nombrado (estudio de una base) la figura sigue sin rótulo, como hoy", {
  fx <- .wpi_fixture()
  meta <- suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = fx$df, instrumento = fx$inst, plan = list(a = p_slide_1_grafico(p_barras_agrupadas(var = "inter"), titulo = "X")),
    presets = .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), w_presets()),
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta))
  m <- Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)[[1]]
  g <- .wpi_word(m)
  expect_equal(ggplot2::layer_scales(g)$x$get_limits()[1], 0)
})

test_that("el PPT no cambia: la lámina no recibe el rótulo del Word", {
  el <- structure(list(var = "docentes$p18"), class = "ppt_element")
  p <- structure(ggplot2::ggplot(), pulso_espec = preparar_categorica(c("Sí", "No"), c(.6, .4), c("60%", "40%")))
  p2 <- .word_publico_marcar(p, el)
  expect_identical(attr(p2, "pulso_espec")$publico_word, "Docentes")
  expect_null(attr(p, "pulso_espec")$publico_word)                     # no muta la espec de la lámina
})
