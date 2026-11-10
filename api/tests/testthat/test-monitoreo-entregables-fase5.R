# ADR 0133, fase 5 (oleada 2) — Monitoreo entrega por el registro único.
#
# Cada salida responde file_id, filename, size y los cuatro campos del registro (modulo, rotulo,
# guardado_en, aviso_guardado); con un .pulso guardado, la copia queda UNA vez en
# `Entregables/Monitoreo`. Los PDF de avance y de producción, que antes devolvían {ok, size, filename}
# sin archivo, se registran en su on_complete. La carga de campo sale como .xlsx real desde el motor.
# Los motores pesados se simulan; el registro y el handler son los reales (`.bv_call`).

.mef_guardada <- function(envir = parent.frame()) {
  withr::local_envvar(PULSO_PUBLIC_MODE = "", .local_envir = envir)
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba", codigo = "HSVG2026"), 0L)
  carpeta <- withr::local_tempdir(.local_envir = envir)
  s <- session_get(sid); s$project_path <- file.path(carpeta, "HSVG2026.pulso"); .session_env[[sid]] <- s
  list(sid = sid, carpeta = carpeta)
}

.mef_escribir <- function(path, ...) { writeBin(charToRaw("contenido de prueba"), path); invisible(path) }
.mef_patron <- function(cuerpo, ext) paste0("^", cuerpo, "_[0-9]{2}_[0-9]{2}_[0-9]{2}\\.", ext, "$")

.mef_contrato <- function(resp, fx, rotulo, patron, modulo = "Monitoreo") {
  expect_true(all(c("file_id", "filename", "size", "modulo", "rotulo", "guardado_en", "aviso_guardado") %in% names(resp)),
              info = rotulo)
  expect_false(is.null(get_file(fx$sid, resp$file_id)))
  expect_gt(resp$size, 0)
  expect_identical(resp$modulo, modulo)
  expect_identical(resp$rotulo, rotulo)
  expect_match(resp$filename, patron)
  expect_true(is.character(resp$guardado_en) && !is.na(resp$guardado_en) && file.exists(resp$guardado_en), info = rotulo)
  expect_identical(list.files(file.path(fx$carpeta, "Entregables", modulo)), basename(resp$guardado_en))
  expect_false("path" %in% names(resp))
}

test_that("los PDF de avance y de producción se registran al terminar el job", {
  casos <- list(
    c("avance_territorial_monitoreo", "Avance territorial", "monitoreo_client_report_pdf"),
    c("avance_telefonico_monitoreo", "Avance telefónico", "monitoreo_client_report_pdf"),
    c("avance_aulas_monitoreo", "Avance de aulas", "monitoreo_client_report_pdf"),
    c("reporte_cliente_monitoreo", "Reporte de avance para el cliente", "monitoreo_client_report_pdf"),
    c("produccion_responsable_monitoreo", "Producción por responsable", "monitoreo_production_report_pdf")
  )
  for (caso in casos) {
    fx <- .mef_guardada()
    nombre <- .export_filename(fx$sid, caso[[1]], "pdf")
    path <- file.path(withr::local_tempdir(), paste0(uuid::UUIDgenerate(), "__", nombre))
    .mef_escribir(path)
    j <- list(sid = fx$sid, status = "done", result_path = path, finished_at = Sys.time(),
              result_data = list(ok = TRUE, size = 19L, filename = nombre))
    resp <- .monitoreo_reporte_pdf_on_complete(j, caso[[1]], caso[[3]], list(include_targets = FALSE, report_kind = "x"))
    .mef_contrato(resp, fx, caso[[2]], paste0("^HSVG2026_", gsub(" ", "_", .entregable_slug(caso[[2]])), "_"))
    meta <- session_get(fx$sid)[[caso[[3]]]]
    expect_true(isTRUE(meta$disponible))
    expect_identical(meta$file_id, resp$file_id)
    expect_identical(meta$report_kind, "x")   # lo que la ruta heredada /download sigue leyendo
  }
  cat <- entregables_catalogo()
  expect_true(all(cat$guardar[cat$kind %in% vapply(casos, `[[`, "", 1)]))
  fuente <- paste(deparse(body(mount_monitoreo)), collapse = "\n")
  expect_identical(lengths(regmatches(fuente, gregexpr(".monitoreo_reporte_pdf_on_complete", fuente, fixed = TRUE))), 2L)
})

