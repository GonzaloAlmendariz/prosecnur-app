# Salto de una sección y pregunta filtro con un código fuera de su lista
# (ítems 41 y 42 del checklist de Validación usada por un practicante;
# validacion_salto_seccion.R y validacion_salto_filtro_fuera_lista.R).
#
# Fixture: un formulario con el consentimiento afuera y dos secciones que se
# abren con él; la segunda tiene una subsección que se abre con p3 = 1:
#
#   consentimiento      (Sí 1 / No 2)
#   sec_a  [${consentimiento} = '1']   "Datos del hogar"
#     p1  obligatoria
#     p2  (Sí 1 / No 2 / Otro 4)
#     p2_1  [${p2} = '4']  obligatoria  "Otro (especificar)"
#   sec_b  [${consentimiento} = '1']   "Opiniones"
#     p3  (Sí 1 / No 2)
#     sub_b  [${p3} = '1']   "Detalle de opiniones"
#       p4
#       p5
#   final  (afuera de las secciones)
#
# Casos (fila: lo que tiene):
#   1  consentimiento 1, todo en regla.
#   2  consentimiento 2, respondió p1, p2 y p3: la sección A y la B no le
#      correspondían. Se marca una vez por sección, nunca por pregunta.
#   3  consentimiento vacío, respondió p1: la sección A no le correspondía.
#   4  consentimiento 1, p3 = 2 y respondió p4: la subsección no le correspondía.
#   5  consentimiento 1, p2 = 1 y respondió p2_1: el salto propio de p2_1.
#   6  consentimiento 1, p2 = 4 y p2_1 vacía: obligatoria vacía, una sola marca.

.ss_survey <- function() {
  data.frame(
    type = c("select_one sino", "begin_group", "integer", "select_one p2", "text", "end_group",
             "begin_group", "select_one sino", "begin_group", "integer", "integer", "end_group", "end_group",
             "text"),
    name = c("consentimiento", "sec_a", "p1", "p2", "p2_1", "",
             "sec_b", "p3", "sub_b", "p4", "p5", "", "", "final"),
    label = c("Consentimiento", "Datos del hogar", "Personas en el hogar", "Motivo", "Otro (especificar)", "",
              "Opiniones", "¿Opina?", "Detalle de opiniones", "Opinión 1", "Opinión 2", "", "", "Comentario final"),
    required = c("", "", "yes", "", "yes", "", "", "", "", "", "", "", "", ""),
    relevant = c("", "${consentimiento} = '1'", "", "", "${p2} = '4'", "",
                 "${consentimiento} = '1'", "", "${p3} = '1'", "", "", "", "", ""),
    stringsAsFactors = FALSE
  )
}

.ss_choices <- function() {
  data.frame(list_name = c("sino", "sino", "p2", "p2", "p2"), name = c("1", "2", "1", "2", "4"),
             label = c("Sí", "No", "Trabajo", "Estudios", "Otro"), stringsAsFactors = FALSE)
}

.ss_inst <- function() list(survey = .ss_survey(), choices = .ss_choices())

.ss_datos <- function() {
  data.frame(
    consentimiento = c("1", "2", NA, "1", "1", "1"),
    p1 = c(3, 4, 2, 5, 1, 2),
    p2 = c("1", "2", NA, "2", "1", "4"),
    p2_1 = c(NA, NA, NA, NA, "Tío", NA),
    p3 = c("2", "1", NA, "2", "2", "2"),
    p4 = c(NA, NA, NA, 7, NA, NA),
    p5 = c(NA, NA, NA, NA, NA, NA),
    final = c("ok", "ok", "ok", "ok", "ok", "ok"),
    stringsAsFactors = FALSE
  )
}

.ss_reglas <- function(include = c("required", "skip")) {
  infer_rules_from_xlsform(.ss_inst(), include = include)$rules
}

.ss_marcas <- function(rules, datos = .ss_datos()) {
  ev <- evaluate_rules(rules, datos)
  stats::setNames(lapply(rules, function(r) which(ev$data[[r$flag_name]] %in% TRUE)),
                  vapply(rules, function(r) if (.vss_es_seccion(r)) paste0("seccion:", .vss_grupo(r))
                         else paste0(r$tipo_regla, ":", r$primary_var, ":", r$presentation$subtipo_semantico %||% ""), ""))
}

