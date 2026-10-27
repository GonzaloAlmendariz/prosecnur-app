source("setup-load-all.R")

# CCSS Perfil 2026 (p_slide_2_graficos y p_slide_6_graficos_poblacion): `p_barras_categoricas` en columnas dentro de un panel
# angosto envolvía los rótulos a 18 caracteres fijos, calibrados para la lámina completa. En un cajón de 6.1 in con cuatro
# columnas «Hasta secundaria completa» quedaba más ancha que su columna y se encimaba con «Superior técnica». El envoltorio
# sale ahora del ancho real de cada columna y, si ni así cabe una palabra, el cuerpo baja hasta el piso del estándar
# (`cifra_minimo`, 8 pt) y no más (graficador_rotulos_eje_x.R).

.rm_df <- function() data.frame(
  categoria = c("Hasta secundaria completa", "Superior técnica", "Universitaria", "Posgrado"),
  pct = c(.24, .21, .39, .17), n = c(91, 79, 147, 64), stringsAsFactors = FALSE
)
.rm_plot <- function(ancho) {
  suppressMessages(suppressWarnings(graficar_barras_categoricas(.rm_df(), var_categoria = "categoria", var_valor = "pct",
    var_n = "n", ancho = ancho, alto = 3, exportar = "rplot")))
}
.rm_rotulos <- function(p) {
  b <- ggplot2::ggplot_build(p)
  lab <- as.vector(unname(b$layout$panel_scales_x[[1]]$get_labels()))
  list(lab = lab, size = p$theme$axis.text.x$size)
}

test_that("en un panel angosto cada línea del rótulo cabe en su columna", {
  skip_if_not_installed("systemfonts")
  for (ancho in c(6.1, 4.1)) {
    r <- .rm_rotulos(.rm_plot(ancho))
    col <- (ancho - 2 * 24 / 72) / 4
    lineas <- unlist(strsplit(r$lab, "\n", fixed = TRUE))
    w <- .lam_ancho_tinta(lineas, r$size, TRUE)
    expect_true(all(w <= col - 0.04), info = sprintf("ancho %.1f: %s", ancho, paste(sprintf("%s=%.2f", lineas, w), collapse = ", ")))
    expect_gte(r$size, .std_valor("ppt", "tipografia", "cifra_minimo"))
  }
})

test_that("en la lámina completa el envoltorio y el cuerpo no cambian", {
  r <- .rm_rotulos(.rm_plot(12.5))
  expect_equal(r$lab, stringr::str_wrap(.rm_df()$categoria, 18))
  expect_equal(r$size, 16)
})

test_that("si ni al piso cabe, el cuerpo se queda en el piso y avisa", {
  skip_if_not_installed("systemfonts")
  a <- .rotulos_eje_x_ajuste(c("Extraordinariamente", "Superlativamente"), ancho_in = 1.2, size_pt = 16, ancho_max = 18, bold = TRUE)
  expect_equal(a$size, .std_valor("ppt", "tipografia", "cifra_minimo"))
  expect_false(a$cabe)
})

test_that("la composición le pasa al graficador el ancho real de su marcador, no 5.2 in", {
  skip_if_not_installed("officer")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  ct <- .PPT_CONTRACT$poblacion_6
  w <- vapply(.SLIDES_COMPOSICION$poblacion_6, function(nm) .composicion_ancho_slot(doc, ct, nm), 0)
  expect_true(all(abs(w - 3.91) < 0.05), info = paste(round(w, 2), collapse = ", "))
  expect_equal(.composicion_ancho_slot(doc, list(slots = list(a = list(loc = list(width = 2.5)))), "a"), 2.5)
})

# Prueba de robustez con el mazo CCSS (2026-10-27): una agrupada de cruce con tres o más grupos (un Sí/No según nivel educativo,
# cuatro grupos) iba por la ruta de respaldo con la cifra de cada barra a 5.97 pt. La escala por número de series
# (`size_texto_barras * 0.70` con cuatro grupos) la bajaba del piso del estándar y `.agrupadas_cruce_par` sólo la acotaba
# hacia abajo: si ya cabía en la barra la dejaba como venía. Ahora el cruce parte del piso (`cifra_minimo`, 8 pt).
test_that("la cifra de una agrupada de cruce con cuatro grupos no baja del piso del estándar", {
  df <- data.frame(categoria = c("Sí", "No"), N = 480, pct_1 = c(.10, .90), pct_2 = c(.29, .71), pct_3 = c(.47, .53),
                   pct_4 = c(.67, .33), stringsAsFactors = FALSE)
  g <- suppressMessages(suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("pct_", 1:4),
    etiquetas_series = c(pct_1 = "Hasta secundaria completa", pct_2 = "Superior técnica", pct_3 = "Universitaria", pct_4 = "Posgrado"),
    usar_canvas = TRUE, orientacion = "horizontal", ancho = 12.5, alto = 6, exportar = "rplot")))
  cr <- attr(g, "pulso_barras_agrupadas_cruce")
  piso_mm <- .std_valor("ppt", "tipografia", "cifra_minimo") * 25.4 / 72
  expect_gte(cr$size_cifra_mm, piso_mm - 1e-9)
  # Con barras holgadas el piso cabe dentro: no hace falta sacarla.
  expect_false(cr$cifra_fuera)
})

test_that("el piso del cruce sólo sube lo que estaba por debajo: dos grupos conservan su cuerpo", {
  expect_equal(.agrupadas_cruce_par(3, 5, 2, 6)$size_mm, 3)
  expect_equal(.agrupadas_cruce_par(2.1, 2, 4, 6)$size_mm, 8 * 25.4 / 72)
  # Barra demasiado delgada para el piso: queda en el piso y se declara fuera (la cifra sale de la barra, no se encoge).
  angosta <- .agrupadas_cruce_par(2.1, 12, 4, 3)
  expect_equal(angosta$size_mm, 8 * 25.4 / 72)
  expect_true(angosta$fuera)
})