test_that("plantilla y códigos de encuestadores se copian y traen el registro", {
  fx <- .mef_guardada()
  resp <- .bv_call(mount_monitoreo, "POST", "/api/monitoreo/territorial/enumerators/template", fx$sid, list())
  .mef_contrato(resp, fx, "Plantilla de encuestadores", .mef_patron("HSVG2026_Plantilla_de_encuestadores", "xlsx"))
})

test_that("la plantilla de disponibilidad pedida desde Monitoreo se guarda en Monitoreo", {
  fx <- .mef_guardada()
  resp <- .bv_call(mount_monitoreo_aulas_plantilla, "POST", "/api/monitoreo/aulas/disponibilidad/plantilla", fx$sid, list())
  .mef_contrato(resp, fx, "Plantilla de disponibilidad de aplicadores",
                .mef_patron("HSVG2026_Plantilla_de_disponibilidad_de_aplicadores", "xlsx"))
  expect_identical(get_file(fx$sid, resp$file_id)$kind, "monitoreo_aulas_disponibilidad_plantilla")
  cat <- entregables_catalogo()
  expect_identical(cat$modulo[cat$kind == "aulas_disponibilidad_plantilla"], "Material de campo")
})

test_that("generar el libro de aulas trae size y el registro", {
  fx <- .mef_guardada()
  session_set(fx$sid, "monitoreo_aulas_plan", list(list(classroom_id = "a1")))
  local_mocked_bindings(aulas_libro_generar = function(unidades, destino, ...) {
    .mef_escribir(destino); structure(destino, unidades = 1L, titulares = 1L, reservas = 0L)
  })
  resp <- .bv_call(mount_monitoreo, "POST", "/api/monitoreo/aulas/generar-libro", fx$sid, list())
  .mef_contrato(resp, fx, "Libro de aulas", .mef_patron("HSVG2026_Libro_de_aulas", "xlsx"))
  expect_identical(resp$unidades, 1L)
})

test_that("el libro de UMP trae el registro", {
  fx <- .mef_guardada()
  local_mocked_bindings(
    monitoreo_normalize_config = function(...) list(monitoreo_profile = list(family = "territorial")),
    .monitoreo_territorial_occurrences_dashboard = function(...) list(by_ump = list(list(ump = "U1")), snapshot = list()),
    .monitoreo_ump_avance_responsable_map = function(...) list(),
    .monitoreo_ump_export_rows = function(...) data.frame("¿Tiene ocurrencias?" = "No", check.names = FALSE),
    .monitoreo_ump_export_write_workbook = function(df, path, meta = list()) .mef_escribir(path)
  )
  resp <- .monitoreo_ump_export(fx$sid, list(only_missing = TRUE))
  .mef_contrato(resp, fx, "UMP", .mef_patron("HSVG2026_UMP_faltantes", "xlsx"))
})

test_that("un archivo de Monitoreo se publica sin la ruta del servidor y con el registro", {
  fx <- .mef_guardada()
  f <- tempfile(fileext = ".xlsx"); .mef_escribir(f)
  meta <- .register_output_file(fx$sid, "monitoreo_ocurrencias_xlsform_descarga", f)
  pub <- .monitoreo_archivo_publico(meta)
  expect_false("path" %in% names(pub))
  expect_identical(pub$filename, meta$original_name)
  expect_true(all(c("modulo", "rotulo", "guardado_en", "aviso_guardado") %in% names(pub)))
  expect_true(file.exists(pub$guardado_en))
  # La descarga se copia; lo que registra «Subir Kobo» no.
  cat <- entregables_catalogo()
  expect_true(cat$guardar[cat$kind == "monitoreo_ocurrencias_xlsform_descarga"])
  expect_false(cat$guardar[cat$kind == "monitoreo_ocurrencias_xlsform"])
})

