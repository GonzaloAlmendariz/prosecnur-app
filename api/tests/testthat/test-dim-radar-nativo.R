source("setup-load-all.R")

# G11 (2026-10-13): el registro declaraba el radar por dimensiones como «ruta anterior» («no hay pieza propia») y el
# motor ya lo armaba con la pieza del radar. Se mide la lámina real con tres ejes y con dos.
.dim_radar_fixture <- function(n_ejes) {
  src <- readLines(test_path("test-engine-dimensiones-ppt-radar.R"))
  src <- src[seq_len(grep("^}", src)[1])]
  if (n_ejes == 2L) src <- sub('c("s1", "s2", "s3")', 'c("s1", "s2")', src, fixed = TRUE)
  env <- new.env(); eval(parse(text = src), envir = env)
  suppressMessages(env$make_dimensiones_ppt_fixture())
}
.dim_radar_estado <- function(fx) {
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$data, instrumento = fx$instrumento, mensajes_progreso = FALSE, path_ppt = out,
    plan = p_plan(slides = list(p_slide_1_grafico(p_dim_radar(objetivo = "idx_idx", cruce = "servicio"), titulo = "Dims"))))))
  .preview_partes(out)$partes[[1]]$estado
}

test_that("con tres ejes el radar por dimensiones sale nativo, como declara el registro", {
  expect_identical(.dim_radar_estado(.dim_radar_fixture(3L)), "nativa")
  expect_identical(.GRAFICADORES_META$p_dim_radar$salida, "nativa")
})

test_that("con dos ejes sale como barras por la ruta anterior, que es su condición declarada", {
  # Con la plantilla estándar la ruta anterior lleva el marco del recetario (7e10765b8, lamina_marco_respaldo.R): el dibujo
  # de barras va dentro del título, pie y folio del motor, que `.pptx_lamina_estado` llama «marco» (como en 00cf512ac).
  expect_identical(.dim_radar_estado(.dim_radar_fixture(2L)), "marco")
  expect_match(.GRAFICADORES_META$p_dim_radar$salida_condicion, "menos de tres ejes", fixed = TRUE)
})
