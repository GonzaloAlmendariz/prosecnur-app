# TXT-3 (plan-texto-abierto-ccss-2026-10-24, O1b): sugerencia de módulo del
# instrumento para un comentario abierto.
#
# Contrato que fija esta suite:
#   - La sugerencia es una PROPUESTA: el motor no escribe grupos ni matrix_cases.
#   - Códigos por módulo (10, 20, 30… en el orden del formulario) y «otro» = 80.
#   - El vocabulario de cada módulo sale de las etiquetas de sus preguntas y
#     opciones (vía .section_map, con los subgrupos subidos a su módulo).
#   - Un comentario puede recibir más de un módulo (multicode).
#   - Una no respuesta (.txt_no_respuesta) no recibe propuesta.
#   - Cada propuesta trae puntaje y las palabras que la justifican.
#   - El endpoint lee la base pedida, no la primera.

source("setup-load-all.R")

.ss_tmp <- function(ext = ".xlsx") {
  d <- tempfile("codif-sugerir-")
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
  file.path(d, paste0("f", ext))
}

.ss_write_xlsform <- function(path, survey, choices) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# Tres módulos con vocabulario propio, un subgrupo dentro del A y el comentario
# final en su propio grupo (que no es un módulo candidato).
.ss_xlsform_tres <- function(path = .ss_tmp()) {
  survey <- data.frame(
    type = c(
      "begin_group", "select_one frec", "begin_group", "text", "end_group", "end_group",
      "begin_group", "select_one acuerdo", "integer", "end_group",
      "begin_group", "select_one acuerdo", "text", "end_group",
      "begin_group", "text", "end_group"
    ),
    name = c(
      "modulo_a", "a1", "bloque_espacios", "a2", NA, NA,
      "modulo_b", "b1", "b2", NA,
      "modulo_c", "c1", "c2", NA,
      "modulo_coment", "coment", NA
    ),
    label = c(
      "Módulo A: Biblioteca y espacios", "¿Con qué frecuencia usa la biblioteca de la facultad?",
      "Espacios", "¿Qué espacios de estudio le faltan?", NA, NA,
      "Módulo B: Docencia", "Los profesores explican con claridad en clase", "¿Cuántos docentes tuvo este ciclo?", NA,
      "Módulo C: Trámites", "Los trámites y pagos de matrícula son sencillos", "¿Qué trámite le costó más?", NA,
      "Comentarios", "¿Algún comentario final?", NA
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("frec", "frec", "acuerdo", "acuerdo"),
    name = c("1", "2", "1", "2"),
    label = c("Nunca", "Siempre", "De acuerdo", "En desacuerdo"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  .ss_write_xlsform(path, survey, choices)
}

.ss_data <- function() {
  data.frame(
    `_uuid` = paste0("u", 1:8),
    coment = c(
      "La biblioteca de sociales necesita más espacios para estudiar",
      "Los profesores dictan clases muy aburridas",
      "Mejorar la biblioteca y que los docentes expliquen mejor",
      "nada",
      "-",
      "El clima de la ciudad es horrible",
      "",
      # Con este, el módulo A no se lleva más de la mitad de las propuestas
      # (2 de 4) y no se parte en subtemas (TXT-11b).
      "Los trámites de matrícula son lentos"
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.ss_resp <- function(out, id) Find(function(r) identical(r$id_caso, id), out$respuestas)
.ss_codigos <- function(r) vapply(r$propuestas, function(p) p$codigo, character(1))

test_that("propone el módulo por el vocabulario de sus preguntas, con códigos por decena y otro=80", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")

  mods <- out$modulos
  expect_equal(vapply(mods, `[[`, "", "seccion"), c("modulo_a", "modulo_b", "modulo_c"))
  expect_equal(vapply(mods, `[[`, "", "codigo"), c("10", "20", "30"))
  expect_equal(mods[[1]]$etiqueta, "Módulo A: Biblioteca y espacios")
  expect_equal(out$otro$codigo, "80")
  # El grupo del propio comentario no es un módulo candidato.
  expect_false("modulo_coment" %in% vapply(mods, `[[`, "", "seccion"))

  r1 <- .ss_resp(out, "u1")
  expect_equal(.ss_codigos(r1), "10")
  # La justificación: palabras del comentario que comparte con el módulo. La
  # del subgrupo (espacios de estudio) sube al módulo A.
  expect_true(all(c("biblioteca", "espacios") %in% r1$propuestas[[1]]$palabras))
  expect_gt(r1$propuestas[[1]]$puntaje, 0)

  expect_equal(.ss_codigos(.ss_resp(out, "u2")), "20")
})

test_that("un comentario que toca dos módulos recibe las dos propuestas (multicode)", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")
  expect_setequal(.ss_codigos(.ss_resp(out, "u3")), c("10", "20"))
})

test_that("una no respuesta no recibe propuesta; un comentario sin vocabulario queda candidato a otro", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")

  nada <- .ss_resp(out, "u4")
  expect_true(nada$no_respuesta)
  expect_length(nada$propuestas, 0L)
  expect_false(nada$candidato_otro)
  expect_true(.ss_resp(out, "u5")$no_respuesta)
  # La celda vacía no es una respuesta: no aparece.
  expect_null(.ss_resp(out, "u7"))

  clima <- .ss_resp(out, "u6")
  expect_false(clima$no_respuesta)
  expect_length(clima$propuestas, 0L)
  expect_true(clima$candidato_otro)

  expect_equal(out$resumen$escribieron, 7L)
  expect_equal(out$resumen$con_contenido, 5L)
  expect_equal(out$resumen$con_propuesta, 4L)
  expect_equal(out$resumen$por_modulo[["10"]], 2L)
  expect_equal(out$resumen$por_modulo[["20"]], 2L)
  expect_equal(out$resumen$por_modulo[["30"]], 1L)
  # Ningún módulo pasa de la mitad: todo queda en primer nivel.
  expect_false(any(vapply(out$modulos, function(m) !is.null(m$padre), logical(1))))
})

test_that("es solo propuesta: el resultado no trae asignaciones y declara que requiere confirmación", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment")
  expect_identical(out$estado, "propuesta")
  expect_true(out$requiere_confirmacion)
  expect_null(out$grupos)
  expect_null(out$matrix_cases)
})

test_that("las secciones se pueden pedir explícitamente y una inexistente es un error tipado", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_tres())
  out <- codif_sugerir_seccion(inst, .ss_data(), "coment", secciones = c("modulo_b", "modulo_c"))
  expect_equal(vapply(out$modulos, `[[`, "", "codigo"), c("10", "20"))
  expect_equal(.ss_codigos(.ss_resp(out, "u2")), "10")

  err <- tryCatch(codif_sugerir_seccion(inst, .ss_data(), "coment", secciones = "modulo_z"),
                  error = function(e) e)
  expect_equal(err$code, "E_CODIF_SUGERIR_SECCION_NO_EXISTE")
  err <- tryCatch(codif_sugerir_seccion(inst, .ss_data(), "no_existe"), error = function(e) e)
  expect_equal(err$code, "E_CODIF_SUGERIR_VARIABLE_NO_EXISTE")
  expect_equal(err$status, 404)
})

