# Segunda serie declarada en barras agrupadas: la medición anterior de una
# lámina de perfil. Ver `api/R/graficos_barras_comparativo.R`.

perfil_data <- function() {
  data.frame(
    categoria = c("Masculino", "Femenino", "Prefiero no responder"),
    N         = c(172, 172, 172),
    n         = c(89, 83, 0),
    pct       = c(89 / 172, 83 / 172, 0),
    stringsAsFactors = FALSE
  )
}

expandir <- function(comparativo, data = perfil_data(), cols_n = c(pct = "n"), ...) {
  .barras_comparativo_expandir(
    data             = data,
    var_categoria    = "categoria",
    cols_porcentaje  = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    cols_n           = cols_n,
    colores_series   = NULL,
    comparativo      = comparativo,
    escala_valor     = "proporcion_1",
    ...
  )
}

test_that("el histórico declarado se alinea por etiqueta de categoría", {
  out <- expandir(list(
    valores         = c(Femenino = 0.59, Masculino = 0.41),
    etiqueta        = "2021",
    etiqueta_actual = "2026"
  ))

  expect_false(is.null(out))
  expect_length(out$cols_porcentaje, 2L)
  # Alineación por NOMBRE, no por posición: el spec vino en orden invertido.
  previa <- out$data[[out$cols_porcentaje[[2]]]]
  expect_equal(previa[[1]], 0.41)
  expect_equal(previa[[2]], 0.59)
  expect_equal(unname(out$etiquetas_series), c("2026", "2021"))
})

test_that("una categoría sin dato anterior queda en NA y no en cero", {
  out <- expandir(list(valores = c(Masculino = 0.41, Femenino = 0.59)))
  previa <- out$data[[out$cols_porcentaje[[2]]]]
  # "Prefiero no responder" no está en el histórico. Un 0 sería un dato medido
  # que nadie midió.
  expect_true(is.na(previa[[3]]))
  expect_false(identical(previa[[3]], 0))
})

test_that("la serie anterior sale gris y la actual conserva el azul de la casa", {
  out <- expandir(list(valores = c(Masculino = 0.41, Femenino = 0.59), etiqueta = "2021"))
  expect_equal(unname(out$colores_series[["2021"]]), .BARRAS_COMPARATIVO_COLOR_ANTERIOR)
  expect_equal(unname(out$colores_series[["Actual"]]), .PULSO_PPT_COLORS$azul)
})

test_that("un color declarado para la serie anterior manda sobre el gris", {
  out <- expandir(list(valores = c(Masculino = 0.41), etiqueta = "2021", color = "#123456"))
  expect_equal(unname(out$colores_series[["2021"]]), "#123456")
})

test_that("la escala se convierte solo cuando el spec la declara distinta", {
  base_100 <- expandir(list(
    valores = c(Masculino = 41, Femenino = 59),
    escala  = "proporcion_100"
  ))
  previa <- base_100$data[[base_100$cols_porcentaje[[2]]]]
  expect_equal(previa[[1]], 0.41)

  # Sin declarar escala se asume la del gráfico: 41 se queda en 41 y el
  # analista lo ve a ojo. No se adivina.
  sin_declarar <- expandir(list(valores = c(Masculino = 41, Femenino = 59)))
  expect_equal(sin_declarar$data[[sin_declarar$cols_porcentaje[[2]]]][[1]], 41)
})

test_that("no aplica sobre un cruce ni sobre un spec que habla de otra pregunta", {
  cruce <- .barras_comparativo_expandir(
    data             = data.frame(categoria = "A", N = 10, pct_1 = 0.5, pct_2 = 0.5),
    var_categoria    = "categoria",
    cols_porcentaje  = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    cols_n           = NULL,
    colores_series   = NULL,
    comparativo      = list(valores = c(A = 0.4)),
    escala_valor     = "proporcion_1"
  )
  expect_null(cruce)

  # Ninguna categoría resuelve: mejor la serie única que una serie vacía que
  # se lee como un cero medido.
  expect_null(expandir(list(valores = c("Otra cosa" = 0.4, "Y otra" = 0.6))))
  expect_null(expandir(NULL))
  expect_null(expandir(list(valores = numeric(0))))
})

