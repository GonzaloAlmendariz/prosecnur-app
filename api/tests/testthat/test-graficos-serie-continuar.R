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

# O1 (Gonzalo, 2026-11-09, su resumen de Arte revisado a mano): `hasta` y `continuar_desde` cuentan en el orden en que se
# dibujan las filas, de arriba abajo, no en el de la métrica de la regla (graficos_tope_orden_dibujo.R).
.o1_ind <- function() data.frame(tema = c("a", "b", "c", "d"), grupo = "doc", valor = c(10, 20, 30, 40), sin_info = c(5, 25, 15, 35),
                                 stringsAsFactors = FALSE)
.o1_recortar <- function(orden = "top_two_box", ...) {
  ev <- list(temas = c("a", "b", "c", "d"), texto = "Se muestran las 4 bajo 60%.", universo = "preguntas de escala", total = 10L)
  el <- c(list(.element_type = "barras_divergentes", overrides = list(estilo = "resumen", orden = orden)), list(...))
  .regla_preguntas_recortar(ev, list(indicadores = .o1_ind(), universo = "preguntas de escala"), el, list(tipo = "bajo_umbral", umbral = 60))
}

test_that("O1: con la escala de mayor a menor, `hasta` deja las primeras como se leen y `continuar_desde` las siguientes", {
  a <- .o1_recortar(hasta = 2L); b <- .o1_recortar(continuar_desde = 3L)
  expect_identical(a$ev$temas, c("d", "c"))      # la lámina se lee de 40 a 30, no las dos más bajas
  expect_identical(b$ev$temas, c("b", "a"))
  expect_match(a$ev$texto, "Se muestran de la 1 a la 2 de las 4 bajo 60%", fixed = TRUE)   # ya no "las 2 más bajas"
  expect_false(grepl("más bajas", a$ev$texto, fixed = TRUE))
  # Por "Sin información" cuenta en ese orden; sin serie, la prioridad de la regla (todas caben y no se toca nada).
  expect_identical(.o1_recortar("sin_informacion", hasta = 2L)$ev$temas, c("d", "b"))
  expect_identical(.o1_recortar()$ev$temas, c("a", "b", "c", "d"))
})

test_that("O1: en el contraste la serie cuenta en el orden del dibujo (diferencia con signo sin la regla de mayor diferencia)", {
  ind <- data.frame(tema = rep(c("a", "b", "c"), 2), grupo = rep(c("E", "D"), each = 3), valor = c(50, 80, 60, 70, 60, 61),
                    stringsAsFactors = FALSE)
  el <- list(.element_type = "dumbbell", overrides = list(estilo = "resumen"))
  # Diferencias E - D: a = -20, b = +20, c = -1. Con signo: b, c, a; sin signo (mayor diferencia): a, b, c.
  expect_identical(c("a", "b", "c")[.tope_espacio_orden_dibujo(c("a", "b", "c"), ind, el, list(tipo = "todas"), TRUE)], c("b", "c", "a"))
  expect_identical(c("a", "b", "c")[.tope_espacio_orden_dibujo(c("a", "b", "c"), ind, el, list(tipo = "mayor_diferencia", n = 3), TRUE)],
                   c("a", "b", "c"))
})

# O4: la lámina con `hasta` no aconseja agregar la continuación si el mazo ya la trae (graficos_serie_plan.R).
.o4_el <- function(...) p_barras_divergentes(vars = c("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen",
                                              regla = list(tipo = "bajo_umbral", umbral = 60), ...)

test_that("O4: la continuación se reconoce por tipo, bases, regla y continuar_desde = hasta + 1", {
  a <- .o4_el(hasta = 11)
  con <- list(p_slide_1_grafico(a, titulo = "Escala"), p_slide_1_grafico(.o4_el(continuar_desde = 12), titulo = "Escala"))
  expect_true(.serie_continuacion_en_plan(a, diapos = con))
  expect_false(.serie_continuacion_en_plan(a, diapos = con[1]))
  otra_regla <- p_barras_divergentes(vars = c("estudiantes$*", "docentes$*"), estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 50),
                                     continuar_desde = 12)
  expect_false(.serie_continuacion_en_plan(a, diapos = list(con[[1]], p_slide_1_grafico(otra_regla, titulo = "Escala"))))
  expect_false(.serie_continuacion_en_plan(a, diapos = list(con[[1]], p_slide_1_grafico(.o4_el(continuar_desde = 13), titulo = "Escala"))))
})