# ---------------------------------------------------------------------------
# TXT-11b: un módulo que se lleva más de la mitad de las propuestas se parte en
# subtemas — sus grupos formales y sus baterías (nota `enunciado_*` + las
# preguntas que la siguen), y las preguntas sueltas antes de la primera nota
# como subtema «general». Códigos 11–19 para el módulo 10.
# ---------------------------------------------------------------------------

.ss_xlsform_baterias <- function(path = .ss_tmp(), n_baterias_extra = 0L) {
  extra_t <- character(0); extra_n <- character(0); extra_l <- character(0)
  temas <- c("Laboratorios de química", "Comedor universitario", "Deportes y gimnasio", "Becas y créditos",
             "Intercambio en el extranjero", "Voluntariado social", "Idiomas y certificaciones",
             "Prácticas preprofesionales", "Salud mental y psicología", "Movilidad y estacionamiento")
  for (k in seq_len(n_baterias_extra)) {
    extra_t <- c(extra_t, "note", "select_one frec", "select_one frec")
    extra_n <- c(extra_n, sprintf("enunciado_x%d", k), sprintf("x%d_1", k), sprintf("x%d_2", k))
    extra_l <- c(extra_l, sprintf("¿Con qué frecuencia usas %s?", tolower(temas[[k]])),
                 sprintf("%s: horario", temas[[k]]), sprintf("%s: atención", temas[[k]]))
  }
  survey <- data.frame(
    type = c(
      "begin_group", "select_one transporte", "integer",
      "note", "select_one frec", "select_one frec", "select_one frec",
      "note", "select_one valor", "select_one valor",
      extra_t,
      "begin_group", "select_one si_no", "integer", "end_group",
      "end_group",
      "begin_group", "select_one frec", "text", "end_group",
      "begin_group", "text", "end_group"
    ),
    name = c(
      "modulo_a", "a1", "a1b",
      "enunciado_a2", "a2_1", "a2_2", "a2_3",
      "enunciado_a3", "a3_1", "a3_2",
      extra_n,
      "bloque_laboral", "a4", "a5", NA,
      NA,
      "modulo_b", "b1", "b2", NA,
      "modulo_coment", "coment", NA
    ),
    label = c(
      "MÓDULO A. VIDA UNIVERSITARIA", "¿Qué medio de transporte usas para llegar al campus?", "¿Cuántos minutos tardas en llegar?",
      "¿Con qué frecuencia usas las siguientes redes sociales?\n\n_Selecciona una opción por fila_", "WhatsApp", "Instagram", "TikTok",
      "¿Cómo valoras los recursos de la facultad?", "Biblioteca", "Laboratorios",
      extra_l,
      "EXPERIENCIA LABORAL", "¿Trabajas además de estudiar?", "¿Cuántas horas semanales dedicas a tu empleo?", NA,
      NA,
      "MÓDULO B. TRÁMITES", "Los trámites de matrícula y pagos son sencillos", "¿Qué trámite te costó más?", NA,
      "Comentarios", "¿Algún comentario final?", NA
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("transporte", "transporte", "frec", "frec", "valor", "valor", "si_no", "si_no"),
    name = c("1", "2", "1", "2", "1", "2", "1", "2"),
    label = c("Bus o combi", "Bicicleta", "Nunca", "Siempre", "Malo", "Bueno", "Sí", "No"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  .ss_write_xlsform(path, survey, choices)
}

.ss_data_baterias <- function() {
  data.frame(
    `_uuid` = paste0("v", 1:6),
    coment = c(
      "Paso todo el día en WhatsApp e Instagram",
      "La biblioteca cierra muy temprano y faltan laboratorios",
      "Trabajo muchas horas en mi empleo y no me alcanza",
      "El transporte al campus es caótico, el bus demora",
      "Los trámites de matrícula son lentos",
      "nada"
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.ss_mod <- function(out, codigo) Find(function(m) identical(m$codigo, codigo), out$modulos)

test_that("un módulo con más de la mitad de las propuestas se parte en grupo formal, baterías y general", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_baterias())
  out <- codif_sugerir_seccion(inst, .ss_data_baterias(), "coment")

  expect_identical(out$estado, "propuesta")
  cods <- vapply(out$modulos, `[[`, "", "codigo")
  # El módulo partido sigue en la lista, seguido de sus subtemas; el B queda en primer nivel.
  expect_equal(cods, c("10", "11", "12", "13", "14", "20"))
  subs <- out$modulos[2:5]
  expect_true(all(vapply(subs, function(m) identical(m$padre, "10"), logical(1))))
  expect_null(.ss_mod(out, "10")$padre)
  expect_null(.ss_mod(out, "20")$padre)
  expect_equal(vapply(subs, `[[`, "", "seccion"),
               c("modulo_a__general", "enunciado_a2", "enunciado_a3", "bloque_laboral"))
  # La etiqueta de una batería es su nota, recortada a su primera línea y sin
  # marcado; la de un grupo, su etiqueta.
  expect_equal(.ss_mod(out, "12")$etiqueta, "¿Con qué frecuencia usas las siguientes redes sociales?")
  expect_equal(.ss_mod(out, "14")$etiqueta, "EXPERIENCIA LABORAL")
  # El general dice de qué módulo es, para que el grupo que cree la confirmación no quede anónimo.
  expect_equal(.ss_mod(out, "11")$etiqueta, "Vida universitaria: preguntas generales")

  expect_equal(.ss_codigos(.ss_resp(out, "v1")), "12")
  expect_equal(.ss_codigos(.ss_resp(out, "v2")), "13")
  expect_equal(.ss_codigos(.ss_resp(out, "v3")), "14")
  expect_equal(.ss_codigos(.ss_resp(out, "v4")), "11")
  expect_equal(.ss_codigos(.ss_resp(out, "v5")), "20")
  # Cada propuesta de subtema dice de qué módulo viene.
  p <- .ss_resp(out, "v1")$propuestas[[1]]
  expect_identical(p$padre, "10")
  expect_identical(p$subtema, "12")
  expect_identical(p$seccion, "enunciado_a2")
  expect_null(.ss_resp(out, "v5")$propuestas[[1]]$padre)

  expect_equal(out$resumen$por_modulo[["12"]], 1L)
  expect_equal(out$resumen$por_modulo[["10"]], 4L)
  expect_equal(out$resumen$partidos, list("10"))
  expect_null(out$grupos)
  expect_null(out$matrix_cases)
})

test_that("con más de nueve subtemas se fusionan los consecutivos de menor vocabulario hasta nueve", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_baterias(n_baterias_extra = 8L))
  out <- codif_sugerir_seccion(inst, .ss_data_baterias(), "coment")
  subs <- Filter(function(m) identical(m$padre, "10"), out$modulos)
  # general + 2 baterías + 8 extra + grupo = 12 → 9.
  expect_length(subs, 9L)
  expect_equal(vapply(subs, `[[`, "", "codigo"), as.character(11:19))
  # El grupo formal y la batería de redes sobreviven con su voz propia.
  expect_true("bloque_laboral" %in% vapply(subs, `[[`, "", "seccion"))
  expect_false(any(duplicated(vapply(subs, `[[`, "", "seccion"))))
  expect_true(all(vapply(.ss_resp(out, "v1")$propuestas, function(p) p$codigo %in% as.character(11:19), logical(1))))
})

# ---------------------------------------------------------------------------
# Contrato HTTP in-process: GET /api/codificacion/sugerencias-seccion
# ---------------------------------------------------------------------------

.ss_endpoint <- function() {
  pr <- mount_codificacion(plumber::pr())
  eps <- pr$endpoints[[1]]
  paths <- vapply(eps, function(e) e$path, character(1))
  eps[[which(paths == "/api/codificacion/sugerencias-seccion")[1]]]
}

.ss_add_base <- function(sid, nombre, xls_path, data_df) {
  xls_meta <- save_upload(sid, "xlsform", paste0(nombre, ".xlsx"),
    readBin(xls_path, "raw", n = file.info(xls_path)$size))
  data_path <- .ss_tmp()
  openxlsx::write.xlsx(data_df, data_path, overwrite = TRUE)
  data_meta <- save_upload(sid, "data", paste0(nombre, "_datos.xlsx"),
    readBin(data_path, "raw", n = file.info(data_path)$size))
  inst <- reporte_instrumento(path = xls_meta$path)
  estudio_add_base(
    sid = sid, nombre = nombre,
    xlsform_file_id = xls_meta$file_id, data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(readxl::read_excel(data_meta$path), instrumento = inst),
    rp_inst = inst, n_filas = nrow(data_df), n_columnas = ncol(data_df)
  )
}

test_that("el endpoint es GET, lee la base pedida (no la primera) y no muta la codificación", {
  ep <- .ss_endpoint()
  expect_equal(ep$verbs, "GET")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  # Base hermana primero, con otro instrumento: si el endpoint cayera en la
  # primera base, los módulos serían los de ella.
  otra_survey <- data.frame(
    type = c("begin_group", "text", "end_group", "begin_group", "text", "end_group"),
    name = c("modulo_x", "x1", NA, "modulo_y", "coment", NA),
    label = c("Módulo X: Transporte", "¿Cómo llega en bus?", NA, "Fin", "Comentario", NA),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  otra_choices <- data.frame(list_name = character(0), name = character(0), label = character(0))
  .ss_add_base(sid, "base_hermana", .ss_write_xlsform(.ss_tmp(), otra_survey, otra_choices),
               data.frame(`_uuid` = "h1", x1 = "bus", coment = "el bus tarda",
                          stringsAsFactors = FALSE, check.names = FALSE))
  .ss_add_base(sid, "base_ccss", .ss_xlsform_tres(), .ss_data())
  primera <- names(session_get(sid)$estudio$bases)[[1]]
  expect_identical(primera, "base_hermana")

  antes <- codif_get(sid, "grupos_recod", source = "base_ccss")
  out <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = plumber:::PlumberResponse$new(),
                      variable = "coment", base = "base_ccss")
  expect_true(isTRUE(out$ok))
  expect_identical(out$base_name, "base_ccss")
  expect_equal(vapply(out$modulos, `[[`, "", "seccion"), c("modulo_a", "modulo_b", "modulo_c"))
  expect_equal(.ss_codigos(.ss_resp(out, "u1")), "10")
  # No escribe nada en la codificación de la base.
  expect_identical(codif_get(sid, "grupos_recod", source = "base_ccss"), antes)

  # `secciones` llega como texto separado por comas desde la query.
  out2 <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = plumber:::PlumberResponse$new(),
                       variable = "coment", base = "base_ccss", secciones = "modulo_b,modulo_c")
  expect_equal(vapply(out2$modulos, `[[`, "", "seccion"), c("modulo_b", "modulo_c"))

  # Sin variable: 400 tipado (wrap_endpoint lo serializa como error API).
  res <- plumber:::PlumberResponse$new()
  err <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = res, base = "base_ccss")
  expect_equal(res$status, 400)
  expect_equal(err$error$code %||% err$code, "E_CODIF_SUGERIR_SIN_VARIABLE")
})

