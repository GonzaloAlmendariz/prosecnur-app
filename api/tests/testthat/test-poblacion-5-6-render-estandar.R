# K15 — «Cinco gráficos» y «Seis gráficos» (tipos 19 y 20) renderizados con la plantilla_16_9 real: el ícono del público
# sale en la cabecera (no se suprime en silencio) y cada gráfico cae en su ranura del estándar.
#
# El verificador de la 2.ª vuelta de K15 encontró que, al pasar el ícono a la cabecera (0.3 in), `.ppt_calibrar_pies_iconos`
# sólo aceptaba un cajón cuadrado de 1 in o más centrado: marcaba el slot `suppress` y `.ph_with_strict` lo omitía sin
# avisar. Este test atraviesa el constructor (reporte_plan_slides.R: pic1 = superior_2…) y la plantilla, no un mock.

# Cada variable tiene su propia lista de opciones, rotuladas con el nombre de su ranura («S1 uno», «I2 tres»…): el render
# de la ruta anterior no dibuja el título del gráfico, pero sí sus rótulos, y así se sabe qué gráfico es cada forma.
.p56_rotulos <- c("S1", "S2", "S3", "I1", "I2", "I3")
.p56_fixture <- function(n_vars) {
  set.seed(7); n <- 40
  vars <- paste0("v", seq_len(n_vars)); listas <- paste0("l", seq_len(n_vars))
  op <- function(k) paste(.p56_rotulos[k], c("uno", "dos", "tres"))
  df <- as.data.frame(setNames(lapply(seq_len(n_vars), function(k) sample(op(k), n, TRUE)), vars), stringsAsFactors = FALSE)
  ch <- do.call(rbind, lapply(seq_len(n_vars), function(k) data.frame(list_name = listas[k], name = op(k), label = op(k))))
  inst <- list(survey = data.frame(name = vars, type = paste("select_one", listas), list_name = listas, label = toupper(vars),
                                   stringsAsFactors = FALSE), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}
.p56_render <- function(slide, n_vars) {
  f <- .p56_fixture(n_vars); out <- tempfile(fileext = ".pptx")
  avisos <- character()
  withCallingHandlers(
    suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = p_plan(slides = list(slide)), path_ppt = out,
                                      mensajes_progreso = FALSE)),
    message = function(m) { if (grepl("[PULSO-AVISO]", conditionMessage(m), fixed = TRUE)) avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  xml <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
  top <- xml2::xml_find_all(xml, "/p:sld/p:cSld/p:spTree/*[self::p:grpSp or self::p:graphicFrame or self::p:pic or self::p:sp]")
  caja <- function(n) {
    off <- xml2::xml_find_first(n, "./p:grpSpPr/a:xfrm/a:off|./p:xfrm/a:off|./p:spPr/a:xfrm/a:off")
    ext <- xml2::xml_find_first(n, "./p:grpSpPr/a:xfrm/a:ext|./p:xfrm/a:ext|./p:spPr/a:xfrm/a:ext")
    c(x = as.numeric(xml2::xml_attr(off, "x")), y = as.numeric(xml2::xml_attr(off, "y")),
      w = as.numeric(xml2::xml_attr(ext, "cx")), h = as.numeric(xml2::xml_attr(ext, "cy"))) / 914400
  }
  list(formas = lapply(top, function(n) list(caja = caja(n), textos = trimws(xml2::xml_text(xml2::xml_find_all(n, ".//a:t"))))),
       avisos = avisos)
}
.p56_comprobar <- function(r, tipo, titulos) {
  ranuras <- .std_tipo_lamina(tipo)$ranuras
  for (k in seq_along(titulos)) {
    f <- Filter(function(z) any(startsWith(z$textos, paste0(titulos[k], " "))), r$formas)
    expect_length(f, 1L)
    if (length(f) != 1L) next
    esperado <- c(x = ranuras[[k]]$x, y = ranuras[[k]]$y, w = ranuras[[k]]$w, h = ranuras[[k]]$h)
    expect_lte(max(abs(f[[1]]$caja - esperado)), 0.02,
               label = sprintf("%s: «%s» en %s, ranura %d en %s", tipo, titulos[k], paste(round(f[[1]]$caja, 3), collapse = "/"), k,
                               paste(round(esperado, 3), collapse = "/")))
  }
  # El ícono del público, en la cabecera (p164/p166: 0.495, 0.165, 0.3).
  ico <- Filter(function(z) !is.na(z$caja[["x"]]) && abs(z$caja[["x"]] - 0.495) < 0.02 && z$caja[["y"]] < 0.6 && z$caja[["w"]] < 0.5, r$formas)
  expect_length(ico, 1L)
  expect_false(any(grepl("ícono", r$avisos, fixed = TRUE)))
}
.p56_g <- function(v, t) p_barras_categoricas(v, titulo = t)
.p56_icono <- function() p_ggplot_raw(ggplot2::ggplot() + ggplot2::theme_void())

test_that("cinco gráficos: cada uno en su ranura (S1 S2 S3 / I1 I2) y el ícono en la cabecera", {
  s <- p_slide_5_graficos_poblacion(grafico_superior_1 = .p56_g("v1", "S1"), grafico_superior_2 = .p56_g("v2", "S2"),
                                    grafico_superior_3 = .p56_g("v3", "S3"), grafico_inferior_1 = .p56_g("v4", "I1"),
                                    grafico_inferior_2 = .p56_g("v5", "I2"), icono = .p56_icono(), titulo = "Perfil")
  .p56_comprobar(.p56_render(s, 5), "p_slide_5_graficos_poblacion", c("S1", "S2", "S3", "I1", "I2"))
})

test_that("seis gráficos: cada uno en su ranura (S1 S2 S3 / I1 I2 I3) y el ícono en la cabecera", {
  s <- p_slide_6_graficos_poblacion(grafico_superior_1 = .p56_g("v1", "S1"), grafico_superior_2 = .p56_g("v2", "S2"),
                                    grafico_superior_3 = .p56_g("v3", "S3"), grafico_inferior_1 = .p56_g("v4", "I1"),
                                    grafico_inferior_2 = .p56_g("v5", "I2"), grafico_inferior_3 = .p56_g("v6", "I3"),
                                    icono = .p56_icono(), titulo = "Perfil")
  .p56_comprobar(.p56_render(s, 6), "p_slide_6_graficos_poblacion", c("S1", "S2", "S3", "I1", "I2", "I3"))
})

test_that("con plantilla_16_9 el ícono de cinco y seis va al cajón de cabecera; sin cajón, se avisa en vez de callar", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  info <- officer::layout_summary(doc)
  contract <- .ppt_calibrar_pies_iconos(.PPT_CONTRACT, doc, master = info$master[[1]], slide_dims = officer::slide_size(doc),
                                        layout_exists = function(nm) nm %in% info$layout)
  for (ck in c("poblacion_5", "poblacion_6")) {
    ico <- contract[[ck]]$slots$icon
    expect_false(isTRUE(ico$suppress), label = ck)
    expect_equal(c(ico$loc$left, ico$loc$top, ico$loc$width), c(0.495, 0.18, 0.3), tolerance = 0.01, label = ck)
  }
  # Un layout sin cuadrado que sirva: el slot se suprime y el aviso dice por qué.
  sin <- data.frame(type = "body", offx = c(11, 0.5), offy = c(0.17, 6.9), cx = c(2.1, 4.9), cy = c(0.92, 0.44))
  expect_null(.ppt_cajon_icono(sin, list(width = 13.333, height = 7.5)))
  avisos <- character()
  withCallingHandlers(.ppt_slot_suprimido(NULL, list(suppress = TRUE, aviso_supresion = .ppt_aviso_icono_suprimido("poblacion_5"))),
                      message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_length(avisos, 1L)
  expect_match(avisos, "[PULSO-AVISO]", fixed = TRUE)
  expect_match(avisos, "sale sin ícono", fixed = TRUE)
  # Un pie suprimido (sin aviso declarado) sigue callado: no es algo que el usuario haya puesto.
  expect_silent(.ppt_slot_suprimido(NULL, list(suppress = TRUE)))
})
