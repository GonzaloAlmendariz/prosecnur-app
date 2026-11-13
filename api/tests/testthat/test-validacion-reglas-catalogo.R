# Catálogo de reglas de una base (M3 de Validación):
# GET /api/validacion/v2/reglas/catalogo. Solo lee.
#
# Fixture: dos bases hermanas ("Hogares" y "Personas", activa "Personas") con un
# formulario de cuatro preguntas:
#   p8   "¿Trabaja actualmente?" (Sí / No)
#   caso "Código del caso", obligatoria
#   p10  "Sector de la empresa", con salto ${p8} = '1'
#   edad "Edad", con restricción de 18 a 99
# p10 no es obligatoria: si lo fuera, su vacío lo marcaría la obligatoria y no
# el salto "debe", que repetiría la misma marca (ítem 42 del checklist de
# Validación usada por un practicante; test-validacion-salto-seccion.R).
# En "Personas" hay 426 casos: a 12 les corresponde p10 (p8 = Sí) y 3 de ellos la
# dejaron vacía; de los 414 a los que no les corresponde, 2 la respondieron. El
# salto "debe" marca 3 de 12, no 3 de 426.

.m3_survey <- function() {
  data.frame(
    type = c("text", "select_one sino", "text", "integer"),
    name = c("caso", "p8", "p10", "edad"),
    label = c("Código del caso", "¿Trabaja actualmente?", "Sector de la empresa", "Edad"),
    required = c("yes", "", "", ""),
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

.m3_archivos <- function(dir, datos, survey = .m3_survey()) {
  xls <- file.path(dir, "formulario.xlsx")
  choices <- data.frame(list_name = c("sino", "sino"), name = c("1", "2"),
                        label = c("Sí", "No"), stringsAsFactors = FALSE)
  openxlsx::write.xlsx(list(survey = survey, choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE)
  list(xlsform = xls, data = csv, datos = datos)
}

.m3_sesion <- function(dir, datos_personas = .m3_datos(), datos_hogares = .m3_datos(20L), survey = .m3_survey()) {
  sid <- session_create()
  for (nombre in c("Hogares", "Personas")) {
    sub <- file.path(dir, nombre)
    dir.create(sub, showWarnings = FALSE, recursive = TRUE)
    f <- .m3_archivos(sub, if (identical(nombre, "Personas")) datos_personas else datos_hogares, survey)
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
  # Sin auditoría ninguna regla está evaluada: todas salen sin evaluar, con su
  # causa (ítem 6 del checklist del practicante).
  for (f in cat$reglas) {
    expect_true(identical(f$ultima_auditoria, NA), info = f$id)
    expect_identical(f$estado_evaluacion, "sin_evaluar")
    expect_identical(f$causa_codigo, "sin_auditoria")
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
  # Dice lo que se marca, como el título, no la regla (ítem 41).
  expect_identical(.m3_texto(nodebe$frase), "Se marca cuando Sector de la empresa tiene respuesta y ¿Trabaja actualmente? no es Sí.")
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
  expect_setequal(vapply(p8$reglas, `[[`, "", "familia"), "salto")
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

# --- Segunda entrega (verificación de M3) ------------------------------------

test_that("restricción con condición y vacíos: la base es quienes respondieron y cumplen la condición", {
  survey <- rbind(.m3_survey(), data.frame(type = "integer", name = "horas", label = "Horas trabajadas",
    required = "", relevant = "${p8} = '1'", constraint = ". <= 80", stringsAsFactors = FALSE))
  datos <- .m3_datos()
  datos$horas <- NA_integer_
  datos$horas[1:12] <- c(90L, 95L, NA, NA, rep(40L, 8))
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = datos, survey = survey)
  .m3_plan(sid, "Personas")
  .m2_auditar(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  horas <- Filter(function(f) identical(f$variable_revisada, "horas") && identical(f$familia, "restriccion"), cat$reglas)[[1]]
  expect_identical(horas$ultima_auditoria$n_casos, 2L)
  expect_identical(horas$ultima_auditoria$n_base, 10L)
  expect_identical(horas$ultima_auditoria$base_tipo, "respondieron")
  expect_identical(horas$limites$max, "80")
  expect_true(is.na(horas$limites$min))
  expect_true(horas$limites$inclusive_max)
  expect_identical(horas$nombre, "\"Horas trabajadas\" menor o igual a 80")
})

test_that("las exclusiones de recolección salen de la base, también de la base de todas las filas", {
  exclusiones <- list(list(excluded_validation_vars = list("edad"), collector_ids = "K2",
                           validation_exclusion_profile = "telefonico"))
  testthat::local_mocked_bindings(.validacion_mb_collection_exclusions_for_base = function(...) exclusiones)
  datos <- .m3_datos()
  datos$collector_id <- ifelse(seq_len(nrow(datos)) > 400L, "K2", "K1")
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = datos)
  .m3_plan(sid, "Personas")
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla("RC_001", "rango_num", list("edad"),
                                                                        list(min = 18, max = 65))))
  .m2_auditar(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  rango <- .m3_regla(cat, "restriccion")$ultima_auditoria
  expect_identical(rango$n_base, 400L)
  propia <- Filter(function(f) identical(f$origen, "propia"), cat$reglas)[[1]]$ultima_auditoria
  expect_identical(propia$base_tipo, "todas")
  expect_identical(propia$n_base, 400L)
  expect_lte(propia$n_casos, propia$n_base)
})

.m3_familias <- function() {
  survey <- data.frame(
    type = c("integer", "integer", "calculate", "integer", "begin_repeat", "text", "end_repeat", "date"),
    name = c("a", "b", "total", "n_hijos", "hijos", "hijo_nombre", "hijos", "fecha"),
    label = c("Hombres", "Mujeres", "Total de personas", "Número de hijos", "Hijos del hogar", "Nombre del hijo", "", "Fecha de visita"),
    calculation = c("", "", "${a} + ${b}", "", "", "", "", ""),
    repeat_count = c("", "", "", "", "${n_hijos}", "", "", ""),
    required = "", relevant = "", constraint = c("", "", "", ". >= 0", "", "", "", ""),
    stringsAsFactors = FALSE)
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = data.frame(list_name = "x", name = "1", label = "X")), x)
  inst <- leer_xlsform_limpieza(x, verbose = FALSE)
  b <- build_validation_bundle(inst)
  cfg <- list(version = 2L, field_period = list(enabled = TRUE, variable = "fecha",
                                                start_date = "2026-06-01", end_date = "2026-06-30"),
              duplicates = list(enabled = TRUE, variables = as.list(sprintf("v%02d", 1:10)),
                                matching_method = "response_similarity"))
  b <- validation_operational_append_rules(b, cfg)
  dup <- rule_duplicate(vars = c("_parent_index", "hijo_nombre"))
  dup$tabla <- "hijos"; dup$presentation$subtipo_semantico <- "relacional"
  filtro <- make_rule(nombre = "filtro", tipo_regla = "constraint", fuente = "instrumento",
                      predicate = ast_not_in_set("a", c("1", "2")))
  b$rules <- c(b$rules, list(dup, filtro))
  plan <- compile_rules_to_plan(b$rules)
  plan[["Categoría"]][plan$ID == filtro$id] <- "Filtro de opciones"
  list(inst = inst, bundle = b, plan = plan, xlsform = x)
}

test_that("familias sin cobertura: cálculo, grupo repetido, periodo, casi iguales y filtro de opciones", {
  fx <- .m3_familias()
  sid <- session_create()
  xm <- save_upload(sid, "xlsform", "f.xlsx", readBin(fx$xlsform, "raw", n = file.info(fx$xlsform)$size))
  estudio_add_base(sid = sid, nombre = "Hogares", xlsform_file_id = xm$file_id, data_file_id = NULL,
                   data_ext = "csv", rp_data = NULL, rp_inst = NULL, n_filas = 0L, n_columnas = 0L)
  validacion_scope_set(sid, "Hogares", "plan_result", list(plan = fx$plan, bundle = fx$bundle))
  cat <- validacion_reglas_catalogo(sid, "Hogares")
  fam <- function(f) Filter(function(x) identical(x$familia, f), cat$reglas)

  calc <- fam("calculo")[[1]]
  expect_identical(calc$nombre, "Valor calculado de \"Total de personas\"")
  expect_identical(.m3_texto(calc$frase), "El valor calculado de Total de personas debe coincidir con su fórmula del formulario.")
  expect_identical(calc$expresion_formulario, "${a} + ${b}")

  grupos <- fam("grupo_repetido")
  nombres <- vapply(grupos, `[[`, "", "nombre")
  expect_false(anyDuplicated(nombres) > 0L)
  expect_true(all(grepl("\"Hijos del hogar\"", nombres)))
  expect_true("Registros repetidos en \"Hijos del hogar\"" %in% nombres)
  textos <- vapply(grupos, function(f) .m3_texto(f$frase), "")
  expect_false(any(grepl("_parent_index|tabla principal|principal\"", c(textos, nombres))))
  expect_true("Se marca cuando Nombre del hijo se repite dentro de la misma encuesta." %in% textos)
  expect_true("Se marca cuando el registro no pertenece a ninguna encuesta de la base." %in% textos)

  periodo <- fam("periodo")[[1]]
  expect_identical(periodo$origen, "operativo")
  expect_identical(.m3_texto(periodo$frase), "Se marca cuando Fecha de visita está fuera del periodo del 2026-06-01 al 2026-06-30.")
  expect_identical(c(periodo$limites$min, periodo$limites$max), c("2026-06-01", "2026-06-30"))
  expect_identical(periodo$limites$tipo, "fecha")

  casi <- fam("casi_iguales")[[1]]
  expect_identical(casi$nombre, "Respuestas casi iguales")
  expect_match(.m3_texto(casi$frase), "al menos 90 % de las 10 preguntas comparadas")

  filtro <- fam("filtro_opciones")[[1]]
  expect_identical(filtro$familia_nombre, "Filtros de opciones")
  expect_identical(filtro$nombre, "Filtro de opciones de \"Hombres\"")

  hijos <- Filter(function(f) identical(f$variable_revisada, "n_hijos") && identical(f$familia, "restriccion"), cat$reglas)[[1]]
  expect_identical(hijos$limites$min, "0")
  expect_true(hijos$limites$inclusive_min)
  expect_true(is.na(hijos$limites$max))
  expect_identical(hijos$nombre, "\"Número de hijos\" mayor o igual a 0")
  .m3_sin_vetados(unlist(lapply(cat$reglas, function(f) c(f$nombre, .m3_texto(f$frase)))))
})

test_that("etiquetas con marcadores: se resuelve el rótulo referido o se recorta, nunca sale el marcador", {
  ctx <- .vrf_contexto(NULL)
  ctx$etiquetas <- c(sede = "Sede de atención", t1 = "¿Cuánto tardó en llegar a ${sede}?",
                     t2 = "¿Cuánto tardó en llegar al espacio de ${sede_ppl}?",
                     t3 = "¿Se encuentra satisfecho - ${current_label}?", t4 = "${current_label}")
  expect_identical(.vrf_etiqueta("t1", ctx), "¿Cuánto tardó en llegar a [Sede de atención]?")
  expect_identical(.vrf_etiqueta("t2", ctx), "¿Cuánto tardó en llegar al espacio?")
  expect_identical(.vrf_etiqueta("t3", ctx), "¿Se encuentra satisfecho?")
  expect_identical(.vrf_etiqueta("t4", ctx), "t4")
})

test_that("una negación de comparaciones simples se escribe en afirmativo", {
  ctx <- .vrf_contexto(NULL)
  ctx$etiquetas <- c(p8 = "Trabaja", edad = "Edad", p9 = "Ocupación")
  plano <- function(x) .vrf_texto_plano(.vrf_cond(x, .vrf_contexto_regla(ctx)))
  neg_y <- ast_not(ast_and(ast_compare_const("p8", "==", "1"), ast_compare_const("edad", ">", "18")))
  expect_identical(plano(neg_y), "Trabaja no es 1 o Edad es menor o igual a 18")
  doble <- ast_not(ast_and(ast_not(ast_and(ast_compare_const("p8", "==", "1"), ast_is_missing("p9"))),
                           ast_compare_const("edad", "<=", "3")))
  txt <- plano(doble)
  expect_false(grepl("no se cumple", txt))
  expect_identical(txt, "(Trabaja es 1 y Ocupación está vacía) o Edad es mayor que 3")
})

test_that("la base de un grupo repetido se nombra por el rótulo del grupo y en registros", {
  expect_identical(.vrb_base_texto("todas", "constraint", "hijos", grupo = "Hijos del hogar"),
                   "registros de \"Hijos del hogar\"")
  expect_identical(.vrb_base_texto("condicion_verdadera", "required", "hijos", grupo = "Hijos del hogar"),
                   "registros de \"Hijos del hogar\" en que se mostró la pregunta")
  expect_identical(.vrb_base_texto("respondieron", "range", "principal", familia = "periodo"),
                   "con la fecha registrada")
})

test_that("un valor que no está entre las opciones de la pregunta sale con un aviso por regla", {
  survey <- .m3_survey()
  survey$relevant[survey$name == "p10"] <- "${p8} = '9'"
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, survey = survey)
  .m3_plan(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  av <- Filter(function(a) identical(a$codigo, "valor_fuera_de_opciones"), cat$avisos)
  ids_salto <- vapply(Filter(function(f) identical(f$familia, "salto") || identical(f$familia, "obligatoria"), cat$reglas), `[[`, "", "id")
  expect_true(length(av) >= 2L)
  expect_true(all(vapply(av, `[[`, "", "id_regla") %in% ids_salto))
  expect_false(anyDuplicated(vapply(av, `[[`, "", "id_regla")) > 0L)
  expect_identical(av[[1]]$texto,
    "El formulario compara \"¿Trabaja actualmente?\" con \"9\", que no está entre sus opciones: ese valor sale sin rótulo.")
})

test_that("reglas de la auditoría fuera del catálogo se cuentan por regla, no por id distinto", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  .m2_auditar(sid, "Personas")
  ev <- validacion_scope_get(sid, "Personas")$evaluacion
  extra <- ev$resumen[1:2, ]
  extra$id_regla <- "VR_skip_[documento]"
  ev$resumen <- rbind(ev$resumen, extra)
  validacion_scope_set(sid, "Personas", "evaluacion", ev)
  av <- Filter(function(a) identical(a$codigo, "auditoria_con_reglas_fuera"), validacion_reglas_catalogo(sid, "Personas")$avisos)[[1]]
  expect_identical(av$n_reglas, 2L)
  expect_length(av$ids, 1L)
  expect_match(av$texto, "tiene 2 reglas")
})

test_that("caché por base: se reusa y se invalida al cambiar la activación de una regla", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  n <- 0L
  original <- .vrc_construir
  testthat::local_mocked_bindings(.vrc_construir = function(...) { n <<- n + 1L; original(...) })
  primero <- validacion_reglas_catalogo(sid, "Personas")
  validacion_reglas_catalogo(sid, "Personas", variable = "p8")
  expect_identical(n, 1L)
  rid <- .m3_regla(primero, "restriccion")$id_motor
  pr <- .m1_router()
  r <- .m1_http(pr, sid, "PATCH", sprintf("/api/validacion/v2/instrumento/regla/%s/activa", rid),
                body = '{"activa": false, "motivo": "Se revisa a mano"}', query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  despues <- validacion_reglas_catalogo(sid, "Personas")
  expect_identical(n, 2L)
  expect_false(.m3_regla(despues, "restriccion")$activa)
  expect_identical(.m3_regla(despues, "restriccion")$motivo_desactivada, "Se revisa a mano")
})

test_that("GET /instrumento/resultado acepta base_nombre en la query", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  .m2_auditar(sid, "Personas")
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/instrumento/resultado", query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  expect_identical(r$body$base_nombre, "Personas")
  expect_length(r$body$avisos, 0L)
})

