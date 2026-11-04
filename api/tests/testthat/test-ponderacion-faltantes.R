# NA/98/99 en las variables de calibración (decisión del 2026-11-04, ADR 0131 §6).
#   1. «Dejar fuera del margen» (por defecto): en el paso de una variable el
#      ajuste toca sólo a los casos con categoría válida, con la meta escalada a
#      la parte del total que ellos representan; los demás conservan su peso.
#      Es la opción `exclude` de ipf y lo que recomiendan Battaglia, Hoaglin y
#      Frankel (2009).
#   2. «Imputar antes de calibrar» (declarada): hot-deck dentro de celdas de las
#      otras variables de calibración, semilla declarada, sólo bajo un umbral
#      (5 % por defecto). Imputa una copia: la variable original no se toca.

.fa_codigo_error <- function(expr) {
  err <- tryCatch({ force(expr); NULL }, api_error = function(e) e)
  if (is.null(err)) NA_character_ else err$code
}

.fa_avisos <- function(res, code) Filter(function(a) identical(a$code, code), res$avisos %||% list())

.fa_cfg <- function(margins, ...) {
  list(enabled = TRUE, rake = c(list(margins = margins), list(...)))
}

# 10 % sin dato en sexo (6 con 99 y 4 NA).
.fa_datos_10 <- function() {
  data.frame(sexo = c(rep("H", 50), rep("M", 40), rep("99", 6), rep(NA, 4)),
             stringsAsFactors = FALSE)
}

.fa_sexo <- list(list(var = "sexo", targets = c(H = .5, M = .5)))

# 200 casos, sexo × edad; `k` casos sin dato en sexo repartidos en edad.
.fa_datos_imp <- function(k = 8L) {
  set.seed(11)
  d <- data.frame(
    sexo = sample(c("H", "M"), 200, TRUE, prob = c(.6, .4)),
    edad = sample(c("joven", "adulto", "mayor"), 200, TRUE, prob = c(.4, .4, .2)),
    stringsAsFactors = FALSE
  )
  if (k > 0) d$sexo[seq(5, by = 23, length.out = k)] <- NA
  d
}

.fa_margins_imp <- list(
  list(var = "sexo", targets = c(H = .5, M = .5)),
  list(var = "edad", targets = c(joven = .3, adulto = .4, mayor = .3))
)

# --- 1. dejar fuera del margen ------------------------------------------------

test_that("con 10 % de NA/99 el raking converge y esos casos conservan su peso", {
  data <- .fa_datos_10()
  r <- ponderacion_compute(data, .fa_cfg(.fa_sexo))
  expect_true(r$converged)
  expect_false("no_converge" %in% vapply(r$avisos, `[[`, "", "code"))
  expect_identical(r$faltantes, "excluir")
  sin_dato <- is.na(data$sexo) | data$sexo == "99"
  # Conservan el peso que traían (1): la meta se aplicó a los 90 válidos.
  expect_equal(r$peso[sin_dato], rep(1, 10), tolerance = 1e-12)
  expect_equal(unique(round(r$peso[data$sexo %in% "H"], 12)), 0.9)
  expect_equal(unique(round(r$peso[data$sexo %in% "M"], 12)), 1.125)
  # Entre los válidos, el margen cierra.
  ok <- !sin_dato
  expect_equal(sum(r$peso[ok & data$sexo == "H"]) / sum(r$peso[ok]), 0.5, tolerance = 1e-9)
  av <- .fa_avisos(r, "categoria_fuera_de_margen")
  expect_length(av, 1)
  expect_identical(av[[1]]$casos, 10L)
  expect_match(av[[1]]$message, "10 casos sin dato en «sexo»", fixed = TRUE)
  expect_match(av[[1]]$message, "conservan su peso", fixed = TRUE)
})

