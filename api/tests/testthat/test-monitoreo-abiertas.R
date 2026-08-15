# M8 del GOAL de calidad de campo: avisar cuando una respuesta abierta no dice
# nada, mientras el caso todavía se puede recuperar.
#
# Lo que se fija acá es sobre todo lo que el detector NO debe marcar. Una señal
# que sospecha de respuestas legítimas se apaga sola: nadie sigue mirando una
# lista que grita en cada caso.

source("setup-load-all.R")

.mab_survey <- function() {
  data.frame(
    type = c("select_one si_no", "text", "text", "text", "integer"),
    type_base = c("select_one", "text", "text", "text", "integer"),
    name = c("barrera", "barrera_otra", "comentario", "codigo", "edad"),
    label = c("¿Tuvo alguna barrera?", "¿Qué otra barrera?",
              "Comentarios finales", "Código de caso", "Edad"),
    relevant = c("", "${barrera}='otro'", "", "", ""),
    stringsAsFactors = FALSE
  )
}

test_that("una respuesta real nunca se marca", {
  # Control que sostiene todo lo demás: sin esto, el aserto de abajo no
  # distingue un detector útil de uno que marca todo.
  reales <- c(
    "no le dieron el trabajo por ser extranjera",
    "certificación", "OFERTAS LABORALES", "Prefieren seleccionar personal peruano",
    "Es arquitecta y considera que prefieren contratar a varones.",
    "gas", "luz", "Sí", "ninguna", "no sabe"
  )
  expect_true(all(abierta_motivo_vacia(reales) == ""))
})

test_that("marca lo que no puede ser una respuesta, y dice por qué", {
  expect_identical(abierta_motivo_vacia("x"), "un_caracter")
  expect_identical(abierta_motivo_vacia("aaaa"), "caracter_repetido")
  expect_identical(abierta_motivo_vacia("---"), "caracter_repetido")
  expect_identical(abierta_motivo_vacia("123"), "sin_letras")
  # El caso real que hoy nadie ve hasta Codificación.
  expect_identical(abierta_motivo_vacia("hjk"), "sin_vocales")
  # Ninguna palabra encadena cinco consonantes; un manotazo sí.
  expect_identical(abierta_motivo_vacia("asdfghjkl"), "tecleo")
  # Y las que sí las tienen no se tocan: el español llega a cuatro.
  expect_identical(abierta_motivo_vacia(c("abstracto", "obstrucción")), c("", ""))
})

test_that("los vacíos y los NA no son hallazgos", {
  expect_true(all(abierta_motivo_vacia(c("", NA, "  ", "NA")) == ""))
})

test_that("por defecto solo se vigilan las que dependen de otra pregunta", {
  # El «otro, especifique» es contenido por construcción. El resto de los campos
  # de texto conviven con captura operativa y no se puede inferir cuál es cuál.
  d <- data.frame(
    barrera = "otro", barrera_otra = "hjk", comentario = "sin comentarios",
    codigo = "H1010", edad = 30, stringsAsFactors = FALSE
  )
  vg <- abiertas_vigiladas(d, .mab_survey())
  expect_identical(vg$variable, "barrera_otra")
  expect_identical(vg$origen, "dependiente")
})

test_that("una independiente se vigila si el estudio la declara", {
  d <- data.frame(
    barrera = "otro", barrera_otra = "algo", comentario = "hjk",
    codigo = "H1010", edad = 30, stringsAsFactors = FALSE
  )
  vg <- abiertas_vigiladas(d, .mab_survey(), declaradas = "comentario")
  expect_setequal(vg$variable, c("barrera_otra", "comentario"))
  expect_identical(vg$origen[vg$variable == "comentario"], "declarada")
  # Declarar una que ya se vigila no la duplica.
  vg2 <- abiertas_vigiladas(d, .mab_survey(), declaradas = "barrera_otra")
  expect_identical(sum(vg2$variable == "barrera_otra"), 1L)
})

test_that("sin instrumento no se vigila nada por cuenta propia", {
  # Adivinar por nombre de columna es justo lo que ninguna señal puede hacer.
  d <- data.frame(barrera_otra = "hjk", stringsAsFactors = FALSE)
  expect_identical(nrow(abiertas_vigiladas(d, NULL)), 0L)
  expect_length(monitoreo_alertas_abiertas(d, NULL), 0L)
})

