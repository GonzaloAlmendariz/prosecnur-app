# Frente C (Gonzalo, CCSS Perfil 2026): en donas y tortas la cifra de una porción chica sale fuera del sector, unida por
# una línea fina, con el mismo umbral de «cifra chica» que las barras apiladas (la cifra no cabe en su segmento con
# 0.12 in de aire). Nunca metida en una porción donde no cabe ni encimada con la vecina («2%» sobre «1%» en Género).

test_that("el umbral de cifra chica es el de las barras apiladas", {
  for (a in c(0.1, 0.3, 0.45, 0.6, 1)) for (cf in c("2%", "46%", "100%")) {
    seg <- data.frame(ancho = a / 2, cifra = cf, color = "#000000", dibujar = TRUE)
    expect_identical(.lam_circular_cifra_chica(cf, a, .std_pt("cifra")), .lam_tiene_peq(seg, 2), info = paste(a, cf))
  }
})

test_that("las posiciones de las cifras de fuera se separan sin cambiar el orden", {
  ang <- c(0.05, 0.06, 0.065, 0.5)
  pos <- .lam_circular_separar(ang, minimo = 0.04)
  expect_true(all(diff(pos[1:3]) >= 0.04 - 1e-9))
  expect_identical(order(pos), order(ang))
  expect_equal(pos[4], 0.5)
})

.lg_espec <- function(v, forma = "pie") {
  rot <- c("Economía", "Relaciones Internacionales", "Ciencia Política", "Finanzas", "Antropología", "Sociología")[seq_along(v)]
  p <- v / sum(v)
  attr(graficar_pie(data.frame(c = rot, p = p, n = v), "c", "p", var_n = "n", tipo_pie = forma), "pulso_espec")
}
.lg_xml <- function(o) o$doc$slide$get_slide(o$doc$cursor)$get()
.lg_sp <- function(x, nombre) xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
.lg_caja <- function(sp) {
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
  cbind(x = as.numeric(xml2::xml_attr(off, "x")), y = as.numeric(xml2::xml_attr(off, "y")),
        w = as.numeric(xml2::xml_attr(ext, "cx")), h = as.numeric(xml2::xml_attr(ext, "cy"))) / 914400
}

test_that("en la torta nativa la porción chica lleva su cifra fuera con una línea guía, y dos chicas no se enciman", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_torta(doc, .lg_espec(c(95, 3, 2)), "Torta", folio = 1)
  x <- .lg_xml(o)
  expect_gte(length(.lg_sp(x, "torta:guia")), 2L)
  fuera <- .lg_caja(.lg_sp(x, "torta:cifra_fuera"))
  expect_equal(nrow(fuera), 2L)
  solapan <- !(fuera[1, "x"] + fuera[1, "w"] <= fuera[2, "x"] || fuera[2, "x"] + fuera[2, "w"] <= fuera[1, "x"] ||
                 fuera[1, "y"] + fuera[1, "h"] <= fuera[2, "y"] || fuera[2, "y"] + fuera[2, "h"] <= fuera[1, "y"])
  expect_false(solapan)
  expect_equal(length(.lg_sp(x, "torta:cifra")), 1L)               # la grande, dentro
})

test_that("la dona ggplot de seis porciones saca las chicas con su guía y sin encimarlas", {
  rot <- c("Economía", "Relaciones Internacionales", "Ciencia Política", "Finanzas", "Antropología", "Sociología")
  v <- c(184, 92, 68, 44, 8, 4)
  p <- graficar_pie(data.frame(c = rot, p = v / sum(v), n = v), "c", "p", var_n = "n", tipo_pie = "donut", ancho = 6, alto = 3.2)
  g <- attr(p, "pulso_pie_guias")
  expect_s3_class(g, "data.frame")
  expect_true(all(c("Antropología", "Sociología") %in% g$categoria[g$fuera]))
  expect_false(any(g$categoria[g$fuera] %in% c("Economía", "Relaciones Internacionales")))
  pos <- sort(g$y_texto[g$fuera])
  expect_true(all(diff(pos) >= attr(g, "minimo") - 1e-9))
})
