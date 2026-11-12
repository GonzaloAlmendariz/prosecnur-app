# Reglas propias de fechas y horas (validacion_regla_fechas.R):
# "Fecha fuera del operativo" (`rango_fecha`) y "Dos fechas u horas que deben
# cuadrar" (`comparar_fechas`).
#
# Grano: fila de la tabla principal (el caso). La cifra es la del motor: casos
# marcados sobre las filas que evalúa la auditoría. Los casos se cruzan por el
# id del motor (respondent_id), nunca por posición: la base de prueba no está
# ordenada por id.
#
# Base sintética (operativo del 08/10/2026 al 31/10/2026):
#   id   fecha        f_entrev     superv     h_ini   h  min ampm  lectura esperada
#   c07  08.10.2026   08.10.2026   09.10.26   13.45   4  30  2     dentro; 13:45 a 16:30 (165 min)
#   c03  07.10.2026   07.10.2026   07.10.26   09.00   9  20  1     antes del operativo; 20 min
#   c12  15.10.28     15.10.2026   14.10.26   10.3    10 15  1     año de 2 cifras; supervisión antes; fin antes (10:15 < 10:30)
#   c01  16.10.2      16.10.2026   16.10.26   05.25   5  40  1     ilegible; 05:25 a 05:40 (15 min)
#   c09  (vacía)      20.10.2026   21.10.26   14.00   2  10  2     vacía; 14:00 a 14:10 (10 min)
#   c05  31.02.2026   02.11.2026   03.11.26   15.00   4  (v) 2     no existe; después del cierre; fin incompleto
#   c02  2026-10-09   09.10.2026   09.10.26   16.00   18.5 0 2     ISO; hora de fin ilegible ("18.5")
#   c11  21/10/2026   21.10.2026   22.10.26   11.00   1  15  (v)   barras; hora sin a.m./p.m. (incompleta)

.fec_datos <- function() {
  data.frame(
    respondent_id = c("c07", "c03", "c12", "c01", "c09", "c05", "c02", "c11"),
    fecha = c("08.10.2026", "07.10.2026", "15.10.28", "16.10.2", NA, "31.02.2026", "2026-10-09", "21/10/2026"),
    f_entrev = c("08.10.2026", "07.10.2026", "15.10.2026", "16.10.2026", "20.10.2026", "02.11.2026",
                 "09.10.2026", "21.10.2026"),
    superv = c("09.10.26", "07.10.26", "14.10.26", "16.10.26", "21.10.26", "03.11.26", "09.10.26", "22.10.26"),
    h_ini = c("13.45", "09.00", "10.3", "05.25", "14.00", "15.00", "16.00", "11.00"),
    h = c(4, 9, 10, 5, 2, 4, 18.5, 1),
    mi = c(30, 20, 15, 40, 10, NA, 0, 15),
    ampm = c(2, 1, 1, 1, 2, 2, 2, NA),
    stringsAsFactors = FALSE
  )
}

.fec_regla <- function(tipo, params, variables, id = "RC_FEC", ...) {
  c(list(id = id, activa = TRUE, nombre = "Fechas", tipo = tipo,
         variables = as.list(variables), params = params,
         severidad = "error", hallazgo_kind = "inconsistencia"), list(...))
}

.fec_rango <- function(...) {
  .fec_regla("rango_fecha", utils::modifyList(list(min = "2026-10-08", max = "2026-10-31"), list(...)), "fecha")
}

# La hora de fin armada con hora, minutos y a.m./p.m. (1 = a.m., 2 = p.m.).
.fec_fin_ampm <- list(variables = list("h", "mi", "ampm"), partes = "hora_minutos_ampm",
                      am = list("1"), pm = list("2"))

.fec_horas <- function(patron, ...) {
  # Lo que se pase reemplaza entero (no se mezcla con el inicio o el fin de base).
  base <- list(unidad = "hora", patron = patron,
               inicio = list(variables = list("h_ini"), partes = "una", formato = "hh.mm"),
               fin = .fec_fin_ampm)
  extra <- list(...)
  base[names(extra)] <- extra
  .fec_regla("comparar_fechas", base, c("h_ini", "h", "mi", "ampm"))
}

