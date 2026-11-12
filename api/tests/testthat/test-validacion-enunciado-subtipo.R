# Enunciado del hallazgo por subtipo (M4, cambio 4; validacion_enunciado_hallazgo.R)
# y una sola narrativa por regla en la cola, el detalle y el caso
# (validacion_narrativa_regla.R).

.en <- function(anomalia, regla, valores, target = "edad", drivers = list(), labels = list(edad = "Edad"),
                etiquetas_valor = list(), caso = "AUD-009") {
  validacion_enunciado_hallazgo(anomalia, list(target = target, drivers = drivers, labels = labels),
                                caso, valores = valores, etiquetas_valor = etiquetas_valor, regla = regla)$texto
}

test_that("cada subtipo dice lo que la regla declara, sin comillas angulares ni punto medio", {
  rango <- list(tipo_regla = "range", familia = "rango_num", limites = list(min = "18", max = "80"))
  expect_identical(.en("valor_invalido", rango, list(edad = "17")),
                   "AUD-009: respondió \"17\" en Edad, fuera del rango permitido (18 a 80). Revisar y corregir en Limpieza.")
  restr <- list(tipo_regla = "constraint", familia = "restriccion",
                limites = list(tipo = "numero", min = "18", max = "80", inclusive_min = TRUE, inclusive_max = TRUE))
  expect_identical(.en("valor_invalido", restr, list(edad = "17")),
                   "AUD-009: respondió \"17\" en Edad, que no cumple la restricción del formulario (Edad entre 18 y 80). Revisar y corregir en Limpieza.")
  un_lado <- list(tipo_regla = "constraint", familia = "restriccion",
                  limites = list(tipo = "numero", min = "0", max = NA, inclusive_min = TRUE))
  expect_match(.en("valor_invalido", un_lado, list(edad = "-1")), "(Edad mayor o igual a 0)", fixed = TRUE)
  fecha <- list(tipo_regla = "range", familia = "rango_fecha",
                limites = list(tipo = "fecha", min = "2026-05-01", max = "2026-06-30"))
  expect_identical(.en("valor_invalido", fecha, list(fecha = "2026-01-01"), target = "fecha", labels = list(fecha = "Fecha")),
                   "AUD-009: registró \"2026-01-01\" en Fecha, fuera del periodo permitido (del 2026-05-01 al 2026-06-30). Revisar y corregir en Limpieza.")
  esp <- c(rango, list(especiales = c(`99` = "No responde")))
  expect_identical(.en("valor_invalido", esp, list(edad = "99")),
                   "AUD-009: respondió \"No responde\" (99) en Edad, un código especial que la regla de rango no admite. Revisar y corregir en Limpieza.")
  cat_ <- list(tipo_regla = "catalog", familia = "fuera_catalogo")
  expect_identical(.en("valor_invalido", cat_, list(sexo = "7"), target = "sexo", labels = list(sexo = "Sexo")),
                   "AUD-009: respondió \"7\" en Sexo, que no está entre las opciones de la pregunta. Revisar y corregir en Limpieza.")
  faltante <- list(tipo_regla = "required", familia = "obligatoria")
  expect_identical(.en("faltante", faltante, list(edad = NA)),
                   "AUD-009: dejó vacía Edad, que es obligatoria. Revisar y corregir en Limpieza.")
  calc <- list(tipo_regla = "calculate_check", familia = "calculo")
  expect_identical(.en("contradiccion", calc, list(total = "1200"), target = "total", labels = list(total = "Ingreso total")),
                   "AUD-009: el valor calculado de Ingreso total (\"1200\") no coincide con el que resulta de sus componentes. Revisar y corregir en Limpieza.")
})