test_that("la auditoría avisa cuando la condición de una regla no se pudo evaluar en casi ninguna fila", {
  datos <- .m3_datos()
  datos$p8 <- ifelse(datos$p8 == 1L, "Sí", "No")
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = datos)
  .m3_plan(sid, "Personas")
  resultado <- NULL
  testthat::local_mocked_bindings(job_submit = function(sid, kind, func, args = list(), on_complete = NULL, ...) {
    inst <- leer_xlsform_limpieza(args$xlsform_path, verbose = FALSE)
    d <- read_validation_data_ast(args$data_path, args$data_ext, instrumento = inst)
    ev <- evaluate_validation_bundle(args$bundle, d, strict = FALSE)
    resultado <<- on_complete(list(sid = sid, result_data = list(ev = ev, total = NA_integer_)))
    "job"
  })
  validacion_auditoria_lanzar(sid, "Personas")
  debe <- .m3_regla(validacion_reglas_catalogo(sid, "Personas"), "salto", "debe")

  esperado <- "La base guarda textos donde el formulario espera códigos en la pregunta \"¿Trabaja actualmente?\": la regla no se pudo evaluar en 426 de 426 casos que debía revisar y no marcó ninguno."
  av_job <- Filter(function(a) identical(a$id_regla, debe$id_motor), resultado$avisos)
  expect_length(av_job, 1L)
  expect_identical(av_job[[1]]$texto, esperado)
  expect_identical(av_job[[1]]$pregunta, "p8")

  est <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/auditoria/estado", query = "base_nombre=Personas")
  expect_identical(est$status, 200L)
  ids <- vapply(est$body$avisos, function(a) a$id_regla, "")
  expect_true(debe$id_motor %in% ids)
  expect_identical(unique(vapply(est$body$avisos, function(a) a$codigo, "")), "condicion_indeterminada")
  res <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/instrumento/resultado", query = "base_nombre=Personas")
  expect_true(debe$id_motor %in% vapply(res$body$avisos, function(a) a$id_regla, ""))
  # La restricción de edad no depende de p8: sin aviso.
  expect_false(.m3_regla(validacion_reglas_catalogo(sid, "Personas"), "restriccion")$id_motor %in% ids)
})

