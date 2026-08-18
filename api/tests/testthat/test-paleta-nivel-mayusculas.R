# P51. Una paleta guardada con otra capitalizacion no casaba por nombre y caia
# al respaldo POSICIONAL, que reparte los colores en el orden en que la paleta
# esta GUARDADA. En el mazo de Contabilidad `lst_p14` esta al reves —«SIN INF»
# primero— y el resultado medido en el XML fue `BFBFBF 70AD47 ADD493 FFD965
# BFBFBF`: el naranja no se dibujaba nunca y «Totalmente en desacuerdo»
# compartia gris con «SIN INF», o sea dos categorias indistinguibles.

test_that("el color sigue a la ETIQUETA aunque cambie la capitalizacion", {
  # EL CASO REAL, reducido: la paleta dice «De Acuerdo» y el nivel «De acuerdo».
  pal <- list("De Acuerdo" = "#ADD493", "En Desacuerdo" = "#FFD965")
  out <- .reporte_plan_palette_for_levels("lst_x", c("De acuerdo", "En desacuerdo"),
                                          palette = pal)
  expect_equal(unname(out[["De acuerdo"]]), "#ADD493")
  expect_equal(unname(out[["En desacuerdo"]]), "#FFD965")
})


test_that("lst_p14 deja de aplastar dos categorias en el mismo gris", {
  # La paleta REAL del `.pulso`, en su orden guardado. Sin el arreglo, los
  # cuatro niveles de escala caen al posicional y salen
  # `BFBFBF 70AD47 ADD493 FFD965` — con el gris al frente y sin naranja.
  pal <- list(
    "SIN INF"                  = "#BFBFBF",
    "Totalmente de Acuerdo"    = "#70AD47",
    "De Acuerdo"               = "#ADD493",
    "En Desacuerdo"            = "#FFD965",
    "Totalmente en Desacuerdo" = "#F4B183"
  )
  niveles <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
               "Totalmente de acuerdo", "SIN INF")
  out <- .reporte_plan_palette_for_levels("lst_p14", niveles, palette = pal)

  expect_equal(unname(out[niveles]),
               c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"))
  # Lo que se veia en la lamina: cinco categorias con CUATRO colores.
  expect_length(unique(unname(out)), 5L)
  expect_true("#F4B183" %in% out)
})


test_that("el acento tampoco rompe el emparejado", {
  pal <- list("Ninguna educacion" = "#111111", "Educacion superior" = "#222222")
  out <- .reporte_plan_palette_for_levels("lst_y",
                                          c("Ninguna educación", "Educación superior"),
                                          palette = pal)
  expect_equal(unname(out[["Ninguna educación"]]), "#111111")
  expect_equal(unname(out[["Educación superior"]]), "#222222")
})


test_that("el nombre exacto sigue mandando sobre el normalizado", {
  # Si la paleta trae las dos formas, gana la literal: normalizar es un
  # RESPALDO, no una sustitucion del emparejado exacto.
  pal <- list("De acuerdo" = "#AAAAAA", "DE ACUERDO" = "#BBBBBB")
  out <- .reporte_plan_palette_for_levels("lst_z", "De acuerdo", palette = pal)
  expect_equal(unname(out[["De acuerdo"]]), "#AAAAAA")
})
