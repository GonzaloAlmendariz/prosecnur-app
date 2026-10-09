# ADR 0093 — invariantes de la especificación de escala, sin renderizar.
# Las reglas son las del recetario (láminas 19, 20, 21, 216 y 221).

.esc_niveles <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo",
                  t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.esc_df <- function(...) {
  filas <- list(...)
  d <- do.call(rbind, lapply(names(filas), function(k) {
    p <- filas[[k]]; data.frame(item = k, N = sum(p), t1 = p[1], t2 = p[2], t3 = p[3], t4 = p[4], t5 = p[5])
  }))
  d[paste0("t", 1:5)] <- d[paste0("t", 1:5)] / d$N
  d
}
.esc <- function(d, ...) preparar_escala(d, var_categoria = "item", var_n = "N", cols_porcentaje = paste0("t", 1:5),
                                          etiquetas_grupos = .esc_niveles, ...)
.ttb <- function(...) .esc(..., barra_extra_preset = "top2box", top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))

test_that("(1) los anchos son cifra sobre suma de cifras y lo que se rotula 0 % no se dibuja", {
  s <- .esc(.esc_df(A = c(1, 7, 60, 110, 0), B = c(0, 10, 40, 46, 4)))
  expect_equal(unname(rowSums(s$anchos)), c(1, 1))
  u <- s$unidades["A", ]
  expect_equal(unname(s$anchos["A", ]), unname(u / sum(u)))
  expect_false(s$dibujar["A", "t5"]); expect_equal(unname(s$anchos["B", "t1"]), 0)
  expect_identical(s$version, "escala/1")
})

test_that("(2) redondeo estándar y del resto mayor, con el ejemplo de las láminas 20 y 21", {
  d <- .esc_df(A = c(1, 7, 60, 110, 0))   # 1, 7, 60, 110 y 0 casos de 178
  expect_equal(unname(.esc(d)$unidades["A", ]), c(1, 4, 34, 62, 0))                          # suma 101
  expect_equal(unname(.esc(d, metodo_redondeo = "reparto")$unidades["A", ]), c(0, 4, 34, 62, 0))  # suma 100
})

test_that("(3) Top Two Box = suma de las cifras rotuladas (lámina 19), aunque difiera del redondeo de la suma", {
  # 34.5 % + 34.5 %: cada una sube a 35 y la caja dice 70; el redondeo de la suma exacta diría 69.
  d <- .esc_df(A = c(155, 155, 345, 345, 0))
  s <- .ttb(d)
  expect_equal(unname(s$unidades["A", c("t3", "t4")]), c(35, 35))   # 34.5 sube
  expect_equal(unname(s$box$unidades), 70)
  expect_equal(s$box$cifras, "70%")
  expect_identical(s$box$rotulo, "Top Two Box")
})

test_that("(4) un box que cubre la escala o sin declaración se apaga, y nunca suma SIN INF", {
  d <- .esc_df(A = c(1, 7, 60, 110, 0))
  sin <- .esc(d, barra_extra_preset = "top2box")
  expect_null(sin$box$unidades); expect_identical(sin$box$motivo, "sin_declaracion")
  con_sin_inf <- .esc(d, barra_extra_preset = "top2box", top2box_labels = c("Totalmente de acuerdo", "SIN INF"))
  expect_identical(con_sin_inf$box$cols, "t4")
  dos <- data.frame(item = "A", N = 10, t1 = 0.4, t2 = 0.6)
  cubre <- preparar_escala(dos, "item", "N", c("t1", "t2"), c(t1 = "No", t2 = "Sí"),
                           barra_extra_preset = "top2box", top2box_labels = c("No", "Sí"))
  expect_null(cubre$box$unidades)
  expect_true(.esc(d)$categorias$especial[5])
})

test_that("(5) SIN INF es el último segmento y entra en la base", {
  s <- .esc(.esc_df(A = c(4, 10, 40, 42, 4)))
  expect_identical(tail(s$categorias$rotulo, 1), "SIN INF")
  expect_equal(unname(s$unidades["A", "t5"]), 4)
  expect_equal(unname(sum(s$anchos["A", ])), 1)
})

