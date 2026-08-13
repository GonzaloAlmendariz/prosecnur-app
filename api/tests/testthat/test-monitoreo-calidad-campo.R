# M1 y M2 del GOAL de Monitoreo: el rol de agente llega al módulo y con él la
# primera señal de calidad del trabajo — quién sigue enviando con una versión
# vieja del formulario.
#
# Lo que se fija acá:
#   - sin rol declarado no hay alerta (V1: no se adivina la columna)
#   - una base sana no alerta (control negativo)
#   - la alerta nombra al agente y trae qué preguntarle (V3)
#   - un caso suelto no nombra a nadie

source("setup-load-all.R")

.mcc_base <- function(versiones, agentes, fechas = NULL) {
  d <- data.frame(
    `_uuid` = sprintf("u%02d", seq_along(versiones)),
    `__version__` = versiones,
    quien = agentes,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  if (!is.null(fechas)) d$cuando <- fechas
  d
}

test_that("sin rol de agente declarado no hay alerta", {
  # V1 de la vara: la versión vieja se sabría, pero no a quién llamar — y
  # adivinar la columna sería hardcodear un nombre de proyecto.
  d <- .mcc_base(c(rep("vNueva", 8), rep("vVieja", 4)), rep(c("Ana", "Luis"), 6))
  expect_length(monitoreo_alertas_procedencia(d, agent_var = ""), 0L)
  expect_length(monitoreo_alertas_procedencia(d, agent_var = "no_existe"), 0L)
})

test_that("una base con una sola versión no alerta a nadie", {
  # Control negativo: si alertara igual, el aserto de abajo no distinguiría un
  # campo sano de uno con el formulario desactualizado.
  d <- .mcc_base(rep("vUnica", 10), rep(c("Ana", "Luis"), 5))
  expect_length(monitoreo_alertas_procedencia(d, "quien"), 0L)
})

test_that("nombra al agente que sigue enviando con la versión vieja", {
  d <- .mcc_base(
    c(rep("vNueva", 10), rep("vVieja", 4)),
    c(rep("Ana", 10), rep("Luis", 4))
  )
  al <- monitoreo_alertas_procedencia(d, "quien")

  expect_length(al, 1L)
  expect_identical(al[[1]]$actor, "Luis")
  expect_identical(al[[1]]$tipo, "formulario_desactualizado")
  # Decisión del equipo: procedencia es la única señal que avisa fuerte, porque
  # es la única que produce datos irrecuperables.
  expect_identical(al[[1]]$severidad, "bloqueante")
  expect_identical(al[[1]]$detalle$n_casos, 4L)
  expect_identical(al[[1]]$detalle$version_vigente, "vNueva")
})

test_that("la alerta dice qué preguntarle, no solo que revise", {
  # V3 de la vara: «revisar» no le sirve a nadie; un nombre y una pregunta sí.
  d <- .mcc_base(c(rep("vNueva", 10), rep("vVieja", 3)),
                 c(rep("Ana", 10), rep("Luis", 3)))
  al <- monitoreo_alertas_procedencia(d, "quien")[[1]]
  expect_true(grepl("Luis", al$mensaje, fixed = TRUE))
  expect_true(grepl("Luis", al$detalle$pregunta, fixed = TRUE))
  expect_true(grepl("actualiz", al$detalle$pregunta, fixed = TRUE))
  expect_false(grepl("revisar", tolower(al$mensaje), fixed = TRUE))
})

test_that("un caso suelto no nombra a nadie", {
  # Uno puede ser un envío rezagado que ya se corrigió. Dos o más indican que
  # siguió trabajando sin actualizar.
  d <- .mcc_base(c(rep("vNueva", 10), "vVieja"), c(rep("Ana", 10), "Luis"))
  expect_length(monitoreo_alertas_procedencia(d, "quien"), 0L)
  # Bajando el mínimo sí aparece: el umbral es del criterio, no del motor.
  expect_length(monitoreo_alertas_procedencia(d, "quien", minimo = 1L), 1L)
})

test_that("con varios agentes rezagados, primero el que más arrastra", {
  d <- .mcc_base(
    c(rep("vNueva", 10), rep("vVieja", 7)),
    c(rep("Ana", 10), rep("Luis", 2), rep("Rosa", 5))
  )
  al <- monitoreo_alertas_procedencia(d, "quien")
  expect_length(al, 2L)
  expect_identical(vapply(al, function(x) x$actor, character(1)), c("Rosa", "Luis"))
})

test_that("dice desde cuándo si la base trae la marca temporal", {
  d <- .mcc_base(
    c(rep("vNueva", 6), rep("vVieja", 3)),
    c(rep("Ana", 6), rep("Luis", 3)),
    fechas = c(rep("2026-08-03T09:00:00", 6),
               "2026-08-03T11:00:00", "2026-08-03T12:00:00", "2026-08-03T13:00:00")
  )
  al <- monitoreo_alertas_procedencia(d, "quien", fecha_var = "cuando")[[1]]
  expect_identical(al$detalle$desde, "2026-08-03T11:00:00")
  expect_true(grepl("2026-08-03T11:00", al$mensaje, fixed = TRUE))
})

test_that("el rol de agente se lee de la declaración de Validación", {
  # M1: Monitoreo no inventa su propia declaración, lee la que ya existe.
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(bases = list(base_1 = list(
    nombre = "base_1",
    validacion = list(operational_config = list(
      version = 2L,
      identity = list(enabled = TRUE, variables = list("codigo"),
                      agent_variable = "quien_encuesto")
    ))
  )))
  .session_env[[sid]] <- s

  expect_identical(monitoreo_agente_declarado(sid, "base_1"), "quien_encuesto")
  # Sin declaración, cadena vacía — nunca un nombre inventado.
  expect_identical(monitoreo_agente_declarado(sid, "base_que_no_existe"), "")
  expect_identical(monitoreo_agente_declarado(session_create()), "")
})

test_that("el motor no confunde el roster planificado con el agente observado", {
  # Son preguntas distintas y ambas se conservan (decisión del 2026-08-13):
  # el roster PXXX dice quién debería trabajar, el rol quién trabajó. Este
  # archivo solo consume el segundo.
  fuente <- readLines(
    testthat::test_path("..", "..", "R", "monitoreo_calidad_campo.R"), warn = FALSE
  )
  # Solo el código: el docstring SÍ menciona el roster, y a propósito — explicar
  # que son cosas distintas es justamente lo que evita que alguien las mezcle.
  codigo <- fuente[!grepl("^\\s*#", fuente)]
  expect_false(any(grepl("roster_from_excel(", codigo, fixed = TRUE)))

  # V1: no nombra variables de ningún proyecto. Acá sí cuenta el archivo entero
  # —un ejemplo en un comentario deja el nombre de un cliente escrito en el repo—
  # y ya costó un rojo en el GOAL anterior.
  for (v in c("Enumerator_name", "Pulso_code", "proyecto_ppl", "Consent")) {
    expect_false(any(grepl(v, fuente, fixed = TRUE)), info = v)
  }
})