test_that("regresión explícita: sin NA el peso no se mueve; con NA cambia por diseño", {
  # Sin NA: idéntico bit a bit al motor anterior (misma huella que test-ponderacion-peso-base).
  set.seed(42)
  n <- 300
  data <- data.frame(
    distrito = sample(c("A", "B", "C"), n, TRUE, prob = c(.5, .3, .2)),
    sexo = sample(c("H", "M"), n, TRUE, prob = c(.65, .35)),
    edad = sample(c("18-29", "30-59", "60+"), n, TRUE, prob = c(.5, .35, .15)),
    stringsAsFactors = FALSE
  )
  r <- ponderacion_compute(data, list(
    enabled = TRUE,
    design = list(var = "distrito", pop_sizes = c(A = 1000, B = 1500, C = 2500)),
    rake = list(margins = list(
      list(var = "sexo", targets = c(H = .49, M = .51)),
      list(var = "edad", targets = c(`18-29` = .3, `30-59` = .5, `60+` = .2))
    )),
    trim = list(cap = 3)
  ))
  expect_equal(sum(r$peso^2), 526.305780540464, tolerance = 1e-10)

  # Con NA: el motor anterior dejaba a los sin dato en 0,1667 y no convergía.
  # Ahora conservan 1 y converge. El cambio es deliberado.
  r10 <- ponderacion_compute(.fa_datos_10(), .fa_cfg(.fa_sexo))
  sin_dato <- is.na(.fa_datos_10()$sexo) | .fa_datos_10()$sexo == "99"
  expect_gt(min(r10$peso[sin_dato]), 0.9)
  expect_true(r10$converged)
})

test_that("una categoría válida sin meta también queda fuera y el aviso lo dice", {
  data <- data.frame(sexo = c(rep("H", 50), rep("M", 45), rep("Otro", 5)), stringsAsFactors = FALSE)
  r <- ponderacion_compute(data, .fa_cfg(.fa_sexo))
  expect_true(r$converged)
  av <- .fa_avisos(r, "categoria_fuera_de_margen")
  expect_length(av, 1)
  expect_match(av[[1]]$message, "sin meta", fixed = TRUE)
})

# --- 2. imputar antes de calibrar ---------------------------------------------

