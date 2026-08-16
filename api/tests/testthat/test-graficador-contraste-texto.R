# El color de la cifra sale del segmento sobre el que cae.
#
# Estaba fijo en blanco, y funcionó mientras el extremo negativo de la escala
# fue el rojo institucional —oscuro—. Al cambiarlo a naranja claro (receta 4),
# 37 láminas quedaron con cifras invisibles. El entregable aprobado tiene cero.

test_that("la luminancia distingue claros de oscuros", {
  # Coeficientes de percepción: el ojo no pesa igual los tres canales.
  expect_gt(.contraste_luminancia("#FFD965"), .contraste_luminancia("#70AD47"))
  expect_gt(.contraste_luminancia("#F4B183"), .contraste_luminancia("#081F5C"))
  expect_equal(.contraste_luminancia("#FFFFFF"), 1)
  expect_equal(.contraste_luminancia("#000000"), 0)
})

test_that("acepta el hex con y sin almohadilla", {
  # El .pulso los guarda con «#» y el XML sin ella: comparar contra una sola
  # forma ya costó dar por limpias 14 paletas que no lo estaban.
  expect_equal(.contraste_luminancia("F4B183"), .contraste_luminancia("#F4B183"))
})

test_that("sobre naranja y amarillo el texto va oscuro", {
  expect_identical(.contraste_texto("#F4B183"), .CONTRASTE_SOBRE_CLARO)
  expect_identical(.contraste_texto("#FFD965"), .CONTRASTE_SOBRE_CLARO)
})

test_that("sobre verde y azul el texto sigue blanco", {
  expect_identical(.contraste_texto("#70AD47"), "white")
  expect_identical(.contraste_texto("#081F5C"), "white")
})

test_that("un color ilegible conserva el comportamiento de siempre", {
  # Sin poder leer el fondo no se inventa nada: se deja el color declarado.
  expect_identical(.contraste_texto("no-es-un-color"), "white")
  expect_identical(.contraste_texto(NA), "white")
})

test_that("funciona con colores que aun no existen en ninguna paleta", {
  # Por eso la decisión es por luminancia y no contra una lista de hexes: una
  # lista hay que mantenerla, y el día que se olvide vuelven las cifras
  # invisibles sin que nada avise.
  expect_identical(.contraste_texto("#FFFEF0"), .CONTRASTE_SOBRE_CLARO)
  expect_identical(.contraste_texto("#101010"), "white")
})

test_that("el recoloreado solo toca las cifras de DENTRO de la barra", {
  # La que va fuera cae sobre el fondo de la lámina, no sobre un segmento.
  df <- data.frame(
    .grupo = c("Muy en desacuerdo", "Muy de acuerdo"),
    .col_label = c("white", "white"),
    .label_fuera = c(TRUE, FALSE),
    stringsAsFactors = FALSE
  )
  pal <- c("Muy en desacuerdo" = "#F4B183", "Muy de acuerdo" = "#70AD47")
  out <- .aplicar_contraste_labels_apiladas(df, "white", pal)

  expect_identical(out$.col_label[1], "white")           # fuera: intacta
  expect_identical(out$.col_label[2], "white")           # dentro sobre verde
})

test_that("una cifra dentro de un segmento claro se vuelve oscura", {
  df <- data.frame(.grupo = "Muy en desacuerdo", .col_label = "white",
                   .label_fuera = FALSE, stringsAsFactors = FALSE)
  out <- .aplicar_contraste_labels_apiladas(
    df, "white", c("Muy en desacuerdo" = "#F4B183"))
  expect_identical(out$.col_label[1], .CONTRASTE_SOBRE_CLARO)
})

test_that("sin paleta no se toca nada", {
  df <- data.frame(.grupo = "X", .col_label = "white", .label_fuera = FALSE,
                   stringsAsFactors = FALSE)
  expect_identical(.aplicar_contraste_labels_apiladas(df, "white", NULL)$.col_label, "white")
})