test_that("una sección con condición es una sola regla y marca una vez por encuesta", {
  rules <- .ss_reglas()
  secciones <- Filter(.vss_es_seccion, rules)
  expect_setequal(vapply(secciones, .vss_grupo, ""), c("sec_a", "sec_b", "sub_b"))
  a <- Filter(function(r) identical(.vss_grupo(r), "sec_a"), secciones)[[1]]
  expect_identical(.vss_variables(a), c("p1", "p2", "p2_1"))
  b <- Filter(function(r) identical(.vss_grupo(r), "sec_b"), secciones)[[1]]
  # La subsección es parte de la sección B: sus preguntas también se miran ahí.
  expect_identical(.vss_variables(b), c("p3", "p4", "p5"))
  sub <- Filter(function(r) identical(.vss_grupo(r), "sub_b"), secciones)[[1]]
  expect_identical(.vss_variables(sub), c("p4", "p5"))
  expect_identical(a$tipo_regla, "skip")
  expect_identical(a$presentation$subtipo_semantico, "nodebe")

  m <- .ss_marcas(rules)
  expect_identical(m[["seccion:sec_a"]], c(2L, 3L))
  expect_identical(m[["seccion:sec_b"]], 2L)
  # La subsección marca solo con la sección B abierta (caso 4), no el caso 2.
  expect_identical(m[["seccion:sub_b"]], 4L)
})

test_that("una pregunta dentro de una sección con condición no repite la marca de la sección", {
  rules <- .ss_reglas()
  nodebe <- Filter(function(r) !.vss_es_seccion(r) && identical(r$presentation$subtipo_semantico, "nodebe"), rules)
  # Solo p2_1 tiene condición propia; p1, p2, p3, p4 y p5 las cubre su sección.
  expect_identical(vapply(nodebe, function(r) r$primary_var, ""), "p2_1")
  m <- .ss_marcas(rules)
  # p2_1 respondida con p2 = 1 en una sección abierta (caso 5). El caso 2 no
  # respondió p2_1, y si lo hubiera hecho lo marcaría la sección.
  expect_identical(m[["skip:p2_1:nodebe"]], 5L)
  datos <- .ss_datos(); datos$p2_1[2] <- "Abuela"
  m2 <- .ss_marcas(rules, datos)
  expect_identical(m2[["skip:p2_1:nodebe"]], 5L)
  expect_identical(m2[["seccion:sec_a"]], c(2L, 3L))
})

test_that("un vacío de una obligatoria con condición se marca una vez", {
  rules <- .ss_reglas()
  debe <- Filter(function(r) identical(r$presentation$subtipo_semantico, "debe"), rules)
  # p2_1 es obligatoria y tiene salto: la obligatoria ya pide la respuesta
  # cuando p2 = 4 en una sección abierta. p1 es obligatoria en su sección.
  expect_length(debe, 0L)
  m <- .ss_marcas(rules)
  expect_identical(m[["required:p2_1:req"]], 6L)
  expect_identical(m[["required:p1:req"]], integer(0))
  # Sin las obligatorias en el plan, el salto "debe" sigue pidiendo la respuesta.
  solo_saltos <- .ss_reglas(include = "skip")
  debe2 <- Filter(function(r) identical(r$presentation$subtipo_semantico, "debe"), solo_saltos)
  expect_setequal(vapply(debe2, function(r) r$primary_var, ""), c("p1", "p2_1"))
})

test_that("cada respuesta indebida queda marcada por una sola regla", {
  rules <- .ss_reglas()
  datos <- .ss_datos()
  m <- .ss_marcas(rules, datos)
  cubre <- function(r, var) if (.vss_es_seccion(r)) var %in% .vss_variables(r) else identical(r$primary_var, var)
  id_de <- function(r) if (.vss_es_seccion(r)) paste0("seccion:", .vss_grupo(r)) else paste0("skip:", r$primary_var, ":nodebe")
  saltos <- Filter(function(r) identical(r$tipo_regla, "skip"), rules)
  # Respuestas que no correspondían, contadas a mano en el fixture.
  indebidas <- list(`2` = c("p1", "p2", "p3"), `3` = "p1", `4` = "p4", `5` = "p2_1")
  for (caso in seq_len(nrow(datos))) for (var in c("p1", "p2", "p2_1", "p3", "p4", "p5")) {
    if (is.na(datos[[var]][caso])) next
    n <- sum(vapply(saltos, function(r) cubre(r, var) && caso %in% m[[id_de(r)]], logical(1)))
    esperado <- if (var %in% indebidas[[as.character(caso)]]) 1L else 0L
    expect_identical(n, esperado, label = sprintf("caso %d, %s", caso, var))
  }
})