test_that("O4: con la continuación en el mazo la lámina no avisa que agregue la lámina que continúa desde la 12; sin ella, sí", {
  src <- .tea_fuentes()
  avisos_de <- function(slides) {
    out <- withr::local_tempfile(fileext = ".pptx")
    av <- character(0)
    withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = p_plan(slides = slides),
                                                          path_ppt = out, mensajes_progreso = FALSE)),
                        message = function(m) { av <<- c(av, conditionMessage(m)); invokeRestart("muffleMessage") })
    av
  }
  a <- p_slide_1_grafico(.o4_el(hasta = 11), titulo = "Escala"); b <- p_slide_1_grafico(.o4_el(continuar_desde = 12), titulo = "Escala")
  expect_false(any(grepl("continúe desde la 12", avisos_de(list(a, b)), fixed = TRUE)))
  expect_true(any(grepl("continúe desde la 12", avisos_de(list(a)), fixed = TRUE)))
})

test_that("S6/O1: las dos mitades de una serie eligen la misma columna aunque una lleve los rótulos largos", {
  cortos <- paste("Pregunta corta", 1:4)
  largos <- c("Los administrativos de la Unidad participamos de actividades de responsabilidad social universitaria de la Universidad.",
              "El Departamento de Arte y Diseño fomenta la participación de docentes en el medio profesional o laboral.",
              "Los mecanismos de evaluación y promoción del personal docente están claramente definidos.",
              "La carga de trabajo de los docentes permite cumplir con las actividades de enseñanza e investigación.")
  # Un alto que no admite más de 9 líneas por lámina: la mitad larga, sola, pediría ensanchar la columna.
  alto <- function(nl, size) if (sum(nl) > 9) NULL else list(u = 0.3, alturas = rep(0.3, length(nl)))
  a <- .lam_rotulos_columna(cortos, NULL, w_min = 1.2, w_max = 5, desde = 12, alto = alto, n_min = 4L, serie = c(cortos, largos))
  b <- .lam_rotulos_columna(largos, NULL, w_min = 1.2, w_max = 5, desde = 12, alto = alto, n_min = 4L, serie = c(cortos, largos))
  expect_false(is.null(a)); expect_false(is.null(b))
  expect_equal(a$wq, b$wq); expect_equal(a$size, b$size)
  # Sin serie, la mitad larga se ensancha por su cuenta: es justo el salto que la serie evita.
  b_sola <- .lam_rotulos_columna(largos, NULL, w_min = 1.2, w_max = 5, desde = 12, alto = alto, n_min = 4L)
  a_sola <- .lam_rotulos_columna(cortos, NULL, w_min = 1.2, w_max = 5, desde = 12, alto = alto, n_min = 4L)
  expect_false(isTRUE(all.equal(a_sola$wq, b_sola$wq)))
})

test_that("S6/O1: con los valores naturales (hasta = 11, continuar_desde = 12) las dos mitades tienen la misma x del área de barras", {
  el <- function(...) p_barras_divergentes(vars = c("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen",
                                           orden = "top_two_box", regla = list(tipo = "bajo_umbral", umbral = 60), ...)
  a <- .sc_render(el(hasta = 11)); b <- .sc_render(el(continuar_desde = 12))
  expect_equal(.sc_cajas(a, "divergentes:centro")$x, .sc_cajas(b, "divergentes:centro")$x, tolerance = 1e-3)
  expect_equal(unique(round(.sc_cajas(a, "divergentes:afirmacion")$w, 3)), unique(round(.sc_cajas(b, "divergentes:afirmacion")$w, 3)))
})
