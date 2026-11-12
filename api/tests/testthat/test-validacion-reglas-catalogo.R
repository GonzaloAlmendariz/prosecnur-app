# Catálogo de reglas de una base (M3 de Validación):
# GET /api/validacion/v2/reglas/catalogo. Solo lee.
#
# Fixture: dos bases hermanas ("Hogares" y "Personas", activa "Personas") con un
# formulario de cuatro preguntas:
#   p8   "¿Trabaja actualmente?" (Sí / No)
#   p10  "Sector de la empresa", obligatoria, con salto ${p8} = '1'
#   edad "Edad", con restricción de 18 a 99
# En "Personas" hay 426 casos: a 12 les corresponde p10 (p8 = Sí) y 3 de ellos la
# dejaron vacía; de los 414 a los que no les corresponde, 2 la respondieron. El
# salto "debe" marca 3 de 12, no 3 de 426.

.m3_survey <- function() {
  data.frame(
    type = c("text", "select_one sino", "text", "integer"),
    name = c("caso", "p8", "p10", "edad"),
    label = c("Código del caso", "¿Trabaja actualmente?", "Sector de la empresa", "Edad"),
    required = c("", "", "yes", ""),
    relevant = c("", "", "${p8} = '1'", ""),
    constraint = c("", "", "", ". >= 18 and . <= 99"),
    stringsAsFactors = FALSE
  )
}

.m3_datos <- function(n = 426L) {
  p8 <- rep(2L, n); p8[seq_len(min(12L, n))] <- 1L
  p10 <- rep("", n)
  if (n >= 12L) p10[1:9] <- "Comercio"
  if (n >= 14L) p10[13:14] <- "Servicios"
  edad <- rep(30L, n)
  if (n >= 2L) edad[1:2] <- 15L
  data.frame(respondent_id = sprintf("u%03d", seq_len(n)), caso = sprintf("C%03d", seq_len(n)),
             p8 = p8, p10 = p10, edad = edad, stringsAsFactors = FALSE)
}

