# Láminas de tres y cuatro gráficos del recetario (ADR 0093, N3; recetario_m2b.R).

.mx_cat <- function(rot, pct, n = NULL) preparar_categorica(rot, pct, paste0(round(100 * pct), "%"), n)
.mx_dico <- function(si) {
  df <- data.frame(item = paste0("i", seq_along(si)), actor = c("Docentes", "Estudiantes", "Egresados")[seq_along(si)], N = 100, s1 = si, s2 = 1 - si)
  preparar_escala(df, "item", "N", c("s1", "s2"), c(s1 = "Sí", s2 = "No"), var_etiqueta_categoria = "actor",
                  colores_grupos = list("Sí" = .std_paleta("dicotomica")[1], "No" = .std_paleta("dicotomica")[2]))
}
.mx_xml <- function(doc) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
}
.mx_off <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
}

test_that("las disposiciones tienen los rectángulos del recetario y sus filetes", {
  g <- .lam_mixta_geo("graficos_3_2mas1")
  col2 <- (.std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der") - 0.5) / 2
  expect_length(g$paneles, 3L)
  expect_equal(g$paneles[[3]]$x, .std_geom("margen_izq") + col2 + 0.5)
  expect_equal(g$paneles[[1]]$h, 2.15)
  expect_setequal(vapply(g$filetes, `[[`, "", "tipo"), c("h", "v"))
  g4 <- .lam_mixta_geo("paneles_4")
  expect_length(g4$paneles, 4L)
  expect_equal(g4$paneles[[3]]$y - g4$paneles[[1]]$y, g4$paneles[[1]]$h + 0.35)
  expect_null(.lam_mixta_geo("graficos_3_fila"))
})

test_that("en la cuadrícula las categóricas van en barras de 0.42 in y una categórica de dos opciones va partida", {
  e <- list(.mx_cat(c("Bachiller", "Magister", "Doctor"), c(.19, .73, .08)), .mx_cat(c("A", "B", "C", "D"), c(.4, .3, .2, .1)),
            .mx_cat(c("x", "y", "z"), c(.5, .3, .2)), .mx_cat(c("Sí", "No"), c(.98, .02), c(51, 1)))
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_mixta(doc, e, "paneles_4", preguntas = list("Grado", "Dpto", "Edad", "¿Conoce la misión?"),
                          publicos = list("52 respuestas", NULL, NULL, "52 respuestas"), titulo = "Perfil", base = "Base: 52 docentes", folio = 160)
  xml <- .mx_xml(o$doc)
  expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:mixta']]"), "xml_missing"))
  b <- .mx_off(xml, "barra")
  expect_equal(nrow(b), 10L)                                       # 3 + 4 + 3; la cuarta es dicotomía
  expect_equal(diff(sort(unique(round(b$y[1:3], 3)))), c(.42, .42), tolerance = 1e-3)
  expect_equal(nrow(.mx_off(xml, "dicotomia:segmento")), 2L)
  expect_equal(nrow(.mx_off(xml, "separador")), 2L)
  expect_identical(xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]")),
                   c("Grado", "Dpto", "Edad", "¿Conoce la misión?"))
})

test_that("dos escalas en la misma fila con la misma escala comparten una sola leyenda al pie", {
  likert <- {
    niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
    df <- data.frame(item = c("a", "b"), actor = c("Docentes", "Estudiantes"), N = 100, t1 = c(.1, .2), t2 = .2, t3 = .3, t4 = c(.4, .3))
    preparar_escala(df, "item", "N", names(niv), niv, var_etiqueta_categoria = "actor", colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], niv)))
  }
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_mixta(doc, list(likert, .mx_dico(c(.98, .77, .78)), .mx_dico(c(.92, .8, .81))), "graficos_3_1arriba",
                          preguntas = list("Tutoría", "Misión", "Dónde"), titulo = "Tutoría y misión", folio = 152)
  xml <- .mx_xml(o$doc)
  ley <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='leyenda:texto']]"))
  expect_identical(sum(ley == "Sí"), 1L)                           # una leyenda Sí/No para los dos paneles de abajo
  expect_identical(sum(ley == "De acuerdo"), 1L)                   # y la del likert de arriba
  cuadros <- .mx_off(xml, "leyenda:cuadro")
  expect_true(all(cuadros$y[cuadros$y > 5] >= .std_geom("contenido_y1") - 0.1))
})

