test_that("el radar declara Arial en todos sus textos de canvas", {
  # 22 textos salian en Helvetica —titulo, subtitulo, etiquetas de eje y
  # leyenda— porque ni los `cowplot::draw_text` ni los `legend.text` del tema
  # declaraban familia y caian al default del device. El entregable aprobado
  # usa Arial y nada mas.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  )

  # Los `draw_text` que dibujan titulo, subtitulo y etiquetas de eje: son los
  # que producian los 22 Helvetica. No se exige a TODOS los draw_text del
  # archivo —hay alguno cuyo texto no llega al mazo— para que el test no
  # pretenda cubrir mas de lo que se midio.
  # El titulo y el subtitulo del canvas, que son los que salian en Helvetica.
  # No se recorren TODAS las ocurrencias de `color_ejes`: dos viven en ramas
  # que no llegan al mazo medido, y exigirselo seria pedirle al test que cubra
  # mas de lo que se comprobo.
  # Ni un solo `family = "sans"`: es el alias generico del device y en el PPT
  # se resuelve a Helvetica, que es como entraron seis de los veintidos.
  expect_false(any(grepl('family = "sans"', f, fixed = TRUE)))

  # El titulo y el subtitulo del canvas —los que salian en Helvetica— llevan
  # familia en su misma linea.
  for (ancla in c("size = size_titulo,", "size = size_subtitulo,")) {
    lineas <- grep(ancla, f, fixed = TRUE, value = TRUE)
    expect_gt(length(lineas), 0L)
    expect_true(all(grepl("family", lineas)), info = ancla)
  }

  # Y al menos una etiqueta de eje: la que dibuja el modo con canvas.
  expect_true(any(grepl('family = "Arial"', f, fixed = TRUE)))

  # Y todo `legend.text` del tema.
  legends <- grep("legend\\.text\\s*=\\s*ggplot2::element_text\\(", f)
  expect_gt(length(legends), 0L)
  for (i in legends) {
    bloque <- paste(f[i:min(length(f), i + 6)], collapse = " ")
    expect_true(grepl("family\\s*=", bloque),
                info = paste("legend.text sin family en la linea", i))
  }
})


test_that("el literal se usa donde la variable no llega", {
  # Dos de los `draw_text` se evaluan en un entorno que NO ve `font_family`:
  # referenciarla ahi degradaba las dos laminas de radar a «Sin datos». El
  # literal es la salida, y este test deja constancia de por que.
  f <- paste(readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  ), collapse = "\n")
  expect_true(grepl('family = "Arial"', f, fixed = TRUE))
})


test_that("`graficar_radar` corre sin canvas, que es donde reventaba", {
  # Este es el test que faltaba. Los dos anteriores leen el FUENTE y por eso
  # dieron verde mientras el motor estaba roto: comprobaban que existiera algun
  # `family = "Arial"` —lo habia, en otras tres lineas— sin ejercitar la ruta.
  # Al sustituir `family = "sans"` por `family = font_family` en dos geom_text
  # del cuerpo de `graficar_radar()`, esa variable no estaba en scope: el unico
  # `font_family` del archivo es un parametro de `.make_table_grob_ttb_style()`.
  # Con canvas la funcion no llega ahi, y el mazo solo usa canvas —por eso las
  # 66 laminas salian bien con el motor abortando en la otra ruta—.
  d <- data.frame(
    eje = c("E1", "E2", "E3"),
    grupo = "Total",
    valor = c(0.30, 0.55, 0.70),
    stringsAsFactors = FALSE
  )
  expect_no_error(
    graficar_radar(d, var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
                   escala_valor = "proporcion_100", mostrar_valores = TRUE,
                   usar_canvas = FALSE, exportar = "rplot")
  )
})


test_that("ningun `family` de ggplot referencia la variable ausente", {
  # Guarda directa contra la regresion. El `family =` de ggplot es el que vive
  # en el cuerpo de `graficar_radar()`, donde `font_family` no existe. El
  # `fontfamily =` de grid es otro: vive dentro de
  # `.make_table_grob_ttb_style()`, que SI lo declara como parametro, y ahi la
  # variable es lo correcto. Un patron `fixed` no distingue los dos porque
  # «fontfamily = font_family» contiene «family = font_family».
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_radar.R"),
    warn = FALSE
  )
  expect_length(
    grep("(?<!font)family = font_family", f, perl = TRUE),
    0L
  )
  # Y las de grid siguen ahi: no se trata de borrar la variable, sino de usarla
  # solo donde esta en scope.
  expect_gt(length(grep("fontfamily = font_family", f, fixed = TRUE)), 0L)
})
