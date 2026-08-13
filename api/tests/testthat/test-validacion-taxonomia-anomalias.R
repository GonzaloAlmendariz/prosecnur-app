# Lote 6 del GOAL de validación extrínseca: los cuatro tipos de anomalía y el
# enunciado que describe el hecho en vez de la regla.
#
# Los nombres los fijó el equipo el 2026-08-12: contradicción, valor inválido,
# faltante indebido y anomalía de procedencia. La fecha fuera del periodo de
# campo entra dentro de procedencia, no como tipo propio.

source("setup-load-all.R")

test_that("el catálogo expone los cuatro tipos acordados, en orden", {
  cat_ <- validacion_anomalias_catalogo()
  expect_length(cat_, 4L)
  expect_identical(
    vapply(cat_, function(x) x$slug, character(1)),
    c("contradiccion", "valor_invalido", "faltante", "procedencia")
  )
})

test_that("las reglas del instrumento se clasifican por su tipo", {
  # El salto violado es una contradicción: la respuesta choca con el dato que
  # gobierna su relevancia. `required` es el faltante. `constraint` declara un
  # dominio a mano, así que es valor inválido.
  expect_identical(validacion_anomalia_tipo("skip"), "contradiccion")
  expect_identical(validacion_anomalia_tipo("required"), "faltante")
  expect_identical(validacion_anomalia_tipo("constraint"), "valor_invalido")
  expect_identical(validacion_anomalia_tipo("calculate_check"), "contradiccion")
})

test_that("el sembrador manda sobre el tipo de regla", {
  # Procedencia y dominio usan las dos el mismo tipo `fuera_catalogo`, así que
  # sin el origen del sembrador ambas caerían en valor inválido — y una versión
  # de formulario no es un valor inválido.
  expect_identical(
    validacion_anomalia_tipo("fuera_catalogo", origen_semilla = "procedencia"),
    "procedencia"
  )
  expect_identical(
    validacion_anomalia_tipo("fuera_catalogo", origen_semilla = "dominio"),
    "valor_invalido"
  )
  # Sin origen, la heurística por tipo de regla.
  expect_identical(validacion_anomalia_tipo("fuera_catalogo"), "valor_invalido")
})

test_that("la fecha fuera de campo cae en procedencia, no en tipo propio", {
  expect_identical(
    validacion_anomalia_tipo("rango_fecha", origen_semilla = "periodo"),
    "procedencia"
  )
})

test_that("lo declarado explícitamente gana, y lo desconocido no se inventa", {
  expect_identical(
    validacion_anomalia_tipo("skip", declarado = "procedencia"), "procedencia"
  )
  # Un slug que no existe no se acepta: se cae al siguiente criterio.
  expect_identical(
    validacion_anomalia_tipo("skip", declarado = "inventado"), "contradiccion"
  )
  # Sin nada que permita clasificar, NA — la UI dirá "sin clasificar".
  expect_true(is.na(validacion_anomalia_tipo("tipo_que_no_existe")))
  expect_identical(validacion_anomalia_etiqueta(NA_character_), "Sin clasificar")
})

test_that("procedencia no se corrige tocando el dato", {
  # Lo consume Limpieza: ofrecer "anular campo" sobre un caso recolectado con
  # otro formulario sería ofrecer una acción que no arregla nada.
  expect_true(validacion_anomalia_corrige_dato("contradiccion"))
  expect_true(validacion_anomalia_corrige_dato("valor_invalido"))
  expect_true(validacion_anomalia_corrige_dato("faltante"))
  expect_false(validacion_anomalia_corrige_dato("procedencia"))
})

# --- Enunciado del hallazgo --------------------------------------------------

.tax_roles <- function() list(
  target = "emp_increase",
  drivers = c("Em_NowWork", "Consent", "proyecto_ppl"),
  labels = list(
    emp_increase = "Comparado con hace unos meses, ¿su ingreso mensual actual aumentó?",
    Em_NowWork = "En este momento, ¿usted se encuentra trabajando?",
    Consent = "¿Acepta continuar con la encuesta?"
  )
)

test_that("el enunciado nombra al sujeto, el hecho, el choque y la acción", {
  # Caso real de ACNUR MDV AGOSTO. Antes, la misma fila se describía como
  # "Si NO se cumple que (X es alguna de A, B, C y…), entonces P no debe
  # responderse": universal, negado y sin sujeto.
  out <- validacion_enunciado_hallazgo(
    "contradiccion", .tax_roles(), caso = "H1010",
    valores = list(emp_increase = "Mi ingreso se mantuvo igual",
                   Em_NowWork = "No estoy trabajando")
  )

  expect_identical(out$sujeto, "H1010")
  expect_true(grepl("Mi ingreso se mantuvo igual", out$texto, fixed = TRUE))
  expect_true(grepl("No estoy trabajando", out$texto, fixed = TRUE))
  expect_true(grepl("¿su ingreso mensual actual aumentó?", out$texto, fixed = TRUE))
  # El aserto que de verdad verifica: cero lógica negada en lo que se lee.
  expect_false(grepl("NO se cumple", out$texto, fixed = TRUE))
  expect_false(grepl("no debe responderse", out$texto, fixed = TRUE))
})