# --- Tercera entrega (verificación M3B) ---------------------------------------

.m3_auditar_etiquetas <- function(sid, base) {
  testthat::local_mocked_bindings(job_submit = function(sid, kind, func, args = list(), on_complete = NULL, ...) {
    inst <- leer_xlsform_limpieza(args$xlsform_path, verbose = FALSE)
    d <- read_validation_data_ast(args$data_path, args$data_ext, instrumento = inst)
    ev <- evaluate_validation_bundle(args$bundle, d, strict = FALSE)
    on_complete(list(sid = sid, result_data = list(ev = ev, total = NA_integer_)))
    "job"
  })
  validacion_auditoria_lanzar(sid, base)
}

.m3_aviso_de <- function(avisos, id) {
  hit <- Filter(function(a) identical(a$id_regla, id), avisos)
  if (length(hit)) hit[[1]] else NULL
}

test_that("aviso sobre las filas que la regla debía revisar: 12 de 12, aunque la tabla tenga 426", {
  survey <- rbind(.m3_survey(), data.frame(type = "integer", name = "p11", label = "Ingreso mensual",
    required = "", relevant = "${p8} = '1'", constraint = ". >= 0", stringsAsFactors = FALSE))
  datos <- .m3_datos()
  datos$p11 <- NA_integer_
  datos$p11[1:12] <- c(-1L, -1L, -1L, rep(500L, 9))
  datos$p8 <- ifelse(datos$p8 == 1L, "Sí", "No")
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = datos, survey = survey)
  .m3_plan(sid, "Personas")
  .m3_auditar_etiquetas(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  p11 <- Filter(function(f) identical(f$variable_revisada, "p11") && identical(f$familia, "restriccion"), cat$reglas)[[1]]
  est <- validacion_auditoria_estado(sid, "Personas")
  a <- .m3_aviso_de(est$avisos, p11$id_motor)
  expect_false(is.null(a))
  expect_identical(a$codigo, "condicion_indeterminada")
  expect_identical(a$n_a_revisar, 12L)
  expect_identical(a$n_indeterminadas, 12L)
})