test_that("la compuerta pide especificación en cada ranura y que el gráfico quepa en su panel", {
  p <- function(e) structure(ggplot2::ggplot(), pulso_espec = e)
  e3 <- list(p(.mx_dico(.31)), p(.mx_cat(as.character(2022:2026), c(.04, .04, .14, .57, .21))), p(.mx_cat(letters[1:6], rep(1 / 6, 6))))
  expect_true(.lam_compositor_aplica_mixta(e3, list(), "graficos_3_2mas1"))
  expect_false(.lam_compositor_aplica_mixta(e3, list(meta = list(motor_nativo = FALSE)), "graficos_3_2mas1"))
  expect_false(.lam_compositor_aplica_mixta(list(e3[[1]], ggplot2::ggplot(), e3[[3]]), list(), "graficos_3_2mas1"))
  largo <- p(.mx_cat(paste("c", 1:12), rep(1 / 12, 12)))
  expect_false(.lam_compositor_aplica_mixta(list(e3[[1]], largo, e3[[3]]), list(), "graficos_3_2mas1"))   # 12 filas no caben abajo
  expect_false(.lam_compositor_aplica_mixta(e3, list(), "graficos_3_fila"))
})

test_that("en la ruta real p_slide_3_graficos_2mas1 y p_slide_4_graficos salen nativas", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(p1 = rep(c("1", "2"), c(31, 69)), p2 = rep(c("a", "b", "c"), c(20, 50, 30)), p3 = rep(c("x", "y", "z", "w"), 25),
                    stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("p1", "p2", "p3"), type = c("select_one sn", "select_one l2", "select_one l3"),
                                   list_name = c("sn", "l2", "l3"), label = c("¿Tiene título?", "Año", "Sueldo"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sn", "sn", "l2", "l2", "l2", "l3", "l3", "l3", "l3"), name = c("1", "2", "a", "b", "c", "x", "y", "z", "w"),
                                    label = c("Sí", "No", "2023", "2024", "2025", "Bajo", "Medio", "Alto", "Muy alto"), stringsAsFactors = FALSE),
               orders_list = NULL)
  plan <- list(a = p_slide_3_graficos_2mas1(p_barras_categoricas("p1"), p_barras_agrupadas("p2"), p_barras_agrupadas("p3"), titulo = "Titulación"),
               b = p_slide_4_graficos(p_barras_agrupadas("p2"), p_barras_agrupadas("p3"), p_barras_agrupadas("p3"), p_barras_categoricas("p1"), titulo = "Perfil"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  for (k in 1:2) {
    xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
    expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:mixta']]"), "xml_missing"))
    preg <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='panel:pregunta']]"))
    expect_true(all(c("Año", "Sueldo") %in% preg))
    expect_identical(xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Folio lamina']]")), as.character(k))
  }
})

# ---- Hallazgos del verificador de N3 (ruta real con datos de borde) ----------

