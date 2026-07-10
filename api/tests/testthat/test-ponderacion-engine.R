test_that(".ponderacion_design_weights reequilibra asignacion desigual", {
  # 100 casos por estrato en 2 estratos, pero A es 1/3 de la poblacion y B 2/3.
  stratum <- rep(c("A", "B"), each = 100)
  w <- .ponderacion_design_weights(stratum, c(A = 1000, B = 2000))
  # Media 1 y el estrato subrepresentado (B) pesa el doble que A.
  expect_equal(mean(w), 1, tolerance = 1e-8)
  wA <- unique(w[stratum == "A"]); wB <- unique(w[stratum == "B"])
  expect_length(wA, 1); expect_length(wB, 1)
  expect_equal(wB / wA, 2, tolerance = 1e-6)
  # Share ponderado reproduce la poblacion: A=1/3, B=2/3.
  expect_equal(sum(w[stratum == "A"]) / sum(w), 1 / 3, tolerance = 1e-6)
})

test_that(".ponderacion_rake ajusta los margenes a los objetivos", {
  set.seed(1)
  data <- data.frame(
    sexo = sample(c("H", "M"), 400, replace = TRUE, prob = c(0.7, 0.3)),
    edad = sample(c("joven", "mayor"), 400, replace = TRUE, prob = c(0.6, 0.4)),
    stringsAsFactors = FALSE
  )
  margins <- list(
    list(var = "sexo", targets = c(H = 0.5, M = 0.5)),
    list(var = "edad", targets = c(joven = 0.5, mayor = 0.5))
  )
  w <- .ponderacion_rake(data, margins)
  expect_true(attr(w, "converged"))
  # Tras raking, cada margen ponderado iguala su objetivo.
  sh_sexo <- tapply(w, data$sexo, sum) / sum(w)
  sh_edad <- tapply(w, data$edad, sum) / sum(w)
  expect_equal(as.numeric(sh_sexo[["H"]]), 0.5, tolerance = 1e-4)
  expect_equal(as.numeric(sh_edad[["joven"]]), 0.5, tolerance = 1e-4)
  expect_equal(mean(w), 1, tolerance = 1e-8)
})

test_that(".ponderacion_rake acepta objetivos como conteos (los normaliza)", {
  data <- data.frame(g = rep(c("a", "b"), c(300, 100)), stringsAsFactors = FALSE)
  w <- .ponderacion_rake(data, list(list(var = "g", targets = c(a = 100, b = 100))))
  sh <- tapply(w, data$g, sum) / sum(w)
  expect_equal(as.numeric(sh[["a"]]), 0.5, tolerance = 1e-5)
})

test_that(".ponderacion_trim recorta pesos extremos y conserva la suma", {
  w <- c(rep(1, 96), 20, 20, 0.01, 0.01)
  tw <- .ponderacion_trim(w, cap = 3, target_sum = length(w))
  expect_equal(sum(tw), length(w), tolerance = 1e-6)
  m <- mean(tw)
  expect_lte(max(tw), 3 * m + 1e-6)
  expect_gte(min(tw), m / 3 - 1e-6)
})

test_that(".ponderacion_diagnostics calcula DEFF y n_eff coherentes", {
  # Pesos uniformes -> DEFF 1, n_eff n.
  d1 <- .ponderacion_diagnostics(rep(1, 100))
  expect_equal(d1$deff, 1, tolerance = 1e-8)
  expect_equal(d1$n_eff, 100, tolerance = 1e-8)
  # Pesos dispersos -> DEFF > 1, n_eff < n.
  d2 <- .ponderacion_diagnostics(c(rep(0.5, 50), rep(1.5, 50)))
  expect_gt(d2$deff, 1)
  expect_lt(d2$n_eff, 100)
})

test_that("ponderacion_compute orquesta diseno + raking + diagnosticos", {
  set.seed(2)
  data <- data.frame(
    distrito = rep(c("chico", "grande"), each = 150),
    sexo = sample(c("H", "M"), 300, replace = TRUE, prob = c(0.6, 0.4)),
    stringsAsFactors = FALSE
  )
  cfg <- list(
    enabled = TRUE,
    design = list(var = "distrito", pop_sizes = c(chico = 1000, grande = 3000)),
    rake = list(margins = list(list(var = "sexo", targets = c(H = 0.5, M = 0.5)))),
    trim = list(cap = 5)
  )
  res <- ponderacion_compute(data, cfg)
  expect_true(res$ok)
  expect_true(res$design_applied)
  expect_true(res$rake_applied)
  expect_length(res$peso, 300)
  expect_equal(mean(res$peso), 1, tolerance = 1e-8)
  # Sexo ponderado ~ 50/50.
  sh <- tapply(res$peso, data$sexo, sum) / sum(res$peso)
  expect_equal(as.numeric(sh[["H"]]), 0.5, tolerance = 1e-3)
  # Distrito grande queda mas pesado que chico (estaba subrepresentado).
  expect_gt(sum(res$peso[data$distrito == "grande"]), sum(res$peso[data$distrito == "chico"]))
  expect_true(is.finite(res$diagnostics$deff))
})

test_that("ponderacion_compute devuelve pesos 1 sin config o deshabilitado", {
  data <- data.frame(x = 1:10)
  expect_equal(ponderacion_compute(data, list())$peso, rep(1, 10))
  expect_equal(ponderacion_compute(data, list(enabled = FALSE))$peso, rep(1, 10))
})
