# Barras divergentes (lámina 71) y ranking con puntos (lámina 72) con formas nativas (ADR 0093, N3).

.dl_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.dl_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.dl_ext <- function(xml, n) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:spPr/a:xfrm", n))
  data.frame(x = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:off"), "x")) / 914400,
             w = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:ext"), "cx")) / 914400)
}
.dl_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.dl_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.dl_datos <- function() data.frame(it = c("Baja", "Alta"), t1 = c(.27, 0), t2 = c(.20, .13), t3 = c(.27, .80), t4 = c(.07, .07), t5 = c(.19, 0))

test_that("las divergentes suman cada lado con sus cifras rotuladas, dejan SIN INF aparte y ordenan por acuerdo", {
  p <- graficar_barras_divergentes(.dl_datos(), "it", names(.dl_niv), .dl_niv, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE)
  e <- attr(p, "pulso_espec")
  expect_identical(e$tipo, "divergentes")
  expect_identical(e$filas, c("Alta", "Baja"))                                  # 87 antes que 34
  expect_identical(e$categorias$lado, c("neg", "neg", "pos", "pos", "sin_inf"))
  expect_identical(e$cifras_pos, c("87%", "34%")); expect_identical(e$cifras_neg, c("13%", "47%"))
  expect_equal(unname(e$total_pos), unname(rowSums(e$unidades[, 3:4])))         # suma de las cifras rotuladas
})

test_that("la lámina divergente pone el desacuerdo a la izquierda del centro y el acuerdo a la derecha", {
  e <- attr(graficar_barras_divergentes(.dl_datos(), "it", names(.dl_niv), .dl_niv, escala_valor = "proporcion_1", n_negativas = 2,
                                        incluir_neutro = FALSE), "pulso_espec")
  o <- .lam_laminas_divergentes(.dl_doc(), e, "Gestión", folio = 71)
  xml <- .dl_xml(o$doc)
  cen <- .dl_ext(xml, "divergentes:centro"); xc <- cen$x + cen$w / 2
  tn <- .dl_ext(xml, "divergentes:total_desacuerdo"); tp <- .dl_ext(xml, "divergentes:total_acuerdo")
  expect_true(all(tn$x + tn$w < xc) && all(tp$x > xc))
  expect_identical(.dl_txt(xml, "divergentes:cifra_sin_inf"), c("0%", "19%"))
  expect_true("SIN INF" %in% .dl_txt(xml, "leyenda:texto"))
  expect_true(.lam_divergentes_cabe(e))
  e$filas <- rep(e$filas, 5); expect_false(.lam_divergentes_cabe(e))               # 10 afirmaciones no caben
})

test_that("el ranking con puntos deja las residuales al final (en gris sólo con residuales_gris) y sin ceros", {
  d <- data.frame(cat = c("No sabe / Ninguna", "B", "A", "C", "Nada"), v = c(4, 21, 29, 9, 0))
  e <- attr(graficar_lollipop(d, "cat", "v", residuales_gris = TRUE), "pulso_espec")
  expect_identical(e$forma, "lollipop")
  expect_identical(e$rotulos, c("A", "B", "C", "No sabe / Ninguna"))            # «Nada» rotula 0 %: fuera
  o <- .lam_laminas_lollipop(.dl_doc(), e, "Mejoras", folio = 72, encabezado = "% de encuestados que marcó cada opción")
  xml <- .dl_xml(o$doc)
  expect_identical(.dl_txt(xml, "lollipop:cifra"), c("29%", "21%", "9%", "4%"))
  col <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='lollipop:punto']]//a:solidFill/a:srgbClr"), "val")
  expect_identical(unique(col[seq(1, length(col), 2)])[2], .lam_hex(.std_color("texto_tenue")))   # la residual en gris
  expect_true(.lam_lollipop_cabe(e))
})

test_that("en la ruta real p_barras_divergentes y p_lollipop salen nativos", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  set.seed(2); N <- 120
  dat <- data.frame(a1 = sample(as.character(1:5), N, TRUE), a2 = sample(as.character(1:5), N, TRUE, prob = c(.05, .1, .4, .4, .05)),
                    m1 = sample(c("x", "y", "z"), N, TRUE, prob = c(.5, .3, .2)),   # el lollipop del motor pide select_one
                    stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("a1", "a2", "m1"), type = c("select_one lk", "select_one lk", "select_one op"), list_name = c("lk", "lk", "op"),
                                   label = c("Afirmación uno", "Afirmación dos", "¿Qué mejorar?"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("lk", 5), rep("op", 3)), name = c(as.character(1:5), "x", "y", "z"),
                                    label = c(.dl_niv, "Equis", "Ye", "Zeta"), stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_divergentes(vars = c("a1", "a2"), incluir_neutro = FALSE), titulo = "Divergentes"),
               b = p_slide_1_grafico(grafico = p_lollipop("m1"), titulo = "Ranking"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  g <- function(k) xml2::xml_attr(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))), "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:divergentes" %in% g(1))
  expect_true("prosecnur:grafico:lollipop" %in% g(2))
})

