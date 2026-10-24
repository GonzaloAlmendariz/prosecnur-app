# Frente D (CCSS Perfil 2026): en las multiapiladas C1 (1-5 + 9 «No tengo información suficiente para responder») y
# B12 (1-5 + 77 «No lo sé / No uso este recurso») el no sustantivo recibía el último verde de una rampa de seis pasos,
# como si fuera «Totalmente de acuerdo». Debe ir gris, al final, con su entrada en la leyenda, y la escala conserva su
# rampa de cinco pasos. Las cifras y el denominador del Top Two Box no cambian (la exclusión del T2B es D13, abierta).
#
# Regla de detección, en orden: (a) metadata del instrumento, (b) código fuera del rango de la escala, (c) rótulo.
# Un código dentro del rango nunca es no sustantivo.

.gns_c1_etq <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo",
                 "Totalmente de acuerdo", "No tengo información suficiente para responder")
.gns_b12_etq <- c("Muy malo", "Malo", "Regular", "Bueno", "Muy bueno", "No lo sé / No uso este recurso")
.gns_choices <- function() {
  data.frame(
    list_name = c(rep("acuerdo", 6), rep("calidad", 6)),
    name = c("1", "2", "3", "4", "5", "9", "1", "2", "3", "4", "5", "77"),
    label = c(.gns_c1_etq, .gns_b12_etq),
    stringsAsFactors = FALSE
  )
}
.gns_gris <- function() .graficos_no_sustantivo_color()

test_that("(b) un código fuera del rango de la escala es no sustantivo: 9 en 1-5 y 77 en 1-5", {
  expect_identical(.graficos_no_sustantivos(c("1", "2", "3", "4", "5", "9"), .gns_c1_etq),
                   c(FALSE, FALSE, FALSE, FALSE, FALSE, TRUE))
  expect_identical(.graficos_no_sustantivos(c("1", "2", "3", "4", "5", "77"), .gns_b12_etq),
                   c(FALSE, FALSE, FALSE, FALSE, FALSE, TRUE))
  # una escala de 1 a 9 consecutiva no tiene no sustantivos
  expect_false(any(.graficos_no_sustantivos(as.character(1:9), paste("Paso", 1:9))))
  # los niveles curriculares 6-9 tampoco
  expect_false(any(.graficos_no_sustantivos(c("6", "7", "8", "9"), c("VI", "VII", "VIII", "IX"))))
})

test_that("un código dentro del rango nunca es no sustantivo, aunque su rótulo lo parezca", {
  etq <- c("Nada", "Poco", "No sabe", "Bastante", "Mucho")
  expect_false(any(.graficos_no_sustantivos(as.character(1:5), etq)))
})