test_that("una pregunta de la sección que la base no trae no deja la regla sin evaluar", {
  rules <- Filter(.vss_es_seccion, .ss_reglas())
  datos <- .ss_datos(); datos$p5 <- NULL
  ev <- evaluate_validation_bundle(list(rules = rules, plan = compile_rules_to_plan(rules)),
                                   list(principal = datos, tables = list(principal = datos)), strict = FALSE)
  res <- ev$resumen
  fila <- res[res$id_regla == Filter(function(r) identical(.vss_grupo(r), "sub_b"), rules)[[1]]$id, ]
  expect_identical(as.character(fila$estado_dinamico), "correcta")
  expect_identical(as.integer(fila$n_inconsistencias), 1L)
  expect_match(as.character(fila$detalle), "p5", fixed = TRUE)
})

test_that("la frase y el nombre dicen lo que se marca, como el título", {
  inst <- .ss_inst()
  ctx <- .vrf_contexto(inst)
  rules <- .ss_reglas()
  a <- Filter(function(r) identical(.vss_grupo(r), "sec_a"), Filter(.vss_es_seccion, rules))[[1]]
  info <- list(origen = "formulario", familia = "salto", direccion = "nodebe", target = "sec_a",
               condicion = .vss_condicion(a), seccion = list(grupo = "sec_a", variables = .vss_variables(a)))
  .txt <- function(fr) paste(vapply(fr, function(f) {
    if (!is.null(f$texto)) f$texto else if (!is.null(f$pregunta)) f$etiqueta else as.character(f$valor)
  }, ""), collapse = "")
  expect_identical(.vrf_nombre(info, ctx), "Sección \"Datos del hogar\": respondida cuando no le correspondía")
  expect_identical(.txt(.vrf_frase(info, ctx)),
                   "Se marca cuando alguna de las 3 preguntas de la sección \"Datos del hogar\" tiene respuesta y Consentimiento no es Sí.")

  p21 <- Filter(function(r) identical(r$primary_var, "p2_1") && identical(r$presentation$subtipo_semantico, "nodebe"), rules)[[1]]
  info2 <- list(origen = "formulario", familia = "salto", direccion = "nodebe", target = "p2_1",
                condicion = .vrb_condicion_salto(p21$predicate, "p2_1", "nodebe"))
  # La frase nombra la condición propia de la pregunta: que la sección esté
  # abierta lo cuida la regla de la sección.
  info2$condicion <- .vss_condicion_propia(p21, info2$condicion)
  expect_identical(.txt(.vrf_frase(info2, ctx)), "Se marca cuando Otro (especificar) tiene respuesta y Motivo no es Otro.")
  # La base de la regla sí cuenta la condición entera (sección abierta y p2 distinto de Otro).
  expect_setequal(ast_variables(.vrb_condicion(p21)$ast), c("consentimiento", "p2"))
})

test_that("el enunciado de una pregunta cubierta nombra su propia condición, no la de la sección", {
  rules <- .ss_reglas()
  p21 <- Filter(function(r) identical(r$primary_var, "p2_1") && identical(r$presentation$subtipo_semantico, "nodebe"), rules)[[1]]
  regla <- list(tipo_regla = "skip", familia = "salto", direccion = "nodebe",
                condicion = .vss_condicion_propia(p21, .vrb_condicion_salto(p21$predicate, "p2_1", "nodebe")),
                etiquetas = list(consentimiento = "Consentimiento", p2 = "Motivo.", p2_1 = "Otro (especificar)"))
  e <- validacion_enunciado_hallazgo("contradiccion", p21$variable_roles, "Encuesta 5",
                                     valores = list(consentimiento = "1", p2 = "1", p2_1 = "Tío"),
                                     etiquetas_valor = list(p2 = list(`1` = "Trabajo")), regla = regla)
  # Sin punto doble aunque el rótulo termine en punto.
  expect_identical(e$texto, "Encuesta 5: respondió \"Tío\" en Otro (especificar), que no correspondía porque declaró \"Trabajo\" (1) en Motivo. Revisar y corregir en Limpieza.")
})

