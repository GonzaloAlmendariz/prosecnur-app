source("setup-load-all.R")

# L10 (bandeja CCSS, 2026-10-24): forma del dumbbell, de las divergentes y del lollipop. Las cifras, las bases y el
# orden del instrumento no cambian; sólo cómo se escriben y dónde se dibujan.

.l10_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.l10_sp <- function(xml, n) xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))
.l10_txt <- function(xml, n) xml2::xml_text(.l10_sp(xml, n))
.l10_ext <- function(xml, n) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:spPr/a:xfrm", n))
  data.frame(x = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:off"), "x")) / 914400,
             w = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:ext"), "cx")) / 914400)
}
.l10_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

# Dos grupos con peso no entero: la suma de pesos de cada grupo NO es un entero.
.l10_db_sources <- function() {
  n <- 200
  d <- data.frame(sexo = rep(c("1", "2"), each = n / 2), a = c(rep("4", 80), rep("1", 20), rep("4", 50), rep("1", 50)),
                  b = rep(c("4", "1"), n / 2), peso = rep(c(1.1, 0.9, 1.05, 0.95), n / 4) * c(rep(1.0843, 100), rep(0.9157, 100)),
                  stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("sexo", "a", "b"), type = c("select_one sx", "select_one esc", "select_one esc"),
                                   label = c("Sexo", "Pregunta A", "Pregunta B"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sx", "sx", rep("esc", 4)), name = c("1", "2", "1", "2", "3", "4"),
                                    label = c("Mujer", "Hombre", "Nada", "Poco", "Algo", "Mucho"), stringsAsFactors = FALSE))
  list(data_sources = list(b1 = d), inst_sources = list(b1 = inst))
}

test_that("L10-2: la leyenda del dumbbell dice los casos sin ponderar, enteros, y no la suma de pesos", {
  src <- .l10_db_sources()
  d <- .dumbbell_grupos_datos(.dumbbell_grupos_temas(c("b1$a", "b1$b"), src), "4", "b1$sexo", c("1", "2"), src)
  expect_true("n_casos" %in% names(d))
  expect_equal(d$n_casos, rep(100, 4))
  expect_false(all(d$n == round(d$n)))                                  # el n ponderado sigue siendo el del porcentaje
  e <- attr(graficar_dumbbell(d), "pulso_espec")
  expect_identical(e$leyenda, c("Mujer (100)", "Hombre (100)"))
  # Sin columna de casos y con n fraccionario la leyenda no inventa decimales: sólo el grupo.
  d2 <- d; d2$n_casos <- NULL
  expect_identical(attr(graficar_dumbbell(d2), "pulso_espec")$leyenda, c("Mujer", "Hombre"))
})

test_that("L10-3: la columna de la diferencia dice quién menos quién y los grupos van en colores de marca", {
  src <- .l10_db_sources()
  d <- .dumbbell_grupos_datos(.dumbbell_grupos_temas(c("b1$a", "b1$b"), src), "4", "b1$sexo", c("1", "2"), src)
  e <- attr(graficar_dumbbell(d), "pulso_espec")
  expect_identical(e$sentido_diferencia, "Mujer − Hombre")
  expect_identical(e$colores, unname(.std_paleta("dicotomica")[1:2]))
  expect_false(any(toupper(e$colores) == "#2A9D8F"))
  o <- .lam_laminas_pesas(.l10_doc(), e, "Brecha", folio = 1)
  xml <- .l10_xml(o$doc)
  expect_identical(.l10_txt(xml, "pesas:sentido"), "Mujer − Hombre")
  expect_identical(.l10_txt(xml, "pesas:encabezado"), "Diferencia")
})

