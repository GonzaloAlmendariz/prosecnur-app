# Sorteo de Muestra general (ADR 0090): reproducibilidad, π publicada,
# reservas y validación del marco. El Monte Carlo del final comprueba que la π
# declarada es la frecuencia real de inclusión, que es lo único que hace
# válido el peso 1/π.

.marco_sorteo <- function(N = 500L, estratos = c("A", "B", "C"), semilla = 11L) {
  set.seed(semilla)
  data.frame(
    codigo = sprintf("U%05d", sample.int(99999L, N)),
    zona = sample(estratos, N, replace = TRUE, prob = c(.5, .3, .2)[seq_along(estratos)]),
    tamano = round(stats::rlnorm(N, 3, 0.8)) + 1,
    stringsAsFactors = FALSE
  )
}
.cols <- list(id = "codigo", estrato = "zona", tamano = "tamano")

test_that("misma semilla y mismo marco dan el mismo listado; el orden del archivo no importa", {
  m <- .marco_sorteo()
  a <- calc_muestra_general_sortear(m, .cols, "mas", n = 60L, semilla = 7L, reservas_por_estrato = 3L)
  b <- calc_muestra_general_sortear(m[sample(nrow(m)), ], .cols, "mas", n = 60L, semilla = 7L, reservas_por_estrato = 3L)
  expect_identical(a$unidades, b$unidades)
  expect_identical(a$corrida$marco_hash, b$corrida$marco_hash)
  expect_identical(a$corrida$run_id, b$corrida$run_id)
  c <- calc_muestra_general_sortear(m, .cols, "mas", n = 60L, semilla = 8L, reservas_por_estrato = 3L)
  expect_false(identical(sort(a$unidades$id), sort(c$unidades$id)))
})

test_that("la muestra de un estrato no depende de qué otros estratos haya", {
  m <- .marco_sorteo()
  todo <- calc_muestra_general_sortear(m, .cols, "mas", n = 60L, semilla = 7L)
  n_a <- todo$estratos$n_h[todo$estratos$clave == "A"]
  solo_a <- calc_muestra_general_sortear(m[m$zona == "A", ], .cols, "mas", n = n_a, semilla = 7L)
  expect_identical(sort(todo$unidades$id[todo$unidades$estrato == "A"]), sort(solo_a$unidades$id))
})

test_that("sortear no toca el RNG global ni su RNGkind", {
  m <- .marco_sorteo()  # el fixture siembra su propio RNG: se arma antes
  set.seed(123); antes <- .Random.seed; kind <- RNGkind()
  calc_muestra_general_sortear(m, .cols, "sistematico", n = 40L, semilla = 5L)
  expect_identical(.Random.seed, antes)
  expect_identical(RNGkind(), kind)
})

test_that("MAS y estratificado: n_h exacto por estrato, π = n_h/N_h y peso 1/π", {
  r <- calc_muestra_general_sortear(.marco_sorteo(), .cols, "mas", n = 75L, semilla = 3L)
  tit <- r$unidades[r$unidades$estado == "titular", ]
  expect_identical(nrow(tit), 75L)
  expect_identical(sum(r$estratos$n_h), 75L)
  for (k in r$estratos$clave) {
    e <- r$estratos[r$estratos$clave == k, ]
    u <- tit[tit$estrato == k, ]
    expect_identical(nrow(u), e$n_h)
    expect_equal(unique(u$pi), e$n_h / e$N_h)
    expect_equal(unique(u$peso_base), e$N_h / e$n_h)
  }
  # Σ pesos de los titulares reconstruye N: es la propiedad de Horvitz–Thompson.
  expect_equal(sum(tit$peso_base), 500)
})

test_that("sistemático con N/n fraccional da exactamente n y respeta el orden declarado", {
  m <- .marco_sorteo(N = 1000L, estratos = "A")
  r <- calc_muestra_general_sortear(m, list(id = "codigo"), "sistematico", n = 300L, semilla = 9L)
  expect_identical(r$corrida$n_titulares, 300L)
  expect_true(r$estratos$arranque > 0 && r$estratos$arranque <= 1000 / 300)
  r2 <- calc_muestra_general_sortear(m, list(id = "codigo"), "sistematico", n = 7L, semilla = 9L,
                                     orden_por = "tamano")
  expect_identical(r2$corrida$n_titulares, 7L)
})

