source("setup-load-all.R")

# S1 (Arte, 2026-11-09): la escala del resumen con 20 filas en la lámina de dos gráficos caía a una imagen con las
# cifras montadas. E3: nunca una imagen ilegible. Ahora va nativa con las filas que caben, en el orden de la regla, y el
# pie lo dice en la frase de la regla. S2: el área de barras de la ranura deja dentro la cifra de un segmento de 30 %
# (lamina_resumen_ranura_escala.R).

test_that("S1: 22 filas en una ranura de la lámina de dos gráficos: nativa, con tope y la frase de la regla al pie", {
  src <- .tea_fuentes()
  esc <- list(graficador = "p_barras_divergentes", args = list(vars = list("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE,
                                                               estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60)))
  pan <- list(graficador = "p_panorama", args = list(vars = list("estudiantes$*", "docentes$*"), corte = list("3", "4")))
  plan <- .normalize_plan(list(slides = list(list(id = "s2", tipo = "p_slide_2_graficos", payload = list(titulo = "Dos gráficos", izquierda = esc, derecha = pan)))),
                          avisar = FALSE)
  out <- withr::local_tempfile(fileext = ".pptx")
  avisos <- character(0)
  withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                                        plan = p_plan(slides = list(.rebuild_slide(plan$slides[[1]]))), path_ppt = out, mensajes_progreso = FALSE)),
                      message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  doc <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
  nombres <- xml2::xml_attr(xml2::xml_find_all(doc, "//p:cNvPr"), "name")
  k <- sum(nombres == "divergentes:afirmacion")
  expect_gte(k, 1L)
  expect_lt(k, 20L)
  expect_false(any(nombres == "mixta:respaldo"))           # ninguna imagen de respaldo
  pie <- paste(xml2::xml_text(xml2::xml_find_all(doc, "//a:t")), collapse = " ")
  av <- tolower(paste(avisos, collapse = "\n"))
  # La frase de la regla, reescrita con lo que muestra la ranura, va al analista; al pie, la base.
  expect_match(av, sprintf("se muestran las %d más bajas de las 22 bajo 60%%", k), fixed = TRUE)
  expect_match(av, sprintf("las %d siguientes no caben en esta lámina", 22L - k), fixed = TRUE)
  expect_false(grepl("se muestran las 20", av, fixed = TRUE))
  expect_false(grepl("Se muestran", pie, ignore.case = TRUE))
  expect_false(grepl("…", pie, fixed = TRUE))
})

test_that("S2: en la ranura de la lámina de dos gráficos un segmento de 30 % lleva su cifra dentro", {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "Sin información")
  d <- data.frame(it = c("Bienestar psicológico (Est.)", "Contratación docente transparente (Doc.)", "Contratación docente justa (Doc.)",
                         "Bienestar psicológico (Doc.)", "Investigación-creación docente suficiente (Doc.)", "Movilidad docente fomentada (Doc.)"),
                  t1 = c(4, 9, 7, 3, 3, 7), t2 = c(9, 18, 16, 17, 38, 25), t3 = c(43, 30, 35, 42, 23, 32), t4 = c(10, 7, 10, 9, 5, 8),
                  t5 = c(34, 36, 32, 29, 31, 28))
  e <- attr(graficar_barras_divergentes(d, "it", names(niv), niv, n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen",
                                        orden = "declarado"), "pulso_espec")
  ge <- .lam_rr_geo(e, 0.5, 1.6, 6.0, 4.6)                 # la ranura izquierda de la lámina de dos gráficos
  expect_true(ge$cabe)
  px <- (ge$xb - ge$xa - 1.1) / .lam_rr_div_total(e)
  expect_gte(30 * px, .lam_ancho_txt("30%", 10, TRUE) + 0.12)
  # «Sin información» con valores de hasta 36 %: su columna no pasa del ancho de siempre (1 in).
  expect_lte(ge$wsi, 1.0 + 1e-9)
})
