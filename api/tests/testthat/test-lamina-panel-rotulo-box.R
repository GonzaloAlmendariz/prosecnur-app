# El rótulo del box en un panel likert se escribe como en la escala de lámina entera: en mayúsculas
# (`.lam_rotulo_box()`), aunque la especificación lo traiga en tipo título.

test_that("el panel likert escribe TOP TWO BOX en mayúsculas", {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
  d <- data.frame(item = c("p1", "p2"), rotulo = c("Competencia 1", "Competencia 2"), N = 40,
                  t1 = c(2, 1), t2 = c(8, 9), t3 = c(15, 14), t4 = c(15, 16)) 
  d[paste0("t", 1:4)] <- d[paste0("t", 1:4)] / d$N
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], niv)),
                       barra_extra_preset = "top2box", top2box_labels = niv[3:4])
  expect_false(is.null(e$box$unidades))
  lz <- .lam_lienzo()
  .lam_likert_panel(lz, e, x = 0.5, y = 1.5, w = 6, filas = seq_len(nrow(d)))
  xml <- paste(unlist(lz$formas), collapse = "")
  expect_match(xml, "name=\"box:rotulo\"", fixed = TRUE)
  rot <- regmatches(xml, regexpr("name=\"box:rotulo\".*?</p:sp>", xml))
  expect_match(rot, "TOP TWO BOX", fixed = TRUE)
  expect_no_match(rot, "Top Two Box", fixed = TRUE)
  # Cabe en una línea: el ancho de la caja menos sus márgenes internos (0.1 in por lado) alcanza para la tinta.
  cx <- as.numeric(sub('.*<a:ext cx="([0-9]+)".*', "\\1", rot)) / 914400
  expect_gte(cx - 0.2, .lam_ancho_tinta("TOP TWO BOX", .std_pt("rotulo_top_two_box"), TRUE))
})
