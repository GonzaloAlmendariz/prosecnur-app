source("setup-load-all.R")

test_that("las matrices salen de lo que el render ya calculo, sin recalcular", {
  # El punto de la feature: la lamina y el XLSX de cruces tienen que decir lo
  # mismo. Si este motor recalculara los conteos desde los datos crudos, cada
  # camino aplicaria sus propias exclusiones y las letras divergirian.
  df_long <- tibble::tibble(
    categoria = c("Si", "No"),
    N = 400,
    n_1 = c(120, 80),
    n_2 = c(60, 140),
    pct_1 = c(0.6, 0.4),
    pct_2 = c(0.3, 0.7)
  )
  mats <- .graficos_sig_matrices(
    df_long = df_long,
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"),
    group_totals = c(pct_1 = 200, pct_2 = 200),
    cols_porcentaje = c("pct_1", "pct_2")
  )

  expect_equal(dim(mats$n_mat), c(2L, 2L))
  expect_equal(rownames(mats$n_mat), c("Si", "No"))
  expect_equal(colnames(mats$n_mat), c("pct_1", "pct_2"))
  expect_equal(unname(mats$n_mat[, "pct_1"]), c(120, 80))
  expect_equal(unname(mats$N_vec), c(200, 200))
})

test_that("el orden de columnas es el orden en que se dibujan las series", {
  # La letra "B" tiene que senalar a la segunda barra del grafico. Si el motor
  # ordenara por otra cosa, la nota diria "B = Mujeres" y la B marcaria a otro.
  df_long <- tibble::tibble(
    categoria = "Si", N = 300,
    n_a = 10, n_b = 20, n_c = 30,
    pct_a = 0.1, pct_b = 0.2, pct_c = 0.3
  )
  mats <- .graficos_sig_matrices(
    df_long = df_long,
    cols_n = c(pct_c = "n_c", pct_a = "n_a", pct_b = "n_b"),
    group_totals = c(pct_c = 100, pct_a = 100, pct_b = 100),
    cols_porcentaje = c("pct_a", "pct_b", "pct_c")
  )
  expect_equal(colnames(mats$n_mat), c("pct_a", "pct_b", "pct_c"))
  expect_equal(unname(mats$n_mat[1, ]), c(10, 20, 30))
})

test_that("las letras son las mismas que produce el motor de cruces", {
  # No es una reimplementacion: se delega en `comparar_columnas_sig`, la misma
  # funcion que firma las letras del XLSX.
  n_mat <- matrix(
    c(150, 50, 90, 110),
    nrow = 2,
    dimnames = list(c("Si", "No"), c("pct_1", "pct_2"))
  )
  N_vec <- c(pct_1 = 200, pct_2 = 200)

  esperado <- comparar_columnas_sig(n_mat = n_mat, N_vec = N_vec, alpha = 0.05)
  obtenido <- .graficos_sig_calcular(n_mat, N_vec, alpha = 0.05)

  expect_identical(obtenido$letras, esperado$letras)
  expect_null(obtenido$motivo)
})

test_that("una diferencia real produce letra y una diferencia de ruido no", {
  # 75% contra 40% sobre 200 casos por grupo es una diferencia que ninguna
  # correccion apaga; 50,5% contra 49,5% no debe marcarse.
  fuerte <- .graficos_sig_calcular(
    matrix(c(150, 80), nrow = 1, dimnames = list("Si", c("pct_1", "pct_2"))),
    c(pct_1 = 200, pct_2 = 200)
  )
  expect_true(nzchar(trimws(fuerte$letras[1, "pct_1"])))

  ruido <- .graficos_sig_calcular(
    matrix(c(101, 99), nrow = 1, dimnames = list("Si", c("pct_1", "pct_2"))),
    c(pct_1 = 200, pct_2 = 200)
  )
  expect_false(nzchar(trimws(ruido$letras[1, "pct_1"])))
  expect_false(nzchar(trimws(ruido$letras[1, "pct_2"])))
})