.l10_div <- function() {
  et <- c(a = "Totalmente en desacuerdo", b = "En desacuerdo", c = "Ni de acuerdo ni en desacuerdo", d = "De acuerdo", e = "Totalmente de acuerdo")
  d <- data.frame(it = c("Me siento cómodo haciendo preguntas durante la clase.", "Evito hacer preguntas por inseguridad frente al resto de la clase"),
                  a = c(.02, .08), b = c(.09, .19), c = c(.35, .26), d = c(.42, .35), e = c(.12, .12))
  attr(graficar_barras_divergentes(d, "it", names(et), et, escala_valor = "proporcion_1", n_negativas = 2, incluir_neutro = TRUE), "pulso_espec")
}

test_that("L10-4: la línea del centro va detrás de las cifras: la del neutro no queda tachada", {
  xml <- .l10_xml(.lam_laminas_divergentes(.l10_doc(), .l10_div(), "Participación", folio = 3)$doc)
  nombres <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp/p:nvSpPr/p:cNvPr"), "name")
  expect_lt(match("divergentes:centro", nombres), min(which(nombres == "divergentes:cifra")))
  expect_lt(match("divergentes:centro", nombres), min(which(nombres == "divergentes:segmento")))
})

test_that("L10-4: el bloque de barras usa el ancho que le deja una columna de afirmaciones a su medida", {
  xml <- .l10_xml(.lam_laminas_divergentes(.l10_doc(), .l10_div(), "Participación", folio = 3)$doc)
  W <- .std_geom("ancho")
  af <- .l10_ext(xml, "divergentes:afirmacion"); seg <- .l10_ext(xml, "divergentes:segmento")
  # Dos afirmaciones de dos líneas en 4.5 in caben en tres en una columna más angosta: la columna cede ancho.
  expect_lt(max(af$w), 4.5)
  # Antes las barras iban de ~6.0 a ~11.5 in (41 % de la lámina): la escala reservaba 100 puntos al acuerdo.
  expect_gte((max(seg$x + seg$w) - min(seg$x)) / W, 0.5)
})

test_that("L10-5b: con residuales_gris el lollipop en ggplot manda «Ninguna» y «Otros» al final y en gris", {
  d <- data.frame(cat = c("Voluntariado", "Académica", "Ninguna", "Deportiva", "Otros"), v = c(44, 29, 28, 14, 1))
  p <- graficar_lollipop(d, "cat", "v", residuales_gris = TRUE)
  b <- ggplot2::ggplot_build(p)$data[[2]]                               # puntos
  lv <- levels(p$data$.cat)                                              # el primer nivel se dibuja abajo
  expect_identical(rev(lv), c("Voluntariado", "Académica", "Deportiva", "Ninguna", "Otros"))
  col_de <- function(cat) unique(b$colour[b$y == match(cat, lv)])
  expect_identical(toupper(col_de("Ninguna")), toupper(.graficos_no_sustantivo_color()))
  expect_identical(toupper(col_de("Otros")), toupper(.graficos_no_sustantivo_color()))
  expect_false(toupper(col_de("Voluntariado")) == toupper(.graficos_no_sustantivo_color()))
  # Sin la opción, al final pero en el color de la serie (el LUGAR no depende de la opción, como en la lámina).
  p0 <- graficar_lollipop(d, "cat", "v")
  expect_identical(rev(levels(p0$data$.cat))[4:5], c("Ninguna", "Otros"))
  b0 <- ggplot2::ggplot_build(p0)$data[[2]]
  expect_length(unique(b0$colour), 1L)
})

test_that("L10-5b: la lámina nativa pinta las residuales con el color de no sustantivo", {
  d <- data.frame(cat = c("Voluntariado", "Ninguna", "Deportiva"), v = c(44, 28, 14))
  e <- attr(graficar_lollipop(d, "cat", "v", residuales_gris = TRUE), "pulso_espec")
  expect_identical(e$rotulos, c("Voluntariado", "Deportiva", "Ninguna"))
  xml <- .l10_xml(.lam_laminas_lollipop(.l10_doc(), e, "Agrupaciones", folio = 5)$doc)
  col <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='lollipop:punto']]//a:solidFill/a:srgbClr"), "val")
  expect_identical(col[length(col)], .lam_hex(.graficos_no_sustantivo_color()))
})