test_that("PPS: π es la de las probabilidades de inclusión con certezas y las certezas siempre entran", {
  m <- .marco_sorteo(N = 200L, estratos = "A")
  m$tamano[1:3] <- 5000  # tres unidades gigantes: certezas
  r <- calc_muestra_general_sortear(m, list(id = "codigo", tamano = "tamano"), "pps", n = 20L, semilla = 4L)
  tit <- r$unidades[r$unidades$estado == "titular", ]
  expect_identical(nrow(tit), 20L)
  expect_true(all(m$codigo[1:3] %in% tit$id))
  expect_equal(tit$pi[match(m$codigo[1:3], tit$id)], c(1, 1, 1))
  orden <- order(m$codigo, method = "radix")
  pik <- .cm_aulas_inclusion_probabilities(m$tamano[orden], 20L)
  expect_equal(tit$pi, pik[match(tit$id, m$codigo[orden])])
})

test_that("reservas: disjuntas de los titulares, del mismo estrato, sin π propia; en PPS no se ofrecen", {
  r <- calc_muestra_general_sortear(.marco_sorteo(), .cols, "mas", n = 60L, semilla = 2L, reservas_por_estrato = 5L)
  tit <- r$unidades[r$unidades$estado == "titular", ]
  res <- r$unidades[r$unidades$estado == "reserva", ]
  expect_identical(nrow(res), 15L)
  expect_length(intersect(tit$id, res$id), 0L)
  expect_true(all(is.na(res$pi)))
  expect_identical(sort(unique(res$lote_reserva)), 1:5)
  p <- calc_muestra_general_sortear(.marco_sorteo(), .cols, "pps", n = 30L, semilla = 2L, reservas_por_estrato = 5L)
  expect_identical(p$corrida$n_reservas, 0L)
  expect_true(p$corrida$reservas_omitidas_pps)
})

test_that("el marco se valida con E_CALC_MUESTRA_GENERAL_MARCO", {
  m <- .marco_sorteo(N = 20L)
  dup <- m; dup$codigo[2] <- dup$codigo[1]
  e1 <- tryCatch(calc_muestra_general_sortear(dup, .cols, "mas", n = 5L), api_error = function(e) e)
  expect_identical(e1$code, "E_CALC_MUESTRA_GENERAL_MARCO")
  expect_match(e1$message, "se repiten")
  vac <- m; vac$codigo[3] <- ""
  e2 <- tryCatch(calc_muestra_general_sortear(vac, .cols, "mas", n = 5L), api_error = function(e) e)
  expect_identical(e2$code, "E_CALC_MUESTRA_GENERAL_MARCO")
  e3 <- tryCatch(calc_muestra_general_sortear(m, list(id = "codigo"), "pps", n = 5L), api_error = function(e) e)
  expect_match(e3$message, "tamaño")
  e4 <- tryCatch(calc_muestra_general_sortear(m, .cols, "mas", n = 0L), api_error = function(e) e)
  expect_identical(e4$code, "E_CALC_MUESTRA_GENERAL_N")
})

test_that("n mayor que el marco es un censo; el orden del listado es estable", {
  m <- .marco_sorteo(N = 30L)
  r <- calc_muestra_general_sortear(m, .cols, "mas", n = 100L, semilla = 1L)
  expect_identical(r$corrida$n_titulares, 30L)
  expect_true(all(r$unidades$pi == 1))
})

test_that("Monte Carlo: la frecuencia de inclusión converge a la π declarada (MAS, sistemático, PPS)", {
  m <- .marco_sorteo(N = 60L, estratos = c("A", "B"), semilla = 21L)
  R <- 2000L
  for (metodo in c("mas", "sistematico", "pps")) {
    conteo <- setNames(numeric(nrow(m)), m$codigo)
    pi_decl <- NULL
    for (s in seq_len(R)) {
      r <- calc_muestra_general_sortear(m, .cols, metodo, n = 15L, semilla = s)
      tit <- r$unidades[r$unidades$estado == "titular", ]
      conteo[tit$id] <- conteo[tit$id] + 1
      if (is.null(pi_decl)) pi_decl <- setNames(numeric(nrow(m)), m$codigo)
      pi_decl[tit$id] <- tit$pi
    }
    # La π de toda unidad es fija entre corridas; se toma la de la unidad cuando salió.
    freq <- conteo / R
    sd <- sqrt(pi_decl * (1 - pi_decl) / R)
    z <- ifelse(sd > 0, abs(freq - pi_decl) / sd, 0)
    expect_true(max(z[pi_decl > 0]) < 4.5, info = sprintf("%s max z = %.2f", metodo, max(z)))
  }
})

test_that("la tabla por estrato publica la π de CADA estrato (no la del primero reciclada)", {
  r <- calc_muestra_general_sortear(.marco_sorteo(N = 999L), .cols, "mas", n = 143L, semilla = 1L)
  expect_equal(r$estratos$pi, r$estratos$n_h / r$estratos$N_h)
  expect_gt(length(unique(round(r$estratos$pi, 12))), 1L)
  p <- calc_muestra_general_sortear(.marco_sorteo(N = 999L), .cols, "pps", n = 60L, semilla = 1L)
  expect_true(all(is.na(p$estratos$pi)))
})
