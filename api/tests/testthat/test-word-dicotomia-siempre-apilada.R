source("setup-load-all.R")

# N5 (Renzo, informe Arte, 2026-10-22): el Word NUNCA dibuja la dicotomía de cifras grandes; un Sí/No sale siempre como
# barra apilada de 100 % con el % dentro y la leyenda. El PPT no cambia.

.sa_textos <- function(g) { b <- suppressWarnings(ggplot2::ggplot_build(g)); unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label))) }
.sa_tam <- function(g) { b <- suppressWarnings(ggplot2::ggplot_build(g)); max(unlist(lapply(b$data, function(l) if ("label" %in% names(l)) l$size))) }
.sa_espec <- function(p = .55) { e <- preparar_categorica(c("Sí", "No"), c(p, 1 - p), c(sprintf("%d%%", round(p * 100)), sprintf("%d%%", round((1 - p) * 100)))); e$colores <- c(`Sí` = "#081F5C", No = "#CA5651"); e }

test_that("Word: un Sí/No sin estilo sale apilado, sin cifras grandes ni rótulos de público sueltos", {
  g <- .word_grafico(structure(ggplot2::ggplot(), pulso_espec = .sa_espec()))
  expect_lt(.sa_tam(g), 22 * 0.95 / ggplot2::.pt)
  expect_false(any(c("Sí", "No") %in% .sa_textos(g)))
  expect_true(all(c("55%", "45%") %in% .sa_textos(g)))
  expect_gt(attr(g, "alto"), attr(g, "alto_fijo"))                               # N25: alto desde el eje y (grosor común)
  e <- .sa_espec(); e$estilo_dicotomia <- "partida"                      # ni siquiera el estilo «partida» lo trae de vuelta
  expect_lt(.sa_tam(.word_grafico(structure(ggplot2::ggplot(), pulso_espec = e))), 22 * 0.95 / ggplot2::.pt)
  expect_lt(.sa_tam(.word_g_sino(.sa_espec())), 22 * 0.95 / ggplot2::.pt)   # los consumidores de .word_g_sino resuelven
})

test_that("Word: la cifra de un segmento menor al 7 % va encima de la barra; las demás, dentro", {
  g <- .word_g_sino(.sa_espec(.04))
  tx <- do.call(rbind, lapply(suppressWarnings(ggplot2::ggplot_build(g))$data, function(l) if ("label" %in% names(l)) l[, c("x", "y", "label")]))
  expect_gt(tx$y[tx$label == "4%"], 1)
  expect_lt(tx$y[tx$label == "96%"], 1)
})

# N20 (Gonzalo/Renzo, Arte, 2026-10-22): "Gráfico 4 debería ser barras, no dicotómico". La dicotomía es solo para Sí/No (o la
# que el analista declara); cualquier otra variable nominal de 2 categorías sale como barras normales, en PPT y en Word.

test_that("N20: .lam_es_dicotomia es TRUE solo para Sí/No (con o sin tilde) y FALSE para otras nominales de 2 categorías", {
  expect_true(.lam_es_dicotomia(preparar_categorica(c("Sí", "No"), c(.62, .38), c("62%", "38%"))))
  expect_true(.lam_es_dicotomia(preparar_categorica(c("Si", "No"), c(.62, .38), c("62%", "38%"))))
  expect_true(.lam_es_dicotomia(preparar_categorica(c("NO ", "sí"), c(.4, .6), c("40%", "60%"))))
  expect_false(.lam_es_dicotomia(preparar_categorica(c("Tiempo completo", "Tiempo parcial"), c(.21, .79), c("21%", "79%"))))
  expect_false(.lam_es_dicotomia(preparar_categorica(c("Masculino", "Femenino"), c(.45, .55), c("45%", "55%"))))
  expect_false(.lam_es_dicotomia(preparar_categorica(c("Sí", "Quizá"), c(.45, .55), c("45%", "55%"))))
  e <- preparar_categorica(c("Departamento Académico", "Facultad"), c(.3, .7), c("30%", "70%"))
  expect_false(.lam_es_dicotomia(e))
  e$dicotomica_declarada <- TRUE                                   # el analista la declara con p_dicotomica()
  expect_true(.lam_es_dicotomia(e))
  el <- list(overrides = list(dicotomica_declarada = TRUE))
  expect_true(isTRUE(.lam_con_estilo_dicotomia(preparar_categorica(c("A", "B"), c(.3, .7), c("30%", "70%")), el)$dicotomica_declarada))
  df <- data.frame(cat = "p5", n = 100, Tiempo_completo = .21, Tiempo_parcial = .79, Si = .21, No = .79)   # escala de una fila con dos categorías: mismo criterio
  esc <- preparar_escala(df, var_categoria = "cat", var_n = "n", cols_porcentaje = c("Tiempo_completo", "Tiempo_parcial"), etiquetas_grupos = c("Tiempo completo", "Tiempo parcial"))
  expect_false(.lam_es_dicotomia(esc))
  expect_true(.lam_es_dicotomia(preparar_escala(df, var_categoria = "cat", var_n = "n", cols_porcentaje = c("Si", "No"), etiquetas_grupos = c("Sí", "No"))))
})

test_that("N20: .word_categorica dibuja barras normales para dos nominales y la apilada para Sí/No", {
  nom <- preparar_categorica(c("Tiempo completo", "Tiempo parcial"), c(.21, .79), c("21%", "79%"))
  g <- .word_categorica(nom)
  expect_true(!is.null(attr(g, "filas")))                          # estructura de .word_g_barras
  expect_true(all(c("Tiempo completo", "Tiempo parcial") %in% .sa_textos(g)))   # rótulos al costado, no leyenda
  expect_equal(attr(g, "alto"), attr(.word_g_barras(nom), "alto"))
  sn <- .word_categorica(.sa_espec())
  expect_null(attr(sn, "filas"))                                   # la apilada de 100 % no lleva filas
  expect_false(any(c("Sí", "No") %in% .sa_textos(sn)))
})
