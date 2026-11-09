source("setup-load-all.R")

# La z de la tabla de cruces clásica (`comparar_columnas_sig`) tomaba la suma de pesos de cada columna como su n: con
# pesos que no promedian 1 (expansión, o pesos ×100) el p se hundía. Mismo criterio que la revisión del ADR 0138 (P1) en
# `.sig_contrastes`: la base de la z es el peso llevado a media 1 sobre las respuestas válidas con peso positivo de la
# tabla. Contrato: los porcentajes no cambian; sin pesos o con pesos de media 1 las letras son las de siempre; pesos ×100
# dan las mismas letras que ×1.

.rc_base <- function(peso_a = 1, peso_b = 1, escala = 1) {
  # A: 60 casos, 33 marcan «1» (55%); B: 60 casos, 24 marcan «1» (40%). Dos filas con NA en la pregunta (no válidas).
  d <- data.frame(
    grupo = rep(c("A", "B"), each = 60),
    p1 = c(rep("1", 33), rep("2", 27), rep("1", 24), rep("2", 36)),
    stringsAsFactors = FALSE
  )
  d$peso <- ifelse(d$grupo == "A", peso_a, peso_b) * escala
  rbind(d, data.frame(grupo = c("A", "B"), p1 = NA_character_, peso = c(5, 7) * escala))
}

.rc_letras <- function(d, alpha = 0.05, weight_col = "peso") {
  r <- .cruces_sig_comparar(d, "p1", c("1", "2"), c("A", "B"), "grupo", "so", alpha = alpha, weight_col = weight_col)
  trimws(r$letras)
}

# z de las tablas de siempre, a mano: proporción combinada en el error estándar.
.rc_p_a_mano <- function(pa, pb, na, nb) {
  pp <- (pa * na + pb * nb) / (na + nb)
  2 * stats::pnorm(-abs((pa - pb) / sqrt(pp * (1 - pp) * (1 / na + 1 / nb))))
}

test_that("oráculo 2×2 a mano: la base de la z es el peso de media 1, no la suma de pesos", {
  # A pesa 2 y B pesa 1: la media sobre los 120 válidos es 1,5, así que A queda en 4/3 (base 80) y B en 2/3 (base 40).
  d <- .rc_base(peso_a = 2, peso_b = 1)
  nn <- nN_para_sig_simple(d, "p1", c("1", "2"), c("1", "2"), c("A", "B"), "grupo", "so", weight_col = "peso")
  expect_equal(unname(nn$N_vec), c(120, 60))
  nN <- .sig_nN_media_uno(nn$n_mat, nn$N_vec, c(60, 60))
  expect_equal(unname(nN$N_vec), c(80, 40))
  expect_equal(nN$escala, 1 / 1.5)

  p_nuevo <- .rc_p_a_mano(0.55, 0.40, 80, 40)
  p_viejo <- .rc_p_a_mano(0.55, 0.40, 120, 60)
  expect_equal(round(p_nuevo, 4), 0.1213)
  expect_equal(round(p_viejo, 4), 0.0578)
  # α = 0,10 separa las dos lecturas: con la suma de pesos A superaba a B; con la base de media 1, no.
  expect_identical(trimws(comparar_columnas_sig(nn$n_mat, nn$N_vec, alpha = 0.10)$letras["1", "A"]), "B")
  expect_identical(.rc_letras(d, alpha = 0.10)[1, 1], "")
  # Y el p cae entre 0,10 y 0,13, el que da la cuenta a mano (0,1213).
  expect_identical(.rc_letras(d, alpha = 0.13)[1, 1], "B")
})

test_that("pesos ×100 dan las mismas letras que pesos ×1", {
  for (alpha in c(0.05, 0.10, 0.13)) {
    expect_identical(.rc_letras(.rc_base(2, 1, escala = 100), alpha), .rc_letras(.rc_base(2, 1), alpha))
  }
  # Antes, con pesos ×100 la base de cada columna era 6000 y la diferencia de 15 puntos salía significativa.
  expect_identical(.rc_letras(.rc_base(1, 1, escala = 100))[1, 1], "")
  nn100 <- nN_para_sig_simple(.rc_base(1, 1, escala = 100), "p1", c("1", "2"), c("1", "2"), c("A", "B"), "grupo",
                              "so", weight_col = "peso")
  expect_identical(trimws(comparar_columnas_sig(nn100$n_mat, nn100$N_vec)$letras["1", "A"]), "B")
})

