source("setup-load-all.R")

# C5 del editor de ajustes Word: la escala apilada del Word la redibuja `.word_g_escala()` desde la espec, y sólo llegan
# los args que entran en `preparar_escala()`. El resto lo fija el recetario. `/presets-metadata` lo publica por preset en
# `word_fijado: [{arg, valor?, unidad?, motivo, aplica_si_marco}]`, leído de las MISMAS constantes que usa el renderer
# (`reporte_word_escala_fijados.R`): si alguien cambia el renderer sin pasar por ellas, este archivo se pone rojo.

.wf_preset <- function(nombre) {
  Filter(function(p) identical(p$name, nombre), .presets_metadata_payload()$presets)[[1]]
}
.wf_por_arg <- function(fijados) stats::setNames(fijados, vapply(fijados, `[[`, "", "arg"))

.wf_rot <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "SIN INF")
.wf_data <- function() {
  data.frame(actor = c("Docentes", "Personal administrativo de apoyo de la facultad"), N = c(52, 172),
             p1 = c(.02, .03), p2 = c(.06, .11), p3 = c(.44, .51), p4 = c(.46, .33), p5 = c(.02, .02))
}
# La espec que el graficador cuelga de su ggplot: la ÚNICA entrada de `.word_g_escala()`.
.wf_espec <- function(...) {
  a <- utils::modifyList(list(mostrar_barra_extra = TRUE), list(...))
  p <- suppressMessages(do.call(graficar_barras_apiladas, c(list(
    .wf_data(), var_categoria = "actor", var_n = "N", cols_porcentaje = paste0("p", 1:5),
    etiquetas_grupos = stats::setNames(.wf_rot, paste0("p", 1:5)), barra_extra_preset = "top2box",
    top2box_labels = c("De acuerdo", "Muy de acuerdo"), exportar = "rplot"), a)))
  attr(p, "pulso_espec")
}

test_that("el payload publica word_fijado en las apiladas y size_leyenda vale 8", {
  for (nm in .WORD_ESCALA_PRESETS) {
    f <- .wf_preset(nm)$word_fijado
    expect_true(is.list(f) && length(f) > 10L, info = nm)
    por <- .wf_por_arg(f)
    expect_identical(por$size_leyenda$valor, 8)
    expect_identical(por$size_leyenda$unidad, "pt")
    for (x in f) {
      expect_match(x$motivo, "^Lo fija el recetario en el Word", info = x$arg)
      expect_match(x$motivo, "cae al marco", info = x$arg)
      expect_true(isTRUE(x$aplica_si_marco), info = x$arg)
    }
  }
  # Un preset cuyo Word no redibuja la escala no publica candados.
  expect_null(.wf_preset("barras_categoricas")$word_fijado)
})

test_that("los args que SÍ llegan al Word no aparecen como fijados", {
  fijados <- vapply(.wf_preset("barras_apiladas")$word_fijado, `[[`, "", "arg")
  llegan <- c("colores_grupos", "decimales", "mostrar_barra_extra", "barra_extra_preset", "top2box_labels",
              "metodo_redondeo", "invertir_leyenda", "invertir_barras", "mostrar_categorias_en_cero")
  expect_length(intersect(fijados, llegan), 0L)
  # Y llegan de verdad: cambian la espec, que es lo único que lee el renderer.
  e0 <- .wf_espec()
  expect_false(identical(.wf_espec(decimales = 1), e0))
  expect_false(identical(.wf_espec(mostrar_barra_extra = FALSE), e0))
  expect_false(identical(.wf_espec(colores_grupos = c("#111111", "#222222", "#333333", "#444444", "#555555")), e0))
})