# ---- Hallazgos del verificador de N6 (ruta real con datos de borde) ----------

test_that("las especiales salen por etiqueta o código 90-99 y nunca entran en el Top Two Box", {
  d <- data.frame(it = "x", a = .1, b = .14, c = .37, d = .27, e = .12)
  et <- c(a = "Totalmente en desacuerdo", b = "En desacuerdo", c = "De acuerdo", d = "Totalmente de acuerdo", e = "No sé / No opina")
  e <- attr(graficar_barras_divergentes(d, "it", names(et), et, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE), "pulso_espec")
  expect_identical(e$categorias$lado[5], "sin_inf"); expect_identical(e$cifras_pos, "64%")      # hallazgo 5: antes 76 %
  d99 <- setNames(d, c("it", "1", "2", "3", "4", "99")); et99 <- setNames(unname(et), c("1", "2", "3", "4", "99")); et99[5] <- "Otra cosa"
  e99 <- attr(graficar_barras_divergentes(d99, "it", names(et99), et99, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE), "pulso_espec")
  expect_identical(e99$categorias$lado[5], "sin_inf")
})

test_that("el reparto posicional se rehace sin la especial y el Top Two Box suma lo que es (hallazgo 8)", {
  d <- data.frame(it = "x", a = .1, b = .12, c = .33, d = .30, e = .15)
  et <- c(a = "TD", b = "D", c = "A", d = "TA", e = "SIN INF")
  e <- attr(graficar_barras_divergentes(d, "it", names(et), et, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = TRUE), "pulso_espec")
  expect_identical(e$categorias$lado, c("neg", "neg", "pos", "pos", "sin_inf")); expect_identical(e$cifras_pos, "63%")
})

test_that("los colores siguen el significado y el centro es el nivel más suave, en las dos direcciones (hallazgos 6 y 7)", {
  lk <- unname(.std_paleta("likert"))
  d <- data.frame(it = "x", a = .1, b = .2, c = .1, d = .3, e = .3)
  et <- c(a = "TD", b = "D", c = "N", d = "A", e = "TA")
  e <- attr(graficar_barras_divergentes(d, "it", names(et), et, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = TRUE), "pulso_espec")
  expect_identical(e$categorias$color[c(1, 2, 4, 5)], lk[c(1, 2, 3, 4)])                    # TA en verde oscuro, no en el gris
  expect_identical(e$categorias$col[e$orden_neg[1]], "b"); expect_identical(e$categorias$col[e$orden_pos[1]], "d")
  inv <- setNames(rev(unname(as.numeric(d[1, -1]))), c("e", "d", "c", "b", "a"))
  di <- data.frame(it = "x", t(inv)); eti <- c(e = "TA", d = "A", c = "N", b = "D", a = "TD")
  ei <- attr(graficar_barras_divergentes(di, "it", names(eti), eti, escala_valor = "proporcion_1",
                                         reparto = list(negativas = c("b", "a"), neutro = "c", positivas = c("e", "d"))), "pulso_espec")
  expect_identical(ei$categorias$col[ei$orden_neg[1]], "b"); expect_identical(ei$categorias$col[ei$orden_pos[1]], "d")
  expect_identical(ei$categorias$color[ei$categorias$col == "e"], lk[4])
})

test_that("con dos especiales la divergente va por la ruta anterior y las cifras chicas no se encima ni suben (hallazgos 4 y 9)", {
  d <- data.frame(it = "x", a = .01, b = .01, c = .4, d = .38, e = .1, f = .1)
  et <- c(a = "TD", b = "D", c = "A", d = "TA", e = "No sabe", f = "No responde")
  e <- attr(graficar_barras_divergentes(d, "it", names(et), et, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE), "pulso_espec")
  expect_false(.lam_divergentes_cabe(e))
  e1 <- attr(graficar_barras_divergentes(d[, 1:6], "it", names(et)[1:5], et[1:5], escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE), "pulso_espec")
  o <- .lam_laminas_divergentes(.dl_doc(), e1, "Chicas", folio = 1)
  xml <- .dl_xml(o$doc)
  cif <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='divergentes:cifra']]")
  txt <- xml2::xml_text(cif); off <- xml2::xml_find_first(cif, "./p:spPr/a:xfrm/a:off")
  xs <- as.numeric(xml2::xml_attr(off, "x")) / 914400; ys <- as.numeric(xml2::xml_attr(off, "y")) / 914400
  ch <- which(txt == "1%")                                                                     # las dos cifras chicas vecinas
  expect_length(unique(round(ys[ch], 3)), 1L)                                                  # a la misma altura (no suben)
  centros <- xs[ch] + 0.3
  expect_true(abs(diff(centros)) >= .lam_ancho_tinta("1%", 10.5, TRUE) + 0.05)                 # y separadas: no se encima
})

