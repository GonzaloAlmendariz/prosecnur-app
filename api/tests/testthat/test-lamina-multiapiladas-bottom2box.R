# Bottom Two Box en la lámina nativa de una batería (F-d, lámina 24 de acrconta_mazo). Con Top Two Box + Bottom Two
# Box la lámina se iba al modo en filas, cuya columna de rótulos de 1.8 in no mide el alto del texto: siete premisas de
# cinco líneas cabían «en una lámina» y se encimaban. La regla de Gonzalo: la segunda columna sólo resta ancho. La
# partición, el alto de cada premisa y el texto son los mismos que sin ella; la barra cede la columna de 1.25 in de la
# lámina 97 del recetario. Se comprueba por la ruta real (`reporte_ppt_plan`) en la batería (`p_barras_multiapiladas`
# modo var) y en «Dividir por» (`p_barras_apiladas` con `cruces`, que delega en multiapiladas modo cruce).
# Desde la decisión «2c» eso vale para premisas largas; las cortas (como los niveles de un cruce) van en filas
# (lámina 97): ver test-lamina-escala-forma-por-largo.R.

.b2_niv <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
.b2_premisas <- c(
  "Considero que el personal administrativo de la Unidad tiene funciones claramente definidas y conocidas por todos.",
  "Considero que las capacitaciones, los programas de actualización y perfeccionamiento brindados por la Universidad son idóneos para la labor.",
  "Estoy satisfecho(a) con los programas de actualización, perfeccionamiento y capacitaciones brindados por la Universidad para su personal.",
  "Existen evaluaciones periódicas para promociones y ascensos del personal administrativo de la Unidad realizados por la Universidad.",
  "Los requisitos de la Universidad que definen las contrataciones, promociones o ascensos del personal administrativo de la Unidad son claros.",
  "Estoy satisfecho(a) con los programas de motivación e incentivos que me brinda la Universidad como su trabajador de la Unidad.",
  "Estoy satisfecho(a) con los programas de ayuda (becas, movilidad académica, bolsa de trabajo, pasantías) que me brinda la Universidad.")

.b2_fixture <- function() {
  set.seed(24)
  vars <- sprintf("p%d", seq_along(.b2_premisas))
  df <- as.data.frame(setNames(lapply(vars, function(v) sample(.b2_niv, 15, replace = TRUE, prob = c(.1, .15, .4, .2, .15))), vars),
                      stringsAsFactors = FALSE)
  df$grupo <- rep(c("Docentes", "Administrativos", "Estudiantes"), each = 5)
  inst <- list(
    survey = data.frame(name = c(vars, "grupo"), type = c(rep("select_one lk", length(vars)), "select_one lg"),
                        list_name = c(rep("lk", length(vars)), "lg"), label = c(.b2_premisas, "Público"), stringsAsFactors = FALSE),
    choices = rbind(data.frame(list_name = "lk", name = .b2_niv, label = .b2_niv, stringsAsFactors = FALSE),
                    data.frame(list_name = "lg", name = c("Docentes", "Administrativos", "Estudiantes"),
                               label = c("Docentes", "Administrativos", "Estudiantes"), stringsAsFactors = FALSE)),
    orders_list = NULL)
  list(df = df, inst = inst, vars = vars)
}

.b2_over <- function(bottom) {
  o <- list(top2box_labels = .b2_niv[3:4])
  if (bottom) o <- c(o, list(columna_bottom2box = TRUE, bottom2box_labels = .b2_niv[1:2]))
  o
}

# Láminas del plan como XML, una por elemento.
.b2_laminas <- function(el, f = .b2_fixture()) {
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, path_ppt = out, mensajes_progreso = FALSE,
                                                     plan = list(a = p_slide_1_grafico(el, titulo = "Dotación administrativa")))))
  lapply(.pptx_slide_paths(out), function(sp) .pptx_leer_parte(out, sp))
}