test_that("la imputación se rechaza por encima del umbral con la causa y la salida", {
  data <- .fa_datos_10()
  cfg <- .fa_cfg(.fa_sexo, faltantes = "imputar")
  err <- tryCatch(ponderacion_compute(data, cfg), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_PONDERACION_IMPUTACION_EXCEDE_UMBRAL")
  expect_match(err$message, "faltan 10", fixed = TRUE)
  expect_match(err$message, "sexo", fixed = TRUE)
  expect_match(err$message, "5 % permitido", fixed = TRUE)
  expect_match(err$message, "dejar fuera del margen", fixed = TRUE)
  # El umbral es configurable.
  cfg15 <- .fa_cfg(.fa_sexo, faltantes = "imputar", imputacion = list(umbral = 0.15))
  r <- ponderacion_compute(data, cfg15)
  expect_identical(r$imputacion$variables$sexo$imputados, 10L)
})

test_that("la imputación es reproducible con la misma semilla y la guarda en el resultado", {
  data <- .fa_datos_imp(8L)
  cfg <- .fa_cfg(.fa_margins_imp, faltantes = "imputar", imputacion = list(semilla = 2026L))
  r1 <- ponderacion_compute(data, cfg)
  r2 <- ponderacion_compute(data, cfg)
  expect_identical(r1$peso, r2$peso)
  expect_identical(r1$imputacion$valores, r2$imputacion$valores)
  expect_identical(r1$imputacion$semilla, 2026L)
  expect_identical(r1$faltantes, "imputar")
  expect_true(r1$converged)
  # No toca el RNG global.
  set.seed(99); a <- stats::runif(1)
  set.seed(99); invisible(ponderacion_compute(data, cfg)); b <- stats::runif(1)
  expect_identical(a, b)
  # Sin semilla declarada se usa una por defecto y también se guarda.
  r0 <- ponderacion_compute(data, .fa_cfg(.fa_margins_imp, faltantes = "imputar"))
  expect_true(is.integer(r0$imputacion$semilla) && !is.na(r0$imputacion$semilla))
})

test_that("se imputa una copia: la variable original queda intacta y hay marca por caso", {
  data <- .fa_datos_imp(8L)
  original <- data$sexo
  r <- ponderacion_compute(data, .fa_cfg(.fa_margins_imp, faltantes = "imputar"))
  expect_identical(data$sexo, original)
  marca <- r$imputacion$marca$sexo
  expect_identical(marca, is.na(original))
  expect_identical(r$imputacion$variables$sexo$imputados, 8L)
  expect_true(all(r$imputacion$valores$sexo %in% c("H", "M")))
  expect_length(r$imputacion$valores$sexo, 8L)

  # En Analítica tampoco se reemplaza: `sexo` sigue con sus NA y la marca viaja aparte.
  pond <- list(enabled = TRUE, rake = list(
    margins = list(list(var = "sexo", targets = list(H = .5, M = .5)),
                   list(var = "edad", targets = list(joven = .3, adulto = .4, mayor = .3))),
    faltantes = "imputar", imputacion = list(umbral = 0.05, semilla = 7)
  ))
  out <- .analitica_ponderacion_apply(data, list(ponderacion = pond))
  expect_identical(out$sexo, original)
  expect_true("peso" %in% names(out))
  imp <- attr(out, "ponderacion_imputados")
  expect_identical(imp$sexo, is.na(original))
  estado <- attr(out, "ponderacion_estado")
  expect_identical(estado$faltantes, "imputar")
  expect_identical(estado$imputacion$variables$sexo$imputados, 8L)
  expect_identical(estado$imputacion$semilla, 7L)
})

test_that("una celda sin donantes se colapsa con regla declarada y avisa", {
  data <- .fa_datos_imp(0L)
  # Los únicos «mayor» sin dato de sexo: su celda (edad = mayor) no tiene donantes.
  mayores <- which(data$edad == "mayor")
  data <- data[c(setdiff(seq_len(nrow(data)), mayores), mayores[1:3]), ]
  data$sexo[data$edad == "mayor"] <- NA
  expect_identical(sum(is.na(data$sexo)), 3L)
  r <- ponderacion_compute(data, .fa_cfg(
    list(list(var = "sexo", targets = c(H = .5, M = .5)),
         list(var = "edad", targets = c(joven = .5, adulto = .5, mayor = .2))),
    faltantes = "imputar"
  ))
  av <- .fa_avisos(r, "celda_sin_donantes")
  expect_length(av, 1)
  expect_identical(av[[1]]$var, "sexo")
  expect_identical(av[[1]]$casos, 3L)
  expect_match(av[[1]]$message, "edad", fixed = TRUE)
  expect_identical(r$imputacion$variables$sexo$colapsados, 3L)
  expect_true(all(r$imputacion$valores$sexo %in% c("H", "M")))
})

test_that("la normalización lleva faltantes e imputación al motor", {
  norm <- .analitica_ponderacion_normalize(list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "sexo", targets = list(H = .5, M = .5))),
                faltantes = "imputar", imputacion = list(umbral = 0.08, semilla = 31),
                codigos_faltantes = list("98", "99", "-1"))
  ))
  expect_identical(norm$rake$faltantes, "imputar")
  expect_equal(norm$rake$imputacion$umbral, 0.08)
  expect_identical(norm$rake$imputacion$semilla, 31L)
  expect_identical(norm$rake$codigos_faltantes, c("98", "99", "-1"))
  legacy <- .analitica_ponderacion_normalize(list(
    enabled = TRUE, rake = list(margins = list(list(var = "sexo", targets = list(H = .5, M = .5))))
  ))
  expect_null(legacy$rake$faltantes)
})

# --- lecturas del resultado (revisión del verificador) --------------------------

