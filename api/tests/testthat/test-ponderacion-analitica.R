test_that(".analitica_ponderacion_normalize traduce la forma JSON del frontend", {
  # jsonlite(simplifyVector=FALSE): objetos -> named lists, arrays -> listas.
  pond <- list(
    enabled = TRUE,
    design = list(var = "distrito", pop_sizes = list(A = 1000, B = 2000)),
    rake = list(margins = list(
      list(var = "sexo", targets = list(H = 0.49, M = 0.51)),
      list(var = "edad", targets = list(joven = 0.6, mayor = 0.4))
    )),
    trim = list(cap = 5)
  )
  norm <- .analitica_ponderacion_normalize(pond)
  expect_true(norm$enabled)
  expect_equal(norm$design$var, "distrito")
  expect_equal(norm$design$pop_sizes, c(A = 1000, B = 2000))
  expect_length(norm$rake$margins, 2)
  expect_equal(norm$rake$margins[[1]]$var, "sexo")
  expect_equal(norm$rake$margins[[1]]$targets, c(H = 0.49, M = 0.51))
  expect_equal(norm$trim$cap, 5)
})

test_that(".analitica_ponderacion_normalize descarta trim <=1 y margenes vacios", {
  norm <- .analitica_ponderacion_normalize(list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "", targets = list(a = 1)))),
    trim = list(cap = 1)
  ))
  expect_true(norm$enabled)
  expect_null(norm$rake)
  expect_null(norm$trim)
})

test_that(".analitica_ponderacion_apply adjunta `peso` solo si esta habilitada", {
  set.seed(3)
  data <- data.frame(
    sexo = sample(c("H", "M"), 300, replace = TRUE, prob = c(0.7, 0.3)),
    stringsAsFactors = FALSE
  )
  cfg_on <- list(ponderacion = list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "sexo", targets = list(H = 0.5, M = 0.5))))
  ))
  out <- .analitica_ponderacion_apply(data, cfg_on)
  expect_true("peso" %in% names(out))
  expect_equal(mean(out$peso), 1, tolerance = 1e-8)
  # Tras ponderar, el margen de sexo queda 50/50.
  sh <- tapply(out$peso, out$sexo, sum) / sum(out$peso)
  expect_equal(as.numeric(sh[["H"]]), 0.5, tolerance = 1e-4)

  # Deshabilitada o sin config -> data intacta, sin columna peso.
  expect_false("peso" %in% names(.analitica_ponderacion_apply(data, list())))
  cfg_off <- list(ponderacion = list(enabled = FALSE,
    rake = list(margins = list(list(var = "sexo", targets = list(H = 0.5, M = 0.5))))))
  expect_false("peso" %in% names(.analitica_ponderacion_apply(data, cfg_off)))
})

test_that("el `peso` adjunto es consumido por .peso_vec (frecuencias)", {
  data <- data.frame(x = rep(c("a", "b"), c(100, 100)), stringsAsFactors = FALSE)
  cfg <- list(ponderacion = list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "x", targets = list(a = 0.25, b = 0.75))))
  ))
  out <- .analitica_ponderacion_apply(data, cfg)
  w <- .peso_vec(out)
  expect_equal(length(w), nrow(out))
  # Frecuencia ponderada de "b" ~ 75% del total ponderado.
  expect_equal(sum(w[out$x == "b"]) / sum(w), 0.75, tolerance = 1e-4)
})
