# CCSS-TXT-24: renombrar un grupo DESPUÉS de adaptar dejaba el rótulo viejo en
# el instrumento adaptado (lo que leen Gráficos, Analítica y la descarga).
# Renombrar no cambia qué respuesta va a qué código: el rótulo nuevo llega a la
# base adaptada de ESA base, sin tocar data, conteos ni bases hermanas.

.rta_instrumento <- function(path, variable) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = "text", name = variable, label = "Comentario final", stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = character(), name = character(), label = character(), stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.rta_grupos <- function(data, variable, etiquetas = c("B · Como estudiante", "B · Tu comodidad")) {
  t <- as.character(data[[variable]])
  list(
    list(id = "mod_24", codigo = "24", etiqueta = etiquetas[1], origen = "nuevo",
         respuestas = list(t[1], t[2])),
    list(id = "mod_26", codigo = "26", etiqueta = etiquetas[2], origen = "nuevo",
         respuestas = list(t[2], t[3]))
  )
}

.rta_registrar_y_adaptar <- function(sid, nombre, data, variable) {
  sdir <- file.path(session_get(sid)$dir, "downloads")
  dir <- file.path(session_get(sid)$dir, paste0("qa-", nombre))
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  inst_path <- .rta_instrumento(file.path(sdir, paste0(nombre, "_inst.xlsx")), variable)
  data_path <- file.path(sdir, paste0(nombre, "_data.xlsx"))
  openxlsx::write.xlsx(data, data_path, overwrite = TRUE)
  inst_meta <- save_upload(sid, "xlsform", basename(inst_path),
                           readBin(inst_path, "raw", n = file.info(inst_path)$size))
  data_meta <- save_upload(sid, "data", basename(data_path),
                           readBin(data_path, "raw", n = file.info(data_path)$size))
  inst <- reporte_instrumento(path = inst_meta$path)
  estudio_add_base(
    sid = sid, nombre = nombre,
    xlsform_file_id = inst_meta$file_id, data_file_id = data_meta$file_id, data_ext = "xlsx",
    rp_data = reporte_data(data, instrumento = inst), rp_inst = inst,
    n_filas = nrow(data), n_columnas = ncol(data)
  )
  codif_set(sid, "data", data, source = nombre)
  codif_set(sid, "inst", leer_instrumento_xlsform(inst_meta$path), source = nombre)

  grupos <- .rta_grupos(data, variable)
  codif_set(sid, "grupos_recod", stats::setNames(list(grupos), variable), source = nombre)
  codif_set(sid, "familias_draft", list(rows = list(list(
    use = TRUE, tipo = "text", parent = variable, parent_col = variable, text_col = variable
  ))), source = nombre)

  rec <- paste0(variable, "_recod")
  rows <- rbind(
    c("_uuid", "_index", variable, rec, "Control", NA, "nuevo_codigo", "nueva_etiqueta"),
    c("UUID", "Índice", "Respuesta", "Código", "Control / notas", NA, "Nuevo código", "Nueva etiqueta"),
    cbind(as.character(data[["_uuid"]]), as.character(data[["_index"]]), as.character(data[[variable]]),
          NA_character_, NA_character_, NA_character_, NA_character_, NA_character_)
  )
  plantilla <- file.path(dir, "plantilla.xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, variable)
  openxlsx::writeData(wb, variable, rows, colNames = FALSE)
  expect_true(.patch_text_sheet(wb, variable, rec, variable, grupos, data))
  openxlsx::saveWorkbook(wb, plantilla, overwrite = TRUE)
  familias <- file.path(dir, "familias.xlsx")
  openxlsx::write.xlsx(data.frame(use = TRUE, tipo = "text", parent = variable,
                                  parent_col = variable, text_col = variable,
                                  stringsAsFactors = FALSE), familias, overwrite = TRUE)
  paths <- .codif_apply_job_runner(
    xls_path = inst_path, data_path = data_path, codes_path = plantilla, fam_path = familias,
    data_out = file.path(dir, "data_adaptada.xlsx"), inst_out = file.path(dir, "inst_adaptado.xlsx"),
    sm_vars = character(), so_parent_vars = character(), so_child_vars = character(),
    text_vars = variable, int_vars = character()
  )
  .codif_apply_complete(sid, nombre, paths)
  invisible(grupos)
}

.rta_rotulos_archivo <- function(sid, base, list_name) {
  s <- session_get(sid)
  path <- s$files[[s$estudio$bases[[base]]$xlsform_file_id]]$path
  ch <- readxl::read_excel(path, sheet = "choices")
  ch <- ch[ch$list_name == list_name, , drop = FALSE]
  stats::setNames(as.character(ch[[grep("^label", names(ch))[1]]]), as.character(ch$name))
}

.rta_valores <- function(df) {
  as.data.frame(lapply(df, function(x) { attributes(x) <- NULL; x }), check.names = FALSE)
}

.rta_sesion <- function() {
  sid <- session_create()
  datos <- data.frame(
    `_uuid` = c("u-1", "u-2", "u-3", "u-4"), `_index` = 1:4,
    coment = c("Más enchufes en la biblioteca", "Profesores poco accesibles y aulas frías",
               "Me da vergüenza preguntar", "Sin comentario"),
    check.names = FALSE
  )
  hermana <- data.frame(
    `_uuid` = c("h-1", "h-2", "h-3"), `_index` = 1:3,
    coment = c("Más enchufes en la biblioteca", "Profesores poco accesibles y aulas frías",
               "Me da vergüenza preguntar"),
    check.names = FALSE
  )
  .rta_registrar_y_adaptar(sid, "principal", datos, "coment")
  .rta_registrar_y_adaptar(sid, "hermana", hermana, "coment")
  estudio_active_base_set(sid, "principal")
  list(sid = sid, datos = datos)
}

test_that("renombrar un grupo tras adaptar lleva el rótulo a la base adaptada sin cambiar cifras", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .rta_sesion()
  sid <- fx$sid
  on.exit(session_delete(sid), add = TRUE)

  s0 <- session_get(sid)
  inst0 <- s0$rp_inst_sources$principal
  ln <- .codif_list_name_for_var(inst0, "coment_recod")
  expect_true(nzchar(ln))
  expect_equal(unname(.rta_rotulos_archivo(sid, "principal", ln)[c("24", "26")]),
               c("B · Como estudiante", "B · Tu comodidad"))
  xls_fid0 <- s0$estudio$bases$principal$xlsform_file_id
  data_fid0 <- s0$estudio$bases$principal$data_file_id
  valores0 <- .rta_valores(s0$rp_data_sources$principal)
  validacion0 <- s0$estudio$bases$principal$validacion
  # Proyecto abierto y recién guardado: el renombre debe marcarlo sucio.
  s_tmp <- session_get(sid); s_tmp$project_path <- tempfile(fileext = ".pulso"); s_tmp$project_dirty <- FALSE
  .session_env[[sid]] <- s_tmp

  renombrados <- .rta_grupos(fx$datos, "coment",
                             c("B · Hábitos de estudio y espacios", "B · Comodidad para preguntar"))
  r <- codificacion_grupos_guardar(sid, "coment", renombrados)

  expect_identical(r$rotulos_adaptados$estado, "propagado")
  expect_identical(r$rotulos_adaptados$base, "principal")
  expect_length(r$rotulos_adaptados$propagados, 2L)
  expect_false(isTRUE(r$rotulos_adaptados$requiere_readaptar))

  s1 <- session_get(sid)
  # El archivo (lo que persiste en el .pulso y se descarga) dice el rótulo nuevo.
  expect_equal(unname(.rta_rotulos_archivo(sid, "principal", ln)[c("24", "26")]),
               c("B · Hábitos de estudio y espacios", "B · Comodidad para preguntar"))
  # Lo que lee Gráficos (instrumento y data de la base), también.
  inst1 <- s1$rp_inst_sources$principal
  expect_equal(unname(inst1$dicc_code_to_label[[ln]][c("24", "26")]),
               c("B · Hábitos de estudio y espacios", "B · Comodidad para preguntar"))
  ol <- inst1$orders_list$coment_recod
  expect_equal(ol$labels[match(c("24", "26"), ol$names)],
               c("B · Hábitos de estudio y espacios", "B · Comodidad para preguntar"))
  d1 <- s1$rp_data_sources$principal
  dummies <- intersect(c("coment_recod.24", "coment_recod/24"), names(d1))
  for (col in dummies) expect_identical(attr(d1[[col]], "label"), "B · Hábitos de estudio y espacios")
  # Ni un número cambia: mismos valores, mismos archivos, misma validación.
  expect_identical(.rta_valores(d1), valores0)
  expect_identical(s1$estudio$bases$principal$xlsform_file_id, xls_fid0)
  expect_identical(s1$estudio$bases$principal$data_file_id, data_fid0)
  expect_identical(s1$estudio$bases$principal$validacion, validacion0)
  expect_true(isTRUE(s1$codif_por_base$principal$aplicado))
  expect_true(isTRUE(s1$project_dirty))
  # La hermana conserva sus rótulos.
  expect_equal(unname(.rta_rotulos_archivo(sid, "hermana", ln)[c("24", "26")]),
               c("B · Como estudiante", "B · Tu comodidad"))
  expect_equal(unname(s1$rp_inst_sources$hermana$dicc_code_to_label[[ln]][c("24", "26")]),
               c("B · Como estudiante", "B · Tu comodidad"))
  # Codificación relee el instrumento ya reescrito.
  ag <- codif_agrupacion_get(sid, "coment_recod", base = "principal")
  et <- stats::setNames(vapply(ag$codigos, `[[`, "", "etiqueta"), vapply(ag$codigos, `[[`, "", "codigo"))
  expect_identical(unname(et[["24"]]), "B · Hábitos de estudio y espacios")

  # Guardar otra vez lo mismo no reescribe nada.
  r2 <- codificacion_grupos_guardar(sid, "coment", renombrados)
  expect_identical(r2$rotulos_adaptados$estado, "al_dia")
})