test_that("sin pesos o con pesos de media 1, las letras son las de siempre (bit a bit)", {
  d1 <- .rc_base(1, 1)
  sin <- .rc_letras(d1, weight_col = "no_existe")
  viejo <- function(d, wc) {
    nn <- nN_para_sig_simple(d, "p1", c("1", "2"), c("1", "2"), c("A", "B"), "grupo", "so", weight_col = wc)
    trimws(unname(comparar_columnas_sig(nn$n_mat, nn$N_vec)$letras))
  }
  expect_identical(unname(sin), viejo(d1, "no_existe"))
  # Pesos variables de media 1 exacta sobre los válidos: la escala es 1 y los conteos no se tocan.
  d2 <- .rc_base(1.5, 0.5)
  for (alpha in c(0.05, 0.10, 0.20)) {
    expect_identical(unname(.rc_letras(d2, alpha)), {
      nn <- nN_para_sig_simple(d2, "p1", c("1", "2"), c("1", "2"), c("A", "B"), "grupo", "so", weight_col = "peso")
      trimws(unname(comparar_columnas_sig(nn$n_mat, nn$N_vec, alpha = alpha)$letras))
    })
  }
  nn <- nN_para_sig_simple(d2, "p1", c("1", "2"), c("1", "2"), c("A", "B"), "grupo", "so", weight_col = "peso")
  expect_identical(.sig_nN_media_uno(nn$n_mat, nn$N_vec, c(60, 60))$N_vec, nn$N_vec)
})

test_that("los porcentajes no cambian: n/N es el mismo antes y después de llevar el peso a media 1", {
  d <- .rc_base(2, 1, escala = 37)
  nn <- nN_para_sig_simple(d, "p1", c("1", "2"), c("1", "2"), c("A", "B"), "grupo", "so", weight_col = "peso")
  nN <- .sig_nN_media_uno(nn$n_mat, nn$N_vec, c(60, 60))
  expect_equal(sweep(nN$n_mat, 2, nN$N_vec, "/"), sweep(nn$n_mat, 2, nn$N_vec, "/"), tolerance = 1e-14)
  expect_equal(unname(nn$n_mat["1", ] / nn$N_vec), c(0.55, 0.40))
})

test_that("los casos con peso 0 no entran en la media del peso", {
  d <- .rc_base(2, 1)
  d0 <- rbind(d, data.frame(grupo = rep("A", 10), p1 = "1", peso = 0))
  expect_identical(.cruces_sig_casos_peso_positivo(d0, "p1", c("1", "2"), c("A", "B"), "grupo", "so", "peso",
                                                   casos = c(A = 70, B = 60)), c(A = 60, B = 60))
  expect_identical(.rc_letras(d0, alpha = 0.10), .rc_letras(d, alpha = 0.10))
})

test_that("serie por niveles y comparativo armonizado: la misma base cuando traen los casos", {
  n_mat <- matrix(c(66, 24), nrow = 1, dimnames = list("t", c("A", "B")))
  N <- c(A = 120, B = 60)
  a <- .graficos_sig_calcular(n_mat, N, alpha = 0.10, n_casos = c(60, 60))
  b <- .graficos_sig_calcular(n_mat * 100, N * 100, alpha = 0.10, n_casos = c(60, 60))
  expect_identical(trimws(a$letras), trimws(b$letras))
  expect_identical(trimws(a$letras["t", "A"]), "")
  # Sin casos (agrupadas sin microdatos) la base es la que se dibuja: la de siempre.
  expect_identical(trimws(.graficos_sig_calcular(n_mat, N, alpha = 0.10)$letras["t", "A"]), "B")

  nm <- matrix(c(66, 54, 24, 36), nrow = 2, dimnames = list(c("1", "2"), c("A", "B")))
  expect_identical(.armz_letras(nm, N, 0.10, casos = c(60L, 60L)), .armz_letras(nm * 100, N * 100, 0.10, casos = c(60L, 60L)))
  expect_identical(.armz_letras(nm, N, 0.10, casos = c(60L, 60L))["1", "A"], "")
})
