# ADR 0133, fase 5 — los llamadores que armaban su propio nombre pasan por el §3.
#
# `<Estudio>_<Entregable>[_<Base>][_<Detalle>]_<dd_mm_yy>.<ext>`: el rótulo sale del catálogo y la
# unidad (manzana, jornada, envío, lote, lámina) va de detalle. Antes de esta fase convivían
# `HojaRuta_Prueba_Bre_a_…`, `FichaUMP_…`, `HojaDia_…`, `invitacion-docentes_invitacion_mailchimp_<stamp>.zip`,
# `hsvg2026-procesable-processing-handoff-<corte>.zip`, `base_limpia_<base>.xlsx`, `reporte_calc_muestra.html`…
#
# El reloj es real (`.export_filename()` no recibe fecha): la fecha se compara con un patrón.

.f5_fecha <- "[0-9]{2}_[0-9]{2}_[0-9]{2}"

.f5_sesion <- function(codigo = "HSVG2026", bases = character(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba", codigo = codigo), 0L)
  for (b in bases) {
    estudio_add_base(sid, b, xlsform_file_id = paste0("x-", b), data_file_id = paste0("d-", b),
                     data_ext = "xlsx", rp_data = data.frame(a = 1), rp_inst = NULL)
  }
  sid
}

.f5_archivo <- function(ext = "pdf") {
  f <- tempfile(fileext = paste0(".", ext))
  writeLines("x", f)
  f
}

.f5_patron <- function(cuerpo, ext) paste0("^", cuerpo, "_", .f5_fecha, "\\.", ext, "$")

# Nada de UUID ni de las palabras inglesas que traían los nombres viejos.
.f5_sin_rastros <- function(nombre) {
  expect_false(grepl("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-", nombre), info = nombre)
  expect_false(grepl("handoff|processing|evidence|package|publication|review|template|decision_maker|audit",
                     nombre, ignore.case = TRUE), info = nombre)
}

test_that("Hojas de ruta: ficha titular y de reemplazo son dos entregables con la manzana de detalle", {
  sid <- .f5_sesion()
  detalle <- .hojas_ruta_vp_detalle_ficha(list(distrito = "Breña", zona = "003", manzana = "045A"))
  expect_identical(detalle, "Breña Z003 Mz045A")

  titular <- .hojas_ruta_vp_registrar(sid, .hojas_ruta_vp_kind_ficha("titular"), .f5_archivo("png"), detalle = detalle)
  reemplazo <- .hojas_ruta_vp_registrar(sid, .hojas_ruta_vp_kind_ficha("reemplazo"), .f5_archivo("pdf"), detalle = detalle)
  expect_match(titular$original_name, .f5_patron("HSVG2026_Ficha_de_UMP_Brena_Z003_Mz045A", "png"))
  expect_match(reemplazo$original_name, .f5_patron("HSVG2026_Ficha_de_reemplazo_UMP_Brena_Z003_Mz045A", "pdf"))
  expect_identical(reemplazo$rotulo, "Ficha de reemplazo UMP")
  expect_identical(reemplazo$modulo, "Hojas de ruta")

  # Un detalle sin zona no deja «Z» suelta.
  expect_identical(.hojas_ruta_vp_detalle_manzana("Breña", "", "045A"), "Breña Mz045A")
})

test_that("Hoja del día: la jornada y el distrito de detalle", {
  sid <- .f5_sesion()
  d <- .hojas_ruta_hd_detalle(list(jornada = "J03", distrito = "Breña"))
  expect_identical(d, "J03 Breña")
  meta <- .hojas_ruta_vp_registrar(sid, "hojas_ruta_hoja_dia", .f5_archivo(), detalle = d)
  expect_match(meta$original_name, .f5_patron("HSVG2026_Hoja_del_dia_J03_Brena", "pdf"))
})

test_that("Material de campo: asignación por UMP y por cuotas tienen rótulos distintos", {
  sid <- .f5_sesion()
  ump <- .register_output_file(sid, "asignacion_encuestadores_ump", .f5_archivo("xlsx"))
  cuotas <- .register_output_file(sid, "asignacion_encuestadores_cuotas", .f5_archivo("xlsx"))
  expect_match(ump$original_name, .f5_patron("HSVG2026_Asignacion_de_encuestadores_por_UMP", "xlsx"))
  expect_match(cuotas$original_name, .f5_patron("HSVG2026_Asignacion_de_encuestadores_por_cuotas", "xlsx"))
  expect_false("asignacion_encuestadores" %in% entregables_catalogo()$kind)
})

test_that("Material de campo: hojas de papel y base de supervisión llevan la unidad o el lote de detalle", {
  sid <- .f5_sesion()
  ruteo <- .register_output_file(sid, "material_ruteo", .f5_archivo(), detalle = "Breña Z003")
  conteo <- .register_output_file(sid, "material_conteo", .f5_archivo(), detalle = "24 zonas")
  sup <- .register_output_file(sid, "supervision_base", .f5_archivo("xlsx"), detalle = "Ronda 2")
  expect_match(ruteo$original_name, .f5_patron("HSVG2026_Hoja_de_ruteo_Brena_Z003", "pdf"))
  expect_match(conteo$original_name, .f5_patron("HSVG2026_Hoja_de_conteo_24_zonas", "pdf"))
  expect_match(sup$original_name, .f5_patron("HSVG2026_Base_de_supervision_Ronda_2", "xlsx"))
})

test_that("Correos: envío y campaña de detalle, sin marca de hora; el manifiesto de SurveyMonkey es suyo", {
  sid <- .f5_sesion()
  campana <- list(campaign_id = "invitacion-docentes", name = "Docentes", sends = list())
  invitacion <- list(send_id = "s1", kind = "invitacion")
  expect_identical(.cmail_export_detalle(campana, invitacion), "Invitación Docentes")

  zip <- .cmail_export_name(sid, campana, invitacion, "collection_mail_zip")
  plantilla <- .cmail_export_name(sid, campana, invitacion, "collection_mail_template_zip")
  sm <- .cmail_export_name(sid, campana, invitacion, "collection_mail_sm_zip")
  man_mc <- .cmail_export_name(sid, campana, invitacion, "collection_mail_manifest", ext = "json")
  man_sm <- .cmail_export_name(sid, campana, invitacion, "collection_mail_sm_manifest", ext = "json")
  expect_match(zip, .f5_patron("HSVG2026_Correo_para_Mailchimp_Invitacion_Docentes", "zip"))
  expect_match(plantilla, .f5_patron("HSVG2026_Plantilla_de_correo_para_Mailchimp_Invitacion_Docentes", "zip"))
  expect_match(sm, .f5_patron("HSVG2026_Correo_para_SurveyMonkey_Invitacion_Docentes", "zip"))
  expect_match(man_mc, .f5_patron("HSVG2026_Correo_para_Mailchimp_manifiesto_Invitacion_Docentes", "json"))
  expect_match(man_sm, .f5_patron("HSVG2026_Correo_para_SurveyMonkey_manifiesto_Invitacion_Docentes", "json"))
  for (n in c(zip, plantilla, sm, man_mc, man_sm)) expect_lte(nchar(tools::file_path_sans_ext(n)), 80L)

  # Revisión y textos: el título sólo entra si el usuario lo cambió; con una campaña, la campaña.
  expect_null(.cmail_detalle_documento("Correos para revisar", "Correos para revisar", list(campana, campana)))
  expect_identical(.cmail_detalle_documento("Correos para revisar", "Correos para revisar", list(campana)), "Docentes")
  expect_identical(.cmail_detalle_documento("Ronda final", "Correos para revisar", list(campana)), "Ronda final")
})

test_that("Monitoreo: UMP, entrega a procesamiento, evidencia y paquete operativo salen del catálogo", {
  sid <- .f5_sesion()
  expect_match(.export_filename(sid, "monitoreo_ump_export", "xlsx", detalle = "faltantes"),
               .f5_patron("HSVG2026_UMP_faltantes", "xlsx"))
  expect_match(.export_filename(sid, "monitoreo_processing_handoff_zip", "zip"),
               .f5_patron("HSVG2026_Entrega_a_procesamiento", "zip"))
  expect_match(.export_filename(sid, "monitoreo_processing_handoff_data", "xlsx", detalle = "solo validadas"),
               .f5_patron("HSVG2026_Data_procesable_solo_validadas", "xlsx"))
  expect_match(.export_filename(sid, "monitoreo_processing_handoff_xlsform", "xlsx"),
               .f5_patron("HSVG2026_XLSForm_procesable", "xlsx"))
  expect_match(.export_filename(sid, "monitoreo_publication_evidence_pack", "zip", detalle = "para el cliente"),
               .f5_patron("HSVG2026_Evidencia_de_publicacion_para_el_cliente", "zip"))
  plantilla <- .register_output_file(sid, "monitoreo_territorial_operational_package_template", .f5_archivo("csv"))
  expect_match(plantilla$original_name, .f5_patron("HSVG2026_Paquete_operativo_plantilla", "csv"))
  encuestadores <- .register_output_file(sid, "monitoreo_plantilla_encuestadores", .f5_archivo("xlsx"))
  codigos <- .register_output_file(sid, "monitoreo_codigos_encuestadores", .f5_archivo("xlsx"))
  expect_match(encuestadores$original_name, .f5_patron("HSVG2026_Plantilla_de_encuestadores", "xlsx"))
  expect_match(codigos$original_name, .f5_patron("HSVG2026_Codigos_de_encuestadores", "xlsx"))
  expect_identical(codigos$modulo, "Monitoreo")
  for (n in c(plantilla$original_name, encuestadores$original_name)) .f5_sin_rastros(n)
})

test_that("Resultados de job y descargas directas: reportes, diferencias, relación, configuración, gráficos", {
  sid <- .f5_sesion()
  casos <- list(
    list(.export_filename(sid, "reporte_calc_muestra", "html"), "HSVG2026_Reporte_de_muestra", "html"),
    list(.export_filename(sid, "reporte_calc_muestra", "pdf"), "HSVG2026_Reporte_de_muestra", "pdf"),
    list(.export_filename(sid, "reporte_muestra_territorial", "pdf"), "HSVG2026_Reporte_de_muestra_territorial", "pdf"),
    list(.export_filename(sid, "diferencias_integracion", "docx"), "HSVG2026_Diferencias_de_integracion", "docx"),
    list(.export_filename(sid, "relacion", "xlsx", detalle = "P12 por sexo"), "HSVG2026_Relacion_P12_por_sexo", "xlsx"),
    list(.export_filename(sid, "codificacion_config", "json"), "HSVG2026_Configuracion_de_codificacion", "json"),
    list(.export_filename(sid, "lamina", "png", detalle = "S12"), "HSVG2026_Lamina_S12", "png"),
    list(.export_filename(sid, "graficos_miniatura", "png", detalle = "S12"), "HSVG2026_Miniatura_de_lamina_S12", "png"),
    list(.export_filename(sid, "formulario_pdf", "pdf", detalle = "Docentes v3"), "HSVG2026_Cuestionario_Docentes_v3", "pdf")
  )
  for (c in casos) expect_match(c[[1]], .f5_patron(c[[2]], c[[3]]))
  expect_match(.export_filename(sid, "graficos_share", "pulso-graficos.zip"),
               paste0("^HSVG2026_Plan_de_graficos_", .f5_fecha, "\\.pulso-graficos\\.zip$"))
  expect_match(.codif_config_filename(sid), .f5_patron("HSVG2026_Configuracion_de_codificacion", "json"))
})

test_that("Un resultado de job servido por su path no deja ver el prefijo del job", {
  sid <- .f5_sesion()
  nombre <- .export_filename(sid, "reporte_calc_muestra", "pdf")
  path <- file.path(tempdir(), paste0(uuid::UUIDgenerate(), "__", nombre))
  cd <- .content_disposition("attachment", basename(path))
  expect_match(cd, paste0("filename=\"", nombre, "\""), fixed = TRUE)
  .f5_sin_rastros(cd)
})

# ---- «Cerrar y generar base» (ADR 0133, fase 5, ítem 3) --------------------------------------
# El router (`router_validacion.R`) devuelve tal cual lo que arma `limpieza_finalize()`, así que
# la respuesta se fija en el motor. Se aíslan sus colaboradores pesados (simulación, escritura,
# promoción, HTML) y se deja real el registro de entregables.

.f5_finalize <- function(sid, base) {
  escribir <- function(path, ...) { writeLines("x", path); invisible(path) }
  testthat::local_mocked_bindings(
    .limpieza_build_decision_queue = function(...) list(),
    .limpieza_simulate = function(...) list(
      data_final = data.frame(a = 1:2), impact = list(cases_excluded = 0L, cells_changed = 0L), logs = list()
    ),
    .limpieza_build_summary = function(...) list(ok = TRUE),
    .resolve_base_files = function(...) stop("sin origen"),
    .bases_write_xlsx = function(data, data2, path, ...) escribir(path),
    .limpieza_promocion_bloqueada_por_repeats = function(...) FALSE,
    .limpieza_promover_base = function(...) list(enabled = TRUE),
    build_limpieza = function(...) list(),
    build_report_html = function(...) "<html></html>",
    .limpieza_export_excel = function(path, ...) escribir(path),
    validacion_scope_set = function(...) invisible(NULL)
  )
  limpieza_finalize(sid, base, scope = list(evaluacion = list(ok = TRUE), limpieza_draft = list()))
}

test_that("finalize ofrece base limpia, revisión y decisiones con nombre y los campos del registro", {
  sid <- .f5_sesion()
  out <- .f5_finalize(sid, "docentes")
  files <- out$artifacts$files
  expect_length(files, 3L)
  expect_identical(vapply(files, `[[`, "", "kind"), c("base_limpia", "reporte_html", "excel_detalle"))
  esperados <- c("HSVG2026_Base_limpia", "HSVG2026_Revision_de_limpieza", "HSVG2026_Decisiones_de_limpieza")
  exts <- c("xlsx", "html", "xlsx")
  for (i in seq_along(files)) {
    f <- files[[i]]
    expect_true(all(c("file_id", "filename", "original_name", "size", "ext", "modulo", "rotulo",
                      "guardado_en", "aviso_guardado") %in% names(f)), info = f$kind)
    expect_match(f$filename, .f5_patron(esperados[[i]], exts[[i]]))
    expect_identical(f$filename, f$original_name)
    expect_identical(f$modulo, "Procesamiento")
    expect_false(is.null(get_file(sid, f$file_id)))
    # Guardar = FALSE sigue en el catálogo en esta oleada: sin copia, `null` en la respuesta.
    expect_true(is.na(f$guardado_en))
    .f5_sin_rastros(f$filename)
  }
  expect_identical(vapply(files, `[[`, "", "rotulo"), c("Base limpia", "Revisión de limpieza", "Decisiones de limpieza"))
})

test_that("finalize en multibase lleva la base en el nombre", {
  sid <- .f5_sesion(bases = c("docentes", "alumnos"))
  out <- .f5_finalize(sid, "alumnos")
  nombres <- vapply(out$artifacts$files, `[[`, "", "filename")
  expect_match(nombres[[1]], .f5_patron("HSVG2026_Base_limpia_alumnos", "xlsx"))
  expect_match(nombres[[2]], .f5_patron("HSVG2026_Revision_de_limpieza_alumnos", "html"))
  expect_false(any(grepl("docentes", nombres)))
})

test_that("los ZIP de Correos se copian junto al proyecto; su manifiesto no", {
  # El front retiró su «Junto al proyecto» manual (fase 5): el ZIP ya no se duplica.
  cat <- entregables_catalogo()
  for (k in c("collection_mail_zip", "collection_mail_template_zip", "collection_mail_sm_zip")) {
    expect_true(cat$guardar[cat$kind == k], info = k)
  }
  for (k in c("collection_mail_manifest", "collection_mail_sm_manifest")) {
    expect_false(cat$guardar[cat$kind == k], info = k)
  }
  sid <- .f5_sesion()
  carpeta <- withr::local_tempdir()
  s <- session_get(sid); s$project_path <- file.path(carpeta, "HSVG2026.pulso"); .session_env[[sid]] <- s
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  zip <- .register_output_file(sid, "collection_mail_zip", .f5_archivo("zip"), detalle = "Invitación Docentes")
  man <- .register_output_file(sid, "collection_mail_manifest", .f5_archivo("json"), detalle = "Invitación Docentes")
  expect_true(file.exists(zip$guardado_en))
  expect_identical(basename(dirname(zip$guardado_en)), "Material de campo")
  expect_null(man$guardado_en)
})

test_that("Paquetes territoriales: las tres entregas que se copian devuelven guardado_en (sin copia + descarga)", {
  src <- readLines(test_path("..", "..", "R", "router_hojas_ruta.R"), warn = FALSE)
  for (kind in c("hojas_ruta_reemplazos_puntuales", "hojas_ruta_operativo", "hojas_ruta_zip")) {
    i <- grep(sprintf('\\.register_output_file\\([^)]*"%s"', kind), src)
    expect_length(i, 1L)
    siguiente <- src[i + 1L]
    expect_match(siguiente, "entregable_respuesta\\(list\\(", info = kind)
  }
  fila <- function(k) entregables_catalogo()[entregables_catalogo()$kind == k, ]
  for (kind in c("hojas_ruta_reemplazos_puntuales", "hojas_ruta_operativo", "hojas_ruta_zip")) {
    expect_true(isTRUE(as.logical(fila(kind)$guardar)), info = kind)
  }
})
