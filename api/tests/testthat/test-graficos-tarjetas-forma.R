source("setup-load-all.R")

# Con el panel de tarjetas al lado, la forma de una categórica se decide en el ancho que queda (v7.13, lámina 25:
# B4_recod con rótulos cortos salía en columnas, «Voluntariado» invadía a «Académica», «Entretenimiento» se partía y
# los «N respuestas» se montaban). Datos sintéticos.

.tf_espec <- function() {
  rot <- c("Voluntariado", "Académica", "Política universitaria", "Artística", "Profesional", "Entretenimiento",
           "Política nacional", "Religiosa", "Otros", "Ninguna", "Deportiva")
  p <- c(28, 16, 8, 6, 6, 3, 3, 2, 1, 51, 4) / 100
  e <- preparar_categorica(rot, p, paste0(round(100 * p), "%"))
  e$n_casos <- round(400 * p); e$n <- e$n_casos
  e
}

test_that("con tarjetas, las columnas se miden con tinta en su paso real, «N respuestas» incluido", {
  e <- .tf_espec(); e10 <- e; for (f in c("rotulos", "valores", "largos", "cifras", "n", "n_casos")) e10[[f]] <- e10[[f]][1:10]
  w_lleno <- .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der") - 1.2
  expect_false(.lam_columnas_caben(e10, w_lleno - 2.6))                 # «Entretenimiento» no cabe en el paso con el panel
  expect_true(.lam_columnas_caben(preparar_categorica(c("Sí", "No", "Tal vez"), c(.5, .3, .2), c("50%", "30%", "20%")), w_lleno))
  # Sin panel de tarjetas, la regla de siempre (el mazo no cambia).
  expect_identical(.lam_categorica_forma(e10, "columnas"), "columnas")
  withr::with_options(list(prosecnur.lam_reserva_derecha = 2.6), {
    expect_identical(.lam_categorica_forma(e10, "columnas"), "barras")
    expect_identical(.lam_categorica_forma(e, "columnas"), "barras")   # once opciones: en barras, que caben
  })
})

test_that("con tarjetas, las barras miden sus rótulos con tinta, como su columna: «Política universitaria» va en una línea", {
  e <- .tf_espec()
  withr::with_options(list(prosecnur.lam_reserva_derecha = 2.6), {
    geo <- .lam_barras_geo(e)
    expect_lte(.lam_alto_tinta("Política universitaria", geo$wlab, geo$size, .std_negrita_forzada("categorias")), geo$fila + 0.02)
    expect_false(is.na(.lam_categorica_forma(e, "barras")))
  })
})

test_that("la lámina de once opciones cortas con una tarjeta va en barras nativas y la tarjeta junto a su barra", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  p <- ggplot2::ggplot(); attr(p, "pulso_espec") <- .tf_espec()
  tj <- list(cruce = "area", fila = "Académica", total = 16, cifra_total = "16%", fragil = TRUE, brecha = 15,
             grupos = data.frame(codigo = c("1", "2"), etiqueta = c("Ciencias políticas y sociales", "Economía y Finanzas"),
                                 p = c(24, 9), dir = c("up", "down"), fragil = TRUE, stringsAsFactors = FALSE))
  attr(p, "pulso_tarjetas") <- list(tarjetas = list(tj), total = 1L, tipo = "multiple", opcion = .tarjetas_opcion(list(tarjetas_diferencias = TRUE)),
                                    rotulos_cruce = c(area = "Área"))
  doc <- .lam_tarjetas_slide_1(doc, p, list(meta = list(), slots = list()), "¿Perteneciste a alguna agrupación?",
                               list(var = "x", .element_type = "barras_agrupadas"), list(base = list(args = list())),
                               "Graficos2", "Office Theme", NULL, base_auto = function(...) "Base: 400", nota_de = function(...) NULL)
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_match(xml, "prosecnur:grafico:categorica", fixed = TRUE)
  expect_false(grepl('name="columna"', xml, fixed = TRUE))              # no en columnas
  expect_match(xml, 'name="tarjeta:guia:punto"', fixed = TRUE)          # anclada a «Académica»
})
