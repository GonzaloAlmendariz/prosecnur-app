# ADR 0131 §6: cadena del peso. El motor parte del peso de diseño de cada caso
# (una columna de la base), calibra por raking a márgenes, ofrece el peso de
# expansión (Σw = N̂), avisa donde antes callaba y recorta recalibrando en ciclo.

.pb_codigo_error <- function(expr) {
  err <- tryCatch({ force(expr); NULL }, api_error = function(e) e)
  if (is.null(err)) NA_character_ else err$code
}

.pb_codigos_aviso <- function(res) {
  vapply(res$avisos %||% list(), function(a) as.character(a$code), character(1))
}

.pb_datos_legacy <- function() {
  set.seed(42)
  n <- 300
  data.frame(
    distrito = sample(c("A", "B", "C"), n, TRUE, prob = c(.5, .3, .2)),
    sexo = sample(c("H", "M"), n, TRUE, prob = c(.65, .35)),
    edad = sample(c("18-29", "30-59", "60+"), n, TRUE, prob = c(.5, .35, .15)),
    stringsAsFactors = FALSE
  )
}

.pb_cfg_legacy <- function(trim = TRUE) {
  cfg <- list(
    enabled = TRUE,
    design = list(var = "distrito", pop_sizes = c(A = 1000, B = 1500, C = 2500)),
    rake = list(margins = list(
      list(var = "sexo", targets = c(H = .49, M = .51)),
      list(var = "edad", targets = c(`18-29` = .3, `30-59` = .5, `60+` = .2))
    ))
  )
  if (trim) cfg$trim <- list(cap = 3)
  cfg
}

# Muestra desbalanceada en sexo × edad: el raking a 50/50 deja pesos dispersos.
.pb_datos_sesgados <- function() {
  data.frame(
    sexo = rep(c("H", "H", "M", "M"), c(240, 60, 80, 20)),
    edad = rep(c("joven", "mayor", "joven", "mayor"), c(240, 60, 80, 20)),
    stringsAsFactors = FALSE
  )
}

.pb_max_desvio <- function(data, w, margins) {
  max(vapply(margins, function(m) {
    tgt <- m$targets / sum(m$targets)
    sh <- tapply(w, data[[m$var]], sum) / sum(w)
    max(abs(as.numeric(sh[names(tgt)]) - as.numeric(tgt)))
  }, numeric(1)))
}

# --- regresión: sin opciones nuevas, el peso es el de siempre -------------------

test_that("sin opciones nuevas el peso es idéntico al de antes (diseño + raking + trim)", {
  data <- .pb_datos_legacy()
  r <- ponderacion_compute(data, .pb_cfg_legacy(trim = TRUE))
  # Huella tomada del motor previo a ADR 0131 §6.
  expect_equal(sum(r$peso^2), 526.305780540464, tolerance = 1e-10)
  expect_equal(r$peso[1:4], c(1.040636954798, 1.040636954798, 0.473585884296, 1.040636954798),
               tolerance = 1e-10)
  expect_equal(r$diagnostics$deff, 1.754352601802, tolerance = 1e-10)
  expect_identical(r$iterations, 7L)
  expect_true(r$converged)
  expect_equal(mean(r$peso), 1, tolerance = 1e-10)

  r2 <- ponderacion_compute(data, .pb_cfg_legacy(trim = FALSE))
  expect_equal(sum(r2$peso^2), 670.299067583810, tolerance = 1e-10)
  expect_equal(r2$peso[1:4], c(1.003493509129, 1.003493509129, 0.456682187495, 1.003493509129),
               tolerance = 1e-10)
})

# --- 1. peso base desde una columna ---------------------------------------------

test_that("con márgenes ya satisfechos, el peso calibrado es proporcional a la columna base", {
  data <- data.frame(
    sexo = rep(c("H", "H", "M", "M"), 50),
    d = rep(c(1, 3, 1, 3), 50),
    stringsAsFactors = FALSE
  )
  cfg <- list(
    enabled = TRUE,
    design = list(peso_columna = "d"),
    rake = list(margins = list(list(var = "sexo", targets = c(H = .5, M = .5))))
  )
  r <- ponderacion_compute(data, cfg)
  expect_true(r$design_applied)
  expect_true(r$rake_applied)
  ratio <- r$peso / data$d
  expect_lt(diff(range(ratio)), 1e-9)
  expect_equal(mean(r$peso), 1, tolerance = 1e-10)
})

test_that("la columna base sin márgenes es el peso de diseño reescalado", {
  data <- data.frame(d = c(2, 4, 6, 8))
  r <- ponderacion_compute(data, list(enabled = TRUE, design = list(peso_columna = "d")))
  expect_true(r$design_applied)
  expect_false(r$rake_applied)
  expect_equal(r$peso, data$d / mean(data$d), tolerance = 1e-12)
})

