# Detector de consistencia (ítem 31 del checklist de Validación del practicante).
#
# Base sintética de 300 encuestas, 10 recopiladores de 30 cada uno. En la base
# limpia, quien fue "Una vez" marca 1 o 2 servicios, quien fue "2 a 3 veces"
# hasta 3 y quien fue "4 veces o más" hasta 6. En la base con invento, una
# persona de campo registra 12 encuestas con "Una vez" y 4 o 6 servicios.

.dc_formulario <- function() {
  survey <- data.frame(
    type = c("begin_group", "select_one frecuencia", "select_multiple servicios", "end_group",
             "integer", "text", "text", "calculate"),
    name = c("uso", "frec", "serv", NA, "edad", "codigo", "telefono", "enc"),
    label = c("Uso del servicio", "11. ¿Cuántas veces usó el servicio en el año?",
              "10. ¿Qué servicios recibió?", NA, "Edad", "Código de ficha", "Teléfono de contacto", NA),
    stringsAsFactors = FALSE)
  choices <- data.frame(
    list_name = c(rep("frecuencia", 3), rep("servicios", 7)),
    name = c("1", "2", "3", "1", "2", "3", "4", "5", "6", "70"),
    label = c("Una vez", "2 a 3 veces", "4 veces o más", "Registro", "Carnet", "Pensión",
              "Certificado", "Talleres", "Terapia", "Otro"),
    stringsAsFactors = FALSE)
  list(survey = survey, choices = choices)
}

.dc_instrumento <- function() {
  dir <- withr::local_tempdir(.local_envir = parent.frame())
  f <- .dc_formulario()
  xls <- file.path(dir, "formulario.xlsx")
  openxlsx::write.xlsx(f, xls)
  leer_xlsform_limpieza(xls, verbose = FALSE)
}

.dc_datos <- function(invento = TRUE) {
  n <- 300L
  enc <- rep(sprintf("Persona %02d", 1:10), each = 30L)
  frec <- rep(c(1L, 2L, 3L), length.out = n)
  # Cantidad de servicios coherente con la frecuencia.
  k <- ifelse(frec == 1L, 1L + (seq_len(n) %% 2L),
              ifelse(frec == 2L, 1L + (seq_len(n) %% 3L), 1L + (seq_len(n) %% 6L)))
  if (invento) {
    inv <- which(enc == "Persona 10")[1:12]
    frec[inv] <- 1L
    # 8 con los 6 servicios y 4 justo en el umbral de "muchas" (4 de 6).
    k[inv] <- c(rep(6L, 8L), rep(4L, 4L))
  }
  data.frame(
    enc = enc,
    frec = as.character(frec),
    serv = vapply(k, function(x) paste(seq_len(x), collapse = " "), character(1)),
    edad = 20L + (seq_len(n) %% 40L),
    codigo = sprintf("F-%04d", seq_len(n)),
    stringsAsFactors = FALSE)
}

.dc_correr <- function(data, recopilador = "enc", ...) {
  inst <- .dc_instrumento()
  validacion_detector_consistencia(data, inst$survey, inst$choices, recopilador = recopilador, ...)
}

.dc_de_tipo <- function(r, tipo) Filter(function(s) identical(s$tipo, tipo), r$sugerencias)

test_that("un recopilador que inventa la combinación rara sale, con su cifra", {
  r <- .dc_correr(.dc_datos(invento = TRUE))
  comb <- .dc_de_tipo(r, "frecuencia_multiple")
  expect_length(comb, 1L)
  s <- comb[[1]]
  expect_identical(r$sugerencias[[1]]$id, s$id) # la concentrada va primero
  expect_identical(vapply(s$variables, `[[`, "", "variable"), c("frec", "serv"))
  expect_identical(s$cifra$n_casos, 12L)
  expect_identical(s$cifra$umbral_opciones, 4L) # 6 opciones de contenido: más de la mitad
  expect_match(s$texto, "Responden \"Una vez\" en frec y marcan 4 o más de las 7 opciones de serv", fixed = TRUE)
  expect_identical(s$concentracion$estado, "concentrada")
  expect_identical(s$concentracion$recopilador, "Persona 10")
  expect_identical(s$concentracion$n_casos_recopilador, 12L)
  expect_identical(s$concentracion$n_encuestas_recopilador, 30L)
  expect_identical(s$concentracion$n_encuestas, 300L)
  expect_match(s$concentracion$texto,
               "12 de los 12 casos (100.0 %) son de Persona 10, que hizo 30 de las 300 encuestas (10.0 %).", fixed = TRUE)
  # Casos con su fila, su recopilador y los valores de las preguntas que mira.
  expect_length(s$casos, 12L)
  expect_true(all(vapply(s$casos, `[[`, "", "recopilador") == "Persona 10"))
  expect_identical(s$casos[[1]]$valores$frec, "1")
})

