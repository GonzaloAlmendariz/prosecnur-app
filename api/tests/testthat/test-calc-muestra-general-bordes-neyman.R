# Bordes del estratificado por estrato que encontró el verificador de E3/E7
# (2026-09-24). Un marco realista —un estrato grande y 19 chicos de 40 con p
# chica— dejaba con Neyman estratos con n_h = 0: el error publicado salía NA y
# el sorteo reventaba con un error crudo de R por la API.

.bn_caso <- function(N_h, p_h = NULL, asignacion = NULL, extra = list()) {
  labs <- sprintf("F%02d", seq_along(N_h))
  est <- lapply(seq_along(N_h), function(i) {
    e <- list(label = labs[i], N = N_h[i]); if (!is.null(p_h)) e$p_facultad <- p_h[i]; e
  })
  par <- utils::modifyList(list(e = .05, tasa_respuesta = 1, oversample_pct = 0), extra)
  if (!is.null(asignacion)) par$asignacion <- asignacion
  comp <- calc_muestra_normalize_componente(list(id = "c1", tecnica = "prob_estratificado",
    marco = list(marco_validado = sum(N_h), estratos = est), parametros = par))
  datos <- data.frame(cod = sprintf("Q%06d", seq_len(sum(N_h))), fac = rep(labs, N_h))
  d <- calc_muestra_general_declarar_marco(list(componentes = list(comp)), list(), "c1", datos,
                                           file_id = "f", columnas = list(id = "cod", estrato = "fac"))
  r <- calc_muestra_calcular_componente(d$estudio$componentes[[1]])
  d$estudio$componentes[[1]]$resultado <- r
  list(d = d, r = r, datos = datos)
}

test_that("con Neyman ningún estrato queda sin casos cuando caben 2 por estrato, y el sorteo corre", {
  x <- .bn_caso(c(8000L, rep(40L, 19)), c(.5, rep(.02, 19)), "neyman")
  nh <- vapply(x$r$distribucion_estratos, `[[`, integer(1), "n_campo")
  expect_true(all(nh >= 2L))
  expect_false(is.na(x$r$precision_alcanzada))
  sel <- calc_muestra_general_seleccionar(x$d$estudio, x$d$estado, "c1", x$datos, semilla = 1L)
  expect_identical(sel$corrida$estratos$n_h, nh)
})

test_that("el sorteo tolera un estrato con n_h = 0 en la asignación", {
  m <- data.frame(id = sprintf("U%03d", 1:50), est = rep(c("A", "B"), c(45, 5)))
  s <- calc_muestra_general_sortear(m, list(id = "id", estrato = "est"), "mas", n = 10L,
                                    semilla = 1L, asignacion = c(A = 10L, B = 0L))
  expect_identical(s$estratos$n_h, c(10L, 0L))
  expect_identical(s$corrida$n_titulares, 10L)
})

test_that("con el piso activo, si el error alcanzado supera el declarado se avisa", {
  x <- .bn_caso(c(4000L, 2500L, 800L, 200L), c(.05, .2, .5, .7), "neyman",
                list(e = .035, n_minimo_estrato = 40L))
  if (x$r$precision_alcanzada > .035 + 1e-9) {
    expect_match(x$r$advertencia, "supera el declarado")
  }
  expect_match(x$r$advertencia, "Neyman")
  expect_false(grepl("estratificado proporcional", x$r$advertencia, fixed = TRUE))
})

test_that("la memoria por estrato escribe el mín(·, N) y el deff", {
  x <- .bn_caso(c(200L, 150L), c(.2, .5), "neyman", list(tasa_respuesta = .4, oversample_pct = .2, n_minimo_estrato = 0L))
  m <- x$r$memoria_calculo
  fila <- m[m$paso == "n a campo", ]
  # Desde L2 el n a campo se infla por estrato: la fórmula es la suma de los
  # mín(·, N_h) y la sustitución lista cada estrato (aquí los dos se censan).
  expect_match(fila$formula, "Σ mín(", fixed = TRUE)
  expect_match(fila$sustitucion, "2 estratos censados", fixed = TRUE)
  expect_identical(fila$resultado, as.character(as.integer(x$r$n_operativo)))
  y <- .bn_caso(c(3000L, 2000L, 1000L), NULL, "neyman", list(deff = 1.3, n_minimo_estrato = 0L))
  expect_match(y$r$memoria_calculo$sustitucion[[1]], "1.3", fixed = TRUE)
})

test_that("redeclarar el marco no duplica ids de estrato", {
  x <- .bn_caso(c(100L, 100L), c(.3, .4))
  est <- x$d$estudio
  est$componentes[[1]]$marco$estratos <- list(list(id = "est-1", label = "F02", N = 100L, p_facultad = .4))
  datos <- data.frame(cod = sprintf("Z%04d", 1:300), fac = rep(c("F01", "F02", "F03"), 100))
  d2 <- calc_muestra_general_declarar_marco(est, x$d$estado, "c1", datos, "f2",
                                            columnas = list(id = "cod", estrato = "fac"))
  ids <- vapply(d2$componente$marco$estratos, `[[`, "", "id")
  expect_identical(anyDuplicated(ids), 0L)
  expect_identical(d2$componente$marco$estratos[[2]]$p_facultad, .4)
})

test_that("con una meta que no alcanza para todos los estratos se dice cuáles quedan fuera, sin «NA»", {
  x <- .bn_caso(c(8000L, rep(40L, 19)), c(.5, rep(.02, 19)), "neyman")
  comp <- x$d$estudio$componentes[[1]]
  comp$meta <- list(valor = 30L)
  r <- calc_muestra_calcular_componente(comp)
  expect_false(grepl("NA", r$advertencia, fixed = TRUE))
  expect_match(r$advertencia, "estratos quedan sin casos")
  expect_match(r$advertencia, "no se puede estimar")
  expect_match(r$advertencia, "asignación de Neyman")
})

test_that("el aviso de error no se contradice por redondeo y nombra su causa real", {
  x <- .bn_caso(c(10000L, 30L), c(.5, .01), "neyman", list(n_minimo_estrato = 0L))
  if (x$r$precision_alcanzada > .05) {
    expect_match(x$r$advertencia, "mínimo de 2 casos por estrato")
    expect_false(grepl("±5.0 puntos) supera el declarado (±5.0)", x$r$advertencia, fixed = TRUE))
  }
})