.m3_archivos <- function(dir, datos) {
  xls <- file.path(dir, "formulario.xlsx")
  choices <- data.frame(list_name = c("sino", "sino"), name = c("1", "2"),
                        label = c("Sí", "No"), stringsAsFactors = FALSE)
  openxlsx::write.xlsx(list(survey = .m3_survey(), choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE)
  list(xlsform = xls, data = csv, datos = datos)
}

.m3_sesion <- function(dir, datos_personas = .m3_datos(), datos_hogares = .m3_datos(20L)) {
  sid <- session_create()
  for (nombre in c("Hogares", "Personas")) {
    sub <- file.path(dir, nombre)
    dir.create(sub, showWarnings = FALSE, recursive = TRUE)
    f <- .m3_archivos(sub, if (identical(nombre, "Personas")) datos_personas else datos_hogares)
    xm <- save_upload(sid, "xlsform", basename(f$xlsform),
                      readBin(f$xlsform, "raw", n = file.info(f$xlsform)$size))
    dm <- save_upload(sid, "data", basename(f$data),
                      readBin(f$data, "raw", n = file.info(f$data)$size))
    inst <- reporte_instrumento(path = xm$path)
    estudio_add_base(
      sid = sid, nombre = nombre, xlsform_file_id = xm$file_id,
      data_file_id = dm$file_id, data_ext = "csv",
      rp_data = reporte_data(f$datos, instrumento = inst), rp_inst = inst,
      n_filas = nrow(f$datos), n_columnas = ncol(f$datos)
    )
  }
  s <- session_get(sid)
  s$estudio$active_base <- "Personas"
  .session_env[[sid]] <- s
  sid
}

.m3_plan <- function(sid, base) {
  files <- .resolve_base_files(sid, base)
  inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
  bundle <- build_validation_bundle(inst, incluir = list(required = TRUE, relevant = TRUE, constraint = TRUE))
  validacion_scope_set(sid, base, "plan_result",
                       list(plan = bundle$plan %||% compile_rules_to_plan(bundle$rules), bundle = bundle))
  bundle
}

.m3_regla <- function(cat, familia, direccion = NULL) {
  hit <- Filter(function(f) identical(f$familia, familia) && !is.na(f$id_motor) &&
                  (is.null(direccion) || identical(f$direccion, direccion)), cat$reglas)
  testthat::expect_length(hit, 1L)
  hit[[1]]
}

.m3_texto <- function(frase) {
  paste(vapply(frase, function(f) {
    if (!is.null(f$texto)) f$texto else if (!is.null(f$pregunta)) f$etiqueta else as.character(f$valor)
  }, character(1)), collapse = "")
}

# Punto medio, raya, comillas angulares y puntos suspensivos, por su código: el
# patrón no lleva los caracteres para que la revisión de redacción no lo lea
# como texto visible.
.m3_sin_vetados <- function(x) {
  x <- x[!is.na(x)]
  patron <- paste0("[", intToUtf8(c(0xb7, 0x2014, 0xab, 0xbb, 0x2026)), "]")
  testthat::expect_false(any(grepl(patron, x)), info = paste(x[grepl(patron, x)], collapse = " | "))
}

test_that("con plan y sin auditoría: cada regla con su frase, sin cifras de auditoría", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")

  expect_true(cat$plan_construido)
  expect_true(is.na(cat$auditada_en))
  expect_identical(cat$base_nombre, "Personas")
  expect_identical(cat$n_total, length(cat$reglas))
  expect_identical(cat$n_activas, cat$n_total)
  expect_identical(cat$por_origen$formulario, cat$n_total)
  ids <- vapply(cat$reglas, `[[`, "", "id")
  expect_false(anyDuplicated(ids) > 0L)
  for (f in cat$reglas) {
    expect_true(identical(f$ultima_auditoria, NA), info = f$id)
    expect_identical(f$estado_evaluacion, "evaluada")
  }
  fams <- vapply(cat$familias, `[[`, "", "familia")
  expect_true(all(c("obligatoria", "salto", "restriccion") %in% fams))
  expect_identical(sum(vapply(cat$familias, `[[`, 0L, "n")), cat$n_total)

  # Una sola narrativa, en fichas, con las comillas y los separadores de la casa.
  debe <- .m3_regla(cat, "salto", "debe")
  expect_identical(debe$nombre, "Salto de \"Sector de la empresa\": vacía cuando le correspondía")
  expect_identical(.m3_texto(debe$frase), "Sector de la empresa se responde cuando ¿Trabaja actualmente? es Sí.")
  preg <- Filter(function(x) !is.null(x$pregunta), debe$frase)
  expect_identical(vapply(preg, `[[`, "", "pregunta"), c("p10", "p8"))
  expect_identical(vapply(preg, `[[`, "", "tipo"), c("texto", "unica"))
  valor <- Filter(function(x) !is.null(x$valor), debe$frase)[[1]]
  expect_identical(valor$valor, "Sí")
  expect_identical(valor$codigo, "1")
  expect_identical(debe$expresion_formulario, "${p8} = '1'")
  nodebe <- .m3_regla(cat, "salto", "nodebe")
  expect_identical(.m3_texto(nodebe$frase), "Sector de la empresa queda vacía cuando ¿Trabaja actualmente? no es Sí.")
  expect_identical(debe$pareja, nodebe$id)
  expect_identical(nodebe$pareja, debe$id)

  rango <- .m3_regla(cat, "restriccion")
  expect_identical(rango$nombre, "\"Edad\" entre 18 y 99")
  expect_identical(rango$limites$min, "18")
  expect_identical(rango$limites$max, "99")
  expect_identical(rango$limites$tipo, "numero")
  expect_identical(rango$clase, "inconsistencia")
  expect_true(is.na(rango$tratamiento_previsto$accion))

  textos <- unlist(lapply(cat$reglas, function(f) c(f$nombre, .m3_texto(f$frase), f$causa, f$familia_nombre)))
  .m3_sin_vetados(textos)
})