test_that("un salto dice si correspondía responder y elige el factor con valor en el caso", {
  et <- list(trabaja = list(`1` = "Sí", `2` = "No"))
  labels <- list(edad = "Edad", trabaja = "Trabaja", consent = "Consentimiento")
  debe <- list(tipo_regla = "skip", familia = "salto", direccion = "debe")
  # El primer factor (consentimiento) está vacío en el caso: se nombra el que tiene valor.
  expect_identical(.en("contradiccion", debe, list(edad = NA, consent = NA, trabaja = "1"),
                       drivers = list("consent", "trabaja"), labels = labels, etiquetas_valor = et),
                   "AUD-009: dejó vacía Edad, que correspondía responder porque declaró \"Sí\" (1) en Trabaja. Revisar y corregir en Limpieza.")
  nodebe <- list(tipo_regla = "skip", familia = "salto", direccion = "nodebe")
  expect_identical(.en("contradiccion", nodebe, list(edad = "30", trabaja = "2"), drivers = list("trabaja"),
                       labels = labels, etiquetas_valor = et),
                   "AUD-009: respondió \"30\" en Edad, que no correspondía porque declaró \"No\" (2) en Trabaja. Revisar y corregir en Limpieza.")
  coh <- list(tipo_regla = "coherence", familia = "coherencia_2v")
  expect_identical(.en("contradiccion", coh, list(p21 = "4", p4 = "1"), target = "p21", drivers = list("p4"),
                       labels = list(p21 = "P21", p4 = "P4"), etiquetas_valor = list(p4 = list(`1` = "Sí"))),
                   "AUD-009: respondió \"4\" en P21, que no es compatible con \"Sí\" (1) en P4. Revisar y corregir en Limpieza.")
})

test_that("la procedencia dice qué se declaró y se confirma con campo", {
  periodo <- list(tipo_regla = "range", familia = "rango_fecha", origen_semilla = "periodo",
                  limites = list(tipo = "fecha", min = "2026-05-01", max = "2026-06-30"))
  expect_identical(.en("procedencia", periodo, list(fecha = "2026-01-01"), target = "fecha", labels = list(fecha = "Fecha")),
                   "AUD-009: se registró el 2026-01-01, fuera del periodo de campo (del 2026-05-01 al 2026-06-30). Confirmar con campo antes de decidir si el caso entra.")
  version <- list(tipo_regla = "catalog", familia = "fuera_catalogo", origen_semilla = "procedencia", version_vigente = "v4")
  expect_match(.en("procedencia", version, list(v = "v3"), target = "v"),
               "se recolectó con la versión \"v3\" del formulario; el estudio declara \"v4\"", fixed = TRUE)
  cont <- list(tipo_regla = "continuidad_secuencia", familia = "continuidad_secuencia", origen_semilla = "continuidad",
               faltantes = list(118L, 140L))
  expect_match(.en("procedencia", cont, list(n = "117"), target = "n"),
               "es el envío 117 de la numeración del servidor y falta el envío 118", fixed = TRUE)
})

test_that("ningún enunciado usa comillas angulares, punto medio ni 'respondió sin respuesta'", {
  reglas <- list(list(tipo_regla = "range", familia = "rango_num"), list(tipo_regla = "skip", familia = "salto", direccion = "debe"),
                 list(tipo_regla = "skip", familia = "salto", direccion = "nodebe"), list(tipo_regla = "constraint", familia = "restriccion"),
                 list(), NULL)
  for (r in reglas) for (a in c("valor_invalido", "contradiccion", "faltante", "procedencia")) {
    for (v in list("5", NA)) {
      t <- .en(a, r, list(edad = v, otra = NA), drivers = list("otra"))
      expect_false(grepl("[\u00ab\u00bb\u00b7]", t), label = t)
      expect_false(grepl("sin respuesta", t, fixed = TRUE), label = t)
    }
  }
  expect_false(grepl("opciones", validacion_anomalias_catalogo()[[2]]$descripcion, fixed = TRUE) &&
                 !grepl("rango", validacion_anomalias_catalogo()[[2]]$descripcion, fixed = TRUE))
})