test_that("cuenta incompleta entre 10 % y 90 %, y el aviso dice cuántos casos marcó", {
  datos <- .m3_datos()
  datos$p8 <- as.character(datos$p8)
  datos$p8[200:426] <- "No"
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = datos)
  .m3_plan(sid, "Personas")
  .m3_auditar_etiquetas(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  est <- validacion_auditoria_estado(sid, "Personas")
  nodebe <- .m3_aviso_de(est$avisos, .m3_regla(cat, "salto", "nodebe")$id_motor)
  expect_identical(nodebe$codigo, "cuenta_incompleta")
  expect_identical(nodebe$texto,
    "La base guarda textos donde el formulario espera códigos en la pregunta \"¿Trabaja actualmente?\": la regla no se pudo evaluar en 227 de 414 casos que debía revisar; su conteo de 2 casos puede quedarse corto.")
  debe <- .m3_aviso_de(est$avisos, .m3_regla(cat, "salto", "debe")$id_motor)
  expect_identical(debe$codigo, "condicion_indeterminada")
  expect_match(debe$texto, "227 de 239 casos que debía revisar y marcó 3 casos\\.$")
})

test_that("una regla propia cuya comparación no se puede decidir en ninguna fila avisa con su causa", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  r <- .m1_regla("RC_009", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "caso", op = ">", variable_comparada = "edad"))))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(r))
  .m2_auditar(sid, "Personas")
  cat <- validacion_reglas_catalogo(sid, "Personas")
  propia <- Filter(function(f) identical(f$id_motor, "RC_009"), cat$reglas)[[1]]
  expect_identical(propia$ultima_auditoria$n_casos, 0L)
  expect_identical(propia$ultima_auditoria$n_casos_indeterminados, 426L)
  a <- .m3_aviso_de(validacion_auditoria_estado(sid, "Personas")$avisos, "RC_009")
  expect_identical(a$texto,
    "La regla compara \"Código del caso\" con \"Edad\", que no tienen el mismo tipo de valor (número, fecha o texto): la regla no se pudo evaluar en 426 de 426 casos que debía revisar y no marcó ninguno.")
})