test_that("un vector sin nombres solo alinea por posición si calza exacto", {
  ok <- expandir(list(valores = c(0.41, 0.59, 0.00)))
  expect_false(is.null(ok))
  expect_equal(ok$data[[ok$cols_porcentaje[[2]]]][[2]], 0.59)

  # Corto: reciclar le inventaría un histórico a la fila que no lo declaró.
  expect_null(expandir(list(valores = c(0.41, 0.59))))
})

test_that("cols_n cubre la serie anterior sin fabricarle una frecuencia", {
  out <- expandir(list(valores = c(Masculino = 0.41, Femenino = 0.59)))
  expect_true(all(out$cols_porcentaje %in% names(out$cols_n)))
  col_n_previa <- out$cols_n[[out$cols_porcentaje[[2]]]]
  expect_true(all(is.na(out$data[[col_n_previa]])))

  # Sin `cols_n` de entrada no se inventa uno.
  sin_n <- expandir(list(valores = c(Masculino = 0.41)), cols_n = NULL)
  expect_null(sin_n$cols_n)
})

test_that("dos series con el mismo rótulo se desempatan en la leyenda", {
  out <- expandir(list(
    valores         = c(Masculino = 0.41),
    etiqueta        = "2026",
    etiqueta_actual = "2026"
  ))
  expect_equal(length(unique(unname(out$etiquetas_series))), 2L)
})

test_that("el graficador dibuja las dos series y el perfil sigue monocromo sin spec", {
  skip_if_not_installed("ggplot2")

  con_historico <- graficar_barras_agrupadas(
    data             = perfil_data(),
    var_categoria    = "categoria",
    var_n            = "N",
    cols_porcentaje  = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    cols_n           = c(pct = "n"),
    comparativo      = list(
      valores         = c(Masculino = 0.41, Femenino = 0.59),
      etiqueta        = "2021",
      etiqueta_actual = "2026"
    )
  )
  expect_s3_class(con_historico, "ggplot")
  fills <- ggplot2::ggplot_build(con_historico)$data[[1]]$fill
  expect_true(.BARRAS_COMPARATIVO_COLOR_ANTERIOR %in% toupper(fills))
  expect_true(.PULSO_PPT_COLORS$azul %in% toupper(fills))

  # Sin spec, la lámina de perfil conserva su monocromo institucional: la
  # puerta nueva no cambia lo que ya salía aprobado.
  sin_historico <- graficar_barras_agrupadas(
    data             = perfil_data(),
    var_categoria    = "categoria",
    var_n            = "N",
    cols_porcentaje  = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    cols_n           = c(pct = "n")
  )
  fills_solo <- unique(toupper(ggplot2::ggplot_build(sin_historico)$data[[1]]$fill))
  expect_equal(fills_solo, .PULSO_PPT_COLORS$azul)
})

test_that("una categoría declarada que no existe se avisa, no se descarta callando", {
  expect_message(
    expandir(list(valores = c(Masculino = 0.41, Femenino = 0.59, "Otro (especifique)" = 0.02))),
    "no coinciden con ninguna barra",
    fixed = TRUE
  )
  # Todas resuelven: nada que avisar.
  expect_silent(expandir(list(valores = c(Masculino = 0.41, Femenino = 0.59))))
})

test_that("el gris de la ola anterior admite la cifra blanca", {
  # La cifra va blanca en las dos series, así que el color de la barra es el
  # que tiene que dar el contraste.
  expect_lt(.contraste_luminancia(.BARRAS_COMPARATIVO_COLOR_ANTERIOR), .CONTRASTE_UMBRAL)
  expect_equal(.contraste_texto(.BARRAS_COMPARATIVO_COLOR_ANTERIOR), "white")
})