test_that("cada arg fijado no cambia la espec: el Word no lo puede leer", {
  e0 <- .wf_espec()
  prueba <- list(size_leyenda = 6, legend_key_cm = 1, leyenda_posicion = "derecha", mostrar_leyenda = FALSE,
                 legend_n_por_fila = 2, size_texto_barras = 2, size_texto_barras_peq = 1, color_texto_barras = "#FF0000",
                 color_texto_barras_fuera = "#FF0000", mostrar_valores = FALSE, mostrar_n_en_etiquetas = TRUE,
                 textos_negrita = "ninguno", umbral_ocultar_etiqueta = 0.1, umbral_mostrar_etiqueta = 0.3,
                 umbral_etiqueta_normal = 0.3, size_ejes = 5, ancho_max_eje_y = 5, size_barra_extra = 3,
                 size_titulo_extra = 3, color_barra_extra = "#FF0000", titulo_barra_extra = "XYZ",
                 prefijo_barra_extra = "N=", barra_extra_semaforo = TRUE, barra_extra_umbral_alto = 50,
                 barra_extra_umbral_medio = 40, grosor_barras = 0.3, grosor_modo = "manual", grosor_barras_mult = 2,
                 alto_por_categoria = 1)
  fijados <- vapply(.wf_preset("barras_apiladas")$word_fijado, `[[`, "", "arg")
  expect_setequal(names(prueba), fijados)   # todo candado publicado se prueba aquí
  for (nm in names(prueba)) {
    expect_identical(do.call(.wf_espec, prueba[nm]), e0, label = nm)
  }
})

test_that("el valor publicado es el que dibuja el renderer", {
  por <- .wf_por_arg(.wf_preset("barras_apiladas")$word_fijado)
  g <- .word_g_escala(.wf_espec())
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  expect_equal(g$theme$legend.text$size, por$size_leyenda$valor)
  expect_equal(as.numeric(grid::convertUnit(g$theme$legend.key.size, "cm")), por$legend_key_cm$valor, tolerance = 1e-3)
  expect_identical(g$theme$legend.position, "bottom")

  texto <- Filter(function(l) "label" %in% names(l) && "size" %in% names(l), b$data)
  pt_de <- function(etiquetas) {
    hit <- Filter(function(l) any(as.character(l$label) %in% etiquetas), texto)
    unique(unlist(lapply(hit, function(l) l$size[as.character(l$label) %in% etiquetas]))) * ggplot2::.pt
  }
  e <- .wf_espec()
  expect_equal(pt_de("44%"), por$size_texto_barras$valor)            # dentro
  expect_equal(pt_de("2%"), por$size_texto_barras_peq$valor)         # chica, encima
  expect_equal(pt_de("Docentes"), por$size_ejes$valor)               # rótulo de fila
  expect_equal(pt_de(e$box$cifras), por$size_barra_extra$valor)      # cifra del box
  expect_equal(pt_de("Top Two Box"), por$size_titulo_extra$valor)    # rótulo del box

  box <- Filter(function(l) any(as.character(l$label) %in% e$box$cifras), texto)[[1]]
  expect_identical(unique(box$colour), por$color_barra_extra$valor)

  rect <- Filter(function(l) all(c("ymin", "ymax") %in% names(l)) && !"label" %in% names(l), b$data)[[1]]
  expect_equal(unique(round(rect$ymax - rect$ymin, 6)), por$grosor_barras$valor)

  largo <- "Personal administrativo de apoyo de la facultad"
  esperado <- paste(strwrap(largo, width = por$ancho_max_eje_y$valor), collapse = "\n")
  expect_true(esperado %in% unlist(lapply(texto, function(l) as.character(l$label))))

  expect_equal(.word_alto_figura("escala", 2) - .word_alto_figura("escala", 1), por$alto_por_categoria$valor)
  expect_equal(por$umbral_mostrar_etiqueta$valor, .WORD_ESCALA_CABE_PCT / 100)
})

test_that("una apilada con size_leyenda 6 y 8 da el mismo PNG del Word: el candado no cambió el comportamiento", {
  png_de <- function(v) {
    g <- .word_grafico(suppressMessages(graficar_barras_apiladas(
      .wf_data(), var_categoria = "actor", var_n = "N", cols_porcentaje = paste0("p", 1:5),
      etiquetas_grupos = stats::setNames(.wf_rot, paste0("p", 1:5)), mostrar_barra_extra = TRUE,
      barra_extra_preset = "top2box", top2box_labels = c("De acuerdo", "Muy de acuerdo"), size_leyenda = v,
      exportar = "rplot")))
    expect_identical(attr(g, "renderer"), "escala")
    f <- .word_png(g, attr(g, "alto"))
    on.exit(unlink(f))
    unname(tools::md5sum(f))
  }
  expect_identical(png_de(6), png_de(8))
})
