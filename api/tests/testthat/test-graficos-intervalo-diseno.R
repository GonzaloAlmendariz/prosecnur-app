source("setup-load-all.R")

# Intervalo de 95% de una proporción bajo el diseño por conglomerados (especificación CCSS del 2026-11-04, §2): la
# linealización en R base coincide con `survey` (svymean sobre el dominio de la base, t con degf), el muestreo aleatorio
# simple es el caso de un caso por conglomerado, y una suma de filas lleva el intervalo de la suma.

.iv_base <- function(seed = 41) {
  set.seed(seed)
  aula <- rep(sprintf("a%02d", 1:30), times = sample(6:14, 30, replace = TRUE))
  efecto <- stats::setNames(stats::rnorm(30, 0, 0.9), sprintf("a%02d", 1:30))
  p <- stats::plogis(-0.4 + efecto[aula])
  y <- as.numeric(stats::runif(length(aula)) < p)
  y[sample(length(y), 25)] <- NA   # fuera de la base de la cifra
  data.frame(aula = aula, y = y, stringsAsFactors = FALSE)
}

test_that("con conglomerados coincide con survey: proporción, error estándar, grados de libertad e intervalo", {
  skip_if_not_installed("survey")
  d <- .iv_base()
  iv <- .intervalo_diseno(d$y, cluster = d$aula)
  des <- survey::svydesign(ids = ~aula, weights = ~w, data = transform(d, w = 1))
  sub <- subset(des, !is.na(y))
  r <- survey::svymean(~y, sub)
  expect_equal(iv$p, as.numeric(stats::coef(r)), tolerance = 1e-10)
  expect_equal(iv$ee, as.numeric(survey::SE(r)), tolerance = 1e-10)
  expect_identical(iv$gl, as.integer(survey::degf(sub)))
  ci <- stats::confint(r, df = survey::degf(sub))
  expect_equal(c(iv$inferior, iv$superior), pmin(1, pmax(0, as.numeric(ci))), tolerance = 1e-10)
  expect_identical(iv$n, sum(!is.na(d$y)))
})

test_that("sin conglomerado es muestreo aleatorio simple: ee = sqrt(p(1 - p) / (n - 1)) y t con n - 1 grados", {
  y <- c(rep(1, 30), rep(0, 70))   # sin casos fuera de la base: con ellos el factor C / (C - 1) cuenta sus conglomerados vacíos, como survey
  iv <- .intervalo_diseno(y)
  expect_equal(iv$p, 0.3)
  expect_equal(iv$ee, sqrt(0.3 * 0.7 / 99), tolerance = 1e-12)
  expect_identical(iv$gl, 99L)
  expect_identical(iv$metodo, "aleatorio_simple")
  expect_equal(iv$superior - iv$p, stats::qt(0.975, 99) * iv$ee, tolerance = 1e-12)
})

test_that("el intervalo se recorta a [0, 1] y una cifra sin base no tiene intervalo", {
  y <- c(1, rep(0, 39))
  iv <- .intervalo_diseno(y)
  expect_identical(iv$inferior, 0)
  expect_gt(iv$superior, iv$p)
  vacio <- .intervalo_diseno(c(NA, NA, NA))
  expect_true(is.na(vacio$p) && is.na(vacio$inferior))
  expect_identical(.intervalo_texto(vacio), "")
  expect_identical(.intervalo_texto(list(inferior = 0.287, superior = 0.414)), "29% a 41%")
})

test_that("una suma de filas lleva el intervalo de la suma, no la suma de los intervalos", {
  d <- .iv_base(7)
  set.seed(3)
  a <- ifelse(is.na(d$y), NA, as.numeric(stats::runif(nrow(d)) < 0.3))
  b <- ifelse(is.na(d$y), NA, as.numeric(!a & stats::runif(nrow(d)) < 0.4))
  suma <- ifelse(is.na(a), NA, as.numeric(a == 1 | b == 1))
  ia <- .intervalo_diseno(a, d$aula); ib <- .intervalo_diseno(b, d$aula); is <- .intervalo_diseno(suma, d$aula)
  expect_equal(is$p, ia$p + ib$p, tolerance = 1e-12)
  expect_lt(is$superior - is$inferior, (ia$superior - ia$inferior) + (ib$superior - ib$inferior))
})

test_that("la fuente toma el conglomerado y el estrato de la regla del estudio", {
  d <- .iv_base(11)
  regla <- list(conglomerado = "aula", estrato = NULL)
  iv <- .intervalo_diseno_fuente(list(data = d), d$y, regla)
  expect_identical(iv$metodo, "conglomerados")
  expect_equal(iv$ee, .intervalo_diseno(d$y, d$aula)$ee)
  iv0 <- .intervalo_diseno_fuente(list(data = d), d$y, list(conglomerado = "no_existe"))
  expect_identical(iv0$metodo, "aleatorio_simple")
})