test_that("un color demasiado claro para la cifra blanca se avisa, no se corrige", {
  claro <- c("2026" = .PULSO_PPT_COLORS$azul, "2021" = "#BFBFBF")
  expect_message(.barras_comparativo_avisar_contraste(claro), "demasiado claro")

  ok <- c("2026" = .PULSO_PPT_COLORS$azul, "2021" = .BARRAS_COMPARATIVO_COLOR_ANTERIOR)
  expect_silent(.barras_comparativo_avisar_contraste(ok))

  # Con la cifra en otro color la guarda no opina: es una regla del blanco.
  expect_silent(.barras_comparativo_avisar_contraste(claro, color_cifra = "#081F5C"))
})

test_that("todas las cifras salen del mismo color", {
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_agrupadas(
    data             = perfil_data(),
    var_categoria    = "categoria",
    var_n            = "N",
    cols_porcentaje  = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    cols_n           = c(pct = "n"),
    comparativo      = list(valores = c(Masculino = 0.41, Femenino = 0.59),
                            etiqueta = "2021", etiqueta_actual = "2026")
  )
  capas <- ggplot2::ggplot_build(p)$data
  textos <- capas[[which(vapply(capas, function(d) "label" %in% names(d), logical(1)))[[1]]]]
  dentro <- textos[nzchar(as.character(textos$label)), ]
  # Una lámina donde unas cifras salen blancas y otras azules se lee como un
  # error aunque cada una, por separado, tenga contraste.
  expect_equal(length(unique(tolower(dentro$colour))), 1L)
})

test_that("la cifra se acota al alto del cajón real, no al nominal", {
  # Alto del cajón que el renderer inyecta en las láminas de perfil.
  ALTO <- 2.565
  chico <- suppressMessages(.barras_comparativo_size_cifra(
    5.6, 2, 2, alto_in = ALTO, header_in = 0.422, legend_in = 0.422))
  grande <- suppressMessages(.barras_comparativo_size_cifra(
    5.6, 6, 2, alto_in = ALTO, header_in = 0.422, legend_in = 0.422))

  # Dos categorías caben con el tamaño declarado: no se toca lo que el analista
  # eligió si no hace falta.
  expect_equal(chico, 5.6)
  # Seis en dos series no caben y el motor cede.
  expect_lt(grande, 5.6)
  expect_gte(grande, 2.6)

  # Con una sola serie nunca se toca: es el perfil de siempre.
  expect_equal(.barras_comparativo_size_cifra(5.6, 6, 1, alto_in = ALTO,
                                              header_in = 0.422, legend_in = 0.422), 5.6)

  # El nominal (`n_cat * alto_por_categoria` = 6,12 in) diría que todo entra.
  # Usarlo era el defecto: con él, seis categorías no se reducen nunca.
  expect_equal(.barras_comparativo_size_cifra(5.6, 6, 2, alto_in = 6.12), 5.6)
})

test_that("el dodge entra en la cuenta del alto de barra", {
  # Las barras no llenan la categoría: el motor deja aire entre grupos. Ignorar
  # ese factor sobreestima el alto y la cifra sale montada sobre el borde de su
  # propia barra — se vio en «Rango de edades» del mazo.
  CROMO <- list(header_in = 0.422, legend_in = 0.422)
  con_aire <- suppressMessages(do.call(.barras_comparativo_size_cifra,
    c(list(5.6, 4, 2, alto_in = 2.565, dodge = 0.70), CROMO)))
  apretado <- suppressMessages(do.call(.barras_comparativo_size_cifra,
    c(list(5.6, 4, 2, alto_in = 2.565, dodge = 0.90), CROMO)))
  expect_lt(con_aire, apretado)

  # Un dodge fuera de rango no rompe la cuenta.
  expect_equal(
    suppressMessages(do.call(.barras_comparativo_size_cifra,
      c(list(5.6, 4, 2, alto_in = 2.565, dodge = 0), CROMO))),
    apretado
  )
})

