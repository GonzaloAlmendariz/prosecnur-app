source("setup-load-all.R")

# K11 (plan F6 §8): la vista previa entrega las formas de cada parte —nombre, rol, caja en pulgadas, cuerpo de letra,
# líneas y si el texto se sale de su caja— y las ranuras del estándar del tipo de lámina, para que el visor dibuje
# guías por capas sin adivinar la geometría desde el PNG. Sin pedirlo (`preview_formas`), la respuesta no cambia.

.pf_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")

.pf_inst <- function(vars, etiquetas = sprintf("Pregunta %s", vars)) {
  list(survey = data.frame(name = vars, type = "select_one esc", list_name = "esc", label = etiquetas, stringsAsFactors = FALSE),
       choices = data.frame(list_name = "esc", name = .pf_niv, label = .pf_niv, stringsAsFactors = FALSE),
       orders_list = NULL, label_col_survey = "label", label_col_choices = "label", lang = "es")
}

.pf_mazo <- function(plan, vars = "p1") {
  set.seed(5)
  df <- as.data.frame(setNames(lapply(vars, function(v) sample(.pf_niv, 120, TRUE, prob = c(.1, .2, .4, .3))), vars), stringsAsFactors = FALSE)
  force(plan)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = .pf_inst(vars), plan = plan,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO), path_ppt = out, mensajes_progreso = FALSE)))
  out
}

.pf_por_nombre <- function(formas, nombre) Filter(function(f) identical(f$nombre, nombre), formas)

test_that("una lámina nativa de escala entrega sus formas con rol, caja en pulgadas y cuerpo de letra", {
  out <- .pf_mazo(list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Una escala")))
  formas <- .preview_formas_lamina(out, .pptx_slide_paths(out)[[1]])
  roles <- setNames(vapply(formas, `[[`, "", "rol"), vapply(formas, `[[`, "", "nombre"))
  expect_identical(unname(roles["prosecnur:grafico:escala"]), "grafico")
  expect_identical(unname(roles["Titulo lamina"]), "titulo")
  expect_identical(unname(roles["Base lamina"]), "base")
  expect_identical(unname(roles["Folio lamina"]), "pie")
  expect_true(all(roles[names(roles) == "cifra"] == "cifra"))
  expect_true(all(roles[names(roles) == "leyenda:texto"] == "leyenda"))
  tit <- .pf_por_nombre(formas, "Titulo lamina")[[1]]
  expect_equal(tit$x, .std_geom("margen_izq"), tolerance = 1e-3)
  expect_equal(tit$w, 10.4, tolerance = 1e-3)
  expect_equal(tit$pt_max, .std_pt("titulo"))
  expect_identical(tit$lineas, 1L)
  expect_false(tit$recortado)
  expect_identical(tit$grupo, "prosecnur:titulo")
  # una forma sin texto (el segmento de la barra) no se lista: las guías son de cajas con nombre y de texto
  expect_false("segmento" %in% names(roles))
  # las cajas caen dentro de la lámina de 13.333 x 7.5 in
  cajas <- do.call(rbind, lapply(formas, function(f) c(f$x, f$y, f$w, f$h)))
  expect_true(all(cajas[, 1] >= 0 & cajas[, 1] + cajas[, 3] <= 13.34 & cajas[, 2] >= 0 & cajas[, 2] + cajas[, 4] <= 7.51))
})

test_that("un título que no cabe en su caja dice cuántas líneas compone y que se recorta", {
  largo <- paste("Un título excepcionalmente largo para comprobar cuántas líneas ocupa en la lámina cuando el analista",
                 "escribe una pregunta entera como título de la lámina del informe final")
  out <- .pf_mazo(list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = largo)))
  tit <- .pf_por_nombre(.preview_formas_lamina(out, .pptx_slide_paths(out)[[1]]), "Titulo lamina")[[1]]
  expect_gte(tit$lineas, 3L)
  expect_true(tit$recortado)
})