test_that("la caché de bases no mezcla dos hermanas iguales auditadas en el mismo segundo", {
  hogares <- .m3_datos()
  hogares$p8[300:307] <- 1L
  hogares$p10[300:307] <- "Comercio"
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir, datos_personas = .m3_datos(), datos_hogares = hogares)
  for (b in c("Personas", "Hogares")) { .m3_plan(sid, b); .m2_auditar(sid, b) }
  for (b in c("Personas", "Hogares")) {
    ev <- validacion_scope_get(sid, b)$evaluacion
    ev$auditada_en <- "2026-11-11T12:00:00Z"
    validacion_scope_set(sid, b, "evaluacion", ev)
  }
  expect_identical(validacion_scope_get(sid, "Personas")$evaluacion$resumen$n_inconsistencias,
                   validacion_scope_get(sid, "Hogares")$evaluacion$resumen$n_inconsistencias)
  personas <- .m3_regla(validacion_reglas_catalogo(sid, "Personas"), "salto", "debe")$ultima_auditoria
  hogares_c <- .m3_regla(validacion_reglas_catalogo(sid, "Hogares"), "salto", "debe")$ultima_auditoria
  expect_identical(personas$n_base, 12L)
  expect_identical(hogares_c$n_base, 20L)
})

test_that("la base de la cantidad de registros de un grupo son los casos de la tabla principal", {
  regla <- rule_repeat_length("hijos", "${n_hijos}")
  regla$tabla <- "hijos"
  expect_identical(.vrb_tabla_de(regla), "principal")
  ev <- list(datos_tablas = list(principal = data.frame(x = 1:5), hijos = data.frame(y = 1:9)),
             bundle = list(rules = list(regla)))
  b <- .vrb_bases(ev, list(list(id = regla$id, rule = regla, propia = NULL)))
  expect_identical(b[[regla$id]]$n_base, 5L)
  expect_identical(b[[regla$id]]$tabla, "principal")
})

