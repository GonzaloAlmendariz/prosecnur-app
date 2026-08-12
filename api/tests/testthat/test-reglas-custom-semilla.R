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

# --- Lote 2 · dominio de las preguntas de opción única -----------------------

.sem_survey <- function() {
  data.frame(
    name = c("p_sexo", "p_nse", "p_texto"),
    type_base = c("select_one", "select_one", "text"),
    list_name = c("lst_sexo", "lst_nse", NA),
    stringsAsFactors = FALSE
  )
}
.sem_choices <- function() {
  data.frame(
    list_name = c("lst_sexo", "lst_sexo", "lst_nse", "lst_nse", "lst_nse"),
    name = c("1", "2", "A", "B", "C"),
    label = c("Hombre", "Mujer", "Alto", "Medio", "Bajo"),
    stringsAsFactors = FALSE
  )
}

test_that("no propone dominio cuando todos los valores están en catálogo", {
  # Control negativo del sembrador de dominio.
  d <- data.frame(p_sexo = c("1", "2", "1"), p_nse = c("A", "B", "C"),
                  p_texto = c("x", "y", "z"), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_dominio(d, .sem_survey(), .sem_choices()), 0L)
})

test_that("propone una regla por variable con valores fuera de su lista", {
  d <- data.frame(p_sexo = c("1", "2", "9"),      # 9 no existe
                  p_nse = c("A", "B", "C"),        # todas válidas
                  p_texto = c("x", "y", "z"),
                  stringsAsFactors = FALSE)
  props <- reglas_semilla_dominio(d, .sem_survey(), .sem_choices())

  expect_length(props, 1L)
  p <- props[[1]]
  expect_identical(unlist(p$variables), "p_sexo")
  expect_identical(unlist(p$semilla$valores_fuera), "9")
  expect_identical(p$semilla$n_casos_afectados, 1L)
  # El catálogo admitido incluye los especiales de la casa.
  expect_true(all(c("1", "2", "98", "99") %in% unlist(p$params$valores)))
})

test_that("los valores especiales de la casa no se reportan como fuera de catálogo", {
  # Sin esta tolerancia, toda pregunta que use 98/99 sin declararlos en choices
  # produciría un falso positivo por caso.
  d <- data.frame(p_sexo = c("1", "98", "99"), p_nse = c("A", "B", "C"),
                  p_texto = c("x", "y", "z"), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_dominio(d, .sem_survey(), .sem_choices()), 0L)
})

test_that("lo propuesto por dominio es insertable y marca los casos correctos", {
  d <- data.frame(p_sexo = c("1", "2", "9", "7"), p_nse = c("A", "B", "C", "A"),
                  p_texto = c("x", "y", "z", "w"), stringsAsFactors = FALSE)
  p <- reglas_semilla_dominio(d, .sem_survey(), .sem_choices())[[1]]

  expect_no_error(.validar_regla_custom(p))
  expr <- .regla_expr_fuera_catalogo("p_sexo", p$params)
  expect_identical(which(as.logical(eval(parse(text = expr), envir = d))), 3:4)
})

test_that("dominio ignora preguntas que no son select_one ni están en la base", {
  d <- data.frame(p_texto = c("libre", "texto"), stringsAsFactors = FALSE)
  expect_length(reglas_semilla_dominio(d, .sem_survey(), .sem_choices()), 0L)
})

test_that("todo lo sembrado sale marcado con su origen", {
  # L12: sin esta marca, 100 criterios sembrados entierran los que una persona
  # escribió con criterio propio.
  d <- .sem_base(c(rep("vNueva", 8), rep("vVieja", 2)),
                 extra = list(p_sexo = c(rep("1", 9), "9")))
  props <- reglas_semilla_todas(d, list(), .sem_survey(), .sem_choices())

  expect_length(props, 2L)                       # procedencia + dominio
  expect_true(all(vapply(props, function(p) identical(p$origen, "sembrado"), logical(1))))
})

test_that("el origen por defecto es manual y solo admite valores conocidos", {
  expect_identical(.regla_origen(list()), "manual")
  expect_identical(.regla_origen(list(origen = "sembrado")), "sembrado")
  expect_identical(.regla_origen(list(origen = "inventado")), "manual")
})