test_that("el choque elige el driver que cambió, no el de contexto", {
  # `Consent` y `proyecto_ppl` están en el gate de 403 de las 425 reglas: se
  # cumplen en casi todos los casos y no explican nada. El driver que importa es
  # el que trae un valor observado en ESTE caso.
  out <- validacion_enunciado_hallazgo(
    "contradiccion", .tax_roles(), caso = "H1010",
    valores = list(emp_increase = "2", Em_NowWork = "4")
  )
  expect_true(grepl("se encuentra trabajando", out$texto, fixed = TRUE))
  expect_false(grepl("Acepta continuar", out$texto, fixed = TRUE))
})

test_that("cada tipo dice su propio choque y su propia acción", {
  roles <- list(target = "emp_impact",
                labels = list(emp_impact = "¿El proceso le ayudó a conseguir empleo?"))

  inval <- validacion_enunciado_hallazgo("valor_invalido", roles, "H1010",
                                         list(emp_impact = "7"))
  expect_true(grepl("no está entre las opciones", inval$texto, fixed = TRUE))
  expect_true(grepl("Limpieza", inval$accion, fixed = TRUE))

  # Procedencia no manda a Limpieza: se confirma con campo.
  proc <- validacion_enunciado_hallazgo("procedencia", roles, "H1006",
                                        list(emp_impact = "1"))
  expect_true(grepl("Confirmar con campo", proc$accion, fixed = TRUE))
  expect_false(grepl("Limpieza", proc$accion, fixed = TRUE))
})

test_that("el faltante se enuncia como vacío, no como respuesta", {
  roles <- list(target = "p1", labels = list(p1 = "¿Cuál es su edad?"))
  out <- validacion_enunciado_hallazgo("faltante", roles, "H1042", list(p1 = ""))
  expect_true(grepl("Dejó vacía", out$texto, fixed = TRUE))
  expect_true(grepl("debía responderse", out$texto, fixed = TRUE))
})

test_that("sin etiqueta humana el enunciado usa el nombre técnico y no rompe", {
  out <- validacion_enunciado_hallazgo(
    "valor_invalido", list(target = "var_sin_label"), "C1", list(var_sin_label = "9")
  )
  expect_true(grepl("«var_sin_label»", out$texto, fixed = TRUE))
})

# --- L9 · el estado del dato, distinto del estado de la regla ---------------

test_that("una regla correcta con hallazgos ya no se lee como correcta", {
  # El síntoma que lo motivó: en pantalla se leía "correcta" al lado de
  # "1 inconsistencia". `estado_dinamico` califica la regla; este campo el dato.
  expect_identical(validacion_estado_dato("correcta", 1L), "con_hallazgos")
  expect_identical(validacion_estado_dato("correcta", 0L), "limpio")
  expect_identical(validacion_estado_dato_etiqueta("con_hallazgos"), "Con hallazgos")
})

test_that("una regla que no corrió no declara el dato limpio", {
  # Decir "limpio" sobre lo que nadie verificó es peor que decir nada.
  expect_identical(validacion_estado_dato("no_evaluada", 0L), "no_evaluada")
  expect_identical(validacion_estado_dato("incorrecta_ejecucion", 0L), "no_evaluada")
  expect_identical(validacion_estado_dato(NA, 0L), "no_evaluada")
  expect_identical(validacion_estado_dato_etiqueta("no_evaluada"), "No evaluada")
})

test_that("el enunciado dice la etiqueta de la opción, con el código detrás", {
  # Misma regla que el resto de la app. Un «4» no dice nada; «No estoy
  # trabajando» (4) sí — y es lo que el analista necesita leer sin ir al
  # diccionario de códigos.
  out <- validacion_enunciado_hallazgo(
    "contradiccion", .tax_roles(), caso = "H1010",
    valores = list(emp_increase = "2", Em_NowWork = "4"),
    etiquetas_valor = list(
      emp_increase = list("2" = "Mi ingreso se mantuvo igual"),
      Em_NowWork = list("4" = "No estoy trabajando")
    )
  )
  expect_true(grepl("«Mi ingreso se mantuvo igual» (2)", out$texto, fixed = TRUE))
  expect_true(grepl("«No estoy trabajando» (4)", out$texto, fixed = TRUE))
})

test_that("sin mapa de etiquetas el enunciado usa el código y no rompe", {
  out <- validacion_enunciado_hallazgo(
    "contradiccion", .tax_roles(), "H1010",
    valores = list(emp_increase = "2", Em_NowWork = "4")
  )
  expect_true(grepl("«2»", out$texto, fixed = TRUE))
})