test_that("la alerta nombra la pregunta, el agente y qué preguntar", {
  d <- data.frame(
    barrera = rep("otro", 4),
    barrera_otra = c("no la contrataron", "hjk", "falta de experiencia", ""),
    comentario = rep("", 4), codigo = sprintf("H%03d", 1:4), edad = rep(30, 4),
    quien = c("Ana Lopez", "Luis Diaz", "Ana Lopez", "Ana Lopez"),
    stringsAsFactors = FALSE
  )
  al <- monitoreo_alertas_abiertas(d, .mab_survey(), "quien", "codigo")

  expect_length(al, 1L)
  expect_identical(al[[1]]$tipo, "abierta_sin_contenido")
  # M7: solo procedencia avisa fuerte.
  expect_identical(al[[1]]$severidad, "advertencia")
  expect_identical(al[[1]]$actor, "Luis Diaz")
  expect_identical(al[[1]]$detalle$n_dudosas, 1L)
  expect_identical(al[[1]]$detalle$n_respondidas, 3L)
  expect_identical(al[[1]]$detalle$casos, "H002")
  # Etiqueta primero y código entre paréntesis.
  expect_true(grepl("¿Qué otra barrera? (barrera_otra)", al[[1]]$mensaje, fixed = TRUE))
  expect_true(grepl("Luis Diaz", al[[1]]$detalle$pregunta, fixed = TRUE))
})

test_that("varias respuestas vacías en la misma pregunta son una alerta", {
  # Si un encuestador escribió tres veces cualquier cosa en la misma pregunta,
  # es un problema, no tres.
  d <- data.frame(
    barrera = rep("otro", 3), barrera_otra = c("hjk", "x", "---"),
    comentario = rep("", 3), codigo = sprintf("H%03d", 1:3), edad = rep(30, 3),
    quien = rep("Luis Diaz", 3), stringsAsFactors = FALSE
  )
  al <- monitoreo_alertas_abiertas(d, .mab_survey(), "quien", "codigo")
  expect_length(al, 1L)
  expect_identical(al[[1]]$detalle$n_dudosas, 3L)
  expect_setequal(al[[1]]$detalle$motivos, c("sin_vocales", "un_caracter", "caracter_repetido"))
})

test_that("vigilar un campo operativo alertaría en toda la base", {
  # La razón medida por la que las independientes se declaran y no se infieren:
  # un teléfono no tiene letras, así que el detector lo marca entero.
  telefonos <- c("970508040", "907 610 039", "999111222")
  expect_true(all(abierta_motivo_vacia(telefonos) == "sin_letras"))
  # Y por eso no entra sin que alguien lo declare.
  d <- data.frame(barrera = "otro", barrera_otra = "algo", comentario = "",
                  codigo = "970508040", edad = 30, stringsAsFactors = FALSE)
  expect_length(monitoreo_alertas_abiertas(d, .mab_survey()), 0L)
})

test_that("el sugeridor separa texto de contenido de captura operativa", {
  d <- data.frame(
    barrera = rep("otro", 6), barrera_otra = rep("algo", 6),
    comentario = c("no conocen el servicio que se brinda a extranjeros",
                   "le piden experiencia que no puede obtener",
                   "considera que deberian difundir mas", "no conocen el servicio que se brinda a extranjeros",
                   "le piden experiencia que no puede obtener", "sin comentarios"),
    codigo = sprintf("H%03d", 1:6), edad = rep(30, 6),
    stringsAsFactors = FALSE
  )
  cand <- abiertas_candidatas(d, .mab_survey())
  por_var <- setNames(vapply(cand, function(c1) isTRUE(c1$probable_operativa), logical(1)),
                      vapply(cand, function(c1) c1$variable, character(1)))
  expect_false(por_var[["comentario"]])
  expect_true(por_var[["codigo"]])
  # Lo que parece contenido primero: es lo que el analista está buscando.
  expect_identical(cand[[1]]$variable, "comentario")
})

test_that("una variable que ya tiene otro rol no se propone como abierta", {
  # Medido: el nombre del encuestador —2,2 palabras, repetido entre casos— se
  # proponía como texto de contenido. El estudio ya dijo qué es esa columna.
  d <- data.frame(
    barrera = rep("otro", 4), barrera_otra = rep("algo", 4),
    comentario = rep("Ana Lopez", 4), codigo = sprintf("H%03d", 1:4),
    edad = rep(30, 4), stringsAsFactors = FALSE
  )
  sin_rol <- abiertas_candidatas(d, .mab_survey())
  expect_true("comentario" %in% vapply(sin_rol, function(c1) c1$variable, character(1)))

  con_rol <- abiertas_candidatas(d, .mab_survey(), roles_declarados = "comentario")
  expect_false("comentario" %in% vapply(con_rol, function(c1) c1$variable, character(1)))
})

test_that("el rol de abiertas se declara y viaja en la config operacional", {
  cfg <- normalize_validation_operational_config(list(
    version = 2L, abiertas = list(enabled = TRUE, variables = list("comentario"))
  ))
  expect_true(cfg$abiertas$enabled)
  expect_identical(cfg$abiertas$variables, "comentario")

  # Activarlo sin declarar nada no es un estado válido: no vigilaría nada y se
  # leería como que sí.
  expect_error(
    normalize_validation_operational_config(list(
      version = 2L, abiertas = list(enabled = TRUE, variables = list())
    )),
    "al menos una variable"
  )
  # Y la variable declarada tiene que existir en la base.
  expect_error(
    normalize_validation_operational_config(
      list(version = 2L, abiertas = list(enabled = TRUE, variables = list("no_existe"))),
      available_variables = c("comentario")
    ),
    "no encontradas"
  )
})