test_that("un código que la base adaptada no tiene se avisa con su causa, no se descarta en silencio", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .rta_sesion()
  sid <- fx$sid
  on.exit(session_delete(sid), add = TRUE)

  grupos <- .rta_grupos(fx$datos, "coment", c("B · Hábitos de estudio y espacios", "B · Tu comodidad"))
  grupos[[3]] <- list(id = "mod_29", codigo = "29", etiqueta = "B · Laboral", origen = "nuevo",
                      respuestas = list(as.character(fx$datos$coment[4])))
  r <- codificacion_grupos_guardar(sid, "coment", grupos)$rotulos_adaptados
  expect_identical(r$estado, "propagado")
  expect_length(r$propagados, 1L)
  expect_length(r$no_propagados, 1L)
  expect_identical(r$no_propagados[[1]]$codigo, "29")
  expect_identical(r$no_propagados[[1]]$motivo, "codigo_sin_adaptar")
  expect_match(r$no_propagados[[1]]$mensaje, "vuelve a adaptar")
  expect_true(isTRUE(r$requiere_readaptar))
})

test_that("una base sin adaptar sólo guarda los grupos", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  r <- codificacion_grupos_guardar(sid, "coment", list(
    list(codigo = "10", etiqueta = "A", origen = "nuevo", respuestas = list("x", "y"))
  ))
  expect_identical(r$n_codificadas, 2L)
  expect_identical(r$rotulos_adaptados$estado, "sin_adaptacion")
  expect_length(codif_get(sid, "grupos_recod")$coment, 1L)
})

