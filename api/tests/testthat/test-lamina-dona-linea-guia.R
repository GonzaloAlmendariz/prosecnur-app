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

# ---- Guía de dos tramos (Gonzalo: «recta y perpendicular a 90° y luego curvar siguiendo la curvatura») -------------

test_that("el trazo de la guía: primer tramo radial dentro de 1°, el segundo equidista del centro", {
  tr <- .lam_circular_guia_trazo(0.97, 0.93, r = 1.75, largo = 0.15)
  x <- tr$rad * sin(2 * pi * tr$ang); y <- tr$rad * cos(2 * pi * tr$ang)
  dir1 <- atan2(x[2] - x[1], y[2] - y[1])                    # dirección del primer tramo
  radial <- atan2(x[1], y[1])                                 # dirección del radio en el punto de salida
  expect_lt(abs((dir1 - radial + pi) %% (2 * pi) - pi) * 180 / pi, 1)
  expect_equal(sqrt(x[1]^2 + y[1]^2), 1.75)
  expect_true(all(abs(sqrt(x[-1]^2 + y[-1]^2) - 1.9) < 1e-9))  # el arco, a r + largo
  expect_gte(nrow(tr), 12L)
  expect_equal(tr$ang[nrow(tr)], 0.93)
  # Si la cifra va en el ángulo de su porción, sólo queda el tramo radial.
  expect_equal(nrow(.lam_circular_guia_trazo(0.2, 0.2, 1, 0.1)), 2L)
})

test_that("la separación abre el grupo hacia los dos lados alrededor de su porción", {
  pos <- .lam_circular_separar(c(0.98, 0.99, 0.995), minimo = 0.03)
  expect_true(all(diff(pos) >= 0.03 - 1e-9))
  expect_lt(pos[1], 0.98); expect_gt(pos[3], 0.995)          # no empuja sólo hacia adelante
  expect_equal(mean(pos), mean(c(0.98, 0.99, 0.995)))
})

test_that("en la torta nativa la guía es radial y luego en arco, y las cifras de fuera no se tocan", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_torta(doc, .lg_espec(c(96, 2, 2)), "Torta", folio = 1)
  x <- .lg_xml(o)
  expect_gte(length(.lg_sp(x, "torta:guia")), 3L)              # radial + tramos del arco
  ln <- xml2::xml_find_first(.lg_sp(x, "torta:guia"), "p:spPr/a:ln")
  expect_identical(unique(xml2::xml_attr(ln, "w")), as.character(as.integer(round(0.012 * 72 * 12700))))
  f <- .lg_caja(.lg_sp(x, "torta:cifra_fuera"))
  expect_equal(nrow(f), 2L)
  expect_false(!(f[1, "x"] + f[1, "w"] <= f[2, "x"] || f[2, "x"] + f[2, "w"] <= f[1, "x"] ||
                   f[1, "y"] + f[1, "h"] <= f[2, "y"] || f[2, "y"] + f[2, "h"] <= f[1, "y"]))
})

test_that("la dona ggplot de Género (2 %, 0 %) a lámina completa saca las dos cifras con guía de dos tramos, sin encimarlas", {
  g <- c("Femenino", "Masculino", "Persona de género no binario", "Prefiero no responder"); v <- c(212, 182, 9, 0)
  p <- suppressWarnings(graficar_pie(data.frame(c = g, p = v / sum(v), n = v), "c", "p", var_n = "n", tipo_pie = "donut",
                                     ancho = 11.5, alto = 4.6))
  gu <- attr(p, "pulso_pie_guias")
  expect_true(all(c("Persona de género no binario", "Prefiero no responder") %in% gu$categoria[gu$fuera]))
  tr <- attr(gu, "trazos")
  for (cat in unique(tr$categoria)) {
    t1 <- tr[tr$categoria == cat, ]
    expect_equal(t1$ang[1], t1$ang[2])                            # primer tramo radial
    expect_true(all(abs(t1$rad[-1] - attr(gu, "r_arco")) < 1e-9))  # el resto, sobre el arco
  }
  fz <- gu[gu$fuera, ]
  expect_gte(abs(diff(fz$y_texto)), attr(gu, "minimo") - 1e-9)
})
