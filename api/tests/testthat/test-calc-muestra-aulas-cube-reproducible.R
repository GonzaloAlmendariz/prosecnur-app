# El sorteo balanceado tiene que dar la MISMA muestra en cualquier maquina.
#
# El golden de al lado (test-calc-muestra-aulas.R) congela una salida concreta,
# pero no puede ver por que cambia: cuando el CI de Linux y el macOS de
# desarrollo divergieron, el golden solo dijo "distinto", y como cada plataforma
# lo regeneraba a su favor el defecto sobrevivio a varias corridas verdes.
#
# Estos tests atacan la CAUSA. La fase de vuelo del cubo toma un vector del
# nucleo con `svd`, que lo define salvo signo; LAPACK no fija cual devuelve. Se
# simula la otra plataforma sustituyendo `base::svd` por uno que entrega el
# signo contrario, que es igual de valido, y se exige que la muestra no cambie.
# Sin la canonicalizacion de ADR 0073 estos tests fallan.

skip_if_not_installed("sampling")

# Sustituye base::svd durante una expresion. base esta sellado, asi que el
# binding se desbloquea y se vuelve a sellar.
.cmr_con_svd <- function(reemplazo, code) {
  expr <- substitute(code)
  caller <- parent.frame()
  ns <- asNamespace("base")
  original <- get("svd", envir = ns)
  unlockBinding("svd", ns)
  on.exit({
    assign("svd", original, envir = ns)
    lockBinding("svd", ns)
  }, add = TRUE)
  assign("svd", reemplazo, envir = ns)
  eval(expr, envir = caller)
}

# El svd de "la otra plataforma": mismos subespacios, signo contrario.
#
# `force()` no es decorativo: sin el, `original` se evalua perezosamente DENTRO
# de .cmr_con_svd, cuando el binding ya fue sustituido, y la funcion se llama a
# si misma hasta desbordar la pila.
.cmr_svd_invertido <- function(original) {
  force(original)
  function(x, nu = min(dim(x)), nv = min(dim(x)), LINPACK = FALSE) {
    s <- original(x, nu = nu, nv = nv)
    if (!is.null(s$u) && length(s$u)) s$u <- -as.matrix(s$u)
    if (!is.null(s$v) && length(s$v)) s$v <- -as.matrix(s$v)
    s
  }
}

test_that("el svd canonico fija el signo y no depende del que devuelva LAPACK", {
  set.seed(11)
  x <- matrix(stats::rnorm(40), nrow = 10)

  canonico <- .cm_aulas_svd_canonico(x)
  invertido <- .cmr_con_svd(.cmr_svd_invertido(base::svd), .cm_aulas_svd_canonico(x))

  expect_identical(canonico$u, invertido$u)
  expect_identical(canonico$v, invertido$v)
  expect_identical(canonico$d, invertido$d)

  # La canonicalizacion no puede romper la descomposicion: x sigue siendo
  # u %*% diag(d) %*% t(v) dentro de la tolerancia declarada.
  reconstruido <- canonico$u %*% diag(canonico$d) %*% t(canonico$v)
  expect_lt(max(abs(reconstruido - x)), 1e-8)
})

test_that("la seleccion balanceada no cambia si LAPACK elige el otro signo", {
  f <- golden_fixture_simulacion()
  frame <- calc_muestra_aulas_construir(base_madre = f$base, config = f$cfg)

  aqui <- calc_muestra_aulas_seleccionar(frame, f$cfg)
  alla <- .cmr_con_svd(
    .cmr_svd_invertido(base::svd),
    calc_muestra_aulas_seleccionar(frame, f$cfg)
  )

  # Si el fixture dejara de sortear por cubo, estos tests pasarian sin ejercer
  # nada: la premisa se comprueba antes que la invariante.
  expect_identical(aqui$selector_engine_used, "cube_balanceado")

  expect_identical(aqui$selection$classroom_id, alla$selection$classroom_id)
  expect_identical(aqui$selection$sample_role, alla$selection$sample_role)
  # Las probabilidades publicadas son el contrato del ADR 0066: si estas
  # divergen, lo que se pondera despues tambien.
  expect_equal(aqui$selection$pi_final, alla$selection$pi_final, tolerance = 1e-12)
})

test_that("la cadena de reemplazos hereda el determinismo de la seleccion", {
  f <- golden_fixture_simulacion()
  frame <- calc_muestra_aulas_construir(base_madre = f$base, config = f$cfg)

  capturar <- function() {
    sel <- calc_muestra_aulas_seleccionar(frame, f$cfg)
    golden_capture_sim(calc_muestra_aulas_simular_reemplazos(frame, sel, f$cfg))
  }

  aqui <- capturar()
  alla <- .cmr_con_svd(.cmr_svd_invertido(base::svd), capturar())
  expect_identical(aqui, alla)
})
