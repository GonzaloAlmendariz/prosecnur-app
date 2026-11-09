source("setup-load-all.R")

# P14 (lead, 2026-11-09): el motor no crea láminas y el pie no promete una que no existe. `continuar_desde` (entero,
# desde 1, en el orden de la regla) hace que la lámina muestre las filas desde esa posición. Fixture: helper-tope-espacio-arte.R.

.cd_el <- function(desde = NULL) p_barras_divergentes(vars = c("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE,
                                                      estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60), continuar_desde = desde)

test_that("sin continuar_desde el pie dice cuántas siguen, sin prometer otra lámina", {
  r <- .regla_preguntas_de_elemento(.cd_el(), .tea_fuentes())
  expect_match(r$evaluacion$texto, "^Se muestran las 20 más bajas de las 22 bajo 60%, de 23 preguntas de escala; las 2 siguientes no caben en esta lámina\\.")
  expect_false(grepl("otra lámina", r$evaluacion$texto, fixed = TRUE))
  expect_identical(.tope_espacio_siguientes(1L), "; la siguiente no cabe en esta lámina.")
  expect_identical(.tope_espacio_siguientes(0L), ".")
})

test_that("con continuar_desde la escala muestra desde esa posición, en el orden de la regla, y el pie lo dice", {
  src <- .tea_fuentes()
  r1 <- .regla_preguntas_de_elemento(.cd_el(), src)
  r <- .regla_preguntas_de_elemento(.cd_el(21), src)
  # Las dos que la primera lámina dejó fuera (las 21.ª y 22.ª más bajas), y ninguna de las que ya mostró.
  expect_length(r$vars, 2L)
  expect_setequal(r$vars, c("estudiantes$p24_2", "docentes$p30_3"))
  expect_length(intersect(r$vars, r1$vars), 0L)
  expect_match(r$evaluacion$texto, "^Se muestran de la 21 a la 22 de las 22 bajo 60%, de 23 preguntas de escala\\.")
  # Desde la 11: de la 11 a la 22 (caben las 12).
  r11 <- .regla_preguntas_de_elemento(.cd_el(11), src)
  expect_length(r11$vars, 12L)
  expect_match(r11$evaluacion$texto, "^Se muestran de la 11 a la 22 de las 22 bajo 60%")
  # El conteo dice lo mismo.
  k <- .regla_preguntas_conteo("p_barras_divergentes", list(vars = list("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE,
                                                            estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60), continuar_desde = 21), src)
  expect_setequal(unlist(k$seleccionadas), c("estudiantes$p24_2", "docentes$p30_3"))
})

test_that("el contraste continúa por la mayor diferencia absoluta y el arg se valida", {
  temas <- sprintf("Tema %02d", 1:40)
  dif <- c(seq(40, 2, length.out = 39), -50)
  d <- data.frame(eje = factor(rep(temas, 2), levels = temas), grupo = factor(rep(c("A", "B"), each = 40), levels = c("A", "B")),
                  valor = c(50 + dif / 2, 50 - dif / 2), stringsAsFactors = FALSE)
  r <- suppressMessages(.contraste_tope_espacio(d, desde = 15L))
  expect_length(unique(as.character(r$datos$eje)), 14L)
  expect_false("Tema 40" %in% r$datos$eje)                       # la de mayor diferencia ya salió en la primera
  expect_identical(r$texto, "Se muestran de la 15 a la 28 de mayor diferencia de 40; las 12 siguientes no caben en esta lámina.")
  expect_null(p_dumbbell(vars = list(T = c("a$p", "b$p")), corte = "4", continuar_desde = 1)$continuar_desde)
  expect_identical(p_dumbbell(vars = list(T = c("a$p", "b$p")), corte = "4", continuar_desde = 15)$continuar_desde, 15L)
  for (malo in list(0, -2, 2.5, "x")) expect_error(p_barras_divergentes(vars = "a$p", continuar_desde = malo), "continuar_desde")
  expect_error(.regla_preguntas_de_elemento(.cd_el(30), .tea_fuentes()), "continuar_desde")
})

test_that("H5: la escala del resumen en una ranura respeta continuar_desde (no lo descarta en silencio) y el pie lo dice", {
  # A diferencia del contraste (C4), la ranura de la escala recorta en el orden de la regla, así que continuar desde una
  # posición tiene sentido: la regla salta las primeras y la ranura muestra las siguientes que caben.
  src <- .tea_fuentes()
  esc <- function(desde = NULL) list(graficador = "p_barras_divergentes", args = c(list(vars = list("estudiantes$*", "docentes$*"), n_negativas = 2,
    incluir_neutro = FALSE, estilo = "resumen", regla = list(tipo = "mayor_sin_info", n = 6)), if (!is.null(desde)) list(continuar_desde = desde)))
  pan <- list(graficador = "p_panorama", args = list(vars = list("estudiantes$*", "docentes$*"), corte = list("3", "4")))
  render <- function(desde = NULL) {
    plan <- .normalize_plan(list(slides = list(list(id = "s2", tipo = "p_slide_2_graficos",
                                                    payload = list(titulo = "Dos gráficos", izquierda = esc(desde), derecha = pan)))), avisar = FALSE)
    out <- withr::local_tempfile(fileext = ".pptx", .local_envir = parent.frame())
    avisos <- character(0)
    withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                                          plan = p_plan(slides = list(.rebuild_slide(plan$slides[[1]]))), path_ppt = out, mensajes_progreso = FALSE)),
                        message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
    doc <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
    txt <- function(nm) vapply(xml2::xml_find_all(doc, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nm), xml2::xml_ns(doc)),
                               function(x) paste(xml2::xml_text(xml2::xml_find_all(x, ".//a:t", xml2::xml_ns(doc))), collapse = ""), "")
    list(filas = txt("divergentes:afirmacion"), pie = paste(xml2::xml_text(xml2::xml_find_all(doc, "//a:t")), collapse = " "), avisos = avisos)
  }
  sin <- render(); con <- render(3)
  expect_length(sin$filas, 6L)
  expect_length(con$filas, 4L)                                   # de la 3 a la 6
  # Las mismas, en el mismo orden, sin las dos primeras (el sufijo del público sólo va cuando la lámina mezcla públicos).
  sin_sufijo <- function(x) sub(" \\([^()]+\\)$", "", x)
  expect_identical(sin_sufijo(con$filas), sin_sufijo(sin$filas[3:6]))
  # La frase va al analista, no al pie (lamina_pie_resumen.R).
  expect_true(any(grepl("de la 3 a la 6 de las 6", con$avisos, fixed = TRUE)))
  expect_false(grepl("de la 3 a la 6", con$pie, fixed = TRUE))
  expect_false(any(grepl("no admite `continuar_desde`", con$avisos, fixed = TRUE)))
})