# ---- Carga de campo -------------------------------------------------------------------------

.mef_plan <- function() list(
  # Agendada el lunes 09/11 a las 08:30: firme, ocupa [08:00, 09:00) con 30 de preparación.
  list(classroom_id = "a", operational_code = "CH 1", sample_role = "titular", course_name = "Curso A",
       faculty = "Letras", venue = "A101", eligible_n = 30, sesiones_dia_hora = "LUN 08:00-10:00 · MIE 08:00-10:00",
       scheduled_time = "08:30", scheduled_date = "2026-11-09"),
  # Sin agendar: banda plausible de la clase entera.
  list(classroom_id = "b", operational_code = "CH 2", sample_role = "titular", course_name = "Curso B",
       faculty = "Ciencias", venue = "B202", eligible_n = 25, sesiones_dia_hora = "LUN 09:00-11:00"),
  # Con hora y sin fecha: no cabe en el calendario.
  list(classroom_id = "c", operational_code = "CH 3", sample_role = "titular", course_name = "Curso C",
       faculty = "Letras", venue = "A102", eligible_n = 20, sesiones_dia_hora = "MAR 14:00-16:00",
       scheduled_time = "14:00"),
  # Reemplazo: no se agenda, no cuenta.
  list(classroom_id = "d", operational_code = "CH 4", sample_role = "reemplazo", course_name = "Curso D",
       faculty = "Letras", venue = "A103", eligible_n = 10, sesiones_dia_hora = "LUN 08:00-09:00")
)

test_that("la malla semanal separa lo firme de lo plausible como la vista", {
  m <- monitoreo_aulas_carga_de_campo_malla(.mef_plan(), duracion_min = 30L, eje = "semana")
  col <- function(hhmm) match(as.integer(substr(hhmm, 1, 2)) * 60L + as.integer(substr(hhmm, 4, 5)), m$franjas)
  expect_identical(m$filas$etiqueta, c("lunes", "martes", "miércoles", "jueves", "viernes", "sábado"))
  expect_identical(m$firmes[1, col("08:00")], 1L)    # preparación
  expect_identical(m$firmes[1, col("08:30")], 1L)
  expect_identical(m$firmes[1, col("09:00")], 0L)
  expect_identical(m$plausibles[1, col("09:00")], 1L)
  expect_identical(m$plausibles[1, col("10:30")], 1L)
  expect_identical(m$aulas[1, col("09:30")], 2L)     # las dos clases en curso
  expect_identical(m$firmes[2, col("13:30")], 1L)    # la de martes, con hora y sin fecha
  expect_identical(sum(m$aulas[3, ]), 0L)            # la sesión del miércoles de «a» no cuenta: va la primera
  expect_identical(m$agendadas, 2L)
  expect_identical(m$por_agendar, 1L)
  expect_identical(m$agendadas_sin_fecha, 1L)
  expect_identical(m$pico$fila, "lunes")
  expect_identical(m$pico$franja, 480L)
})

test_that("el calendario pone una fila por fecha, un carril por agendar y mide el pico sólo en fechas", {
  m <- monitoreo_aulas_carga_de_campo_malla(.mef_plan(), eje = "calendario")
  expect_identical(m$filas$clave, c("2026-11-09", "por-agendar:0"))
  expect_identical(m$filas$etiqueta, c("Lunes 09/11", "lunes"))
  expect_identical(m$agendadas_sin_fecha, 1L)
  expect_identical(m$fechas, 1L)
  expect_identical(m$pico$fila, "Lunes 09/11")
  # La ventana del motor manda sobre el texto del libro.
  v <- monitoreo_aulas_carga_de_campo_malla(.mef_plan(), eje = "calendario",
                                            ventanas = list(list(codigo = "CH 2", fecha = "2026-11-10", inicio = "09:30")))
  expect_identical(v$filas$clave, c("2026-11-09", "2026-11-10"))
  expect_identical(v$firmes[2, match(9L * 60L, v$franjas)], 1L)
})