test_that("(6) una batería de un público sale por Top Two Box; con actores o pedido, el orden declarado", {
  d <- .esc_df(A = c(10, 20, 40, 30, 0), B = c(1, 4, 40, 55, 0), C = c(5, 5, 50, 40, 0), D = c(2, 8, 40, 50, 0))
  # Por defecto, el orden declarado (filas que son públicos o niveles no se reordenan); la batería lo pide.
  expect_identical(.ttb(d)$orden$aplicado, 1:4)
  s <- .ttb(d, orden = "auto")
  expect_identical(s$orden$criterio, "top_two_box")
  expect_identical(s$filas$id[s$orden$aplicado], c("B", "C", "D", "A"))   # C y D empatan en 90: queda el declarado
  d$actor <- c("Docentes", "Estudiantes", "Docentes", "Estudiantes")
  con_actores <- .ttb(d, var_grupo_id = "actor", orden = "auto")
  expect_identical(con_actores$orden$criterio, "declarado")
})

test_that("(8) la fila Total pondera por N y va primera aunque se ordene por Top Two Box", {
  d <- .esc_df(A = c(10, 20, 40, 30, 0), B = c(1, 4, 40, 55, 0))
  s <- .ttb(d, fila_total = TRUE, orden = "auto")
  expect_true(s$filas$es_total[1]); expect_identical(s$orden$aplicado[1], 1L)
  esperado <- (d$t4[1] * d$N[1] + d$t4[2] * d$N[2]) / sum(d$N)
  expect_equal(unname(s$unidades[1, "t4"]), floor(100 * esperado + 0.5))   # 42.5 sube (lámina 20), no al par
})

test_that("(9) una fila que suma 0 da anchos 0, no NaN", {
  d <- .esc_df(A = c(1, 1, 1, 1, 0)); d[1, paste0("t", 1:5)] <- 0
  s <- .esc(d)
  expect_true(all(s$anchos == 0)); expect_false(any(is.nan(s$anchos)))
})

test_that("(10) las letras de significancia sólo van donde hay cifra", {
  d <- .esc_df(A = c(0, 10, 40, 50, 0))
  suf <- data.frame(item = c("A", "A"), .col_pct = c("t1", "t3"), .sufijo = c("B", "C"))
  s <- .esc(d, sufijos_etiqueta = suf)
  expect_identical(unname(s$cifras["A", "t3"]), "40% C")
  expect_false(grepl("B", s$cifras["A", "t1"]))
})

test_that("una afirmación con varios actores conserva el orden de los actores; varias premisas de una fila se ordenan", {
  d <- .esc_df(A = c(10, 20, 40, 30, 0), B = c(1, 4, 40, 55, 0), C = c(5, 5, 50, 40, 0))
  d$premisa <- "P1"
  un_bloque <- .ttb(d, var_grupo_id = "premisa", orden = "auto")
  expect_identical(un_bloque$orden$criterio, "declarado")
  expect_identical(un_bloque$orden$aplicado, 1:3)
  d$premisa <- c("P1", "P2", "P3")
  tres <- .ttb(d, var_grupo_id = "premisa", orden = "auto")
  expect_identical(tres$orden$criterio, "top_two_box")
  expect_identical(tres$filas$id[tres$orden$aplicado], c("B", "C", "A"))
})

test_that("los rótulos envueltos para ggplot llegan sin saltos de línea", {
  d <- .esc_df(A = c(10, 20, 40, 30, 0)); d$rotulo <- "Aprendizaje autónomo\ne investigación"
  s <- .esc(d, var_etiqueta_categoria = "rotulo")
  expect_identical(s$filas$rotulo, "Aprendizaje autónomo e investigación")
})

test_that("(8) sin N válido no hay fila Total", {
  d <- .esc_df(A = c(10, 20, 40, 30, 0), B = c(1, 4, 40, 55, 0))
  d$N <- c(0, NA)
  s <- .ttb(d, fila_total = TRUE)
  expect_false(any(s$filas$es_total))
  expect_identical(nrow(s$filas), 2L)
})
