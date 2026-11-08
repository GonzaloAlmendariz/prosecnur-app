# Ola 3, O3 y O5: la divergente que sale como imagen en una lámina de dos gráficos en vertical, junto a una apilada nativa.
#   O3: sin fondo blanco propio, con la paleta de la escala del estándar (la de la apilada), leyenda y rótulos al cuerpo del
#       estándar, la cifra de «SIN INF» que no cabe en su columna encima con guía (antes, blanca y cortada) y ninguna forma
#       con geometría inválida (la leyenda centrada en el panel dejaba su última clave fuera del lienzo).
#   O5: la cifra de fuera deja al menos 0.03 in de aire con la barra de la fila de arriba.
# Fixture sintético (helper-ola2-laminas.R, `.ola2_e1b`).

.o3_lamina <- function() {
  fx <- .ola2_e1b()
  .ola2_pptx(fx, list(p_slide_2_graficos_vertical(
    titulo = "Divergente y apilada",
    superior = p_barras_divergentes(vars = c("doc$q1", "doc$q2"), n_negativas = 2, incluir_neutro = FALSE),
    inferior = p_barras_apiladas(var = "doc$q1"))))
}

test_that("la divergente imagen: paleta de la escala, sin fondo blanco, leyenda entera y geometría válida", {
  skip_if_not_installed("officer")
  pth <- .o3_lamina()
  s <- .leer_parte_zip(pth, "ppt/slides/slide1.xml")
  expect_false(grepl("2147483647", s, fixed = TRUE))                     # ninguna forma fuera del lienzo
  expect_false(grepl('cx="-', s, fixed = TRUE))
  lk <- toupper(sub("^#", "", unname(.std_paleta("likert"))))
  for (col in lk) expect_true(grepl(sprintf('val="%s"', col), s, fixed = TRUE), info = col)
  expect_false(grepl('val="FFFFFF"', s, fixed = TRUE))                   # sin rectángulo blanco de fondo
  cj <- .ola2_cajas(pth, 1)
  ley <- cj[cj$texto == "SIN INF", , drop = FALSE]
  expect_equal(nrow(ley), 2L)                                            # la clave de las dos leyendas
  expect_true(all(ley$x1 <= .std_geom("ancho") + 1e-6))
  # Rótulos de fila y leyenda de la divergente al cuerpo del estándar.
  fila <- cj[cj$texto == "Pregunta dos", , drop = FALSE]
  expect_equal(fila$pt[1], .std_pt("rotulo_categoria"))
})

test_that("la cifra de «SIN INF» que no cabe en su columna va encima, legible, y la de fuera deja aire con la barra de arriba", {
  skip_if_not_installed("officer")
  pth <- .o3_lamina()
  f <- .ola2_formas(pth, 1)
  cifras <- f[.ola2_es_cifra(f$texto), , drop = FALSE]
  barras <- f[!nzchar(f$texto) & !f$cust & (f$x1 - f$x0) > 0.01 & (f$y1 - f$y0) > 0.12 & (f$y1 - f$y0) < 0.6, , drop = FALSE]
  # Sólo la divergente (arriba): sus cifras y sus barras están por encima de la apilada.
  y_corte <- min(f$y0[f$texto == "Pregunta uno" & f$pt == .std_pt("rotulo_categoria")], Inf) + 1.2
  cifras <- cifras[cifras$y1 < y_corte, , drop = FALSE]; barras <- barras[barras$y1 < y_corte, , drop = FALSE]
  expect_gte(nrow(cifras), 8L)
  expect_true(all(cifras$pt >= 14 - 1e-6))                                # ninguna se achica
  # O5: toda cifra que queda bajo una barra con la que comparte columna tiene 0.03 in de aire.
  for (i in seq_len(nrow(cifras))) {
    a <- cifras[i, ]
    encima <- barras[barras$x0 < a$x1 & barras$x1 > a$x0 & barras$y1 <= a$y0 + 0.2 & barras$y0 < a$y0, , drop = FALSE]
    if (!nrow(encima)) next
    expect_gte(a$y0 - max(encima$y1), 0.03 - 1e-3)
  }
})

test_that("sin alto el grosor no cambia; con un lienzo bajo y cifras de fuera bajo otra fila, baja lo justo", {
  df <- data.frame(.item = factor(c("A", "A", "B", "B"), levels = c("B", "A")), .cat = c("n1", "p1", "n1", "p1"),
                   .signo = c(-3, 90, -2, 80), .valor = c(3, 90, 2, 80), .lado = c("neg", "pos", "neg", "pos"),
                   .orden_apilado = c(1, 1, 1, 1))
  expect_identical(.divergentes_grosor_con_aire(df, NULL, 0.68, 0, 14, 12, 100, TRUE, 10, NULL, 1L), 0.68)
  g <- .divergentes_grosor_con_aire(df, NULL, 0.68, 0, 14, 12, 100, TRUE, 10, 2.5, 1L)
  expect_lt(g, 0.68)
  in_fila <- (2.5 - (0.3 + 0.3 + 0.25 + 0.25)) / (2 + 1.2)
  expect_gte((1 - g - 0.06) * in_fila - 14 * 0.75 / 72, 0.03 - 1e-9)
  expect_identical(.divergentes_grosor_con_aire(df, NULL, 0.68, 0, 14, 12, 100, TRUE, 10, 8, 1L), 0.68)   # lienzo alto: cabe
})