test_that("el enunciado del caso cuenta las preguntas respondidas y nombra la respuesta que decide", {
  rules <- .ss_reglas()
  a <- Filter(function(r) identical(.vss_grupo(r), "sec_a"), Filter(.vss_es_seccion, rules))[[1]]
  regla <- list(tipo_regla = "skip", familia = "salto", direccion = "nodebe", condicion = .vss_condicion(a),
                seccion = list(grupo = "sec_a", etiqueta = "Datos del hogar", variables = .vss_variables(a)),
                etiquetas = list(consentimiento = "Consentimiento"))
  et <- list(consentimiento = list(`1` = "Sí", `2` = "No"))
  e <- validacion_enunciado_hallazgo("contradiccion", list(target = "sec_a"), "Encuesta 2",
                                     valores = list(consentimiento = "2", p1 = "4", p2 = "2", p2_1 = NA),
                                     etiquetas_valor = et, regla = regla)
  expect_identical(e$subtipo, "seccion_nodebe")
  expect_identical(e$texto, paste("Encuesta 2: respondió 2 de las 3 preguntas de la sección \"Datos del hogar\",",
                                  "que no correspondía porque declaró \"No\" (2) en Consentimiento. Revisar y corregir en Limpieza."))
  vacia <- validacion_enunciado_hallazgo("contradiccion", list(target = "sec_a"), "Encuesta 3",
                                         valores = list(consentimiento = NA, p1 = "2", p2 = NA, p2_1 = NA),
                                         etiquetas_valor = et, regla = regla)
  expect_identical(vacia$choque, "que no correspondía porque dejó vacía Consentimiento")
  expect_identical(vacia$hecho, "respondió 1 de las 3 preguntas de la sección \"Datos del hogar\"")
})

test_that("la pregunta filtro con un código fuera de su lista se cuenta sobre todos los casos marcados", {
  cond <- ast_not(ast_compare_const("p6", "==", "4"))
  df <- data.frame(p6 = c("77", "77", "1", "77", "99", "2 77"), stringsAsFactors = FALSE)
  ops <- list(p6 = list(`1` = "Trabajo", `2` = "Estudios", `3` = "Familia", `4` = "Otro motivo"))
  r <- validacion_filtro_fuera_de_lista(cond, df, c(1L, 2L, 4L), ops)
  expect_length(r, 1L)
  expect_identical(r[[1]]$variable, "p6")
  expect_identical(r[[1]]$n_casos, 3L)
  expect_identical(r[[1]]$n_marcados, 3L)
  expect_identical(r[[1]]$otro, list(codigo = "4", etiqueta = "Otro motivo"))
  expect_identical(r[[1]]$texto, paste0("p6 vale 77 en los 3 casos, un código que no está en sus opciones; ",
                                        "puede ser el de \"Otro motivo\" (4 en el formulario): revisa el formulario antes de corregir respuestas."))
  # Parcial, con un código especial declarado que no cuenta y una opción
  # múltiple tokenizada.
  r2 <- validacion_filtro_fuera_de_lista(cond, df, c(3L, 4L, 5L, 6L), ops, especiales = c(`99` = "No responde"))
  expect_identical(r2[[1]]$n_casos, 2L)
  expect_identical(r2[[1]]$valores, list(list(valor = "77", n = 2L)))
  expect_match(r2[[1]]$texto, "^p6 vale 77 en 2 de los 4 casos, ")
  # Sin valores fuera de lista: nada que decir.
  expect_length(validacion_filtro_fuera_de_lista(cond, df, 3L, ops), 0L)
})

test_that("la regla de sección y la marca de la pregunta cubierta sobreviven al plan exportado", {
  rules <- .ss_reglas()
  a <- Filter(function(r) identical(.vss_grupo(r), "sec_a"), Filter(.vss_es_seccion, rules))[[1]]
  a2 <- rule_from_json(rule_to_json(a))
  expect_true(.vss_es_seccion(a2))
  expect_identical(.vss_variables(a2), c("p1", "p2", "p2_1"))
  expect_identical(ast_hash(.vss_condicion(a2)), ast_hash(.vss_condicion(a)))
  p21 <- Filter(function(r) identical(r$primary_var, "p2_1") && identical(r$presentation$subtipo_semantico, "nodebe"), rules)[[1]]
  p21b <- rule_from_json(rule_to_json(p21))
  cond <- .vrb_condicion_salto(p21b$predicate, "p2_1", "nodebe")
  expect_identical(ast_variables(.vss_condicion_propia(p21b, cond)), "p2")
})

# --- Por HTTP, con dos bases hermanas ------------------------------------------

.ss_sesion <- function(dir, datos_personas, datos_hogares) {
  sid <- session_create()
  for (nombre in c("Hogares", "Personas")) {
    sub <- file.path(dir, nombre)
    dir.create(sub, showWarnings = FALSE, recursive = TRUE)
    datos <- if (identical(nombre, "Personas")) datos_personas else datos_hogares
    xls <- file.path(sub, "formulario.xlsx")
    openxlsx::write.xlsx(list(survey = .ss_survey(), choices = .ss_choices()), xls)
    csv <- file.path(sub, "base.csv")
    utils::write.csv(datos, csv, row.names = FALSE, na = "")
    xm <- save_upload(sid, "xlsform", basename(xls), readBin(xls, "raw", n = file.info(xls)$size))
    dm <- save_upload(sid, "data", basename(csv), readBin(csv, "raw", n = file.info(csv)$size))
    inst <- reporte_instrumento(path = xm$path)
    estudio_add_base(sid = sid, nombre = nombre, xlsform_file_id = xm$file_id, data_file_id = dm$file_id,
                     data_ext = "csv", rp_data = reporte_data(datos, instrumento = inst), rp_inst = inst,
                     n_filas = nrow(datos), n_columnas = ncol(datos))
  }
  s <- session_get(sid); s$estudio$active_base <- "Hogares"; .session_env[[sid]] <- s
  sid
}