test_that("con «excluir» la tabla de márgenes se lee entre los válidos y cierra en la meta", {
  r <- ponderacion_compute(.fa_datos_10(), .fa_cfg(.fa_sexo))
  filas <- r$margins$sexo
  pond <- vapply(filas, `[[`, numeric(1), "ponderado")
  expect_equal(pond, c(0.5, 0.5), tolerance = 1e-9)
  muestra <- vapply(filas, `[[`, numeric(1), "muestra")
  expect_equal(muestra, c(50, 40) / 90, tolerance = 1e-12)
  # Con dos márgenes y NA en el primero, el segundo se lee con su propio peso.
  data <- .fa_datos_imp(8L)
  r2 <- ponderacion_compute(data, .fa_cfg(.fa_margins_imp))
  expect_true(r2$converged)
  pond_edad <- vapply(r2$margins$edad, `[[`, numeric(1), "ponderado")
  expect_equal(pond_edad, c(.3, .4, .3), tolerance = 1e-6)
  pond_sexo <- vapply(r2$margins$sexo, `[[`, numeric(1), "ponderado")
  expect_equal(pond_sexo, c(.5, .5), tolerance = 1e-6)
})

test_that("sin ningún donante posible no se cuenta como imputado y se dice por qué", {
  data <- data.frame(sexo = rep(NA_character_, 40), edad = rep(c("joven", "mayor"), 20),
                     stringsAsFactors = FALSE)
  r <- ponderacion_compute(data, .fa_cfg(
    list(list(var = "sexo", targets = c(H = .5, M = .5)),
         list(var = "edad", targets = c(joven = .5, mayor = .5))),
    faltantes = "imputar", imputacion = list(umbral = 1)
  ))
  expect_identical(r$imputacion$variables$sexo$imputados, 0L)
  expect_identical(r$imputacion$variables$sexo$sin_donante, 40L)
  expect_false(any(r$imputacion$marca$sexo))
  codes <- vapply(r$avisos, `[[`, "", "code")
  expect_true("imputacion_sin_donantes" %in% codes)
  expect_false("imputacion_aplicada" %in% codes)
  expect_false("celda_sin_donantes" %in% codes)
  av <- .fa_avisos(r, "imputacion_sin_donantes")[[1]]
  expect_match(av$message, "ningún caso de la base", fixed = TRUE)
})

test_that("un receptor sin dato en las demás variables se imputa de toda la muestra y el aviso lo dice", {
  data <- .fa_datos_imp(0L)
  data$sexo[1:3] <- NA
  data$edad[1:3] <- NA
  r <- ponderacion_compute(data, .fa_cfg(.fa_margins_imp, faltantes = "imputar"))
  av <- .fa_avisos(r, "imputacion_aplicada")
  msg_sexo <- Filter(function(a) identical(a$var, "sexo"), av)[[1]]$message
  expect_match(msg_sexo, "en toda la muestra para 3 casos", fixed = TRUE)
  expect_length(.fa_avisos(r, "celda_sin_donantes"), 0)
})

test_that("la imputación fija su generador: otro RNGkind en la sesión no cambia el resultado ni queda tocado", {
  data <- .fa_datos_imp(8L)
  cfg <- .fa_cfg(.fa_margins_imp, faltantes = "imputar", imputacion = list(semilla = 5L))
  base <- ponderacion_compute(data, cfg)
  previo <- RNGkind()
  on.exit(do.call(RNGkind, as.list(previo)), add = TRUE)
  suppressWarnings(RNGkind("L'Ecuyer-CMRG", "Box-Muller", "Rounding"))
  otro <- ponderacion_compute(data, cfg)
  expect_identical(otro$imputacion$valores, base$imputacion$valores)
  expect_identical(RNGkind(), c("L'Ecuyer-CMRG", "Box-Muller", "Rounding"))
  expect_identical(base$imputacion$rng$kind, "Mersenne-Twister")
})