test_that("un diseno con repeats se abstiene y explica por que", {
  # Publicar significancia sobre observaciones no independientes es peor que no
  # publicarla: el lector la toma por buena.
  res <- .graficos_sig_calcular(
    matrix(c(150, 80), nrow = 1, dimnames = list("Si", c("pct_1", "pct_2"))),
    c(pct_1 = 200, pct_2 = 200),
    diseno = "cluster"
  )
  expect_null(res$letras)
  expect_match(res$motivo, "repeat")
  expect_match(res$motivo, "no son independientes")
})

test_that("sin dos grupos con base no hay contraste y se dice", {
  res <- .graficos_sig_calcular(
    matrix(c(150, 0), nrow = 1, dimnames = list("Si", c("pct_1", "pct_2"))),
    c(pct_1 = 200, pct_2 = 0)
  )
  expect_null(res$letras)
  expect_match(res$motivo, "base suficiente")
})

test_that("el marcador .a de la tabla no ensucia la barra", {
  # `.a` marca la columna excluida del contraste. En una tabla densa informa;
  # sobre una barra de 0% es ruido, porque el 0% ya se ve.
  letras <- matrix(
    c(" B", ".a"),
    nrow = 1,
    dimnames = list("Si", c("pct_1", "pct_2"))
  )
  sufijos <- .graficos_sig_sufijos(letras)
  expect_equal(nrow(sufijos), 1L)
  expect_equal(sufijos$.col_pct, "pct_1")
  expect_equal(sufijos$.sufijo, " B")
})

test_that("las letras acumuladas se pegan sin espacios internos", {
  # `comparar_columnas_sig` acumula con `paste`, que deja espacios dobles:
  # sobre una barra angosta " B  C" rompe el ancho de la etiqueta.
  letras <- matrix(" B  C", nrow = 1, dimnames = list("Si", "pct_1"))
  sufijos <- .graficos_sig_sufijos(letras)
  expect_equal(sufijos$.sufijo, " BC")
})

test_that("apagada, la opcion deja los argumentos exactamente como estaban", {
  # Stopping rule del scope lock: con la opcion apagada el render no cambia.
  base_args <- list(data = "x", titulo = "T")
  out <- .graficos_sig_aplicar(
    base_args = base_args,
    df_long = tibble::tibble(categoria = "Si", n_1 = 1, n_2 = 2),
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"),
    group_totals = c(pct_1 = 10, pct_2 = 10),
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "A", pct_2 = "B"),
    activo = FALSE
  )
  expect_identical(out, base_args)
  expect_null(out$sufijos_etiqueta)
  expect_null(out$nota_pie_significancia)
})

test_that("encendida, entrega sufijos por celda y la nota con el mapa de letras", {
  out <- .graficos_sig_aplicar(
    base_args = list(titulo = "T"),
    df_long = tibble::tibble(
      categoria = c("Si", "No"),
      n_1 = c(150, 50), n_2 = c(80, 120)
    ),
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"),
    group_totals = c(pct_1 = 200, pct_2 = 200),
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    activo = TRUE
  )

  expect_true(is.data.frame(out$sufijos_etiqueta))
  expect_true(all(c("categoria", ".col_pct", ".sufijo") %in% names(out$sufijos_etiqueta)))
  expect_match(out$nota_pie_significancia, "A = Hombres")
  expect_match(out$nota_pie_significancia, "B = Mujeres")
  expect_match(out$nota_pie_significancia, "Bonferroni")
  expect_identical(out$titulo, "T")
})

test_that("sin ninguna diferencia significativa la nota lo dice, no calla", {
  # Un grafico sin letras y sin nota se lee como "no se probo". Son cosas
  # distintas y el pie tiene que distinguirlas.
  out <- .graficos_sig_aplicar(
    base_args = list(),
    df_long = tibble::tibble(categoria = "Si", n_1 = 101, n_2 = 99),
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"),
    group_totals = c(pct_1 = 200, pct_2 = 200),
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    activo = TRUE
  )
  expect_null(out$sufijos_etiqueta)
  expect_match(out$nota_pie_significancia, "Ninguna diferencia")
})