test_that("los grupos se resuelven con chOff/chExt: una forma dentro de un grupo escalado cae donde la pinta PowerPoint", {
  xml <- paste0(
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    # grupo en (1 in, 1 in) de 4 x 2 in que dibuja un espacio hijo de 2 x 1 in con origen en (5 in, 5 in): escala 2
    '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="prosecnur:grafico:prueba"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="3657600" cy="1828800"/><a:chOff x="4572000" y="4572000"/><a:chExt cx="1828800" cy="914400"/></a:xfrm></p:grpSpPr>',
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="cifra:valor"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr><a:xfrm><a:off x="5029200" y="4572000"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr>',
    '<p:txBody><a:bodyPr wrap="square"/><a:lstStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></a:lstStyle>',
    '<a:p><a:r><a:rPr lang="es-PE"/><a:t>45%</a:t></a:r></a:p><a:p><a:r><a:rPr sz="1100"/><a:t>de 120</a:t></a:r></a:p></p:txBody></p:sp>',
    '</p:grpSp></p:spTree></p:cSld></p:sld>')
  formas <- .preview_formas_de_xml(xml2::read_xml(xml))
  expect_identical(vapply(formas, `[[`, "", "nombre"), c("prosecnur:grafico:prueba", "cifra:valor"))
  g <- formas[[1]]; f <- formas[[2]]
  expect_equal(c(g$x, g$y, g$w, g$h), c(1, 1, 4, 2))
  expect_equal(c(f$x, f$y, f$w, f$h), c(2, 1, 2, 1))   # (5.5 - 5) * 2 + 1 = 2; ancho 1 * 2
  expect_identical(f$rol, "cifra")
  expect_identical(f$pt_max, 18)                       # heredado de defRPr del lstStyle
  expect_identical(f$pt_min, 11)
  expect_identical(f$lineas, 2L)
  expect_true(is.na(g$pt_max))                         # sin texto propio: null en la API
  expect_true(is.na(g$recortado))
  expect_true(is.na(g$grupo))
})

