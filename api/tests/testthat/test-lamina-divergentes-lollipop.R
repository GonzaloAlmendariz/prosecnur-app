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

test_that("el ranking con puntos deja las residuales al final en gris y sin ceros", {
  d <- data.frame(cat = c("No sabe / Ninguna", "B", "A", "C", "Nada"), v = c(4, 21, 29, 9, 0))
  e <- attr(graficar_lollipop(d, "cat", "v"), "pulso_espec")
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