# Formas con nombre dentro del grupo del gráfico de escala, en pulgadas.
.b2_formas <- function(x, nombre) {
  xml <- xml2::read_xml(x)
  sp <- xml2::xml_find_all(xml, sprintf("//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:escala']]/p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(path, attr) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, path), attr)) / 914400
  data.frame(t = xml2::xml_text(sp), x = num("./p:spPr/a:xfrm/a:off", "x"), y = num("./p:spPr/a:xfrm/a:off", "y"),
             w = num("./p:spPr/a:xfrm/a:ext", "cx"), h = num("./p:spPr/a:xfrm/a:ext", "cy"), stringsAsFactors = FALSE)
}

.b2_sin_solape_vertical <- function(f) {
  f <- f[order(f$y), ]
  nrow(f) < 2L || all(f$y[-1] >= (f$y + f$h)[-nrow(f)] - 1e-6)
}

test_that("con Bottom Two Box la batería se parte igual, cada premisa ocupa el mismo alto y ningún rótulo se encima", {
  el <- function(bottom) p_barras_multiapiladas(modo = "var", vars = .b2_fixture()$vars, top2box = TRUE,
                                                top2box_labels = .b2_niv[3:4], overrides = .b2_over(bottom))
  sin <- .b2_laminas(el(FALSE)); con <- .b2_laminas(el(TRUE))
  expect_gt(length(sin), 1L)                                   # siete premisas largas no caben en una lámina
  expect_identical(length(con), length(sin))
  expect_identical(vapply(con, .pptx_lamina_estado, ""), rep("nativa", length(con)))
  vistas <- character(0)
  for (k in seq_along(con)) {
    ps <- .b2_formas(sin[[k]], "premisa"); pc <- .b2_formas(con[[k]], "premisa")
    expect_identical(pc$t, ps$t, info = paste("lámina", k))                     # mismas premisas en la misma lámina
    expect_equal(pc$y, ps$y, tolerance = 1e-6, info = paste("lámina", k))       # y en el mismo sitio, con el mismo alto
    expect_equal(pc$h, ps$h, tolerance = 1e-6, info = paste("lámina", k))
    expect_true(.b2_sin_solape_vertical(pc), info = paste("lámina", k))
    vistas <- c(vistas, pc$t)
    # Las dos columnas: una cifra de cada box por premisa, sus rótulos, y la Top Two Box a la izquierda de la Bottom.
    b1 <- .b2_formas(con[[k]], "box:cifra"); b2 <- .b2_formas(con[[k]], "box2:cifra")
    expect_identical(nrow(b1), nrow(pc)); expect_identical(nrow(b2), nrow(pc))
    expect_identical(.b2_formas(con[[k]], "box2:rotulo")$t, "Bottom Two Box")
    expect_true(all(b1$x + b1$w <= min(b2$x) + 1e-6), info = paste("lámina", k))
    expect_true(all(grepl("^[0-9]+%$", b2$t)), info = paste("lámina", k))
    # La barra cede el ancho de la columna y termina antes de la Top Two Box.
    seg <- .b2_formas(con[[k]], "segmento")
    expect_lte(max(seg$x + seg$w), min(b1$x) + 1e-6)
    expect_equal(max(seg$x + seg$w) - min(seg$x), .std_geom("likert")$ancho_barra - 1.25, tolerance = 0.01)
    # Base chica: cada box dice sus casos, como sin Bottom Two Box.
    expect_identical(nrow(.b2_formas(con[[k]], "box2:casos")), nrow(pc))
  }
  expect_setequal(vistas, .b2_premisas)                        # el texto completo, ninguna premisa perdida
  # Sin Bottom Two Box nada cambia: la Top Two Box sigue en su columna de 11.4 in.
  expect_true(all(abs(.b2_formas(sin[[1]], "box:cifra")$x - .std_geom("likert")$x_top_two_box) < 0.01))
  expect_identical(nrow(.b2_formas(sin[[1]], "box2:cifra")), 0L)
})

test_that("«Dividir por» (apiladas con cruces) con Bottom Two Box: niveles cortos van en filas (97) con las mismas filas", {
  # Decisión «2c»: los niveles del cruce son rótulos cortos, así que con Bottom Two Box la lámina va en filas (lámina 97)
  # en vez del bloque; las filas, su orden y las láminas son las mismas que sin ella.
  el <- function(bottom) p_barras_apiladas("p2", cruces = "grupo",
                                           overrides = c(list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box"), .b2_over(bottom)))
  sin <- .b2_laminas(el(FALSE)); con <- .b2_laminas(el(TRUE))
  expect_identical(length(con), length(sin))
  for (k in seq_along(con)) {
    expect_identical(.pptx_lamina_estado(con[[k]]), "nativa")
    fs <- .b2_formas(sin[[k]], "premisa"); fc <- .b2_formas(con[[k]], "actor")
    expect_gt(nrow(fs), 0L)
    expect_identical(fc$t[order(fc$y)], fs$t[order(fs$y)], info = k)            # mismas filas, mismo orden
    expect_identical(nrow(.b2_formas(con[[k]], "premisa")), 0L)                  # es la forma en filas
    expect_true(.b2_sin_solape_vertical(fc), info = k)
    expect_identical(nrow(.b2_formas(con[[k]], "box2:cifra")), nrow(fc))
    expect_identical(nrow(.b2_formas(con[[k]], "box:cifra")), nrow(fc))
    # Top y Bottom Two Box: las mismas cifras de Top que sin Bottom, fila por fila.
    tc <- .b2_formas(con[[k]], "box:cifra"); ts <- .b2_formas(sin[[k]], "box:cifra")
    expect_identical(tc$t[order(tc$y)], ts$t[order(ts$y)], info = k)
  }
})

test_that("con la fila Total el modo en filas no deja que un rótulo largo invada la fila vecina", {
  d <- data.frame(item = c("a", "b"), actor = c(.b2_premisas[2], .b2_premisas[3]), N = 100,
                  t1 = .1, t2 = .1, t3 = .4, t4 = .3, t5 = .1)
  e <- preparar_escala(d, "item", "N", paste0("t", 1:5), setNames(.b2_niv, paste0("t", 1:5)), var_etiqueta_categoria = "actor",
                       colores_grupos = as.list(setNames(.std_paleta("likert"), .b2_niv)), barra_extra_preset = "top2box",
                       top2box_labels = .b2_niv[3:4], columna_bottom2box = TRUE, bottom2box_labels = .b2_niv[1:2], fila_total = TRUE)
  expect_true(.lam_escala_modo_filas(e))
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- suppressMessages(.lam_laminas_escala(doc, e, "Con Total", base = "Base", folio = 1))
  for (k in seq_len(o$partes)) {
    x <- as.character(o$doc$slide$get_slide(length(o$doc) - o$partes + k)$get())
    expect_true(.b2_sin_solape_vertical(.b2_formas(x, "actor")), info = paste("lámina", k))
  }
  # Sin Total, la Bottom Two Box no manda la lámina a filas.
  e$filas$es_total[] <- FALSE
  expect_false(.lam_escala_modo_filas(e))
})