test_that("una base limpia no da sugerencias fuertes", {
  r <- .dc_correr(.dc_datos(invento = FALSE))
  expect_length(r$sugerencias, 0L)
  expect_identical(r$n_candidatas, 0L)
})

test_that("sin recopilador declarado lo dice y no mide la concentración", {
  r <- .dc_correr(.dc_datos(invento = TRUE), recopilador = NA_character_)
  expect_true("sin_recopilador" %in% vapply(r$avisos, `[[`, "", "codigo"))
  expect_null(r$recopilador)
  for (s in r$sugerencias) expect_identical(s$concentracion$estado, "sin_rol")
  # Sin persona a quien atribuirla, la combinación sale solo si es rara frente al resto.
  comb <- .dc_de_tipo(r, "frecuencia_multiple")
  for (s in comb) expect_lt(s$cifra$n_casos, 0.25 * s$cifra$esperados + 1e-9)
})

test_that("un recopilador declarado que no es columna de la base avisa con su causa", {
  r <- .dc_correr(.dc_datos(invento = TRUE), recopilador = "entrevistador")
  avisos <- vapply(r$avisos, `[[`, "", "codigo")
  expect_true("recopilador_sin_columna" %in% avisos)
  expect_match(r$avisos[[which(avisos == "recopilador_sin_columna")]]$texto, "entrevistador", fixed = TRUE)
})

test_that("la regla sugerida marca exactamente los casos de la sugerencia", {
  data <- .dc_datos(invento = TRUE)
  r <- .dc_correr(data)
  s <- .dc_de_tipo(r, "frecuencia_multiple")[[1]]
  regla <- c(list(id = "RC_900"), s$regla)
  expect_silent(.validar_regla_custom(regla))
  gate <- regla$gate_conditions[[1]]
  marcados <- .vd_sm_cardinality_violation("serv", data, max_count = regla$params$max) &
    data[[gate$variable]] == gate$value
  expect_identical(which(marcados), vapply(s$casos, `[[`, 1L, "fila"))
})

test_that("una concentración se distingue de un reparto parejo", {
  grupo <- rep(sprintf("P%d", 1:10), each = 30L)
  repartida <- .vdc_concentracion(seq(1, 300, by = 30), grupo, "enc")
  expect_identical(repartida$estado, "repartida")
  concentrada <- .vdc_concentracion(271:280, grupo, "enc")
  expect_identical(concentrada$estado, "concentrada")
  expect_identical(concentrada$recopilador, "P10")
  # La mitad de los casos en quien hizo la mitad de las encuestas no es concentración.
  mitad <- rep(c("A", "B"), each = 150L)
  pareja <- .vdc_concentracion(c(1:6, 151:154), mitad, "enc")
  expect_identical(pareja$estado, "repartida")
  expect_identical(pareja$recopilador, "A")
  # Pocos casos: no se mide.
  expect_identical(.vdc_concentracion(271:272, grupo, "enc")$estado, "pocos_casos")
  # Los casos sin recopilador no cuentan en la base.
  grupo_na <- grupo; grupo_na[1:30] <- NA
  c2 <- .vdc_concentracion(271:280, grupo_na, "enc")
  expect_identical(c2$n_encuestas, 270L)
})