test_that("contrato HTTP: POST /api/codificacion/grupos lleva el rótulo a la base adaptada", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .rta_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  pulso <- tempfile(fileext = ".pulso")
  on.exit(unlink(pulso), add = TRUE)
  build_pulso(fx$sid, pulso, project_name = "rta", allow_empty_overwrite = TRUE)

  srv <- http_contract_server()
  op <- http_post_json(srv, "/api/project/open", body = list(path = pulso))
  expect_identical(op$status, 200L)
  sid <- op$json$session_id

  renombrados <- .rta_grupos(fx$datos, "coment",
                             c("B · Hábitos de estudio y espacios", "B · Comodidad para preguntar"))
  # Campos extra en el cuerpo (como manda el front) no rompen el handler.
  r <- http_post_json(srv, "/api/codificacion/grupos", sid = sid,
                      body = list(parent = "coment", grupos = renombrados, base = "principal"))
  expect_identical(r$status, 200L)
  expect_identical(r$json$rotulos_adaptados$estado, "propagado")

  ag <- http_get(srv, "/api/codificacion/agrupacion?parent=coment_recod&base=principal", sid = sid)
  expect_identical(ag$status, 200L)
  et <- stats::setNames(vapply(ag$json$codigos, function(x) x$etiqueta, ""),
                        vapply(ag$json$codigos, function(x) x$codigo, ""))
  expect_identical(unname(et[["24"]]), "B · Hábitos de estudio y espacios")
  expect_identical(unname(et[["26"]]), "B · Comodidad para preguntar")
})