test_that("el detalle de un salto dice, sobre todos sus casos y en la base pedida, el código fuera de lista de la pregunta filtro", {
  personas <- cbind(respondent_id = sprintf("u%02d", 1:6), .ss_datos(), stringsAsFactors = FALSE)
  # p2 vale 7 (no está en la lista) en los casos 5 y 6 con p2_1 respondida.
  personas$p2[5:6] <- "7"; personas$p2_1[5:6] <- c("Tío", "Abuela")
  hogares <- cbind(respondent_id = sprintf("h%02d", 1:6), .ss_datos(), stringsAsFactors = FALSE)
  dir <- withr::local_tempdir()
  sid <- .ss_sesion(dir, personas, hogares)
  withr::defer(session_delete(sid))
  for (b in c("Hogares", "Personas")) {
    files <- .resolve_base_files(sid, b)
    inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
    bundle <- build_validation_bundle(inst, incluir = list(required = TRUE, relevant = TRUE, constraint = FALSE))
    validacion_scope_set(sid, b, "plan_result", list(plan = compile_rules_to_plan(bundle$rules), bundle = bundle))
    .m2_auditar(sid, b)
  }
  pr <- .m1_router()
  cat_ <- .m1_http(pr, sid, "GET", "/api/validacion/v2/reglas/catalogo", query = "base_nombre=Personas")$body
  p21 <- Filter(function(f) identical(f$variable_revisada, "p2_1") && identical(f$direccion, "nodebe"), cat_$reglas)[[1]]
  expect_identical(p21$nombre, "Salto de \"Otro (especificar)\": respondida cuando no le correspondía")
  det <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                  body = sprintf('{"id_regla":"%s","base_nombre":"Personas","limite":1}', p21$id_motor))$body
  # La página trae un caso; la cifra es sobre los dos que la regla marca.
  expect_length(det$casos, 1L)
  f <- det$filtro_fuera_de_lista
  expect_length(f, 1L)
  expect_identical(f[[1]]$variable, "p2")
  expect_identical(f[[1]]$n_casos, 2L)
  expect_identical(f[[1]]$n_marcados, 2L)
  expect_identical(f[[1]]$texto, paste0("p2 vale 7 en los 2 casos, un código que no está en sus opciones; ",
                                        "puede ser el de \"Otro\" (4 en el formulario): revisa el formulario antes de corregir respuestas."))
  # La base hermana (la activa) no tiene el código fuera de lista: su detalle no lo dice.
  cat_h <- .m1_http(pr, sid, "GET", "/api/validacion/v2/reglas/catalogo", query = "base_nombre=Hogares")$body
  p21h <- Filter(function(f) identical(f$variable_revisada, "p2_1") && identical(f$direccion, "nodebe"), cat_h$reglas)[[1]]
  det_h <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                    body = sprintf('{"id_regla":"%s","base_nombre":"Hogares"}', p21h$id_motor))$body
  expect_length(det_h$filtro_fuera_de_lista, 0L)

  # La sección: una regla con su nombre y, por caso, cuántas preguntas respondió.
  sec <- Filter(function(f) identical(f$variable_revisada, "sec_a"), cat_$reglas)[[1]]
  expect_identical(sec$nombre, "Sección \"Datos del hogar\": respondida cuando no le correspondía")
  expect_identical(sec$ultima_auditoria$n_casos, 2L)
  det_s <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                    body = sprintf('{"id_regla":"%s","base_nombre":"Personas"}', sec$id_motor))$body
  subt <- vapply(det_s$esperado, function(e) as.character(e$subtipo), "")
  expect_identical(unique(subt), "seccion_nodebe")
  # Caso 2: p1 y p2; caso 3: p1.
  expect_setequal(vapply(det_s$esperado, function(e) as.character(e$hecho), ""),
                  c("respondió 2 de las 3 preguntas de la sección \"Datos del hogar\"",
                    "respondió 1 de las 3 preguntas de la sección \"Datos del hogar\""))
})