test_that("columna que no se parece a sí misma: atípico, dígitos, forma y dato personal", {
  data <- .dc_datos(invento = FALSE)
  data$edad[7] <- 999L
  data$codigo[c(11, 12)] <- c("F0011", "12")
  data$telefono <- sprintf("9%08d", 10000000L + seq_len(nrow(data)))
  data$dni <- sprintf("%08d", 40000000L + seq_len(nrow(data)))
  data$dni[c(5, 6)] <- c("4000005", "400006")
  r <- .dc_correr(data)
  tipos <- vapply(r$sugerencias, `[[`, "", "tipo")
  at <- .dc_de_tipo(r, "atipico")[[1]]
  expect_identical(at$variables[[1]]$variable, "edad")
  expect_identical(vapply(at$casos, `[[`, 1L, "fila"), 7L)
  expect_match(at$texto, "1 valor de edad queda lejos del resto (999)", fixed = TRUE)
  expect_identical(at$regla$tipo, "rango_num")
  expect_silent(.validar_regla_custom(c(list(id = "RC_901"), at$regla)))
  fo <- .dc_de_tipo(r, "forma")[[1]]
  expect_identical(fo$variables[[1]]$variable, "codigo")
  expect_identical(sort(vapply(fo$casos, `[[`, 1L, "fila")), c(11L, 12L))
  di <- .dc_de_tipo(r, "digitos")
  expect_identical(di[[1]]$variables[[1]]$variable, "dni")
  expect_identical(sort(vapply(di[[1]]$casos, `[[`, 1L, "fila")), c(5L, 6L))
  # Todas las columnas personales van en una sola sugerencia, con la causa de Carga.
  pe <- .dc_de_tipo(r, "dato_personal")
  expect_length(pe, 1L)
  expect_identical(vapply(pe[[1]]$variables, `[[`, "", "variable"), c("telefono", "dni"))
  causa <- .reconciliacion_dato_personal("telefono", data$telefono)$causa
  expect_match(pe[[1]]$texto, paste0("telefono: ", causa), fixed = TRUE)
  expect_identical(pe[[1]]$titulo, "Datos potencialmente personales en 2 columnas")
  # El recopilador declarado no se mira como columna.
  expect_false("enc" %in% unlist(lapply(r$sugerencias, function(s) vapply(s$variables, `[[`, "", "variable"))))
})

test_that("la forma no distingue días o meses de uno o dos dígitos, sí el largo de un año o un código", {
  expect_identical(.vdc_forma_de(c("1 Julio", "13 Junio")), c("9 A", "9 A"))
  expect_identical(.vdc_forma_de(c("08.10.2026", "16.10.16")), c("9.9.9999", "9.9.9"))
  expect_identical(.vdc_forma_de(c("P375", "595")), c("A999", "999"))
})

test_that("una cola larga no es atípico", {
  data <- .dc_datos(invento = FALSE)
  data$edad[1:30] <- 900L # 10 % lejos: no son pocos
  r <- .dc_correr(data)
  expect_length(.dc_de_tipo(r, "atipico"), 0L)
})

test_that("las preguntas de secciones distintas no se cruzan solas, pero se pueden pedir", {
  inst <- .dc_instrumento()
  inst$survey$group_name[inst$survey$name %in% "serv"] <- "otra_seccion"
  data <- .dc_datos(invento = TRUE)
  r <- validacion_detector_consistencia(data, inst$survey, inst$choices, recopilador = "enc")
  expect_length(.dc_de_tipo(r, "frecuencia_multiple"), 0L)
  r2 <- validacion_detector_consistencia(data, inst$survey, inst$choices, recopilador = "enc",
                                         pares = list(c("frec", "serv")))
  expect_length(.dc_de_tipo(r2, "frecuencia_multiple"), 1L)
})

test_that("un par categórico pedido marca la celda rara frente a la independencia", {
  data <- .dc_datos(invento = FALSE)
  data$sexo <- rep(c("1", "2"), length.out = nrow(data))
  data$embarazo <- ifelse(data$sexo == "2", ifelse((seq_len(nrow(data)) %/% 2L) %% 2L == 0L, "1", "2"), "2")
  data$embarazo[c(1, 3)] <- "1" # dos hombres embarazados
  r <- .dc_correr(data, pares = list(c("sexo", "embarazo")))
  ca <- .dc_de_tipo(r, "categorica_pedida")
  expect_length(ca, 1L)
  expect_identical(sort(vapply(ca[[1]]$casos, `[[`, 1L, "fila")), c(1L, 3L))
  expect_silent(.validar_regla_custom(c(list(id = "RC_902"), ca[[1]]$regla)))
})