test_that("la leyenda se parte en filas sólo si no cabe en el ancho", {
  rot <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
  expect_identical(.divergentes_leyenda_filas(rot, 12, 10.05), 1L)
  expect_gt(.divergentes_leyenda_filas(rot, 12, 5), 1L)
  expect_identical(.divergentes_leyenda_filas(rot, 12, NULL), 1L)
})

# G-a..G-d (captura de Gonzalo, lámina «G. 2 vertical divergente con saldo», 2026-11-08: «un gráfico con fondo blanco y otros
# sin fondo […]; tamaños de texto inconsistentes, y un espacio exagerado para etiquetas cuando sus labels son cortos»).

.o3_roles <- function(pth) {
  cj <- .ola2_cajas(pth, 1)
  corte <- min(cj$y0[cj$texto == "Base: 200"]) + 0.2                     # la divergente arriba, la apilada abajo
  cj$panel <- ifelse(cj$y0 < corte, "divergente", "apilada")
  cj$rol <- ifelse(.ola2_es_cifra(cj$texto) & !grepl("^0%$|^50%$", cj$texto) & cj$pt >= 13, "cifra",
            ifelse(startsWith(cj$texto, "Base:"), "base",
            ifelse(cj$texto %in% c("Pregunta uno", "Pregunta dos"), "rotulo",
            ifelse(cj$texto %in% c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"), "leyenda", NA))))
  cj[!is.na(cj$rol), , drop = FALSE]
}

test_that("G-b: cada rol (rótulo, cifra, leyenda, base) tiene el mismo cuerpo en los dos gráficos de la lámina", {
  skip_if_not_installed("officer")
  r <- .o3_roles(.o3_lamina())
  for (rol in c("rotulo", "cifra", "leyenda", "base")) {
    pts <- tapply(round(r$pt[r$rol == rol]), r$panel[r$rol == rol], function(x) paste(sort(unique(x)), collapse = ","))
    expect_identical(unname(pts["divergente"]), unname(pts["apilada"]), info = rol)
  }
  expect_equal(unique(round(r$pt[r$rol == "cifra"])), .std_pt("cifra"))
  s <- .leer_parte_zip(.o3_lamina(), "ppt/slides/slide1.xml")
  cif <- regmatches(s, gregexpr('(?s)<a:rPr sz="14\\d\\d"[^>]*>', s, perl = TRUE))[[1]]
  expect_true(all(grepl('b="1"', cif)))                                    # las cifras en negrita, en los dos gráficos
})

test_that("G-c: el canal de rótulos mide el rótulo más largo más su aire, en los dos gráficos", {
  skip_if_not_installed("officer")
  pth <- .o3_lamina()
  f <- .ola2_formas(pth, 1)
  r <- .o3_roles(pth)
  barras <- f[!nzchar(f$texto) & !f$cust & (f$x1 - f$x0) > 0.05 & (f$y1 - f$y0) > 0.12 & (f$y1 - f$y0) < 0.6, , drop = FALSE]
  for (pan in c("divergente", "apilada")) {
    rot <- r[r$rol == "rotulo" & r$panel == pan, , drop = FALSE]
    b <- barras[barras$y0 > min(rot$y0) - 0.4 & barras$y1 < max(rot$y1) + 0.4, , drop = FALSE]
    tinta <- max(.lam_ancho_tinta(rot$texto, .std_pt("rotulo_categoria"), TRUE))
    hueco <- min(b$x0) - max(rot$x1)
    # En la divergente el hueco incluye el desacuerdo hasta el cero y sus cifras de fuera: a lo más una pulgada.
    expect_lte(hueco, if (pan == "apilada") .APILADAS_CANAL_AIRE_IN + .APILADAS_CANAL_CALLE_IN + 0.05 else 1, label = pan)
  }
  expect_equal(.apiladas_canal_dinamico(0.37, 0.47, c("Asociado", "Jefe de Práctica"), 12, 10)$w_etq,
               max(.APILADAS_CANAL_MIN_IN, .lam_ancho_tinta("Jefe de Práctica", 12, TRUE) + .APILADAS_CANAL_AIRE_IN) / 10, tolerance = 1e-9)
  expect_identical(.apiladas_canal_dinamico(0.1, 0.6, c("Un rótulo bastante largo que no cabe en una pulgada"), 12, 10)$w_etq, 0.1)   # lo declarado es el tope
})

test_that("G-d: las cifras de fuera no cruzan la línea del cero; el lado izquierdo mide el desacuerdo, no el acuerdo", {
  lab <- data.frame(.item = factor(c("A", "A"), levels = "A"), .cat = c("n1", "n2"), .signo = c(-3, -8), .valor = c(3, 8),
                    .lado = c("neg", "neg"), .orden_apilado = c(2, 1), .lab = c("3%", "8%"))
  df <- rbind(lab[, 1:6], data.frame(.item = factor("A", levels = "A"), .cat = "p1", .signo = 80, .valor = 80, .lado = "pos", .orden_apilado = 1))
  pos <- .divergentes_cifras_posiciones(lab, df, 14, 0.03, 0.68)
  w_u <- (.ancho_texto_in(pos$.lab, 14) + 0.06) / 0.03
  expect_true(all(!pos$.dentro))
  expect_true(all(pos$.x + w_u / 2 <= 0 + 1e-9))                           # enteras a la izquierda del cero
  expect_equal(.divergentes_tope_izquierdo(df, 100), max(11 * 1.15, 12))
})