# Ids del motor de las filas marcadas (por el evaluador de la auditoría).
.fec_marca <- function(regla, datos = .fec_datos()) {
  rule <- bridge_regla_custom(regla)
  ev <- evaluate_validation_bundle(list(rules = list(rule)), datos, strict = FALSE)
  fila <- ev$resumen[ev$resumen$id_regla == rule$id, ]
  expect_identical(fila$estado_dinamico, "correcta")
  flag <- ev$datos[[rule$flag_name]]
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

# El texto del plan (y del script de limpieza), fuera del motor, en un entorno
# con solo las columnas de la base, después de la normalización del plan.
.fec_marca_texto <- function(regla, datos = .fec_datos()) {
  proc <- .normalizar_procesamiento(.compilar_regla_custom(regla)$Procesamiento)
  expr <- sub("^[A-Za-z0-9_.]+ <- ", "", proc)
  env <- list2env(as.list(datos), parent = baseenv())
  flag <- eval(parse(text = expr), envir = env)
  flag[is.na(flag)] <- FALSE
  sort(datos$respondent_id[flag])
}

.fec_ambos <- function(regla, esperado) {
  expect_identical(.fec_marca(regla), sort(esperado))
  expect_identical(.fec_marca_texto(regla), sort(esperado))
}

# Lo medido por id, para leer cada caso sin depender del orden.
.fec_medida <- function(regla, datos = .fec_datos()) {
  m <- .regla_fechas_medir_tabla(datos, regla)
  out <- as.data.frame(m[c("a_texto", "a_estado", "a_formato", "b_texto", "b_estado", "diferencia", "motivo")],
                       stringsAsFactors = FALSE)
  rownames(out) <- datos$respondent_id
  out
}

test_that("en 'auto' cada respuesta se lee con el formato que le calza y se dice cuál", {
  m <- .fec_medida(.fec_rango())
  expect_identical(m["c07", "a_texto"], "2026-10-08")
  expect_identical(m["c07", "a_formato"], "dd.mm.aaaa")
  expect_identical(m["c12", "a_texto"], "2028-10-15")
  expect_identical(m["c12", "a_formato"], "dd.mm.aa")
  expect_identical(m["c02", "a_formato"], "aaaa-mm-dd")
  expect_identical(m["c11", "a_formato"], "dd/mm/aaaa")
  # Ilegible (año de una cifra), inexistente (31 de febrero) y vacía.
  expect_identical(m[c("c01", "c05", "c09"), "a_estado"], c("ilegible", "ilegible", "vacia"))
})

test_that("un instante con desfase se lee en la zona del operativo", {
  r <- .fec_rango()
  d <- data.frame(respondent_id = c("z1", "z2", "z3"),
                  fecha = c("2026-10-09T03:15:00.000Z", "2026-10-08T23:15:00-05:00", "2026-10-08 10:00"),
                  stringsAsFactors = FALSE)
  m <- .fec_medida(r, d)
  # 03:15 UTC del 9 es todavía el 8 en Lima.
  expect_identical(m$a_texto, c("2026-10-08", "2026-10-08", "2026-10-08"))
})

test_that("Fecha fuera del operativo marca antes, después e ilegibles, y la vacía no", {
  # c03 antes del inicio; c12 (2028) después del cierre; c01 y c05 ilegibles.
  .fec_ambos(.fec_rango(), c("c03", "c12", "c01", "c05"))
  m <- .fec_medida(.fec_rango())
  expect_identical(m[c("c03", "c12", "c01"), "motivo"], c("antes", "despues", "ilegible"))
  # Sin marcar ilegibles, solo las que caen fuera.
  .fec_ambos(.fec_rango(marcar_ilegibles = FALSE), c("c03", "c12"))
})

test_that("con el formato declarado, lo que no calza es ilegible y no se reinterpreta", {
  # "15.10.28" ya no se lee como 2028 y "21/10/2026" ni "2026-10-09" se leen.
  r <- .fec_rango(formato = "dd.mm.aaaa")
  m <- .fec_medida(r)
  expect_identical(m[c("c12", "c02", "c11"), "a_estado"], c("ilegible", "ilegible", "ilegible"))
  .fec_ambos(r, c("c03", "c12", "c01", "c05", "c02", "c11"))
})

test_that("el límite es inclusivo salvo que se diga", {
  .fec_ambos(.fec_rango(min = "2026-10-09", marcar_ilegibles = FALSE), c("c03", "c07", "c12"))
  .fec_ambos(.fec_rango(min = "2026-10-08", inclusive = FALSE, marcar_ilegibles = FALSE), c("c03", "c07", "c12"))
})

test_that("una fecha repartida en día, mes y año se arma y se marca incompleta", {
  d <- data.frame(respondent_id = c("p2", "p1", "p3", "p4"),
                  dia = c(7, 8, NA, 31), mes = c(10, 10, 10, 2), anio = c(2026, 26, 2026, 2026))
  r <- .fec_regla("rango_fecha", list(min = "2026-10-08", partes = "dia_mes_anio"), c("dia", "mes", "anio"))
  m <- .fec_medida(r, d)
  expect_identical(m["p1", "a_texto"], "2026-10-08")
  expect_identical(m[c("p3", "p4"), "a_estado"], c("incompleta", "ilegible"))
  .fec_ambos_d <- function(regla, esperado) {
    expect_identical(.fec_marca(regla, d), sort(esperado))
    expect_identical(.fec_marca_texto(regla, d), sort(esperado))
  }
  .fec_ambos_d(r, c("p2", "p3", "p4"))
})

test_that("las horas se leen de hh.mm y de hora, minutos y a.m./p.m.", {
  m <- .fec_medida(.fec_horas("orden"))
  # "10.3" es una hora que perdió el cero: 10:30. "05.25" es 05:25.
  expect_identical(m[c("c07", "c12", "c01"), "a_texto"], c("13:45", "10:30", "05:25"))
  # 4, 30, p.m. es 16:30; 9, 20, a.m. es 09:20.
  expect_identical(m[c("c07", "c03"), "b_texto"], c("16:30", "09:20"))
  # Sin minutos o sin a.m./p.m. con una hora de 1 a 12: incompleta. "18.5" no es una hora.
  expect_identical(m[c("c05", "c11", "c02"), "b_estado"], c("incompleta", "incompleta", "ilegible"))
  d <- data.frame(respondent_id = c("x1", "x2", "x3"), h_ini = c("13:45", "1:45 p.m.", "25.10"),
                  h = c(15, 13, 12), mi = c(0, 0, 5), ampm = c(NA, 1, 1))
  m <- .fec_medida(.fec_horas("orden", inicio = list(variables = list("h_ini"), partes = "una")), d)
  # Sin a.m./p.m. una hora de 24 se lee; "13 a.m." no existe; 12 a.m. es medianoche.
  expect_identical(m$b_texto, c("15:00", NA, "00:05"))
  expect_identical(m$b_estado, c("leida", "ilegible", "leida"))
  expect_identical(m$a_texto, c("13:45", "13:45", NA))
})

test_that("orden: el fin antes que el inicio, por hora y por fecha", {
  # c12: 10:15 antes que 10:30. Los ilegibles e incompletos también se marcan.
  .fec_ambos(.fec_horas("orden"), c("c12", "c05", "c02", "c11"))
  .fec_ambos(.fec_horas("orden", marcar_ilegibles = FALSE), c("c12"))
  # Supervisión (dd.mm.aa) antes que la entrevista (dd.mm.aaaa): c12.
  sup <- .fec_regla("comparar_fechas",
                    list(unidad = "fecha", patron = "orden",
                         inicio = list(variables = list("f_entrev"), formato = "dd.mm.aaaa"),
                         fin = list(variables = list("superv"), formato = "dd.mm.aa")),
                    c("f_entrev", "superv"))
  .fec_ambos(sup, c("c12"))
})

test_that("duración: menos del mínimo o más del máximo, en minutos", {
  m <- .fec_medida(.fec_horas("duracion", minimo = 11, maximo = 90))
  expect_equal(m[c("c07", "c03", "c01", "c09"), "diferencia"], c(165, 20, 15, 10))
  # c07 165 > 90; c09 10 < 11; c12 negativa (se nombra orden); más los ilegibles.
  .fec_ambos(.fec_horas("duracion", minimo = 11, maximo = 90), c("c07", "c09", "c12", "c05", "c02", "c11"))
  m <- .fec_medida(.fec_horas("duracion", minimo = 11, maximo = 90))
  expect_identical(m[c("c07", "c09", "c12"), "motivo"], c("larga", "corta", "orden"))
  # Solo el máximo: la negativa no marca.
  .fec_ambos(.fec_horas("duracion", maximo = 90, marcar_ilegibles = FALSE), c("c07"))
  # Diferencia de fechas en días: la fecha de la encuesta distinta de la de la entrevista.
  dist <- .fec_regla("comparar_fechas",
                     list(unidad = "fecha", patron = "duracion", minimo = 0, maximo = 0, marcar_ilegibles = FALSE,
                          inicio = list(variables = list("fecha")), fin = list(variables = list("f_entrev"))),
                     c("fecha", "f_entrev"))
  # c12: 2028 frente a 2026; c02: 09/10 frente a 09/10 (igual).
  .fec_ambos(dist, c("c12"))
})

test_that("el filtro previo se aplica a las reglas de fechas", {
  regla <- .fec_regla("rango_fecha", list(min = "2026-10-08", max = "2026-10-31"), "fecha",
                      gate_conditions = list(list(variable = "ampm", op = "==", value = "1")))
  expect_identical(.fec_marca(regla), sort(c("c03", "c12", "c01")))
})

test_that("una pregunta que falta en la base se dice, no se descarta", {
  d <- .fec_datos()
  d$mi <- NULL
  rule <- bridge_regla_custom(.fec_horas("orden"))
  ev <- evaluate_validation_bundle(list(rules = list(rule)), d, strict = FALSE)
  fila <- ev$resumen[ev$resumen$id_regla == rule$id, ]
  expect_false(identical(fila$estado_dinamico, "correcta"))
  expect_match(fila$detalle, "mi")
})

test_that("la lectura cuenta cada formato y sus cuatro estados suman las filas", {
  lec <- .regla_fechas_lectura(.fec_datos(), .fec_rango())
  expect_length(lec, 1L)
  l <- lec[[1]]
  formatos <- stats::setNames(vapply(l$formatos, function(f) f$n, integer(1)),
                              vapply(l$formatos, function(f) f$formato, character(1)))
  expect_identical(formatos[["dd.mm.aaaa"]], 2L)
  expect_identical(sum(formatos), l$n_leidas)
  expect_identical(c(l$n_leidas, l$n_vacias, l$n_incompletas, l$n_ilegibles), c(5L, 1L, 0L, 2L))
  expect_identical(l$n_leidas + l$n_vacias + l$n_incompletas + l$n_ilegibles, l$n_filas)
  lec <- .regla_fechas_lectura(.fec_datos(), .fec_horas("orden"))
  expect_identical(vapply(lec, function(x) x$momento, character(1)), c("inicio", "fin"))
  expect_identical(c(lec[[2]]$n_leidas, lec[[2]]$n_incompletas, lec[[2]]$n_ilegibles), c(5L, 2L, 1L))
})

test_that("el esquema rechaza reglas de fechas mal formadas con su código", {
  err <- function(regla) {
    e <- tryCatch(.validar_regla_custom(regla), api_error = function(e) e)
    if (inherits(e, "api_error")) e$code else NA_character_
  }
  expect_true(is.na(err(.fec_horas("orden"))))
  expect_true(is.na(err(.fec_rango(formato = "dd.mm.aa"))))
  expect_identical(err(.fec_rango(formato = "hh:mm")), "E_REGLA_FECHAS_FORMATO")
  expect_identical(err(.fec_rango(partes = "dia_mes_anio")), "E_REGLA_FECHAS_PARTES")
  expect_identical(err(.fec_horas("antes")), "E_REGLA_FECHAS_PATRON")
  expect_identical(err(.fec_horas("orden", unidad = "semana")), "E_REGLA_FECHAS_PATRON")
  expect_identical(err(.fec_horas("duracion")), "E_REGLA_FECHAS_DURACION")
  expect_identical(err(.fec_horas("duracion", minimo = 90, maximo = 10)), "E_REGLA_FECHAS_DURACION")
  expect_identical(err(.fec_horas("duracion", minimo = "diez")), "E_REGLA_FECHAS_DURACION")
  expect_identical(err(.fec_horas("orden", fin = list(variables = list("h", "mi"), partes = "hora_minutos_ampm"))),
                   "E_REGLA_FECHAS_PARTES")
  expect_identical(err(.fec_horas("orden", fin = list(variables = list("h", "mi", "ampm"), partes = "hora_minutos_ampm",
                                                      am = list("1"), pm = list("1")))), "E_REGLA_FECHAS_PARTES")
  # Las preguntas de la regla son las del inicio y luego las del fin, por nombre.
  mal <- .fec_horas("orden")
  mal$variables <- list("h", "mi", "ampm", "h_ini")
  expect_identical(err(mal), "E_REGLA_FECHAS_PARTES")
  expect_true(all(c("E_REGLA_FECHAS_DURACION", "E_REGLA_FECHAS_FORMATO", "E_REGLA_FECHAS_PARTES",
                    "E_REGLA_FECHAS_PATRON") %in% errores_registrados()$codigo))
})

test_that("la frase del catálogo dice el periodo, el formato y los ilegibles", {
  ctx <- .vrf_contexto(NULL)
  frase <- function(regla) .vrf_texto_plano(.vrf_frase_fechas(list(propia = regla), ctx))
  expect_identical(frase(.fec_rango(formato = "dd.mm.aaaa")),
                   paste("Se marca cuando fecha es anterior al 08/10/2026 o es posterior al 31/10/2026.",
                         "fecha se lee como dd.mm.aaaa. También se marca una fecha que no se puede leer."))
  expect_identical(frase(.fec_rango(marcar_ilegibles = FALSE)),
                   "Se marca cuando fecha es anterior al 08/10/2026 o es posterior al 31/10/2026.")
  expect_identical(frase(.fec_horas("orden")),
                   paste("Se marca cuando la hora armada con h, mi y ampm es anterior a h_ini.",
                         "h_ini se lee como hh.mm. También se marca una hora incompleta o que no se puede leer."))
  expect_identical(frase(.fec_horas("duracion", minimo = 11, maximo = 90, marcar_ilegibles = FALSE)),
                   paste("Se marca cuando entre h_ini y la hora armada con h, mi y ampm pasan menos de 11",
                         "o más de 90 minutos. h_ini se lee como hh.mm."))
  expect_identical(.vrf_nombre_familia("propia", "comparar_fechas"), "Dos fechas u horas que deben cuadrar")
})

test_that("el enunciado del caso sale de la misma medida que la marca", {
  en <- function(regla, id, labels = list()) {
    d <- .fec_datos()
    validacion_enunciado_hallazgo("valor_invalido", list(target = regla$variables[[1]], labels = labels), id,
                                  valores = as.list(d[d$respondent_id == id, ]),
                                  regla = list(fechas = .regla_fechas_contexto(regla)))
  }
  r <- .fec_rango()
  e <- en(r, "c12", list(fecha = "Fecha"))
  expect_identical(e$subtipo, "fechas")
  expect_identical(e$texto, paste("c12: registró \"15.10.28\" (15/10/2028) en Fecha, posterior al cierre del",
                                  "operativo (31/10/2026). Revisar y corregir en Limpieza."))
  expect_identical(en(r, "c03")$hecho, "registró \"07.10.2026\" (07/10/2026) en fecha")
  expect_identical(en(r, "c01")$texto,
                   "c01: registró \"16.10.2\" en fecha, que no se puede leer como fecha. Revisar y corregir en Limpieza.")
  expect_identical(en(.fec_rango(formato = "dd.mm.aaaa"), "c02")$choque, "que no se puede leer como dd.mm.aaaa")
  h <- .fec_horas("orden")
  expect_identical(en(h, "c12", list(h_ini = "Hora de inicio", h = "Hora", mi = "Minutos", ampm = "AM/PM"))$texto,
                   paste("c12: registró 10:15 en la hora armada con Hora, Minutos y AM/PM, anterior a \"10.3\" (10:30)",
                         "en Hora de inicio. Revisar y corregir en Limpieza."))
  expect_identical(en(h, "c11")$hecho, "dejó incompleta la hora armada con h, mi y ampm")
  dur <- .fec_horas("duracion", minimo = 11, maximo = 90)
  e <- en(dur, "c09")
  expect_identical(e$hecho, "pasaron 10 minutos entre h_ini (\"14.00\" (14:00)) y la hora armada con h, mi y ampm (14:10)")
  expect_identical(e$choque, "menos que el mínimo de 11 minutos")
  expect_identical(en(dur, "c07")$choque, "más que el máximo de 90 minutos")
  # Una "Fecha fuera del operativo" sembrada como periodo de campo conserva su enunciado.
  expect_null(.regla_fechas_contexto(c(r, list(semilla = list(origen = "periodo")))))
})

test_that("la ficha recibe los límites de la regla aunque no haya árbol de rango", {
  lim <- .regla_fechas_limites(.fec_rango())
  expect_identical(lim$tipo, "fecha")
  expect_identical(c(lim$min, lim$max), c("2026-10-08", "2026-10-31"))
  expect_identical(validacion_anomalia_tipo("comparar_fechas"), "contradiccion")
})

# --- Conteo previo por HTTP, con ids del motor -------------------------------

.fec_sesion <- function(dir, datos = .fec_datos()) {
  survey <- data.frame(
    type = c("text", "text", "text", "text", "text", "integer", "integer", "select_one ampm"),
    name = c("caso", "fecha", "f_entrev", "superv", "h_ini", "h", "mi", "ampm"),
    label = c("Código del caso", "Fecha", "Fecha de entrevista", "Fecha de supervisión", "Hora de inicio",
              "Hora", "Minutos", "AM/PM"),
    required = "", relevant = "", constraint = "",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = "ampm", name = c("1", "2"), label = c("AM", "PM"), stringsAsFactors = FALSE)
  datos$caso <- sprintf("C-%s", datos$respondent_id)
  xls <- file.path(dir, "formulario.xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), xls)
  csv <- file.path(dir, "base.csv")
  utils::write.csv(datos, csv, row.names = FALSE)
  sid <- session_create()
  xm <- save_upload(sid, "xlsform", basename(xls), readBin(xls, "raw", n = file.info(xls)$size))
  dm <- save_upload(sid, "data", basename(csv), readBin(csv, "raw", n = file.info(csv)$size))
  inst <- reporte_instrumento(path = xm$path)
  for (nombre in c("Otra", "Fechas")) {
    estudio_add_base(
      sid = sid, nombre = nombre, xlsform_file_id = xm$file_id,
      data_file_id = dm$file_id, data_ext = "csv",
      rp_data = reporte_data(datos, instrumento = inst), rp_inst = inst,
      n_filas = nrow(datos), n_columnas = ncol(datos)
    )
  }
  s <- session_get(sid)
  s$estudio$active_base <- "Otra"
  .session_env[[sid]] <- s
  sid
}

.fec_probar <- function(sid, regla, query = "base_nombre=Fechas") {
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/reglas_custom/probar",
           body = as.character(jsonlite::toJSON(regla, auto_unbox = TRUE, null = "null")),
           query = query)
}

test_that("el conteo previo cuenta sobre la base pedida, dice la lectura y devuelve los casos por su id", {
  dir <- withr::local_tempdir()
  sid <- .fec_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .fec_probar(sid, .fec_rango(formato = "dd.mm.aaaa"))
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Fechas")
  expect_identical(b$n_base, 8L)
  # c03 antes; c12, c01, c05, c02 y c11 ilegibles con dd.mm.aaaa.
  expect_identical(b$n_casos, 6L)
  ids <- vapply(b$ejemplos, function(e) e$id_caso, character(1))
  expect_setequal(ids, c("c03", "c12", "c01", "c05", "c02", "c11"))
  c03 <- b$ejemplos[[match("c03", ids)]]
  expect_identical(c03$fechas$motivo, "antes")
  expect_identical(c03$fechas$inicio$texto, "2026-10-07")
  expect_identical(c03$fechas$inicio$original, "07.10.2026")
  c12 <- b$ejemplos[[match("c12", ids)]]
  expect_identical(c12$fechas$inicio$estado, "ilegible")
  expect_identical(c12$fechas$inicio$original, "15.10.28")
  expect_true(isTRUE(c12$valores[[1]]$falla))
  lec <- b$lectura[[1]]
  expect_identical(lec$formato, "dd.mm.aaaa")
  expect_identical(lec$n_leidas, 2L)
  expect_identical(lec$n_ilegibles, 5L)
  expect_identical(lec$n_filas, 8L)
})

test_that("el conteo previo de horas arma la hora de fin con los códigos de a.m. y p.m.", {
  dir <- withr::local_tempdir()
  sid <- .fec_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .fec_probar(sid, .fec_horas("duracion", minimo = 11, maximo = 90, marcar_ilegibles = FALSE))
  expect_identical(r$status, 200L)
  ids <- vapply(r$body$ejemplos, function(e) e$id_caso, character(1))
  expect_setequal(ids, c("c07", "c09", "c12"))
  c07 <- r$body$ejemplos[[match("c07", ids)]]
  expect_identical(c07$fechas$fin$texto, "16:30")
  expect_equal(c07$fechas$diferencia, 165)
  expect_length(r$body$lectura, 2L)
})

test_that("el conteo previo rechaza una regla de fechas mal formada con su código", {
  dir <- withr::local_tempdir()
  sid <- .fec_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .fec_probar(sid, .fec_horas("duracion"))
  expect_identical(r$status, 400L)
  expect_identical(r$body$error$code, "E_REGLA_FECHAS_DURACION")
})