test_that("el motivo dice la causa real y una causa sin rótulo no muestra el código", {
  expect_identical(.vrc_motivo_llano("incorrecta_ejecucion", "runtime_error", "x"), "La regla falló al evaluarse.")
  expect_identical(.vrc_motivo_llano("incorrecta_ejecucion", "runtime_error", "x", compara_preguntas = TRUE),
                   "La regla falló al evaluarse. Revisa que las preguntas que compara sean del mismo tipo (número, fecha o texto).")
  expect_identical(.vrf_causa("algo_nuevo_del_motor"), "La regla no se pudo evaluar sobre esta base")
  expect_false(grepl("algo_nuevo", .vrc_motivo_llano("no_evaluada", "algo_nuevo_del_motor")))
})

test_that("un valor calculado dice su condición de relevancia, solo si la regla la aplica; y un código sin etiqueta sale una vez", {
  ctx <- .vrf_contexto(NULL)
  ctx$condiciones <- list(total = ast_compare_const("consent", "==", "1"))
  con <- list(predicate = ast_odk_raw("(consent == '1') & !eq_num_na(total, a + b)", origin = "legacy_r_expr"))
  sin <- list(predicate = ast_odk_raw("!eq_num_na(total, a + b)", origin = "legacy_r_expr"))
  expect_false(is.null(.vrc_condicion_calculo(con, "calculo", "total", ctx)))
  expect_null(.vrc_condicion_calculo(sin, "calculo", "total", ctx))
  expect_identical(.vrf_q("current_code", ctx), list(list(texto = "current_code")))
  ctx$etiquetas <- c(edad = "Edad")
  expect_identical(.vrf_q("edad", ctx)[[1]]$etiqueta, "Edad")
})