test_that("(c) sin rango numérico decide el rótulo", {
  expect_identical(.graficos_no_sustantivos(c("TD", "D", "A", "TA", "SIN INF"),
                                            c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")),
                   c(FALSE, FALSE, FALSE, FALSE, TRUE))
  expect_identical(.graficos_no_sustantivos(c("a", "b", "c", "x"), c("Malo", "Regular", "Bueno", "No lo sé / No uso este recurso")),
                   c(FALSE, FALSE, FALSE, TRUE))
})

test_that("(a) la metadata del instrumento manda cuando existe", {
  # 0 «No aplica» declarado especial: fuera de la escala 1-4 por la metadata, no por el rango
  meta <- c("0" = TRUE, "1" = FALSE, "2" = FALSE, "3" = FALSE, "4" = FALSE)
  expect_identical(.graficos_no_sustantivos(c("0", "1", "2", "3", "4"), c("No aplica", "Nada", "Poco", "Algo", "Mucho"),
                                            especiales = names(meta)[meta]),
                   c(TRUE, FALSE, FALSE, FALSE, FALSE))
  ch <- .gns_choices(); ch$especial <- ifelse(ch$name %in% c("9", "77"), "1", "")
  expect_identical(.graficos_no_sustantivos_especiales_meta("acuerdo", ch), "9")
  expect_identical(.graficos_no_sustantivos_especiales_meta("acuerdo", .gns_choices()), character(0))
})

test_that("la paleta pinta el no sustantivo de gris y la escala conserva su rampa de cinco pasos", {
  ch <- .gns_choices()
  for (caso in list(list(ln = "acuerdo", lv = c("1", "2", "3", "4", "5", "9"), etq = .gns_c1_etq),
                    list(ln = "calidad", lv = c("1", "2", "3", "4", "5", "77"), etq = .gns_b12_etq))) {
    pal <- .graficos_no_sustantivos_paleta(caso$ln, caso$lv, ch)
    expect_identical(names(pal), caso$etq)
    expect_identical(unname(pal[6]), .gns_gris())
    escala <- .reporte_plan_pulso_palette_for_levels(caso$etq[1:5])
    expect_identical(unname(pal[1:5]), unname(escala))
    # el último paso de la escala ya no es el verde que llevaba el no sustantivo
    antes <- .reporte_plan_pulso_palette_for_levels(caso$etq)
    expect_false(identical(unname(antes[6]), .gns_gris()))
  }
})

test_that("sin no sustantivos la paleta es exactamente la de antes", {
  ch <- data.frame(list_name = "x", name = c("1", "2", "3", "4"),
                   label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                   stringsAsFactors = FALSE)
  expect_identical(.graficos_no_sustantivos_paleta("x", ch$name, ch),
                   .reporte_plan_pulso_palette_for_levels(ch$label))
})

test_that("los no sustantivos van al final; el resto conserva su orden", {
  ch <- .gns_choices()
  expect_identical(.graficos_no_sustantivos_al_final(c("9", "1", "2", "3", "4", "5"), "acuerdo", ch),
                   c("1", "2", "3", "4", "5", "9"))
  expect_identical(.graficos_no_sustantivos_al_final(c("1", "2", "3"), "acuerdo", ch), c("1", "2", "3"))
  # también si los niveles llegan como etiquetas
  expect_identical(.graficos_no_sustantivos_al_final(rev(.gns_b12_etq), "calidad", ch),
                   c(rev(.gns_b12_etq[1:5]), .gns_b12_etq[6]))
})

test_that("el color no mueve cifras ni el denominador del Top Two Box", {
  df <- data.frame(cat = c("a", "b"), N = c(100, 80),
                   pct_1 = c(.05, .10), pct_2 = c(.10, .15), pct_3 = c(.20, .25), pct_4 = c(.30, .25), pct_5 = c(.25, .15),
                   pct_6 = c(.10, .10), stringsAsFactors = FALSE)
  cols <- paste0("pct_", 1:6); etq <- stats::setNames(.gns_c1_etq, cols)
  args <- list(df, "cat", "N", cols, etq, barra_extra_preset = "top2box", top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  antes <- do.call(preparar_escala, c(args, list(colores_grupos = .reporte_plan_pulso_palette_for_levels(.gns_c1_etq))))
  ahora <- do.call(preparar_escala, c(args, list(colores_grupos = .graficos_no_sustantivos_paleta("acuerdo", c(as.character(1:5), "9"), .gns_choices()))))
  expect_identical(ahora$box$cifras, antes$box$cifras)
  expect_identical(ahora$box$cols, antes$box$cols)
  expect_identical(ahora$unidades, antes$unidades)
  expect_identical(ahora$cifras, antes$cifras)
  expect_identical(ahora$categorias$color[6], .gns_gris())
  expect_identical(ahora$categorias$rotulo[6], .gns_c1_etq[6])   # sigue en la leyenda, al final
})

test_that("el no sustantivo se distingue del neutro de la escala (contraste de luminancia)", {
  lum <- function(h) { v <- grDevices::col2rgb(h)[, 1] / 255; sum(c(0.2126, 0.7152, 0.0722) * v) }
  pal <- .graficos_no_sustantivos_paleta("acuerdo", c("1", "2", "3", "4", "5", "9"), .gns_choices()[1:6, ])
  expect_gt(abs(lum(pal[3]) - lum(pal[6])), 0.15)
})