test_that("el libro de carga de campo es un .xlsx de dos hojas con la malla y el detalle", {
  path <- tempfile(fileext = ".xlsx")
  monitoreo_aulas_carga_de_campo_xlsx(.mef_plan(), path, eje = "semana")
  expect_identical(openxlsx::getSheetNames(path), c("Carga de campo", "Detalle por sesión"))
  detalle <- openxlsx::read.xlsx(path, sheet = 2, check.names = FALSE, sep.names = " ")
  expect_identical(names(detalle), c("Día", "Inicio", "Fin", "Salón", "Curso-horario", "Curso", "Facultad", "Elegibles"))
  expect_identical(nrow(detalle), 4L)                # a (2 sesiones), b y c; el reemplazo no
  expect_identical(detalle$Inicio[[1]], "08:00")
  malla <- openxlsx::read.xlsx(path, sheet = 1, startRow = 6, colNames = FALSE)
  expect_identical(malla[1, 1], "Día")
  expect_identical(malla[2, 1], "lunes")
  expect_true("08:00" %in% unlist(malla[1, ]))
  # La celda firme lleva color de fondo: el estilo se escribe en la hoja.
  wb <- openxlsx::loadWorkbook(path)
  rellenos <- unlist(lapply(wb$styleObjects, function(o) if (o$sheet == "Carga de campo") o$style$fill$fillFg))
  expect_true(any(grepl("1F3864", rellenos)))
})

test_that("POST carga-de-campo/excel devuelve el registro y valida sus parámetros", {
  fx <- .mef_guardada()
  session_set(fx$sid, "monitoreo_aulas_plan", .mef_plan())
  ruta <- "/api/monitoreo/aulas/carga-de-campo/excel"
  resp <- .bv_call(mount_monitoreo_aulas_plantilla, "POST", ruta, fx$sid,
                   list(duracion_min = 30, eje = "semana", preparacion_min = 30, salida_min = 15))
  .mef_contrato(resp, fx, "Carga de campo", .mef_patron("HSVG2026_Carga_de_campo", "xlsx"))
  expect_identical(resp$eje, "semana")
  expect_identical(resp$pico$franja, "08:00")
  expect_identical(openxlsx::getSheetNames(get_file(fx$sid, resp$file_id)$path), c("Carga de campo", "Detalle por sesión"))

  llamar <- function(sid, body) {
    res <- plumber:::PlumberResponse$new()
    out <- .bv_endpoint(mount_monitoreo_aulas_plantilla, "POST", ruta)$getFunc()(req = .bv_req(sid, body), res = res)
    list(status = res$status, code = out$error$code)
  }
  expect_identical(llamar(fx$sid, list(eje = "mensual"))$code, "E_MONITOREO_CARGA_CAMPO_PARAMETROS")
  expect_equal(llamar(fx$sid, list(duracion_min = 0))$status, 422)
  fx2 <- .mef_guardada()
  sin_plan <- llamar(fx2$sid, list())
  expect_equal(sin_plan$status, 409)
  expect_identical(sin_plan$code, "E_MONITOREO_CARGA_CAMPO_SIN_PLAN")
  session_set(fx2$sid, "monitoreo_aulas_plan", list(list(classroom_id = "x", sesiones_dia_hora = "")))
  expect_identical(llamar(fx2$sid, list())$code, "E_MONITOREO_CARGA_CAMPO_SIN_HORARIO")
  expect_false("POST /api/monitoreo/aulas/carga-de-campo/excel" %in% PUBLIC_MODE_WHITELIST)
})
