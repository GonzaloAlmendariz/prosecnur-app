source("setup-load-all.R")

# ADR 0128 (D2): la prueba de diseño se implementa en R base y se contrasta contra `survey` (solo en Suggests).
# Fixture sintético: 40 aulas en tres estratos (uno con un solo aula), pesos desiguales, faltantes y un efecto de aula
# fuerte, para que la varianza de diseño se aparte de la de muestreo aleatorio simple.

.fixture_aulas <- function(seed = 1, n = 500, n_aulas = 40) {
  set.seed(seed)
  aula <- sample(sprintf("a%02d", seq_len(n_aulas)), n, replace = TRUE)
  k <- as.integer(sub("a", "", aula))
  estrato <- ifelse(k <= 15, "e1", ifelse(k < n_aulas, "e2", "e3"))
  efecto <- stats::rnorm(n_aulas)[k]
  g <- sample(c("x", "y", "z"), n, replace = TRUE, prob = c(0.4, 0.35, 0.25))
  y <- as.numeric(stats::runif(n) < stats::plogis(-0.3 + efecto + (g == "y") * 0.6))
  y[sample(n, 30)] <- NA
  data.frame(y = y, g = g, aula = aula, estrato = estrato, w = stats::runif(n, 0.5, 2), stringsAsFactors = FALSE)
}

test_that("la diferencia de proporciones bajo diseño coincide con survey (svyby + svycontrast)", {
  skip_if_not_installed("survey")
  d <- .fixture_aulas()
  r <- .sig_contrastes(cbind(Y = d$y), d$g, c("x", "y", "z"), d$aula, d$estrato, d$w, prueba = "rao_scott")

  vieja <- options(survey.lonely.psu = "adjust"); on.exit(options(vieja), add = TRUE)
  d$estrato <- factor(d$estrato)
  des <- survey::svydesign(ids = ~aula, strata = ~estrato, weights = ~w, data = d)
  b <- survey::svyby(~y, ~g, des, survey::svymean, covmat = TRUE, na.rm = TRUE)
  for (k in seq_len(nrow(r$pares))) {
    cc <- stats::setNames(rep(0, 3), c("x", "y", "z")); cc[r$pares$a[k]] <- 1; cc[r$pares$b[k]] <- -1
    s <- survey::svycontrast(b, cc)
    expect_equal(r$pares$dif[k], as.numeric(stats::coef(s)), tolerance = 1e-10)
    expect_equal(r$pares$se[k], as.numeric(survey::SE(s)), tolerance = 1e-10)
    p_survey <- 2 * stats::pt(-abs(stats::coef(s) / survey::SE(s)), df = survey::degf(des))
    expect_equal(r$pares$p[k], as.numeric(p_survey), tolerance = 1e-10)
  }
  expect_equal(r$gl, survey::degf(des))
})

test_that("sin conglomerado, cada caso es su aula: la varianza es la de muestreo aleatorio simple con reemplazo", {
  d <- .fixture_aulas(seed = 2)
  r <- .sig_contrastes(cbind(Y = d$y), d$g, c("x", "y", "z"), cluster = NULL, prueba = "rao_scott")
  ok <- !is.na(d$y)
  for (k in seq_len(nrow(r$pares))) {
    ya <- d$y[ok & d$g == r$pares$a[k]]; yb <- d$y[ok & d$g == r$pares$b[k]]
    n <- nrow(d)   # cada caso es un conglomerado, también los que no están en la base (aportan cero)
    # Con reemplazo y n/(n-1) sobre los aportes: la varianza de razón sin fpc.
    va <- stats::var(ya) * (length(ya) - 1) / length(ya)^2 * n / (n - 1)
    vb <- stats::var(yb) * (length(yb) - 1) / length(yb)^2 * n / (n - 1)
    expect_equal(r$pares$se[k]^2, va + vb, tolerance = 1e-8)
  }
})

test_that("un aula con estudiantes de los dos grupos aporta covarianza (no se asume independencia entre grupos)", {
  d <- .fixture_aulas(seed = 3)
  r <- .sig_contrastes(cbind(Y = d$y), d$g, c("x", "y", "z"), d$aula, prueba = "rao_scott")
  r_sin <- .sig_contrastes(cbind(Y = d$y), d$g, c("x", "y", "z"), cluster = NULL, prueba = "rao_scott")
  # Con efecto de aula fuerte, el deff se aparta de 1.
  expect_true(all(is.finite(r$pares$deff)))
  expect_false(isTRUE(all.equal(r$pares$se, r_sin$pares$se)))
})

test_that("la prueba z reproduce la de las tablas de siempre (comparar_columnas_sig)", {
  n_mat <- matrix(c(150, 50, 90, 110), nrow = 2, dimnames = list(c("Si", "No"), c("A", "B")))
  y <- c(rep(1, 150), rep(0, 50), rep(1, 90), rep(0, 110))
  g <- c(rep("A", 200), rep("B", 200))
  r <- .sig_contrastes(cbind(Si = y), g, c("A", "B"), prueba = "z")
  ppool <- (150 + 90) / 400
  z <- (0.75 - 0.45) / sqrt(ppool * (1 - ppool) * (1 / 200 + 1 / 200))
  expect_equal(r$pares$p, 2 * stats::pnorm(-abs(z)), tolerance = 1e-12)
  expect_equal(comparar_columnas_sig(n_mat, c(A = 200, B = 200))$letras["Si", "A"] |> trimws(), "B")
})