test_that("la columna base tiene que existir y ser numérica, finita y > 0", {
  data <- data.frame(sexo = c("H", "M", "H"), d = c(1, 2, 3), z = c(1, 0, 2),
                     na = c(1, NA, 2), txt = c("a", "b", "c"), stringsAsFactors = FALSE)
  base_cfg <- function(col) list(enabled = TRUE, design = list(peso_columna = col))
  expect_identical(.pb_codigo_error(ponderacion_compute(data, base_cfg("nope"))),
                   "E_PONDERACION_PESO_BASE_INEXISTENTE")
  expect_identical(.pb_codigo_error(ponderacion_compute(data, base_cfg("z"))),
                   "E_PONDERACION_PESO_BASE_INVALIDO")
  expect_identical(.pb_codigo_error(ponderacion_compute(data, base_cfg("na"))),
                   "E_PONDERACION_PESO_BASE_INVALIDO")
  expect_identical(.pb_codigo_error(ponderacion_compute(data, base_cfg("txt"))),
                   "E_PONDERACION_PESO_BASE_INVALIDO")
})

test_that("la normalización lleva peso_columna, escala y el ciclo de recorte al motor", {
  norm <- .analitica_ponderacion_normalize(list(
    enabled = TRUE,
    design = list(peso_columna = "peso_diseno"),
    rake = list(margins = list(list(var = "sexo", targets = list(H = 0.49, M = 0.51)))),
    escala = "expansion",
    total_poblacion = 12000,
    trim = list(cap = 5, recalibrar = TRUE, max_ciclos = 30, tol_margen = 0.002)
  ))
  expect_identical(norm$design$peso_columna, "peso_diseno")
  expect_identical(norm$escala, "expansion")
  expect_equal(norm$total_poblacion, 12000)
  expect_equal(norm$trim$cap, 5)
  expect_true(norm$trim$recalibrar)
  expect_identical(norm$trim$max_ciclos, 30L)
  expect_equal(norm$trim$tol_margen, 0.002)

  # Lo de siempre no cambia de forma.
  legacy <- .analitica_ponderacion_normalize(list(enabled = TRUE, trim = list(cap = 3)))
  expect_identical(legacy$trim, list(cap = 3))
  expect_null(legacy$escala)
})

test_that("Analítica aplica peso base + calibración con la columna declarada", {
  data <- data.frame(
    sexo = rep(c("H", "H", "M", "M"), 50),
    d = rep(c(1, 3, 1, 3), 50),
    stringsAsFactors = FALSE
  )
  cfg <- list(ponderacion = list(
    enabled = TRUE,
    design = list(peso_columna = "d"),
    rake = list(margins = list(list(var = "sexo", targets = list(H = 0.5, M = 0.5))))
  ))
  out <- .analitica_ponderacion_apply(data, cfg)
  expect_lt(diff(range(out$peso / out$d)), 1e-9)
  estado <- attr(out, "ponderacion_estado")
  expect_identical(estado$status, "aplicada")
  expect_identical(estado$peso_base, "d")

  # Una columna base inválida es un error de configuración, no un fallback mudo.
  data$d[3] <- 0
  expect_identical(.pb_codigo_error(.analitica_ponderacion_apply(data, cfg)),
                   "E_PONDERACION_PESO_BASE_INVALIDO")
})

# --- 2. peso de expansión ---------------------------------------------------------

test_that("en modo expansión Σw es la suma de las metas de población", {
  data <- .pb_datos_legacy()
  cfg <- list(
    enabled = TRUE,
    rake = list(margins = list(
      list(var = "sexo", targets = c(H = 6000, M = 4000)),
      list(var = "edad", targets = c(`18-29` = 3000, `30-59` = 5000, `60+` = 2000))
    )),
    escala = "expansion"
  )
  r <- ponderacion_compute(data, cfg)
  expect_equal(sum(r$peso), 10000, tolerance = 1e-8)
  expect_identical(r$escala, "expansion")
  expect_equal(r$total_poblacion, 10000)
  # El peso normalizado y el de expansión son el mismo vector reescalado.
  r1 <- ponderacion_compute(data, modifyList(cfg, list(escala = NULL)))
  expect_equal(r$peso / sum(r$peso), r1$peso / sum(r1$peso), tolerance = 1e-12)
  expect_equal(r$diagnostics$deff, r1$diagnostics$deff, tolerance = 1e-10)
})