test_that("salto: la base es a quienes correspondía (3 de 12) y no la base entera (3 de 426)", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  .m2_auditar(sid, "Personas")
  ev <- validacion_scope_get(sid, "Personas")$evaluacion
  cat <- validacion_reglas_catalogo(sid, "Personas")

  debe <- .m3_regla(cat, "salto", "debe")$ultima_auditoria
  expect_identical(debe$n_casos, 3L)
  expect_identical(debe$n_base, 12L)
  expect_equal(debe$porcentaje, 3 / 12)
  expect_identical(debe$n_base_indeterminada, 0L)
  expect_identical(debe$base_tipo, "condicion_verdadera")
  expect_identical(debe$base_definicion, "a quienes les correspondía responder")
  expect_identical(debe$nivel, "caso")

  nodebe <- .m3_regla(cat, "salto", "nodebe")$ultima_auditoria
  expect_identical(nodebe$n_casos, 2L)
  expect_identical(nodebe$n_base, 414L)
  expect_identical(nodebe$base_definicion, "a quienes no les correspondía responder")

  rango <- .m3_regla(cat, "restriccion")$ultima_auditoria
  expect_identical(rango$n_casos, 2L)
  expect_identical(rango$n_base, 426L)
  expect_identical(rango$base_definicion, "que respondieron la pregunta")

  # El resumen de la auditoría no cambia: sigue dividiendo por todas las filas.
  fila <- ev$resumen[ev$resumen$id_regla == .m3_regla(cat, "salto", "debe")$id_motor, ]
  expect_equal(fila$porcentaje, 3 / 426)
  expect_identical(cat$auditada_en, ev$auditada_en)
  expect_length(cat$avisos, 0L)
})

test_that("la base se cuenta con las opciones del formulario y dice cuándo la condición no se pudo evaluar", {
  # El export trae "Sí"/"No" y el formulario compara con el código '1'. En la
  # auditoría la condición del salto sale indeterminada (NA) en todas las filas
  # y la regla reporta 0 casos sin decir nada; el catálogo lo deja a la vista:
  # base 0, 426 filas indeterminadas y un aviso. La base se cuenta con las
  # opciones del formulario, como la auditoría: sin ellas el motor la tomaría
  # por "desalineada" y la base quedaría sin contar.
  datos <- .m3_datos()
  datos$p8 <- ifelse(datos$p8 == 1L, "Sí", "No")
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = datos)
  .m3_plan(sid, "Personas")
  .m2_auditar(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  debe <- .m3_regla(cat, "salto", "debe")
  expect_identical(debe$ultima_auditoria$n_casos, 0L)
  expect_identical(debe$ultima_auditoria$n_base, 0L)
  expect_identical(debe$ultima_auditoria$n_base_indeterminada, 426L)
  expect_true(is.na(debe$ultima_auditoria$porcentaje))
  codigos <- vapply(cat$avisos, `[[`, "", "codigo")
  expect_false("base_sin_contar" %in% codigos)
  aviso <- cat$avisos[[match("base_indeterminada", codigos)]]
  expect_true(debe$id %in% unlist(aviso$ids))
})