test_that("la caché ve un cambio de datos después de la fila 50 en la misma base", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  .m2_auditar(sid, "Personas")
  expect_identical(.m3_regla(validacion_reglas_catalogo(sid, "Personas"), "salto", "debe")$ultima_auditoria$n_base, 12L)
  ev <- validacion_scope_get(sid, "Personas")$evaluacion
  ev$datos_tablas$principal$p8[300] <- 1L
  ev$datos_tablas$principal$p10[300] <- "Comercio"
  validacion_scope_set(sid, "Personas", "evaluacion", ev)
  expect_identical(.m3_regla(validacion_reglas_catalogo(sid, "Personas"), "salto", "debe")$ultima_auditoria$n_base, 13L)
})

test_that("una regla creada o cambiada después de la auditoría sale sin evaluar, con su causa", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  rango <- function(max) .m1_regla("RC_001", "rango_num", list("edad"), list(min = 18, max = max))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(rango(65)))
  .m2_auditar(sid, "Personas")
  auditada <- validacion_reglas_catalogo(sid, "Personas")
  expect_identical(auditada$n_sin_evaluar, sum(vapply(auditada$reglas, function(f) !is.na(f$causa_codigo), logical(1))))
  propia <- function(cat, id) Filter(function(f) identical(f$id_motor, id), cat$reglas)[[1]]
  expect_identical(propia(auditada, "RC_001")$estado_evaluacion, "evaluada")

  nueva <- .m1_regla("RC_002", "rango_num", list("edad"), list(min = 0, max = 120))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(rango(65), nueva))
  con_nueva <- validacion_reglas_catalogo(sid, "Personas")
  expect_identical(propia(con_nueva, "RC_002")$estado_evaluacion, "sin_evaluar")
  expect_identical(propia(con_nueva, "RC_002")$causa_codigo, "sin_auditar")
  expect_identical(propia(con_nueva, "RC_002")$causa, "Creada después de la última auditoría")
  expect_identical(propia(con_nueva, "RC_001")$estado_evaluacion, "evaluada")
  expect_identical(con_nueva$n_sin_evaluar, auditada$n_sin_evaluar + 1L)

  validacion_scope_set(sid, "Personas", "reglas_custom", list(rango(70)))
  editada <- validacion_reglas_catalogo(sid, "Personas")
  expect_identical(propia(editada, "RC_001")$estado_evaluacion, "sin_evaluar")
  expect_identical(propia(editada, "RC_001")$causa_codigo, "editada_tras_auditoria")
  expect_identical(propia(editada, "RC_001")$causa, "Cambió después de la última auditoría")
})

test_that("el detalle que el equipo escribió en la regla llega al catálogo y a la cola de hallazgos", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  con_detalle <- .m1_regla("RC_001", "rango_num", list("edad"), list(min = 18, max = 65),
                           mensaje = "Revisar con la ficha física")
  sin_detalle <- .m1_regla("RC_002", "rango_num", list("edad"), list(min = 0, max = 120), mensaje = "RC_002")
  validacion_scope_set(sid, "Personas", "reglas_custom", list(con_detalle, sin_detalle))
  cat <- validacion_reglas_catalogo(sid, "Personas")
  fila <- function(id) Filter(function(f) identical(f$id_motor, id), cat$reglas)[[1]]
  expect_identical(fila("RC_001")$detalle, "Revisar con la ficha física")
  # Un mensaje igual al nombre lo copió el asistente, no lo escribió nadie.
  expect_true(is.na(fila("RC_002")$detalle))

  .m2_auditar(sid, "Personas")
  cola <- validacion_cola_con_narrativa(list(list(source_id = "RC_001")), validacion_narrativa_reglas(sid, "Personas"),
                                        validacion_scope_get(sid, "Personas"))
  expect_identical(cola[[1]]$detalle, "Revisar con la ficha física")
  vacia <- validacion_cola_con_narrativa(list(list(source_id = "NO_EXISTE")), NULL, validacion_scope_get(sid, "Personas"))
  expect_true(is.na(vacia[[1]]$detalle))
})

test_that("la frase de una condición de vacío dice está vacía o tiene respuesta", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  vacia <- .m1_regla("RC_020", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "edad", op = ">=", valor = 18), list(variable = "p8", op = "is_empty"))))
  con_respuesta <- .m1_regla("RC_021", "condiciones", list(), list(modo = "todas", condiciones = list(
    list(variable = "p8", op = "not_empty"))))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(vacia, con_respuesta))
  cat <- validacion_reglas_catalogo(sid, "Personas")
  texto <- function(id) {
    f <- Filter(function(f) identical(f$id_motor, id), cat$reglas)[[1]]
    paste(vapply(f$frase, function(p) as.character(p$texto %||% p$etiqueta %||% p$codigo %||% p$valor), ""), collapse = "")
  }
  expect_match(texto("RC_020"), "está vacía")
  expect_match(texto("RC_021"), "tiene respuesta")
})

