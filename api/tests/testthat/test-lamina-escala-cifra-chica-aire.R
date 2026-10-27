# N9 (Renzo, 2026-10-22): «el alto de los indicadores de porcentaje puede ser ligeramente menos largo para no chocar
# con las barras». La cifra chica (1 %, 5 %) sube sobre su segmento con una guía; la caja quedaba a 0,04 in de la barra
# de la fila de arriba. La guía y la caja bajan para dejar al menos 0,075 in, sin tocar la separación entre cifras
# (0,46 in), el aire de la fila (`aire_cifra_chica`) ni el grosor.
.fcg_formas <- function(doc) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:sp")
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "p:nvSpPr/p:cNvPr"), "name")
  g <- function(a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0("p:spPr/a:xfrm/", if (a %in% c("x", "y")) "a:off" else "a:ext")),
                                             switch(a, x = "x", y = "y", w = "cx", h = "cy"))) / 914400
  data.frame(nombre = nm, x = g("x"), y = g("y"), w = g("w"), h = g("h"), stringsAsFactors = FALSE)
}
.fcg_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.fcg_lam <- function(n = 5) {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
  d <- data.frame(item = sprintf("p%02d", seq_len(n)), N = 51, t1 = 0.01, t2 = 0.03, t3 = 0.46, t4 = 0.50,
                  rotulo = sprintf("Competencia %d", seq_len(n)))
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], niv)),
                       barra_extra_preset = "top2box", top2box_labels = niv[3:4])
  e$filas$grupo_id <- "g1"; e$filas$grupo_titulo <- "Premisa"   # filas de una misma premisa: barras una bajo otra
  suppressMessages(.lam_laminas_escala(.fcg_doc(), e, "Comunicación", folio = 1))
}
# Holgura de cada cifra de fila >= 2 sobre el borde inferior de la barra de arriba, y la guía vertical
.fcg_medir <- function(f) {
  seg <- f[f$nombre == "segmento", ]; cf <- f[f$nombre == "cifra_fuera", ]
  filas <- sort(unique(round(seg$y, 3)))
  holg <- vapply(seq_len(nrow(cf)), function(i) {
    abajo <- filas[filas > cf$y[i]][1]
    if (is.na(abajo)) return(NA_real_)
    arriba <- seg[round(seg$y, 3) < abajo, ]
    if (!nrow(arriba)) return(NA_real_)
    cf$y[i] - max(arriba$y + arriba$h)
  }, 0)
  list(holgura = holg[!is.na(holg)], cf = cf, seg = seg, guia = f[f$nombre == "guia" & f$w < 0.05, ])
}

# El estándar trae un piso de 1,12 cm (2026-10-26); esta suite mide la tabla de grosor y la geometría sin él.
# A nivel de archivo (no teardown_env(), que sólo restaura al final de TODO test_dir y dejaba el 0 a los archivos
# siguientes del shard: rompía test-lamina-escala-m1-sin-cont.R en el shard 4 de CI).
withr::local_options(prosecnur.grosor_piso_cm = 0)

test_that("la cifra chica de la segunda fila queda al menos 0,075 in bajo la barra de arriba y dentro de su fila", {
  m <- .fcg_medir(.fcg_formas(.fcg_lam()$doc))
  expect_gt(length(m$holgura), 0)
  expect_gte(min(m$holgura), 0.075 - 1e-6)
})

test_that("la guía de la cifra chica mide a lo más 0,055 in y la caja no la cruza", {
  m <- .fcg_medir(.fcg_formas(.fcg_lam()$doc))
  expect_lte(max(m$guia$h), 0.055 + 1e-6)
  # la caja de la cifra termina por debajo del borde superior de la barra (no la pisa)
  expect_true(all(vapply(seq_len(nrow(m$cf)), function(i) m$cf$y[i] + m$cf$h[i] <= min(m$seg$y[m$seg$y > m$cf$y[i]]) + 1e-6, TRUE)))
})

test_that("no cambia lo que no se pidió: aire de la fila, separación de 0,46 in entre cifras y grosor", {
  expect_equal(.std_geom("aire_cifra_chica"), 0.36)
  m <- .fcg_medir(.fcg_formas(.fcg_lam()$doc))
  ys <- round(m$seg$y, 3); fila <- sort(unique(ys))
  expect_equal(unname(diff(fila)[1]), unname(m$seg$h[1] + 0.36), tolerance = 1e-3)
  c1 <- m$cf[round(m$cf$y, 2) == round(min(m$cf$y), 2), ]
  if (nrow(c1) > 1) expect_gte(min(diff(sort(c1$x))), 0.46 - 1e-3)
})

# N9b (Renzo, 2026-10-22, captura de un «3 %» sobre el último segmento): la guía vertical tocaba el número. Tras N9 la
# guía subía hasta y-0,05 y la caja de la cifra terminaba en y-0,02: se solapaban 0,03 in y en el render el trazo
# arrancaba pegado al glifo. La caja ahora acaba donde acaba el glifo (a la altura de su base) y entre ella y la guía
# queda ~0,02 in; el codo horizontal va por debajo de esa caja.
# Las piezas de una cifra chica: su caja y las guías que la siguen (misma fila: entre su y y 0,12 in bajo su borde inferior)
.fcg_guias_de <- function(f, i, cf) {
  g <- f[f$nombre == "guia", ]
  fondo <- cf$y[i] + cf$h[i]
  g[g$y >= cf$y[i] & g$y < fondo + 0.12 & g$x + g$w >= cf$x[i] & g$x <= cf$x[i] + cf$w[i], ]
}

test_that("N9b: la guía y el codo no entran en la caja de la cifra y quedan a ~0,02 in de ella", {
  f <- .fcg_formas(.fcg_lam()$doc); m <- .fcg_medir(f)
  expect_gt(nrow(m$cf), 0)
  for (i in seq_len(nrow(m$cf))) {
    gs <- .fcg_guias_de(f, i, m$cf)
    expect_gt(nrow(gs), 0)
    fondo <- m$cf$y[i] + m$cf$h[i]                         # borde inferior de la caja de la cifra
    expect_gte(min(gs$y) - fondo, 0.02 - 1e-3)             # ninguna guía entra en la caja y deja aire
  }
  expect_gte(min(m$holgura), 0.075 - 1e-6)                 # y se conserva la holgura de N9 respecto a la barra de arriba
})