test_that("la nota cabe en el lienzo: ninguna linea excede el ancho pedido", {
  # El primer render real salio con el texto cortado por los dos lados. El
  # caption del graficador no envuelve, asi que la nota tiene que llegar
  # envuelta o no se lee.
  skip_if_not_installed("stringr")
  nota <- .graficos_sig_nota(
    etiquetas_series = c("Poblacion de acogida", "Poblacion refugiada y migrante"),
    alpha = 0.05,
    ancho = 60
  )
  lineas <- strsplit(nota, "\n", fixed = TRUE)[[1]]
  expect_true(length(lineas) > 1L)
  expect_true(all(nchar(lineas) <= 60L))
})

test_that("el mapa de letras vive en su propia linea", {
  # Es lo que el lector consulta cuando ve una "B", no parte del parrafo.
  skip_if_not_installed("stringr")
  nota <- .graficos_sig_nota(
    etiquetas_series = c("Hombres", "Mujeres"),
    alpha = 0.05
  )
  lineas <- strsplit(nota, "\n", fixed = TRUE)[[1]]
  expect_match(lineas[[length(lineas)]], "^A = Hombres")
  expect_false(grepl("A = Hombres", lineas[[1]]))
})

test_that("un alpha invalido cae al 0,05 y no revienta el mazo", {
  out <- .graficos_sig_aplicar(
    base_args = list(),
    df_long = tibble::tibble(categoria = "Si", n_1 = 150, n_2 = 80),
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"),
    group_totals = c(pct_1 = 200, pct_2 = 200),
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "A", pct_2 = "B"),
    activo = TRUE,
    alpha = "no-es-un-numero"
  )
  expect_match(out$nota_pie_significancia, "alpha = 0.05")
})

test_that("una base hija de repeat se reconoce como diseno cluster", {
  # Es la puerta que impide publicar una z sobre observaciones dependientes.
  expect_identical(
    .graficos_sig_diseno_de_fuente(list(repeat_grain = list(base_name = "servicios"))),
    "cluster"
  )
  expect_identical(
    .graficos_sig_diseno_de_fuente(list(parent_base = "hogar")),
    "cluster"
  )
  inst_attr <- structure(list(), repeat_grain = list(repeat_group = "visitas"))
  expect_identical(.graficos_sig_diseno_de_fuente(inst_attr), "cluster")
})

test_that("una base plana se reconoce como independiente y una ausente como desconocida", {
  expect_identical(
    .graficos_sig_diseno_de_fuente(list(survey = data.frame(name = "p1"))),
    "independiente"
  )
  expect_identical(.graficos_sig_diseno_de_fuente(NULL), "desconocido")
  # Un `repeat_grain` vacio no es una marca de repeat.
  expect_identical(
    .graficos_sig_diseno_de_fuente(list(repeat_grain = list())),
    "independiente"
  )
})

.df_sig_cruce <- function() {
  data.frame(
    categoria = c("Alto", "Bajo"),
    N = c(400, 400),
    pct_1 = c(0.75, 0.25),
    pct_2 = c(0.40, 0.60),
    stringsAsFactors = FALSE
  )
}

