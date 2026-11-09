source("setup-load-all.R")

# S6 (Gonzalo, 2026-11-09: «esto puede ir en dos diapos para que se vea más uniforme»). Con `hasta` en la primera
# lámina y `continuar_desde` en la segunda, las dos comparten columna de rótulos, paso de fila y escala
# (lamina_divergentes_serie.R, lamina_contraste_grupos.R).

.sc_render <- function(el) {
  src <- .tea_fuentes()
  out <- withr::local_tempfile(fileext = ".pptx", .local_envir = parent.frame())
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                                     plan = p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala"))), path_ppt = out, mensajes_progreso = FALSE)))
  xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
}
.sc_cajas <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(a, b) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, sprintf(".//a:%s", a)), b)) / 914400
  data.frame(x = num("off", "x"), y = num("off", "y"), w = num("ext", "cx"), h = num("ext", "cy"))
}

test_that("S6: la escala partida con hasta y continuar_desde comparte columna, paso de fila y escala", {
  el <- function(...) p_barras_divergentes(vars = c("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen",
                                           regla = list(tipo = "bajo_umbral", umbral = 60), ...)
  a <- .sc_render(el(hasta = 11)); b <- .sc_render(el(continuar_desde = 12))
  ra <- .sc_cajas(a, "divergentes:afirmacion"); rb <- .sc_cajas(b, "divergentes:afirmacion")
  expect_identical(nrow(ra), 11L); expect_identical(nrow(rb), 11L)
  expect_equal(unique(round(ra$w, 3)), unique(round(rb$w, 3)))                  # la misma columna de rótulos
  expect_equal(diff(ra$y + ra$h / 2)[1], diff(rb$y + rb$h / 2)[1], tolerance = 1e-3)   # el mismo paso de fila
  expect_equal(.sc_cajas(a, "divergentes:centro")$x, .sc_cajas(b, "divergentes:centro")$x, tolerance = 1e-3)   # el mismo eje
  # La misma escala: el mismo ancho para el mismo porcentaje (las barras de 100 % miden lo mismo en las dos).
  sa <- .sc_cajas(a, "divergentes:segmento"); sb <- .sc_cajas(b, "divergentes:segmento")
  ancho_fila <- function(s, y) sum(s$w[abs(s$y - y) < 0.05])
  expect_equal(ancho_fila(sa, sa$y[1]), ancho_fila(sb, sb$y[1]), tolerance = 0.02)
})

test_that("S6: hasta valida su posición y no admite quedar antes de continuar_desde", {
  expect_error(p_barras_divergentes(vars = "a$p", hasta = 0), "hasta")
  expect_error(p_barras_divergentes(vars = "a$p", continuar_desde = 5, hasta = 3), "hasta")
  expect_identical(p_barras_divergentes(vars = "a$p", hasta = 11)$hasta, 11L)
  expect_identical(p_dumbbell(vars = "e$*", cruce = "e$c", grupos = c("1", "2", "3"), corte = c("3", "4"), regla = list(tipo = "mayor_diferencia", n = 7),
                              hasta = 4)$hasta, 4L)
})

test_that("S6: el contraste con tres grupos partido en 4 y 3 preguntas reparte el alto igual en las dos láminas", {
  rot <- paste("Pregunta", 1:7)
  g <- c("Segundo ciclo", "Tercer ciclo", "Cuarto ciclo")
  esp <- function(i) {
    d <- data.frame(eje = rep(rot[i], 3), grupo = rep(g, each = length(i)), valor = 50 + seq_along(rep(i, 3)), n_casos = rep(c(139, 25, 115), each = length(i)))
    e <- .espec_contraste(d, base_en = "nota"); e$serie <- list(rotulos = rot, eje = e$eje, m_max = 4L); e
  }
  a <- .lam_contraste_geom(esp(1:4), titulo = "Diferencias por ciclo"); b <- .lam_contraste_geom(esp(5:7), titulo = "Diferencias por ciclo")
  expect_equal(a$u, b$u); expect_equal(a$hueco, b$hueco); expect_equal(a$m$wrot, b$m$wrot)
})