test_that("expansión con metas en proporciones pide un total explícito", {
  data <- .pb_datos_legacy()
  cfg <- list(enabled = TRUE, escala = "expansion",
              rake = list(margins = list(list(var = "sexo", targets = c(H = .49, M = .51)))))
  expect_identical(.pb_codigo_error(ponderacion_compute(data, cfg)),
                   "E_PONDERACION_EXPANSION_SIN_TOTAL")
  cfg$total_poblacion <- 25000
  r <- ponderacion_compute(data, cfg)
  expect_equal(sum(r$peso), 25000, tolerance = 1e-8)
})

test_that("expansión con peso 1/π y metas en proporción usa Σ del peso base (ADR 0131)", {
  data <- .pb_datos_legacy()
  set.seed(7)
  data$pd <- round(stats::runif(nrow(data), 20, 80), 1)
  r <- ponderacion_compute(data, list(
    enabled = TRUE, escala = "expansion",
    design = list(peso_columna = "pd"),
    rake = list(margins = list(list(var = "sexo", targets = c(H = .49, M = .51))))
  ))
  expect_equal(sum(r$peso), sum(data$pd), tolerance = 1e-8)
  expect_equal(r$total_poblacion, sum(data$pd))
  # pop_sizes del diseño con metas en proporción: Σ de los estratos.
  r2 <- ponderacion_compute(data, list(
    enabled = TRUE, escala = "expansion",
    design = list(var = "distrito", pop_sizes = c(A = 1000, B = 1500, C = 2500)),
    rake = list(margins = list(list(var = "sexo", targets = c(H = .49, M = .51))))
  ))
  expect_equal(sum(r2$peso), 5000, tolerance = 1e-8)
})

test_that("expansión sobre pop_sizes del diseño suma la población de los estratos", {
  data <- .pb_datos_legacy()
  r <- ponderacion_compute(data, list(
    enabled = TRUE, escala = "expansion",
    design = list(var = "distrito", pop_sizes = c(A = 1000, B = 1500, C = 2500))
  ))
  expect_equal(sum(r$peso), 5000, tolerance = 1e-8)
})

test_that("márgenes con totales distintos avisan y la expansión usa el primero", {
  data <- .pb_datos_legacy()
  r <- ponderacion_compute(data, list(
    enabled = TRUE, escala = "expansion",
    rake = list(margins = list(
      list(var = "sexo", targets = c(H = 6000, M = 4000)),
      list(var = "edad", targets = c(`18-29` = 3000, `30-59` = 5000, `60+` = 3000))
    ))
  ))
  expect_equal(sum(r$peso), 10000, tolerance = 1e-8)
  expect_true("totales_inconsistentes" %in% .pb_codigos_aviso(r))
})

# --- 3. avisos donde antes callaba ------------------------------------------------

test_that("una categoría del margen sin casos avisa con la categoría y el margen", {
  data <- data.frame(sexo = rep(c("H", "M"), c(60, 40)), stringsAsFactors = FALSE)
  r <- ponderacion_compute(data, list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "sexo", targets = c(H = .45, M = .45, X = .10))))
  ))
  av <- Filter(function(a) identical(a$code, "categoria_sin_casos"), r$avisos)
  expect_length(av, 1)
  expect_identical(av[[1]]$var, "sexo")
  expect_identical(av[[1]]$categorias, "X")
  expect_match(av[[1]]$message, "sexo", fixed = TRUE)
  expect_match(av[[1]]$message, "X", fixed = TRUE)
  # La meta de X se reparte entre H y M: el raking converge y deja 50/50.
  expect_true(r$converged)
  expect_false("no_converge" %in% .pb_codigos_aviso(r))
  expect_equal(sum(r$peso[data$sexo == "H"]) / sum(r$peso), 0.5, tolerance = 1e-6)
})

test_that("un estrato ausente de pop_sizes avisa", {
  data <- data.frame(distrito = rep(c("A", "B", "Z"), c(50, 30, 20)), stringsAsFactors = FALSE)
  r <- ponderacion_compute(data, list(
    enabled = TRUE, design = list(var = "distrito", pop_sizes = c(A = 1000, B = 2000))
  ))
  av <- Filter(function(a) identical(a$code, "estrato_sin_poblacion"), r$avisos)
  expect_length(av, 1)
  expect_identical(av[[1]]$categorias, "Z")
  expect_identical(av[[1]]$casos, 20L)
})

test_that("casos con NA o 98/99 fuera de las metas avisan que conservan su peso", {
  data <- data.frame(sexo = c(rep("H", 50), rep("M", 40), rep("99", 6), rep(NA, 4)),
                     stringsAsFactors = FALSE)
  r <- ponderacion_compute(data, list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "sexo", targets = c(H = .5, M = .5))))
  ))
  av <- Filter(function(a) identical(a$code, "categoria_fuera_de_margen"), r$avisos)
  expect_length(av, 1)
  expect_identical(av[[1]]$var, "sexo")
  expect_identical(av[[1]]$casos, 10L)
  expect_setequal(av[[1]]$categorias, c("99", "(sin dato)"))
})