test_that("la cola, el detalle, el caso y el catálogo dan el mismo nombre, la misma frase y la misma severidad", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  # Una regla del formulario (obligatoriedad de la edad: marca u09) y una propia.
  .m1_plan(sid, "Personas")
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad(), .m1_regla_p4_p21()))
  .m2_auditar(sid, "Personas")
  pr <- .m1_router()
  cat_ <- .m1_http(pr, sid, "GET", "/api/validacion/v2/reglas/catalogo", query = "base_nombre=Personas")$body
  obligatoria <- Filter(function(f) identical(f$familia, "obligatoria"), cat_$reglas)[[1]]
  expect_identical(obligatoria$severidad, "error")
  lim <- .m1_http(pr, sid, "GET", "/api/validacion/v2/limpieza", query = "base_nombre=Personas")$body

  for (par in list(c(obligatoria$id_motor, "u09"), c("RC_001", "u01"))) {
    rid <- par[1]; caso_id <- par[2]
    ref <- Filter(function(f) identical(f$id_motor, rid), cat_$reglas)[[1]]
    q <- Filter(function(x) identical(x$source_id, rid), lim$decision_queue)[[1]]
    det <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                    body = sprintf('{"id_regla":"%s","base_nombre":"Personas"}', rid))$body
    caso <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = sprintf("id=%s&base_nombre=Personas", caso_id))$body
    h <- Filter(function(x) identical(x$id_regla, rid), caso$hallazgos)[[1]]
    for (x in list(q = list(q$nombre_regla, q$frase, q$severidad, q$clase, q$familia),
                   regla = list(det$regla$nombre, det$regla$frase, det$regla$severidad, det$regla$clase, det$regla$familia),
                   caso = list(h$nombre, h$frase, h$severidad, h$clase, h$familia))) {
      expect_identical(x[[1]], ref$nombre, label = rid)
      expect_identical(x[[2]], ref$frase, label = rid)
      expect_identical(x[[3]], ref$severidad, label = rid)
      expect_identical(x[[4]], ref$clase, label = rid)
      expect_identical(x[[5]], ref$familia, label = rid)
    }
    expect_true(q$en_catalogo)
  }
  expect_identical(Filter(function(f) identical(f$id_motor, "RC_001"), cat_$reglas)[[1]]$severidad, "advertencia")
  det <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                  body = '{"id_regla":"RC_001","base_nombre":"Personas"}')$body
  caso <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u01&base_nombre=Personas")$body
  h <- Filter(function(x) identical(x$id_regla, "RC_001"), caso$hallazgos)[[1]]
  # El enunciado del detalle y el del caso son el mismo.
  e1 <- det$esperado[[match("u01", unlist(det$case_ids))]]
  expect_identical(e1$texto, "u01: respondió \"15\" en Edad, fuera del rango permitido (16 a 25). Revisar y corregir en Limpieza.")
  expect_identical(h$esperado$texto, e1$texto)
})

# --- Ronda 2 (VERIFICACION_MOTOR_M4: O4, O5) ---------------------------------

test_that("O4: en un salto con varios factores se nombra el que decide la condición", {
  et <- list(consent = list(`1` = "Sí", `2` = "No"), trabaja = list(`1` = "Sí", `2` = "No"))
  labels <- list(edad = "Edad", trabaja = "Trabaja", consent = "Consentimiento")
  # relevant "consent = 1 and trabaja = 1": no correspondía porque trabaja = 2.
  nodebe <- list(tipo_regla = "skip", familia = "salto", direccion = "nodebe",
                 condicion = ast_not(ast_and(ast_compare_const("consent", "==", "1"),
                                             ast_compare_const("trabaja", "==", "1"))))
  expect_match(.en("contradiccion", nodebe, list(edad = "30", consent = "1", trabaja = "2"),
                   drivers = list("consent", "trabaja"), labels = labels, etiquetas_valor = et),
               "que no correspondía porque declaró \"No\" (2) en Trabaja", fixed = TRUE)
  # relevant "consent = 1 or trabaja = 1": correspondía porque trabaja = 1.
  debe <- list(tipo_regla = "skip", familia = "salto", direccion = "debe",
               condicion = ast_or(ast_compare_const("consent", "==", "1"),
                                  ast_compare_const("trabaja", "==", "1")))
  expect_match(.en("contradiccion", debe, list(edad = NA, consent = "2", trabaja = "1"),
                   drivers = list("consent", "trabaja"), labels = labels, etiquetas_valor = et),
               "que correspondía responder porque declaró \"Sí\" (1) en Trabaja", fixed = TRUE)
})

test_that("O5: la frase de dos respuestas que deben cuadrar dice lo que marca", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_p4_p21()))
  cat_ <- validacion_reglas_catalogo(sid, "Personas")
  f <- .vrf_texto_plano(Filter(function(x) identical(x$id_motor, "RC_002"), cat_$reglas)[[1]]$frase)
  # RC_002 marca P4 = 1 con P21 entre 4, 5, 6 y 8.
  expect_false(grepl("cuando si", f, fixed = TRUE))
  expect_false(grepl("no está entre", f, fixed = TRUE))
  expect_match(f, "Sí y ", fixed = TRUE)
})