test_that("el catálogo no escribe en ninguna base y no cae en la primera", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  .m3_plan(sid, "Hogares")
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla("RC_001", "rango_num", list("edad"),
                                                                        list(min = 18, max = 65))))
  .m2_auditar(sid, "Personas")
  antes <- session_get(sid)

  activa <- validacion_reglas_catalogo(sid)
  personas <- validacion_reglas_catalogo(sid, "Personas")
  hogares <- validacion_reglas_catalogo(sid, "Hogares")

  expect_identical(session_get(sid), antes)
  expect_identical(activa$base_nombre, "Personas")
  expect_identical(personas$por_origen$propia, 1L)
  expect_identical(hogares$por_origen$propia, 0L)
  expect_true(is.na(hogares$auditada_en))
  expect_true(all(vapply(hogares$reglas, function(f) identical(f$ultima_auditoria, NA), logical(1))))
  propia <- Filter(function(f) identical(f$origen, "propia"), personas$reglas)[[1]]
  expect_identical(propia$familia, "rango_num")
  expect_identical(propia$familia_nombre, "Valor fuera de rango")
  expect_identical(propia$clase, "caso_a_revisar")
  expect_identical(propia$tratamiento_previsto$accion, "ignore_rule")
  expect_identical(propia$ultima_auditoria$base_tipo, "todas")
  expect_identical(propia$ultima_auditoria$n_base, 426L)
  expect_error(validacion_reglas_catalogo(sid, "Empresas"), class = "api_error")
})

test_that("filtro por pregunta: solo las reglas que la leen, y una pregunta desconocida avisa", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  todas <- validacion_reglas_catalogo(sid, "Personas")
  p8 <- validacion_reglas_catalogo(sid, "Personas", variable = "p8")

  expect_identical(p8$variable, "p8")
  expect_true(p8$n_total > 0L && p8$n_total < todas$n_total)
  expect_true(all(vapply(p8$reglas, function(f) "p8" %in% unlist(f$variables), logical(1))))
  expect_setequal(vapply(p8$reglas, `[[`, "", "familia"), c("salto", "obligatoria"))
  expect_identical(p8$n_total, length(p8$reglas))

  nada <- validacion_reglas_catalogo(sid, "Personas", variable = "p99")
  expect_identical(nada$n_total, 0L)
  expect_identical(vapply(nada$avisos, `[[`, "", "codigo"), "variable_desconocida")
})

test_that("desactivadas, preguntas excluidas y expresiones de listado externo salen con su causa", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  bundle <- .m3_plan(sid, "Personas")
  rid <- as.character(Filter(function(r) identical(r$tipo_regla, "constraint"), bundle$rules)[[1]]$id)
  validacion_scope_set(sid, "Personas", "reglas_desactivadas", rid)
  validacion_scope_set(sid, "Personas", "reglas_desactivadas_motivo",
                       stats::setNames(list(list(motivo = "Se revisa a mano")), rid))
  validacion_scope_set(sid, "Personas", "variables_excluidas", "p10")
  pr <- validacion_scope_get(sid, "Personas")$plan_result
  pr$bundle$discarded <- list(list(row_name = "caso", field = "constraint", origin = "pulldata",
                                   expression = "pulldata('padron', 'id', 'id', .) != ''"))
  validacion_scope_set(sid, "Personas", "plan_result", pr)

  cat <- validacion_reglas_catalogo(sid, "Personas")
  rango <- .m3_regla(cat, "restriccion")
  expect_false(rango$activa)
  expect_identical(rango$motivo_desactivada, "Se revisa a mano")
  expect_identical(cat$n_activas, cat$n_total - 1L)

  salto <- .m3_regla(cat, "salto", "debe")
  expect_identical(salto$estado_evaluacion, "sin_evaluar")
  expect_identical(salto$causa_codigo, "variable_excluida")
  expect_identical(salto$causa, "Pregunta fuera de la auditoría")

  externa <- Filter(function(f) identical(f$causa_codigo, "listado_externo"), cat$reglas)
  expect_length(externa, 1L)
  expect_identical(externa[[1]]$id, "sin_regla:constraint:caso")
  expect_false(externa[[1]]$se_puede_desactivar)
  expect_identical(externa[[1]]$expresion_formulario, "pulldata('padron', 'id', 'id', .) != ''")
  sin_ev <- sum(vapply(cat$reglas, function(f) identical(f$estado_evaluacion, "sin_evaluar"), logical(1)))
  expect_identical(cat$n_sin_evaluar, sin_ev)
  expect_identical(sum(vapply(cat$familias, `[[`, 0L, "n_sin_evaluar")), sin_ev)
})