test_that("pisar un tamaño declarado se avisa", {
  expect_message(
    .barras_comparativo_size_cifra(5.6, 6, 2, alto_in = 2.565,
                                   header_in = 0.422, legend_in = 0.422),
    "la cifra baja de"
  )
  expect_silent(.barras_comparativo_size_cifra(5.6, 2, 2, alto_in = 2.565,
                                               header_in = 0.422, legend_in = 0.422))
})

test_that("la cabecera se recorta a lo que el título necesita, y solo hacia abajo", {
  # El preset del perfil declara 0,756 in para un título de una línea a 16 pt.
  recortada <- .barras_comparativo_header(0.756, size_titulo = 16)
  expect_lt(recortada, 0.756)
  # Tiene que seguir dando para el cuerpo del título con su aire.
  expect_gt(recortada, 16 / 72)

  # Nunca crece: una cabecera ya ajustada se respeta.
  expect_equal(.barras_comparativo_header(0.30, size_titulo = 16), 0.30)
  # Un título grande exige más cabecera que uno chico.
  expect_gt(.barras_comparativo_header(0.9, size_titulo = 24),
            .barras_comparativo_header(0.9, size_titulo = 12))
  # Piso duro y entradas inservibles.
  expect_gte(.barras_comparativo_header(0.9, size_titulo = 4), 0.26)
  expect_equal(.barras_comparativo_header(NA, size_titulo = 16), NA)
})

test_that("recortar el cromo engorda la barra y sube la cifra", {
  # Reparto medido con trace() antes y después de los recortes.
  antes <- suppressMessages(.barras_comparativo_size_cifra(
    5.6, 4, 2, alto_in = 2.565, header_in = 0.756, legend_in = 0.750))
  despues <- suppressMessages(.barras_comparativo_size_cifra(
    5.6, 4, 2, alto_in = 2.565, header_in = 0.422, legend_in = 0.422))
  expect_gt(despues, antes)
})

test_that("el panel se calcula descontando el cromo, no con una fracción", {
  # El cromo es la diferencia entre creer que cabe y que quepa: descontarlo
  # baja la cifra, y no descontarlo es lo que la hacía salir montada sobre el
  # borde de su propia barra.
  sin_cromo <- suppressMessages(
    .barras_comparativo_size_cifra(5.6, 4, 2, alto_in = 2.565))
  con_cromo <- suppressMessages(.barras_comparativo_size_cifra(
    5.6, 4, 2, alto_in = 2.565, header_in = 0.422, legend_in = 0.422))
  expect_lt(con_cromo, sin_cromo)
  # Un cromo que se come el cajón entero no rompe la cuenta.
  expect_equal(
    .barras_comparativo_size_cifra(5.6, 4, 2, alto_in = 2.565, header_in = 3),
    5.6
  )
})

test_that("las dos barras de una categoría van pegadas y el aire queda entre categorías", {
  skip_if_not_installed("ggplot2")
  p <- graficar_barras_agrupadas(
    data             = perfil_data(),
    var_categoria    = "categoria",
    var_n            = "N",
    cols_porcentaje  = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    cols_n           = c(pct = "n"),
    comparativo      = list(valores = c(Masculino = 0.41, Femenino = 0.59),
                            etiqueta = "2021", etiqueta_actual = "2026")
  )
  b <- ggplot2::ggplot_build(p)$data[[1]]
  b <- b[order(b$xmin), ]
  anchos <- b$xmax - b$xmin

  # Dentro del par no hay hueco: el borde de una barra es el de la siguiente.
  # (Las dos primeras filas son las dos series de la primera categoría.)
  hueco_par <- b$xmin[[2]] - b$xmax[[1]]
  expect_lt(abs(hueco_par), 1e-6)

  # Entre categorías sí: el dodge deja aire, que es donde separa algo.
  hueco_cat <- b$xmin[[3]] - b$xmax[[2]]
  expect_gt(hueco_cat, 0)
  expect_gt(hueco_cat, median(anchos) * 0.05)
})