test_that("la letra se dibuja pegada a la cifra de su propia barra", {
  skip_if_not_installed("ggplot2")
  sufijos <- data.frame(
    categoria = "Alto",
    .col_pct = "pct_1",
    .sufijo = " B",
    stringsAsFactors = FALSE
  )
  p <- graficar_barras_agrupadas(
    data = .df_sig_cruce(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    sufijos_etiqueta = sufijos,
    exportar = "rplot", usar_canvas = FALSE
  )
  capas <- Filter(function(l) inherits(l$geom, "GeomText"), p$layers)
  etiquetas <- unlist(lapply(capas, function(l) as.character(l$data$lab)))

  expect_true("75% B" %in% etiquetas)
  # Las otras tres celdas no reciben letra.
  expect_true("40%" %in% etiquetas)
  expect_false(any(grepl("^40% ", etiquetas)))
})

test_that("sin sufijos por celda las etiquetas quedan como estaban", {
  skip_if_not_installed("ggplot2")
  base <- graficar_barras_agrupadas(
    data = .df_sig_cruce(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    exportar = "rplot", usar_canvas = FALSE
  )
  con_vacio <- graficar_barras_agrupadas(
    data = .df_sig_cruce(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    sufijos_etiqueta = NULL,
    exportar = "rplot", usar_canvas = FALSE
  )
  lab_de <- function(p) {
    capas <- Filter(function(l) inherits(l$geom, "GeomText"), p$layers)
    sort(unlist(lapply(capas, function(l) as.character(l$data$lab))))
  }
  expect_identical(lab_de(base), lab_de(con_vacio))
})

test_that("un sufijo para una celda inexistente no rompe ni contamina", {
  # El motor puede mandar una categoria que el grafico filtro por exclusion de
  # opciones; eso no puede tumbar el mazo entero.
  skip_if_not_installed("ggplot2")
  sufijos <- data.frame(
    categoria = "Categoria Fantasma",
    .col_pct = "pct_9",
    .sufijo = " Z",
    stringsAsFactors = FALSE
  )
  p <- graficar_barras_agrupadas(
    data = .df_sig_cruce(), var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    sufijos_etiqueta = sufijos,
    exportar = "rplot", usar_canvas = FALSE
  )
  capas <- Filter(function(l) inherits(l$geom, "GeomText"), p$layers)
  etiquetas <- unlist(lapply(capas, function(l) as.character(l$data$lab)))
  expect_false(any(grepl("Z", etiquetas)))
})

test_that("el camino completo va de los conteos del render a la letra dibujada", {
  # Contrato de punta a punta: lo que el motor calcula es lo que la barra dice.
  skip_if_not_installed("ggplot2")
  df <- .df_sig_cruce()
  args <- .graficos_sig_aplicar(
    base_args = list(),
    df_long = tibble::tibble(
      categoria = c("Alto", "Bajo"),
      n_1 = c(300, 100), n_2 = c(160, 240)
    ),
    cols_n = c(pct_1 = "n_1", pct_2 = "n_2"),
    group_totals = c(pct_1 = 400, pct_2 = 400),
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    activo = TRUE
  )
  p <- graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"),
    etiquetas_series = c(pct_1 = "Hombres", pct_2 = "Mujeres"),
    sufijos_etiqueta = args$sufijos_etiqueta,
    exportar = "rplot", usar_canvas = FALSE
  )
  capas <- Filter(function(l) inherits(l$geom, "GeomText"), p$layers)
  etiquetas <- unlist(lapply(capas, function(l) as.character(l$data$lab)))

  # 75% de Hombres contra 40% de Mujeres sobre 400 por grupo: Hombres gana en
  # "Alto" (letra B) y Mujeres gana en "Bajo" (letra A).
  expect_true("75% B" %in% etiquetas)
  expect_true("60% A" %in% etiquetas)
})

test_that("un cruce de una sola serie no inventa un contraste", {
  out <- .graficos_sig_aplicar(
    base_args = list(),
    df_long = tibble::tibble(categoria = "Si", n_1 = 150),
    cols_n = c(pct_1 = "n_1"),
    group_totals = c(pct_1 = 200),
    cols_porcentaje = "pct_1",
    etiquetas_series = c(pct_1 = "Total"),
    activo = TRUE
  )
  expect_null(out$sufijos_etiqueta)
  expect_true(nzchar(out$nota_pie_significancia))
})