test_that("un id de regla repetido en el motor sale único en el catálogo, con el id del motor aparte", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  bundle <- .m3_plan(sid, "Personas")
  copia <- Filter(function(r) identical(r$tipo_regla, "constraint"), bundle$rules)[[1]]
  copia$tabla <- "rep_hijos"
  pr <- validacion_scope_get(sid, "Personas")$plan_result
  pr$bundle$rules <- c(pr$bundle$rules, list(copia))
  validacion_scope_set(sid, "Personas", "plan_result", pr)

  cat <- validacion_reglas_catalogo(sid, "Personas")
  ids <- vapply(cat$reglas, `[[`, "", "id")
  expect_false(anyDuplicated(ids) > 0L)
  dobles <- Filter(function(f) identical(f$id_motor, as.character(copia$id)), cat$reglas)
  expect_length(dobles, 2L)
  expect_setequal(vapply(dobles, `[[`, "", "id"),
                  paste0(copia$id, c("@principal", "@rep_hijos")))
  # Leer dos veces da los mismos ids.
  expect_identical(vapply(validacion_reglas_catalogo(sid, "Personas")$reglas, `[[`, "", "id"), ids)
})

test_that("base sin filas: el catálogo responde y la base de cada regla es 0, sin porcentaje", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = .m3_datos(0L))
  .m3_plan(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  expect_true(cat$n_total > 0L)
  .m2_auditar(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  ua <- Filter(is.list, lapply(cat$reglas, `[[`, "ultima_auditoria"))
  expect_true(length(ua) > 0L)
  for (u in ua) {
    expect_identical(u$n_base, 0L)
    expect_true(is.na(u$porcentaje))
  }
})

test_that("sin plan: solo las propias, y la ruta HTTP sirve el catálogo de la base pedida", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  inactiva <- .m1_regla("RC_010", "rango_num", list("edad"), list(min = 18, max = 65))
  inactiva$activa <- FALSE
  validacion_scope_set(sid, "Hogares", "reglas_custom", list(inactiva))
  pr <- .m1_router()

  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/reglas/catalogo", query = "base_nombre=Hogares")
  expect_identical(r$status, 200L)
  expect_identical(r$body$base_nombre, "Hogares")
  expect_false(r$body$plan_construido)
  expect_identical(r$body$n_total, 1L)
  expect_identical(r$body$n_activas, 0L)
  regla <- r$body$reglas[[1]]
  expect_identical(regla$id, "RC_010")
  expect_null(regla$ultima_auditoria)
  expect_true(is.list(regla$frase) && length(regla$frase) > 0L)
  expect_true(is.list(regla$variables))

  .m3_plan(sid, "Personas")
  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/reglas/catalogo", query = "variable=edad")
  expect_identical(r$status, 200L)
  expect_identical(r$body$base_nombre, "Personas")
  expect_identical(r$body$variable, "edad")
  expect_true(all(vapply(r$body$reglas, function(f) "edad" %in% unlist(f$variables), logical(1))))

  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/reglas/catalogo", query = "base_nombre=Empresas")
  expect_identical(r$status, 404L)
  expect_identical(r$body$error$code, "E_BASE_NOT_FOUND")
})

test_that("en modo público la ruta responde 403", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  withr::local_envvar(PULSO_PUBLIC_MODE = "1")
  pr <- apply_public_mode_filter(.m1_router())
  r <- .m1_http(pr, sid, "GET", "/api/validacion/v2/reglas/catalogo")
  expect_identical(r$status, 403L)
  expect_identical(r$body$error$code, "E_FORBIDDEN_PUBLIC")
})