.vn_inst <- function(vars, listas) {
  survey <- do.call(rbind, lapply(names(vars), function(v) data.frame(name = v, type = vars[[v]], list_name = sub("^select_(one|multiple) ", "", vars[[v]]),
                                                                       label = paste("Pregunta", v), stringsAsFactors = FALSE)))
  choices <- do.call(rbind, lapply(names(listas), function(l) data.frame(list_name = l, name = listas[[l]], label = names(listas[[l]]) %||% listas[[l]], stringsAsFactors = FALSE)))
  list(survey = survey, choices = choices, orders_list = NULL)
}
.vn_xml <- function(out, k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
.vn_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.vn_grupos <- function(xml) xml2::xml_attr(xml2::xml_find_all(xml, "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
.vn_cajas <- function(xml) {
  off <- xml2::xml_find_all(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[starts-with(@name,'prosecnur:grafico')]]//p:sp/p:spPr/a:xfrm")
  data.frame(nombre = xml2::xml_attr(xml2::xml_find_first(xml2::xml_parent(xml2::xml_parent(off)), "./p:nvSpPr/p:cNvPr"), "name"),
             x = as.numeric(xml2::xml_attr(xml2::xml_find_first(off, "./a:off"), "x")) / 914400,
             y = as.numeric(xml2::xml_attr(xml2::xml_find_first(off, "./a:off"), "y")) / 914400,
             w = as.numeric(xml2::xml_attr(xml2::xml_find_first(off, "./a:ext"), "cx")) / 914400,
             h = as.numeric(xml2::xml_attr(xml2::xml_find_first(off, "./a:ext"), "cy")) / 914400)
}

test_that("la categórica nativa conserva su base; rótulos largos van en barras o caen a la ruta anterior, nunca fuera de la lámina", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  set.seed(3); N <- 180
  largo <- sprintf("Opción %02d: una alternativa de respuesta deliberadamente larga para medir el rótulo de ochenta o más caracteres", 1:3)
  l10 <- c(largo, paste("Categoría", 4:9), "Otros"); sn <- c("Sí", "No")
  dat <- data.frame(q10 = sample(l10, N, TRUE), qsn = sample(sn, N, TRUE, prob = c(.6, .4)), stringsAsFactors = FALSE)
  inst <- .vn_inst(list(q10 = "select_one l10", qsn = "select_one sn"), list(l10 = l10, sn = sn))
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_categoricas("q10"), titulo = "Diez"),
               b = p_slide_1_grafico(grafico = p_barras_categoricas("qsn"), titulo = "Sí/No"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  for (k in 1:2) {
    xml <- .vn_xml(out, k)
    expect_match(.vn_txt(xml, "Base lamina"), "^Base: 180")                     # hallazgo 1: la base no se pierde
    cj <- .vn_cajas(xml)
    expect_true(all(cj$y + cj$h <= 7.5 + 1e-6))                                   # hallazgo 2: nada sale por abajo
  }
  expect_length(.vn_txt(.vn_xml(out, 1), "columna"), 0L)                          # diez rótulos largos: no en columnas
  expect_true(any(c("prosecnur:grafico:categorica") %in% .vn_grupos(.vn_xml(out, 1))))
})

test_that("una agrupada Sí/No con (n) sale como dicotomía con la frecuencia una sola vez y la cifra limpia", {
  withr::local_options(prosecnur.casos_junto = list(cuando = "siempre"))   # la dicotomía con «(n)» es el modo «siempre» del ajuste
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(qsn = rep(c("Sí", "No"), c(124, 76)), stringsAsFactors = FALSE)
  inst <- .vn_inst(list(qsn = "select_one sn"), list(sn = c("Sí", "No")))
  # Con el preset de la casa (orden del instrumento e inversión para coord_flip): Sí a la izquierda, como en el gráfico.
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_agrupadas("qsn", overrides = list(mostrar_n_en_etiquetas = TRUE, orden_barras = "instrumento",
                                                                                         invertir_barras = TRUE)), titulo = "Trabajo"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml <- .vn_xml(out, 1)
  expect_identical(.vn_txt(xml, "dicotomia:cifra"), c("62%", "38%"))              # hallazgo 4
  expect_identical(.vn_txt(xml, "dicotomia:rotulo"), c("Sí (124)", "No (76)"))
})

test_that("en barras la cifra con (n) tiene su columna medida y no se parte", {
  e <- preparar_categorica(c("a", "b", "c"), c(.475, .33, .195), c("47.5% (95)", "33% (66)", "19.5% (39)"))
  lz <- .lam_lienzo(); .lam_barras_h(lz, e, 0.5, 2, 12.5, wlab = 1.4, g = 0.4, fila = 0.6)
  doc <- .lam_agrupar(officer::add_slide(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                         layout = "Graficos2", master = "Office Theme"), lz, nombre = "prosecnur:grafico:x")
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  cj <- .vn_cajas(.vn_xml(out, 1)); cif <- cj[cj$nombre == "cifra", ]
  expect_true(all(cif$w >= .lam_ancho_txt("47.5% (95)", 12, TRUE)))
})

test_that("la leyenda de una escala en media columna queda dentro de su panel (no cruza el filete)", {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
  df <- data.frame(item = letters[1:4], actor = c("Docentes", "Egresados", "Empleadores", "Estudiantes"), N = 50,
                   t1 = .25, t2 = .25, t3 = .25, t4 = .25)
  lik <- preparar_escala(df, "item", "N", names(niv), niv, var_etiqueta_categoria = "actor", colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], niv)))
  e <- list(.mx_dico(.62), .mx_cat(c("a", "b", "c"), c(.475, .33, .195)), lik)
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_mixta(doc, e, "graficos_3_2mas1", preguntas = list("P1", "P2", "P3"), titulo = "Mixta", folio = 1)
  xml <- .mx_xml(o$doc); cj <- .vn_cajas(xml)
  p3 <- .lam_mixta_geo("graficos_3_2mas1")$paneles[[3]]
  ley <- cj[cj$nombre %in% c("leyenda:cuadro") & cj$x > p3$x - 0.5, ]
  expect_true(nrow(ley) == 4L && all(ley$x >= p3$x - 1e-6) && all(ley$x <= p3$x + p3$w))       # hallazgo 5
})

