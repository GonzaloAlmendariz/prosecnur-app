# Sembrado de criterios de revisión — GOAL validación extrínseca, lote 1 (L2).
#
# El sembrador propone criterios ya formados para que la cobertura no dependa de
# que alguien sepa que debe escribirlos. Lo que se fija acá:
#   - propone solo cuando hay algo que proponer (control negativo explícito)
#   - lo propuesto es insertable tal cual: pasa el schema real
#   - lo propuesto, compilado y evaluado, marca exactamente los casos correctos
#   - no nombra variables de ningún proyecto

source("setup-load-all.R")

.sem_base <- function(versiones, extra = list()) {
  d <- data.frame(
    `_uuid` = sprintf("u%02d", seq_along(versiones)),
    `_submission_time` = sprintf("2026-08-%02dT10:00:00", seq_along(versiones)),
    `__version__` = versiones,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  for (nm in names(extra)) d[[nm]] <- extra[[nm]]
  d
}

test_that("no propone nada cuando la base viene de una sola versión", {
  # Control negativo: si el sembrador propusiera igual, el aserto de abajo no
  # distinguiría una base sana de una mezclada.
  d <- .sem_base(rep("vA", 10))
  expect_length(reglas_semilla_procedencia(d), 0L)
})

test_that("no propone nada cuando la base no registra versión", {
  d <- data.frame(`_uuid` = c("u1", "u2"), p1 = c("a", "b"),
                  stringsAsFactors = FALSE, check.names = FALSE)
  expect_length(reglas_semilla_procedencia(d), 0L)
})

test_that("propone el criterio cuando conviven dos versiones, con la mayoritaria como vigente", {
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  props <- reglas_semilla_procedencia(d)

  expect_length(props, 1L)
  p <- props[[1]]
  expect_identical(p$tipo, "fuera_catalogo")
  expect_identical(unlist(p$variables), "__version__")
  expect_identical(unlist(p$params$valores), "vNueva")
  expect_identical(p$semilla$n_casos_afectados, 2L)
  expect_identical(p$severidad, "advertencia")
})

test_that("lo propuesto es insertable tal cual: pasa el schema real de reglas custom", {
  # Si el candidato no valida, el analista recibe una propuesta que no puede
  # guardar — el sembrado sería decorativo.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  p <- reglas_semilla_procedencia(d)[[1]]
  expect_no_error(.validar_regla_custom(p))
})

test_that("lo propuesto, evaluado, marca exactamente los casos de la versión no vigente", {
  # El aserto que de verdad verifica: se compila con el compilador real y se
  # evalúa sobre la base. Sin esto, un candidato bien formado pero con la
  # versión equivocada pasaría igual.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  p <- reglas_semilla_procedencia(d)[[1]]

  expr <- .regla_expr_fuera_catalogo("`__version__`", p$params)
  marcados <- which(as.logical(eval(parse(text = expr), envir = d)))

  expect_identical(marcados, 9:10)
  expect_true(all(d[["__version__"]][marcados] == "vVieja"))
})

test_that("no vuelve a proponer lo que ya está cubierto", {
  # Idempotencia: sin esto, cada carga acumula el mismo criterio otra vez.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  ya <- list(list(id = "RC_001", tipo = "fuera_catalogo",
                  variables = list("__version__"), params = list(valores = list("vNueva"))))
  expect_length(reglas_semilla_procedencia(d, ya), 0L)

  # Pero un criterio sobre OTRA variable no lo cubre.
  otra <- list(list(id = "RC_001", tipo = "fuera_catalogo",
                    variables = list("p1"), params = list(valores = list("a"))))
  expect_length(reglas_semilla_procedencia(d, otra), 1L)
})

test_that("desempata por el envío más reciente cuando las versiones están parejas", {
  # 5 y 5: la mayoría no decide. Manda la última que llegó, porque una versión
  # se publica y a partir de ahí se usa.
  d <- .sem_base(c(rep("vVieja", 5), rep("vNueva", 5)))
  p <- reglas_semilla_procedencia(d)[[1]]
  expect_identical(unlist(p$params$valores), "vNueva")
})

test_that("el sembrador no nombra variables de ningún proyecto", {
  # V1 de la vara: solo metadatos de plataforma y roles declarados.
  fuente <- readLines(
    testthat::test_path("..", "..", "R", "reglas_custom_semilla.R"),
    warn = FALSE
  )
  prohibidas <- c("name_ppl", "Pulso_code", "telephone", "emp_impact",
                  "Em_NowWork", "Enumerator_name", "proyecto_ppl")
  for (v in prohibidas) {
    expect_false(any(grepl(v, fuente, fixed = TRUE)),
                 info = sprintf("el sembrador menciona '%s'", v))
  }
})

test_that("reglas_semilla_todas reúne lo de cada sembrador", {
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)))
  expect_length(reglas_semilla_todas(d), 1L)
  expect_length(reglas_semilla_todas(.sem_base(rep("vA", 5))), 0L)
})