test_that("antes de la primera auditoría y tras reconstruir el plan, toda regla activa sale sin evaluar", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  .m3_plan(sid, "Personas")
  .m3_plan(sid, "Hogares")
  validacion_scope_set(sid, "Personas", "reglas_custom",
                       list(.m1_regla("RC_001", "rango_num", list("edad"), list(min = 18, max = 65))))
  # Una desactivada no es "sin evaluar": dice que está desactivada.
  apagada <- vapply(validacion_reglas_catalogo(sid, "Personas")$reglas, function(f) {
    if (identical(f$familia, "restriccion")) f$id_motor else NA_character_
  }, character(1))
  validacion_scope_set(sid, "Personas", "reglas_desactivadas", apagada[!is.na(apagada)])

  activas_sin <- function(cat) {
    vapply(cat$reglas, function(f) isTRUE(f$activa) && identical(f$estado_evaluacion, "sin_evaluar"), logical(1))
  }
  # Camino 1: plan leído, ninguna auditoría.
  antes <- validacion_reglas_catalogo(sid, "Personas")
  expect_true(antes$n_activas >= 4L)
  expect_identical(sum(activas_sin(antes)), antes$n_activas)
  expect_identical(antes$n_sin_evaluar, antes$n_activas)
  for (f in Filter(function(f) isTRUE(f$activa), antes$reglas)) {
    expect_identical(f$causa_codigo, "sin_auditoria", info = f$id)
    expect_identical(f$causa, "Aún no se auditó", info = f$id)
  }
  desactivada <- Filter(function(f) !isTRUE(f$activa), antes$reglas)
  expect_length(desactivada, 1L)
  expect_identical(desactivada[[1]]$estado_evaluacion, "evaluada")
  expect_identical(sum(vapply(antes$familias, `[[`, 0L, "n_sin_evaluar")), antes$n_sin_evaluar)

  # Auditadas las dos bases, ninguna regla queda sin evaluar por falta de auditoría.
  .m2_auditar(sid, "Personas")
  .m2_auditar(sid, "Hogares")
  auditada <- validacion_reglas_catalogo(sid, "Personas")
  expect_false(any(vapply(auditada$reglas, function(f) identical(f$causa_codigo, "sin_auditoria"), logical(1))))
  expect_identical(auditada$n_sin_evaluar, 0L)
  hogares_antes <- validacion_reglas_catalogo(sid, "Hogares")$n_sin_evaluar

  # Camino 2: "Aplicar y reconstruir el plan" por HTTP en Personas descarta su
  # auditoría; la base hermana conserva la suya.
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/instrumento/plan", body = "{}",
                query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  expect_null(validacion_scope_get(sid, "Personas")$evaluacion)
  expect_false(is.null(validacion_scope_get(sid, "Hogares")$evaluacion))
  tras <- validacion_reglas_catalogo(sid, "Personas")
  expect_identical(sum(activas_sin(tras)), tras$n_activas)
  expect_identical(tras$n_sin_evaluar, tras$n_activas)
  expect_true(all(vapply(Filter(function(f) isTRUE(f$activa), tras$reglas),
                         function(f) identical(f$causa_codigo, "sin_auditoria"), logical(1))))
  expect_identical(validacion_reglas_catalogo(sid, "Hogares")$n_sin_evaluar, hogares_antes)
  expect_identical(hogares_antes, 0L)
})

test_that("una regla propia del detector publica de dónde salió; las demás, NA", {
  dir <- withr::local_tempdir()
  sid <- .m3_sesion(dir)
  del_detector <- .m1_regla("RC_020", "rango_num", list("edad"), list(min = 18, max = 65),
                            origen = "sembrado", semilla = list(origen = "detector_consistencia", porque = "x"))
  a_mano <- .m1_regla("RC_021", "rango_num", list("edad"), list(min = 18, max = 65))
  validacion_scope_set(sid, "Hogares", "reglas_custom", list(del_detector, a_mano))
  cat <- validacion_reglas_catalogo(sid, "Hogares")
  por_id <- stats::setNames(cat$reglas, vapply(cat$reglas, function(f) f$id, character(1)))
  expect_identical(por_id$RC_020$semilla_origen, "detector_consistencia")
  expect_true(is.na(por_id$RC_021$semilla_origen))
})