test_that("un par pedido mal formado o con una pregunta que no está corta con E_BAD_REQUEST", {
  data <- .dc_datos(invento = FALSE)
  expect_error(.dc_correr(data, pares = list(c("frec", "no_existe"))), class = "api_error")
  e <- tryCatch(.dc_correr(data, pares = list(c("frec", "no_existe"))), api_error = function(e) e)
  expect_identical(e$code, "E_BAD_REQUEST")
  expect_error(.dc_correr(data, pares = list(c("serv", "codigo"))), class = "api_error")
  expect_error(.vdc_parsear_pares("frec"), class = "api_error")
  expect_identical(.vdc_parsear_pares("frec:serv, a:b"), list(c("frec", "serv"), c("a", "b")))
})

test_that("pocas y fuertes: no pasa del tope y ordena lo concentrado primero", {
  data <- .dc_datos(invento = TRUE)
  u <- .VDC_UMBRALES
  u$max_sugerencias <- 1L
  data$edad[7] <- 999L
  r <- .dc_correr(data, u = u)
  expect_length(r$sugerencias, 1L)
  expect_identical(r$sugerencias[[1]]$tipo, "frecuencia_multiple")
  expect_gte(r$n_candidatas, 2L)
})

# --- Contrato HTTP, con dos bases ---------------------------------------------

.dc_sesion <- function(dir) {
  sid <- session_create()
  f <- .dc_formulario()
  for (nombre in c("Limpia", "Con invento")) {
    sub <- file.path(dir, nombre)
    dir.create(sub, recursive = TRUE, showWarnings = FALSE)
    xls <- file.path(sub, "formulario.xlsx")
    openxlsx::write.xlsx(f, xls)
    datos <- .dc_datos(invento = identical(nombre, "Con invento"))
    csv <- file.path(sub, "base.csv")
    utils::write.csv(datos, csv, row.names = FALSE)
    xm <- save_upload(sid, "xlsform", basename(xls), readBin(xls, "raw", n = file.info(xls)$size))
    dm <- save_upload(sid, "data", basename(csv), readBin(csv, "raw", n = file.info(csv)$size))
    inst <- reporte_instrumento(path = xm$path)
    estudio_add_base(sid = sid, nombre = nombre, xlsform_file_id = xm$file_id, data_file_id = dm$file_id,
                     data_ext = "csv", rp_data = reporte_data(datos, instrumento = inst), rp_inst = inst,
                     n_filas = nrow(datos), n_columnas = ncol(datos))
    cfg <- normalize_validation_operational_config(list(identity = list(agent_variable = "enc")))
    validacion_scope_set(sid, nombre, "operational_config", cfg)
  }
  # La activa es la primera: la base pedida debe mandar.
  s <- session_get(sid); s$estudio$active_base <- "Limpia"; .session_env[[sid]] <- s
  sid
}

.dc_get <- function(pr, sid, query) {
  req <- as.environment(list(
    REQUEST_METHOD = "GET", PATH_INFO = "/api/validacion/v2/detector-consistencia", QUERY_STRING = query,
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
    rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) "")))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: lee la base pedida, no la primera, y no marca el proyecto", {
  dir <- withr::local_tempdir()
  sid <- .dc_sesion(dir)
  pr <- mount_validacion_detector(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  sucia_antes <- isTRUE(session_get(sid)$project_dirty)
  r <- .dc_get(pr, sid, "base_nombre=Con%20invento")
  expect_identical(r$status, 200L)
  expect_identical(r$body$base_nombre[[1]], "Con invento")
  sug <- r$body$sugerencias
  expect_gte(length(sug), 1L)
  expect_identical(sug[[1]]$tipo[[1]], "frecuencia_multiple")
  expect_identical(sug[[1]]$concentracion$recopilador[[1]], "Persona 10")
  expect_identical(r$body$recopilador$variable[[1]], "enc")
  limpia <- .dc_get(pr, sid, "base_nombre=Limpia")
  expect_identical(limpia$status, 200L)
  expect_length(limpia$body$sugerencias, 0L)
  expect_identical(isTRUE(session_get(sid)$project_dirty), sucia_antes)
  mal <- .dc_get(pr, sid, "base_nombre=Limpia&pares=frec")
  expect_identical(mal$status, 400L)
  expect_identical(mal$body$error$code[[1]] %||% mal$body$code[[1]], "E_BAD_REQUEST")
})