test_that("un raking que no converge llega como aviso", {
  data <- .pb_datos_legacy()
  cfg <- .pb_cfg_legacy(trim = FALSE)
  cfg$rake$max_iter <- 1L
  r <- ponderacion_compute(data, cfg)
  expect_false(r$converged)
  expect_true("no_converge" %in% .pb_codigos_aviso(r))
  # Y la UI lo recibe una sola vez.
  ui <- vapply(.analitica_ponderacion_warnings(r), function(a) a$code, character(1))
  expect_identical(sum(ui == "no_converge"), 1L)
})

test_that("los avisos del motor llegan a la UI y a la corrida de Analítica", {
  data <- data.frame(sexo = rep(c("H", "M"), c(60, 40)), stringsAsFactors = FALSE)
  pond <- list(enabled = TRUE,
               rake = list(margins = list(list(var = "sexo", targets = list(H = .45, M = .45, X = .10)))))
  r <- ponderacion_compute(data, .analitica_ponderacion_normalize(pond))
  ui <- vapply(.analitica_ponderacion_warnings(r), function(a) a$code, character(1))
  expect_true("categoria_sin_casos" %in% ui)
  avisos_r <- character()
  out <- withCallingHandlers(
    .analitica_ponderacion_apply(data, list(ponderacion = pond)),
    warning = function(w) {
      avisos_r <<- c(avisos_r, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
  expect_true(any(grepl("sin casos", avisos_r, fixed = TRUE)))
  estado <- attr(out, "ponderacion_estado")
  expect_true("categoria_sin_casos" %in% vapply(estado$avisos, function(a) a$code, character(1)))
})

# --- 4. recorte seguido de recalibración, en ciclo --------------------------------

test_that("recortar y recalibrar en ciclo deja los márgenes dentro de la tolerancia y el tope", {
  data <- .pb_datos_sesgados()
  margins <- list(
    list(var = "sexo", targets = c(H = .5, M = .5)),
    list(var = "edad", targets = c(joven = .5, mayor = .5))
  )
  sin_recorte <- ponderacion_compute(data, list(enabled = TRUE, rake = list(margins = margins)))
  expect_gt(max(sin_recorte$peso) / mean(sin_recorte$peso), 4)

  r <- ponderacion_compute(data, list(
    enabled = TRUE, rake = list(margins = margins),
    trim = list(cap = 4, recalibrar = TRUE, tol_margen = 1e-3)
  ))
  expect_lte(max(r$peso) / mean(r$peso), 4 * (1 + 1e-3))
  expect_lte(.pb_max_desvio(data, r$peso, margins), 1e-3)
  expect_true(r$recorte$convergio)
  expect_identical(r$recorte$modo, "recalibrar")
  # deff de Kish y n efectivo, antes y después del recorte.
  expect_equal(r$recorte$antes$deff, sin_recorte$diagnostics$deff, tolerance = 1e-8)
  expect_equal(r$recorte$despues$deff, r$diagnostics$deff, tolerance = 1e-12)
  expect_lt(r$recorte$despues$deff, r$recorte$antes$deff)
  expect_gt(r$recorte$despues$n_eff, r$recorte$antes$n_eff)
})

test_that("el recorte de siempre rompe los márgenes y ahora lo avisa", {
  data <- .pb_datos_sesgados()
  margins <- list(
    list(var = "sexo", targets = c(H = .5, M = .5)),
    list(var = "edad", targets = c(joven = .5, mayor = .5))
  )
  r <- ponderacion_compute(data, list(enabled = TRUE, rake = list(margins = margins),
                                      trim = list(cap = 4)))
  expect_gt(.pb_max_desvio(data, r$peso, margins), 1e-3)
  expect_true("recorte_rompe_margenes" %in% .pb_codigos_aviso(r))
  expect_identical(r$recorte$modo, "renormalizar")
})

test_that("un tope inalcanzable agota los ciclos y avisa", {
  data <- .pb_datos_sesgados()
  margins <- list(
    list(var = "sexo", targets = c(H = .5, M = .5)),
    list(var = "edad", targets = c(joven = .5, mayor = .5))
  )
  r <- ponderacion_compute(data, list(
    enabled = TRUE, rake = list(margins = margins),
    trim = list(cap = 1.2, recalibrar = TRUE, max_ciclos = 5)
  ))
  expect_false(r$recorte$convergio)
  expect_identical(r$recorte$ciclos, 5L)
  expect_true("recorte_no_converge" %in% .pb_codigos_aviso(r))
})