test_that("el ranking conserva la nota de recorte y el resaltado del analista (hallazgo 10)", {
  d <- data.frame(cat = c(letters[1:6], "Becas"), v = c(30, 25, 20, 15, 5, 3, 12))
  e <- attr(graficar_lollipop(d, "cat", "v", top_n = 5, resaltar = "Becas"), "pulso_espec")
  expect_identical(e$nota_recorte, "Se muestran 5 de 7 categorías.")
  o <- .lam_laminas_lollipop(.dl_doc(), e, "Ranking", folio = 1)
  col <- xml2::xml_attr(xml2::xml_find_all(.dl_xml(o$doc), "//p:sp[p:nvSpPr/p:cNvPr[@name='lollipop:punto']]//a:solidFill/a:srgbClr"), "val")
  expect_true(.lam_hex(.std_color("coral")) %in% col)
})

test_that("una opción especial reconocida sólo por su código (99) queda fuera del Top Two Box por la ruta real", {
  d <- data.frame(it = "x", niv_1 = .12, niv_2 = .17, niv_3 = .35, niv_4 = .25, niv_5 = .11)
  et <- c(niv_1 = "TD", niv_2 = "D", niv_3 = "A", niv_4 = "TA", niv_5 = "Desconoce")
  e <- attr(graficar_barras_divergentes(d, "it", names(et), et, escala_valor = "proporcion_1",
                                        reparto = list(negativas = c("niv_1", "niv_2"), neutro = character(0), positivas = c("niv_3", "niv_4", "niv_5")),
                                        codigos_grupos = c(niv_1 = "1", niv_2 = "2", niv_3 = "3", niv_4 = "4", niv_5 = "99")), "pulso_espec")
  expect_identical(e$categorias$lado[5], "sin_inf"); expect_identical(e$cifras_pos, "60%")     # antes 71 % con «Desconoce»
})

test_that("ninguna cifra chica queda cruzada por la línea del centro y la cabecera especial no parte la palabra (ronda 3)", {
  d <- data.frame(it = c("chico", "otra"), a = c(.02, .01), b = c(.03, .01), c = c(.49, .48), d = c(.43, .47), e = c(.03, .03))
  et <- c(a = "TD", b = "D", c = "A", d = "TA", e = "Desconoce")
  e <- attr(graficar_barras_divergentes(d, "it", names(et), et, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = FALSE,
                                        codigos_grupos = c(a = "1", b = "2", c = "3", d = "4", e = "99")), "pulso_espec")
  expect_true(.lam_divergentes_cabe(e))
  xml <- .dl_xml(.lam_laminas_divergentes(.dl_doc(), e, "Chicas", folio = 1)$doc)
  cen <- .dl_ext(xml, "divergentes:centro"); xc <- cen$x + cen$w / 2
  cif <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='divergentes:cifra']]")
  txt <- xml2::xml_text(cif); ext <- .dl_ext(xml, "divergentes:cifra")
  ch <- which(ext$w < 0.61)                                                                    # las corridas (caja de 0.6 in)
  expect_gt(length(ch), 0L)
  for (i in ch) {
    m <- ext$x[i] + ext$w[i] / 2; wt <- .lam_ancho_tinta(txt[i], 10.5, TRUE)
    expect_true(xc < m - wt / 2 || xc > m + wt / 2, info = txt[i])                           # la tinta no toca la línea
  }
  enc <- .dl_ext(xml, "divergentes:encabezado")[3, ]                                           # la cabecera de la especial
  expect_identical(.dl_txt(xml, "divergentes:encabezado")[3], "Desconoce")
  expect_gte(enc$w, .lam_ancho_tinta("Desconoce", 10.5, TRUE) + 0.1)
  e2 <- e; e2$categorias$rotulo[5] <- "Desconoce por completo la existencia del programa"
  expect_false(.lam_divergentes_cabe(e2))                                                      # no cabe: ruta anterior
})
