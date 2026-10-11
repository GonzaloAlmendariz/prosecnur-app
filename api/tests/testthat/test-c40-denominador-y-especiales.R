# C40 (docs/qa/revision-c40-args-sin-control-f6-2026-10-11.md): dos defectos del motor que bloquean asignar argumentos
# de gráfico en Láminas.
#
# D1 (denominador). En radar/tabla, `top_n` y `sm_omit_codes` recortan los códigos ANTES de calcular el denominador:
#   `.radar_build_sm()` pasa los códigos ya recortados a `denominador_validos(codes = codes_row)`, que sólo cuenta a
#   quien eligió alguno de ESOS códigos. El % de las categorías que se conservan se infla. Lo correcto es lo que hace el
#   lollipop (`graficador_lollipop.R`): recortar filas DESPUÉS de calcular la cifra.
#
# D2 (90-99). Invariante dominio-prosecnur §5 / nucleo-metodologico regla 3: los códigos 90-99 no se borran de los datos
#   y sólo se muestran si están presentes. `.tab_freq` pide `freq_table_spss(mostrar_todo = TRUE)` sin
#   `codigos_solo_si_presentes`, así que con `mostrar_ceros` encendido reaparecen 98/99 ausentes al 0 %; Word lo enciende
#   por defecto y PPT no. En escala, `preparar_escala(mostrar_categorias_en_cero = TRUE)` dibuja también las columnas
#   `especial` en cero.
#
# Datos sintéticos, sin cliente, sin red ni reloj.

# ---- D1: denominador intacto con top_n / sm_omit_codes ------------------------------------------------------------

# Multirespuesta compacta de 10 personas y 5 opciones. Quien eligió sólo d o e (personas 4, 5, 6 y 8) también es base.
.c40_sm <- function() {
  cods <- c("a", "b", "c", "d", "e"); labs <- c("A", "B", "C", "D", "E")
  list(
    data = data.frame(
      m = c("a b", "a", "b c", "d", "e", "e", "a c", "d e", "c", "b"),
      g = rep(c("g1", "g2"), each = 5),
      peso = 1, stringsAsFactors = FALSE
    ),
    survey = data.frame(name = c("m", "g"), type = c("select_multiple l_m", "select_one l_g"),
                        label = c("Pregunta M", "Grupo"), stringsAsFactors = FALSE),
    orders_list = list(
      m = list(names = cods, labels = labs),
      g = list(names = c("g1", "g2"), labels = c("Grupo 1", "Grupo 2"))
    )
  )
}

.c40_radar <- function(f, ...) {
  d <- .radar_build_sm("m", data = f$data, survey = f$survey, orders_list = f$orders_list, ...)
  stats::setNames(as.numeric(d$valor), paste(d$grupo, d$eje, sep = "|"))
}

test_that("D1 radar SM: top_n < categorías no cambia el % de las categorías que se conservan", {
  f <- .c40_sm()
  completo <- .c40_radar(f)
  # Sin recorte: base = 10 personas; A, B, C y E las eligen 3, D la eligen 2.
  expect_equal(unname(completo[c("Total|A", "Total|B", "Total|C", "Total|E")]), rep(0.3, 4))
  expect_equal(unname(completo["Total|D"]), 0.2)

  recortado <- .c40_radar(f, top_n = 3)
  expect_length(recortado, 3L)
  # Las conservadas valen lo mismo que sin top_n: la base sigue siendo 10, no los 6 que eligieron A, B o C.
  expect_equal(recortado, completo[names(recortado)])
})

test_that("D1 radar SM: sm_omit_codes no saca de la base a quien sólo eligió lo omitido", {
  f <- .c40_sm()
  completo <- .c40_radar(f)
  omitido <- .c40_radar(f, sm_omit_codes = c("d", "e"))
  expect_setequal(sub("^Total\\|", "", names(omitido)), c("A", "B", "C"))
  expect_equal(omitido, completo[names(omitido)])
})

test_that("D1 radar SM con cruce: top_n conserva el denominador de cada grupo", {
  f <- .c40_sm()
  completo <- .c40_radar(f, cruce = "g")
  recortado <- .c40_radar(f, cruce = "g", top_n = 3)
  expect_true(all(names(recortado) %in% names(completo)))
  # Grupo 1 (personas 1-5): A=2/5, B=2/5, C=1/5; sin d/e la base caería a 3.
  expect_equal(recortado, completo[names(recortado)])
})

test_that("D1 radar SO: top_n tampoco cambia la base de una pregunta de opción única", {
  cods <- c("1", "2", "3", "4")
  f <- list(
    data = data.frame(m = rep(cods, c(4, 3, 2, 1)), peso = 1, stringsAsFactors = FALSE),
    survey = data.frame(name = "m", type = "select_one l_s", label = "Pregunta S", stringsAsFactors = FALSE),
    orders_list = list(m = list(names = cods, labels = c("Uno", "Dos", "Tres", "Cuatro")))
  )
  completo <- .c40_radar(f)
  expect_equal(unname(completo), c(0.4, 0.3, 0.2, 0.1))
  recortado <- .c40_radar(f, top_n = 2)
  expect_length(recortado, 2L)
  expect_equal(recortado, completo[names(recortado)])
})

test_that("D1 guarda: top_n >= categorías es no-op", {
  f <- .c40_sm()
  expect_equal(.c40_radar(f, top_n = 5), .c40_radar(f))
  expect_equal(.c40_radar(f, top_n = 9), .c40_radar(f))
})

# ---- D2: 98/99 ausentes no resucitan al 0 % (barras, PPT y Word) --------------------------------------------------