test_that("una lámina por la ruta anterior entrega el título del marcador, el gráfico y la base de su ranura", {
  out <- .pf_mazo(list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Lámina vieja", meta = list(motor_nativo = FALSE))))
  formas <- .preview_formas_lamina(out, .pptx_slide_paths(out)[[1]])
  roles <- setNames(vapply(formas, `[[`, "", "rol"), vapply(formas, `[[`, "", "nombre"))
  expect_identical(unname(roles["Title 1"]), "titulo")
  expect_identical(unname(roles["prosecnur:slide_1:base"]), "base")
  expect_true(any(roles == "grafico"))
  expect_true(all(roles[grepl("^prosecnur:leyenda:texto", names(roles))] == "leyenda"))
  tit <- .pf_por_nombre(formas, "Title 1")[[1]]
  expect_true(is.numeric(tit$x) && tit$w > 5)
})

test_that("una multilista partida entrega las formas de cada parte, con los títulos de bloque como texto", {
  vars <- sprintf("v%02d", 1:10)
  out <- .pf_mazo(list(a = p_slide_1_grafico(titulo = "Multilista", grafico = p_barras_multiapiladas(
    modo = "multilista", top2box = TRUE, top2box_labels = .pf_niv[3:4],
    bloques = list(list(modo = "var", vars = vars[1:5], titulo = "Bloque uno"), list(modo = "var", vars = vars[6:10], titulo = "Bloque dos"))))),
    vars = vars)
  partes <- .preview_partes(out)
  expect_gte(partes$n, 2L)
  conf <- .preview_con_formas(list(partes = partes), out, "p_slide_1_grafico", TRUE)
  for (p in conf$partes$partes) {
    nombres <- vapply(p$formas, `[[`, "", "nombre")
    expect_true("prosecnur:grafico:multilista" %in% nombres)
    expect_true("Titulo lamina" %in% nombres)
  }
  bloque <- Filter(function(f) identical(f$nombre, "bloque:titulo"), conf$partes$partes[[1]]$formas)
  expect_true(length(bloque) >= 1L)
  expect_identical(bloque[[1]]$rol, "texto")
  expect_identical(conf$ranuras_estandar, lapply(.std_tipo_lamina("p_slide_1_grafico")$ranuras, .graficos_estandar_ranura))
})

test_that("sin pedirlo la respuesta no cambia; una lámina de estructura no tiene ranuras del estándar", {
  out <- .pf_mazo(list(a = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Una")))
  resp <- list(ok = TRUE, partes = .preview_partes(out), folio = 1L)
  expect_identical(.preview_con_formas(resp, out, "p_slide_1_grafico", FALSE), resp)
  expect_identical(.preview_ranuras_estandar("p_slide_portada"), list())
  expect_identical(.preview_ranuras_estandar("no_existe"), list())
})

# Verificador de K11 (acrconta): 7 títulos de 2 líneas y 2 premisas se marcaban «recortado» y en el render no lo están.
# El título del motor admite dos líneas (la misma regla que su aviso, K12b) y una medición que excede la caja por menos
# de una línea no es confiable (la tinta medida y la composición real difieren en una línea): ahí `recortado` es null.
.pf_caja_texto <- function(nombre, h, texto, sz = 1300, w = 3.3, interlineado = NULL) {
  ln <- if (is.null(interlineado)) "" else sprintf('<a:lnSpc><a:spcPct val="%d"/></a:lnSpc>', interlineado)
  xml <- paste0(
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>',
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="', nombre, '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>',
    sprintf('<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm></p:spPr>', round(w * 914400), round(h * 914400)),
    '<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720"><a:noAutofit/></a:bodyPr><a:lstStyle/>',
    '<a:p><a:pPr>', ln, '</a:pPr><a:r><a:rPr sz="', sz, '" b="1"/><a:t>', texto, '</a:t></a:r></a:p></p:txBody></p:sp>',
    '</p:spTree></p:cSld></p:sld>')
  .preview_formas_de_xml(xml2::read_xml(xml))[[1]]
}

test_that("un título del motor de dos líneas no se marca recortado; de tres, sí (K11, verificador)", {
  dos <- "Valoración de los estudiantes sobre el desempeño de los docentes del programa de estudios"
  tres <- paste(dos, "en las competencias declaradas en el perfil de egreso y en los objetivos educacionales de la carrera")
  t2 <- .pf_caja_texto("Titulo lamina", 0.5, dos, sz = 2400, w = 10.4)
  expect_identical(t2$lineas, 2L)
  expect_false(t2$recortado)
  t3 <- .pf_caja_texto("Titulo lamina", 0.5, tres, sz = 2400, w = 10.4)
  expect_gte(t3$lineas, 3L)
  expect_true(t3$recortado)
})

test_that("un texto que excede su caja por menos de una línea da null; por más, TRUE; y el interlineado cuenta", {
  premisa <- "El plan de estudios incorpora contenidos actualizados que responden a las necesidades del entorno profesional y social de la región"
  n <- .lam_lineas_tinta(premisa, 3.3, 13, TRUE)
  alto_linea <- 13 * 1.2 / 72
  justa <- .pf_caja_texto("premisa", 0.05 + n * alto_linea, premisa)
  expect_false(justa$recortado)
  una_menos <- .pf_caja_texto("premisa", 0.05 + (n - 1) * alto_linea + 0.02, premisa)
  expect_true(is.na(una_menos$recortado))                                   # como las premisas 15 y 81 de acrconta
  dos_menos <- .pf_caja_texto("premisa", 0.05 + (n - 2.2) * alto_linea, premisa)
  expect_true(dos_menos$recortado)
  apretado <- .pf_caja_texto("premisa", 0.05 + n * alto_linea * 0.8 + 0.02, premisa, interlineado = 80000)
  expect_false(apretado$recortado)                                           # a 80 % de interlineado cabe
})
