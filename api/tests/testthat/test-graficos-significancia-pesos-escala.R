source("setup-load-all.R")

# La z toma la base de cada grupo de los pesos llevados a media 1 (revisión metodológica del ADR 0138, P1). Antes tomaba
# la suma de pesos como n: con pesos de expansión o pesos ×100 el p se hundía (5.9e-130 en la sonda de la revisión).
# Contrato: escalar los pesos de una base no mueve ningún p, ni entre públicos ni en una base; la proporción y Rao-Scott
# quedan como estaban.

.pe_base <- function(n, ttb, seed, aula = FALSE) {
  set.seed(seed)
  y <- stats::rbinom(n, 1, ttb)
  d <- data.frame(p1 = ifelse(y == 1, sample(c("3", "4"), n, TRUE), sample(c("1", "2"), n, TRUE)),
                  peso = round(stats::runif(n, 0.4, 2.5), 3), stringsAsFactors = FALSE)
  d$p1[sample(n, 3)] <- NA
  if (aula) d$aula <- sample(sprintf("a%02d", 1:15), n, TRUE)
  d
}
.pe_inst <- function() list(
  survey = data.frame(name = "p1", type = "select_one lk", label = "Los propósitos son claros", stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
.pe_src <- function(escala_adm = 1) {
  ds <- list(docentes = .pe_base(120, .55, 11, aula = TRUE), estudiantes = .pe_base(300, .45, 12, aula = TRUE),
             administrativos = .pe_base(60, .75, 13))
  ds$administrativos$peso <- ds$administrativos$peso * escala_adm
  list(data_sources = ds, inst_sources = list(docentes = .pe_inst(), estudiantes = .pe_inst(), administrativos = .pe_inst()))
}
.pe_regla <- function(prueba) {
  r <- .sig_regla_fabrica(); r$prueba <- prueba; r$correccion <- "bonferroni_fila"; r$conglomerado <- "aula"; r
}
.pe_tema <- function(src, prueba) {
  .tpub_evaluar_tema("t", c(docentes = "p1", estudiantes = "p1", administrativos = "p1"), "3,4", src, .pe_regla(prueba))
}

test_that("entre públicos: escalar los pesos de una base no mueve ningún p de la z ni la proporción", {
  a <- .pe_tema(.pe_src(1), "z")
  b <- .pe_tema(.pe_src(100), "z")
  expect_equal(nrow(a$ev$pares), 3L)
  expect_equal(b$ev$pares$p, a$ev$pares$p, tolerance = 1e-10)
  expect_equal(b$ev$celdas$p, a$ev$celdas$p, tolerance = 1e-12)
  # La base de la z es el n de respuestas válidas de cada público: la z coincide con la de pesos de media 1 a mano.
  src <- .pe_src(1)
  w1 <- lapply(src$data_sources, function(d) { ok <- !is.na(d$p1); d$peso[ok] / mean(d$peso[ok]) })
  y <- lapply(src$data_sources, function(d) as.numeric(d$p1[!is.na(d$p1)] %in% c("3", "4")))
  pr <- a$ev$pares[1, ]
  pa <- sum(w1[[pr$a]] * y[[pr$a]]) / length(y[[pr$a]]); pb <- sum(w1[[pr$b]] * y[[pr$b]]) / length(y[[pr$b]])
  na <- length(y[[pr$a]]); nb <- length(y[[pr$b]])
  pp <- (pa * na + pb * nb) / (na + nb)
  expect_equal(pr$p, 2 * stats::pnorm(-abs((pa - pb) / sqrt(pp * (1 - pp) * (1 / na + 1 / nb)))), tolerance = 1e-10)
})

test_that("entre públicos: Rao-Scott no cambia con la escala de los pesos", {
  a <- .pe_tema(.pe_src(1), "rao_scott")
  b <- .pe_tema(.pe_src(100), "rao_scott")
  expect_equal(b$ev$pares$p, a$ev$pares$p, tolerance = 1e-10)
  expect_equal(b$ev$pares$se, a$ev$pares$se, tolerance = 1e-12)
})

test_that("una base (ADR 0129): escalar todos los pesos no mueve ningún p, por pares ni frente al resto", {
  set.seed(129)
  n <- 400
  g <- sample(c("1", "2", "3"), n, TRUE)
  y <- stats::rbinom(n, 1, c(`1` = .6, `2` = .45, `3` = .5)[g])
  w <- stats::runif(n, 0.4, 2.5)
  ind <- function(w) list(Y = matrix(y, ncol = 1L, dimnames = list(NULL, "Si")), w = w, tipo = "so")
  r <- .sig_regla_fabrica(); r$prueba <- "z"; r$conglomerado <- NULL
  for (ml in c(6L, 1L)) {
    r$max_letras <- ml
    e1 <- .sig_evaluar(ind(w), g, c("1", "2", "3"), regla = r, filas = "Si")
    e2 <- .sig_evaluar(ind(w * 250), g, c("1", "2", "3"), regla = r, filas = "Si")
    expect_true(nrow(e1$pares) >= 3L)
    expect_equal(e2$pares$p, e1$pares$p, tolerance = 1e-10)
    expect_equal(e2$celdas$p, e1$celdas$p, tolerance = 1e-12)
  }
  # Sin pesos (todos 1) la z es la de siempre: la normalización no la toca.
  z1 <- .sig_contrastes(cbind(Si = y), g, c("1", "2", "3"), prueba = "z")
  z0 <- .sig_contrastes(cbind(Si = y), g, c("1", "2", "3"), w = rep(3, n), prueba = "z")
  expect_equal(z0$pares$p, z1$pares$p, tolerance = 1e-12)
})

test_that("pesos de media 1: por unidad, sólo entre los casos que entran, cero fuera", {
  w <- c(2, 4, 6, 10, 30, 0, 5)
  dentro <- c(TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE)
  u <- c("a", "a", "a", "b", "b", "b", "b")
  x <- .sig_pesos_media_uno(w, dentro, u)
  expect_equal(x, c(0.5, 1, 1.5, 0.5, 1.5, 0, 0))
  expect_equal(.sig_pesos_media_uno(w, dentro), c(w[1:5] / mean(w[1:5]), 0, 0))
})