# ---------------------------------------------------------------------------
# TXT-25: una pregunta con enunciado interrogativo propio que sigue a una
# batería sin una nota de por medio no es un ítem de esa batería: forma su
# propio subtema. Un ítem de batería (sin enunciado propio, o que comparte la
# escala del ítem anterior) se queda en la batería. El general no se parte.
# ---------------------------------------------------------------------------

.ss_xlsform_sin_nota <- function(path = .ss_tmp(), items_interrogativos = FALSE) {
  it_lab <- if (items_interrogativos) c("¿Usas el bus del campus?", "¿Usas la bicicleta del campus?") else c("Bloque 1", "Bloque 2")
  it_tipo <- if (items_interrogativos) c("select_one frec", "select_one frec") else c("select_one perfil_1", "select_one perfil_2")
  survey <- data.frame(
    type = c(
      "begin_group", "select_one transporte", "integer",
      "note", it_tipo,
      "select_one forma", "select_one forma", "text",
      "select_multiple espacios", "text",
      "end_group",
      "begin_group", "select_one frec", "text", "end_group",
      "begin_group", "text", "end_group"
    ),
    name = c(
      "modulo_a", "a1", "a1b",
      "enunciado_a9", "a9_1", "a9_2",
      "a10", "a10_recod", "a10_otro",
      "a11", "a11_otro",
      NA,
      "modulo_b", "b1", "b2", NA,
      "modulo_coment", "coment", NA
    ),
    label = c(
      "MÓDULO A. VIDA UNIVERSITARIA", "¿Qué medio de transporte usas para llegar al campus?", "¿Cuántos minutos tardas en llegar?",
      "¿Cómo te definirías como estudiante en los siguientes bloques?", it_lab,
      "¿Cómo te sientes más cómodo/a estudiando?", "¿Cómo te sientes más cómodo/a estudiando?", "Por favor, especifica:",
      "¿Cuáles son los espacios de la Facultad donde pasas más tiempo?", "Por favor, especifica:",
      NA,
      "MÓDULO B. TRÁMITES", "Los trámites de matrícula y pagos son sencillos", "¿Qué trámite te costó más?", NA,
      "Comentarios", "¿Algún comentario final?", NA
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("transporte", "transporte", "frec", "frec", "perfil_1", "perfil_1", "perfil_2", "perfil_2",
                  "forma", "forma", "espacios", "espacios"),
    name = c("1", "2", "1", "2", "1", "2", "1", "2", "1", "2", "1", "2"),
    label = c("Bus o combi", "Bicicleta", "Nunca", "Siempre", "Dedicado", "Relajado", "Puntual", "Impuntual",
              "Solo en silencio", "En grupo con compañeros", "Biblioteca", "Cafetería"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  .ss_write_xlsform(path, survey, choices)
}

.ss_data_sin_nota <- function() {
  data.frame(
    `_uuid` = paste0("w", 1:6),
    coment = c(
      "Soy un estudiante dedicado pero impuntual",
      "Prefiero estudiar en grupo con compañeros",
      "La cafetería y la biblioteca siempre están llenas",
      "El transporte al campus es caótico, el bus demora",
      "Los trámites de matrícula son lentos",
      "nada"
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

test_that("tres preguntas seguidas sin nota entre ellas salen como tres subtemas (TXT-25)", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_sin_nota())
  out <- codif_sugerir_seccion(inst, .ss_data_sin_nota(), "coment")
  subs <- Filter(function(m) identical(m$padre, "10"), out$modulos)
  expect_equal(vapply(subs, `[[`, "", "seccion"), c("modulo_a__general", "enunciado_a9", "a10", "a11"))
  expect_equal(vapply(subs, `[[`, "", "codigo"), c("11", "12", "13", "14"))
  # El subtema de una pregunta suelta se rotula con su enunciado.
  expect_equal(.ss_mod(out, "13")$etiqueta, "¿Cómo te sientes más cómodo/a estudiando?")
  expect_equal(.ss_mod(out, "14")$etiqueta, "¿Cuáles son los espacios de la Facultad donde pasas más tiempo?")
  # Su recodificada (mismo enunciado) y su «especifica» no abren otro subtema.
  expect_false(any(c("a10_recod", "a10_otro", "a11_otro") %in% vapply(subs, `[[`, "", "seccion")))
  expect_equal(.ss_codigos(.ss_resp(out, "w1")), "12")
  expect_equal(.ss_codigos(.ss_resp(out, "w2")), "13")
  expect_equal(.ss_codigos(.ss_resp(out, "w3")), "14")
  expect_equal(.ss_codigos(.ss_resp(out, "w4")), "11")
  expect_identical(out$estado, "propuesta")
  expect_null(out$grupos)
})

test_that("los ítems interrogativos que comparten la escala de la batería no se parten (TXT-25)", {
  inst <- leer_instrumento_xlsform(.ss_xlsform_sin_nota(items_interrogativos = TRUE))
  out <- codif_sugerir_seccion(inst, .ss_data_sin_nota(), "coment")
  secs <- vapply(Filter(function(m) identical(m$padre, "10"), out$modulos), `[[`, "", "seccion")
  # «¿Usas la bicicleta…?» comparte la escala de «¿Usas el bus…?»: es un ítem de la batería.
  expect_false("a9_2" %in% secs)
  # El primer ítem tampoco: con la escala de la batería, es la batería.
  expect_false("a9_1" %in% secs)
  expect_true(all(c("enunciado_a9", "a10", "a11") %in% secs))
})

test_that("sobre el tope se fusionan primero dos baterías vecinas, no las preguntas que se separaron (TXT-25)", {
  u <- function(s, tipo, txt) list(seccion = s, etiqueta = s, etiqueta_completa = s, textos = txt, tipo = tipo)
  subs <- list(
    u("bat1", "bateria", c("redes sociales frecuencia", "whatsapp instagram tiktok youtube facebook linkedin")),
    u("p1", "pregunta", "estudiar comodo"),
    u("p2", "pregunta", "espacios facultad"),
    u("bat2", "bateria", c("docentes trato aula", "capacitados distantes dispuestos valoran ejemplos")),
    u("bat3", "bateria", c("horarios atencion", "cumplen horas establecidas alumnos fuera"))
  )
  out <- .codif_ss_fusionar_subtemas(subs, vacias = character(0), max_subtemas = 4L)
  expect_equal(vapply(out, `[[`, "", "seccion"), c("bat1", "p1", "p2", "bat2"))
  expect_equal(out[[4]]$etiqueta, "bat2 / bat3")
  # Sin dos baterías juntas, se fusiona el par vecino de menor vocabulario, como antes.
  out3 <- .codif_ss_fusionar_subtemas(out, vacias = character(0), max_subtemas = 3L)
  expect_equal(vapply(out3, `[[`, "", "seccion"), c("bat1", "p1", "bat2"))
})
