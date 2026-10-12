# Estas pruebas miran orden y forma, no los casos: «Casos junto al porcentaje» en «nunca» (sus fixtures tienen base chica).
withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))

# Orden del Word para las agrupadas de una serie y la dicotomía (N8.7): `.word_grafico` despacha la espec categórica a
# `.word_g_barras` / `.word_g_sino`, que la dibujan de arriba hacia abajo (o de izquierda a derecha). La espec se lee en
# el orden visual del ggplot de la ruta anterior (paridad, con `invertir_barras` TRUE o FALSE), así que el Word también:
# antes salía invertido igual que la lámina nativa (verificador de cfccbc3b3: 17 figuras de acrconta_mazo).

.wo_graf <- function(cats, n, inv, orden = "instrumento") {
  d <- data.frame(cat = cats, n = n, pct = n / sum(n), stringsAsFactors = FALSE)
  suppressMessages(suppressWarnings(graficar_barras_agrupadas(d, var_categoria = "cat", var_n = "n", cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Total"), orden_barras = orden, invertir_barras = inv)))
}
# El ggplot horizontal lista su eje discreto de abajo hacia arriba: se lee al revés.
.wo_lectura_gg <- function(g) rev(ggplot2::ggplot_build(g)$layout$panel_params[[1]]$y$get_labels())
# Rótulos del Word de arriba hacia abajo, cada uno con la cifra de su fila.
.wo_word_barras <- function(g) {
  w <- .word_grafico(g); expect_identical(attr(w, "renderer"), "categorica")
  b <- suppressWarnings(ggplot2::ggplot_build(w))
  cif <- b$data[[2]]; rot <- b$data[[3]]
  rot <- rot[order(-rot$y), ]
  setNames(vapply(rot$y, function(y) as.character(cif$label[which.min(abs(cif$y - y))]), ""), gsub("\n", " ", rot$label))
}

test_that("el Word dibuja la agrupada de una serie en el orden en que se lee el ggplot, con su cifra, invertida o no", {
  cats <- c("Primera", "Segunda", "Tercera", "Cuarta"); n <- c(10, 40, 20, 30)
  for (inv in c(TRUE, FALSE)) {
    g <- .wo_graf(cats, n, inv)
    w <- .wo_word_barras(g)
    expect_identical(names(w), .wo_lectura_gg(g), info = paste("invertir", inv))
    expect_identical(unname(w[cats]), c("10%", "40%", "20%", "30%"), info = paste("invertir", inv))
  }
  # Con la inversión del preset de la casa, el orden del instrumento de arriba hacia abajo.
  expect_identical(names(.wo_word_barras(.wo_graf(cats, n, TRUE))), cats)
  # Mayor a menor con la residual: el Word sigue al ggplot también con «Otros».
  g <- .wo_graf(c("A", "B", "Otros", "C"), c(20, 50, 5, 25), TRUE, orden = "mayor_menor")
  expect_identical(names(.wo_word_barras(g)), c("B", "C", "A", "Otros"))
  expect_identical(unname(.wo_word_barras(g)), c("50%", "25%", "20%", "5%"))
})

test_that("la dicotomía del Word pone a la izquierda la categoría que el ggplot lee primero, con su cifra", {
  for (inv in c(TRUE, FALSE)) {
    g <- .wo_graf(c("Sí", "No"), c(124, 76), inv)
    primero <- .wo_lectura_gg(g)[1]
    w <- .word_grafico(g); expect_identical(attr(w, "renderer"), "categorica")
    a <- suppressWarnings(ggplot2::ggplot_build(w))$data
    textos <- do.call(rbind, lapply(a, function(l) if ("label" %in% names(l)) data.frame(x = l$x, y = l$y, label = as.character(l$label))))
    izq <- textos[textos$x == min(textos$x), ]
    cifra_izq <- izq$label[which.max(izq$y)]; rot_izq <- izq$label[which.min(izq$y)]
    expect_match(rot_izq, paste0("^", primero), info = paste("invertir", inv))
    expect_identical(cifra_izq, if (primero == "Sí") "62%" else "38%", info = paste("invertir", inv))
  }
  expect_match(.wo_lectura_gg(.wo_graf(c("Sí", "No"), c(124, 76), TRUE))[1], "^Sí")      # preset de la casa: Sí a la izquierda
})

test_that("con el preset de la casa el Word manda «Ninguno» y «Ninguna de las anteriores» al final, con su cifra", {
  a <- .build_presets(.enriquecer_presets(list(), NULL))$barras_agrupadas$args
  graf <- function(cats, n, orden) {
    d <- data.frame(cat = cats, n = n, pct = n / sum(n), stringsAsFactors = FALSE)
    args <- utils::modifyList(a[intersect(names(a), names(formals(graficar_barras_agrupadas)))],
                              list(data = d, var_categoria = "cat", var_n = "n", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total"),
                                   orden_barras = orden, usar_canvas = FALSE))
    suppressMessages(suppressWarnings(do.call(graficar_barras_agrupadas, args)))
  }
  w <- .wo_word_barras(graf(c("Uno", "Ninguno", "Dos", "Tres"), c(30, 10, 40, 20), "instrumento"))
  expect_identical(names(w), c("Uno", "Dos", "Tres", "Ninguno"))
  expect_identical(unname(w), c("30%", "40%", "20%", "10%"))
  w2 <- .wo_word_barras(graf(c("Uno", "Dos", "Ninguna de las anteriores", "Tres"), c(30, 10, 45, 15), "mayor_menor"))
  expect_identical(names(w2), c("Uno", "Tres", "Dos", "Ninguna de las anteriores"))
  expect_identical(unname(w2), c("30%", "15%", "10%", "45%"))
})

test_that("contrato de la espec vertical en el Word: hoy va por el marco (no la consume el renderer de categóricas)", {
  cod <- c(`1` = "Siempre", `2` = "A veces", `3` = "Nunca")
  df <- data.frame(q = rep(names(cod), c(30, 25, 45)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "q", type = "select_one lq", list_name = "lq", label = "Frecuencia", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lq", name = names(cod), label = unname(cod), stringsAsFactors = FALSE),
               orders_list = list(q = list(names = names(cod), labels = unname(cod))))
  renderers <- character(0)
  orig <- .word_grafico
  testthat::local_mocked_bindings(.word_grafico = function(g, ...) { w <- orig(g, ...); renderers <<- c(renderers, attr(w, "renderer")); w })
  out <- tempfile(fileext = ".docx")
  suppressMessages(suppressWarnings(reporte_word_plan(data = df, instrumento = inst, path_docx = out, presets_ppt = .build_presets(.enriquecer_presets(list(), NULL)),
    plan = list(a = p_slide_1_grafico(p_barras_agrupadas("q", overrides = list(orientacion = "vertical", usar_canvas = FALSE)), titulo = "Vertical")),
    mensajes_progreso = FALSE)))
  expect_true(file.exists(out))
  expect_identical(unique(renderers), "marco")
})