test_that("el público de un panel de selección múltiple son los encuestados, no las marcas", {
  e <- preparar_categorica(c("a", "b", "c"), c(.9, .8, .37), c("90%", "80%", "37%"), c(180, 160, 74))   # 414 marcas de 200 personas
  expect_equal(.espec_n_base(e), 200)                                                           # hallazgo 6
  expect_identical(.lam_mixta_encabezados(list(e))$publicos[[1]], "200 respuestas")
  expect_equal(.espec_n_base(preparar_categorica(c("Sí", "No"), c(.6, .4), c("60%", "40%"), c(120, 80))), 200)
})

test_that("una escala con Top Two Box y dos categorías en cero no se dibuja como dicotomía", {
  niv <- c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA")
  df <- data.frame(item = "x", N = 50, t1 = 0, t2 = 0, t3 = .4, t4 = .6)
  e <- preparar_escala(df, "item", "N", names(niv), niv, barra_extra_preset = "top2box", top2box_labels = c("A", "TA"))
  expect_false(.lam_es_dicotomia(e))                                                            # hallazgo 7
  e2 <- preparar_escala(df, "item", "N", names(niv), niv)
  expect_false(.lam_es_dicotomia(e2))                                                           # escala de 4 con dos ceros, sin box
})

test_that("el realce exige un máximo único en la cifra rotulada", {
  e <- preparar_categorica(c("a", "b", "c", "d"), c(.1204, .1196, .05, .03), c("12%", "12%", "5%", "3%"), resaltar = TRUE)
  expect_false(e$realce)
  expect_true(preparar_categorica(c("a", "b", "c"), c(.5, .3, .2), c("50%", "30%", "20%"), resaltar = TRUE)$realce)
  expect_false(preparar_categorica(c("a", "b", "c"), c(.5, .3, .2), c("50%", "30%", "20%"))$realce)   # por defecto, un color
})

test_that("en la dicotomía de un panel los rótulos van sin frecuencia, como la cuarta celda de la lámina 160", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  e <- list(.mx_cat(c("a", "b", "c"), c(.5, .3, .2)), .mx_cat(c("a", "b", "c"), c(.5, .3, .2)), .mx_cat(c("a", "b", "c"), c(.5, .3, .2)),
            .mx_cat(c("Sí", "No"), c(.98, .02), c(51, 1)))
  o <- .lam_laminas_mixta(doc, e, "paneles_4", preguntas = list("A", "B", "C", "D"), titulo = "Perfil", folio = 1)
  expect_identical(.vn_txt(.mx_xml(o$doc), "dicotomia:rotulo"), c("Sí", "No"))
})

test_that("las bases de una lámina mixta no se pierden: sólo se omite la que otra contiene", {
  expect_identical(.lam_bases_sin_repetir(c("Base: 200", "Base: 200 respuestas")), "Base: 200 respuestas")
  expect_setequal(.lam_bases_sin_repetir(c("Base: 200 estudiantes", "Base: 200 docentes", "Nota: pregunta filtrada por condición laboral")),
                  c("Base: 200 estudiantes", "Base: 200 docentes", "Nota: pregunta filtrada por condición laboral"))
  expect_setequal(.lam_bases_sin_repetir(c("Nota: pregunta de opción múltiple", "Nota: excluye a quienes no aplican", "Base: 200 egresados")),
                  c("Nota: pregunta de opción múltiple", "Nota: excluye a quienes no aplican", "Base: 200 egresados"))
  expect_identical(.lam_bases_sin_repetir(c("Base: 200", "Base: 2000 respuestas")), c("Base: 200", "Base: 2000 respuestas"))
})