# Opción única con 5 códigos: 1 y 2 presentes, 3 sustantivo sin casos, 98 y 99 especiales ausentes.
.c40_so <- function() {
  cods <- c("1", "2", "3", "98", "99")
  labs <- c("Sí", "No", "A veces", "No sabe", "No responde")
  list(
    data = data.frame(q = rep(c("1", "2"), c(6, 4)), stringsAsFactors = FALSE),
    instrumento = list(
      survey = data.frame(name = "q", type = "select_one l_q", label = "Pregunta Q", stringsAsFactors = FALSE),
      choices = data.frame(list_name = "l_q", name = cods, label = labs, stringsAsFactors = FALSE),
      orders_list = list(q = list(names = cods, labels = labs, label = "Pregunta Q"))
    )
  )
}

# Textos de las capas del lienzo de barras: rótulos de categoría (y la base). Mismo extractor que
# test-engine-plan-ppt-var-cruce.R.
.c40_textos <- function(p) {
  unique(unlist(lapply(p$layers, function(layer) {
    if (is.data.frame(layer$data) && "text" %in% names(layer$data)) as.character(layer$data$text) else character(0)
  })))
}

# Renderiza el plan por el camino real: `rendered` es la lámina PPT; `render_meta[[1]]$plot_word` la figura que
# `reporte_word_plan()` recibe (mismo elemento con `.word_render = TRUE`).
.c40_render <- function(mostrar_ceros = NULL) {
  f <- .c40_so()
  plan <- list(d1 = p_slide_1_grafico(grafico = p_barras_agrupadas("q", mostrar_ceros = mostrar_ceros)))
  res <- suppressWarnings(suppressMessages(reporte_ppt_plan(
    data = f$data, instrumento = f$instrumento, plan = plan,
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE
  )))
  list(ppt = .c40_textos(res$rendered[[1]]), word = .c40_textos(res$render_meta[[1]]$plot_word))
}

.C40_ESPECIALES <- c("No sabe", "No responde")

test_that("D2 PPT: con mostrar_ceros = TRUE el sustantivo en cero aparece y los 98/99 ausentes no", {
  r <- .c40_render(TRUE)
  expect_true(all(c("Sí", "No", "A veces") %in% r$ppt))
  expect_false(any(.C40_ESPECIALES %in% r$ppt))
})

test_that("D2 Word: con mostrar_ceros = TRUE el sustantivo en cero aparece y los 98/99 ausentes no", {
  r <- .c40_render(TRUE)
  expect_true(all(c("Sí", "No", "A veces") %in% r$word))
  expect_false(any(.C40_ESPECIALES %in% r$word))
})

test_that("D2 guarda: con mostrar_ceros = FALSE ningún cero aparece y PPT y Word coinciden", {
  r <- .c40_render(FALSE)
  expect_false(any(c("A veces", .C40_ESPECIALES) %in% r$ppt))
  expect_setequal(r$word, r$ppt)
})

test_that("D2 default: PPT y Word dibujan el mismo conjunto de categorías y ninguno resucita 98/99", {
  r <- .c40_render(NULL)
  expect_false(any(.C40_ESPECIALES %in% r$word))
  expect_setequal(r$word, r$ppt)
})

test_that("D2 guarda: un 98 PRESENTE en los datos se sigue mostrando con mostrar_ceros = TRUE", {
  f <- .c40_so()
  f$data$q[10] <- "98"
  plan <- list(d1 = p_slide_1_grafico(grafico = p_barras_agrupadas("q", mostrar_ceros = TRUE)))
  res <- suppressWarnings(suppressMessages(reporte_ppt_plan(
    data = f$data, instrumento = f$instrumento, plan = plan,
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE
  )))
  ppt <- .c40_textos(res$rendered[[1]])
  expect_true("No sabe" %in% ppt)
  expect_false("No responde" %in% ppt)
})

# ---- D2 en escala: `especial` en cero no se dibuja con mostrar_categorias_en_cero --------------------------------

.c40_escala <- function(mostrar_categorias_en_cero) {
  tab <- data.frame(
    cat = c("p1", "p2"), lab = c("Afirmación 1", "Afirmación 2"), n = c(10, 10),
    pct_1 = c(.5, .4), pct_2 = c(.4, .6), pct_3 = c(0, 0), pct_98 = c(.1, 0), pct_99 = c(0, 0),
    stringsAsFactors = FALSE
  )
  eg <- c(pct_1 = "De acuerdo", pct_2 = "En desacuerdo", pct_3 = "Neutral",
          pct_98 = "No sabe (98)", pct_99 = "No responde (99)")
  preparar_escala(tab, var_categoria = "cat", var_etiqueta_categoria = "lab", var_n = "n",
                  cols_porcentaje = names(eg), etiquetas_grupos = eg,
                  mostrar_categorias_en_cero = mostrar_categorias_en_cero)
}

test_that("D2 escala: con categorías en cero, el sustantivo en cero se dibuja y el 99 ausente no", {
  e <- .c40_escala(TRUE)
  expect_identical(e$categorias$especial, c(FALSE, FALSE, FALSE, TRUE, TRUE))
  # Sustantivo sin casos: se dibuja con el piso en ambas filas.
  expect_true(all(e$dibujar[, "pct_3"]))
  # 99 ausente en toda la batería: ni se dibuja ni ocupa ancho.
  expect_false(any(e$dibujar[, "pct_99"]))
  expect_equal(unname(e$anchos[, "pct_99"]), c(0, 0))
  # 98 presente en p1: se sigue dibujando.
  expect_true(e$dibujar["p1", "pct_98"])
})

test_that("D2 escala guarda: sin categorías en cero, nada en cero se dibuja", {
  e <- .c40_escala(FALSE)
  expect_false(any(e$dibujar[, c("pct_3", "pct_99")]))
  expect_true(e$dibujar["p1", "pct_98"])
})
