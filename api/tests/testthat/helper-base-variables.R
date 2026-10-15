# Fixtures del ADR 0106 (variables propias y calculadas de cada base).
#
# Dos bases separadas, como HSyVbG: «2026» llega en Excel con su XLSForm y trae
# columnas que el XLSForm no declara (`facultad`, `P12_R`, `indice`); «2024»
# llega como .sav con un XLSForm que sólo declara `p1` y trae `indice_vbg` con
# sus etiquetas de valor.

.bv_xlsx_bytes <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  wb <- openxlsx::createWorkbook()
  for (nm in names(sheets)) {
    openxlsx::addWorksheet(wb, nm)
    openxlsx::writeData(wb, nm, sheets[[nm]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  readBin(path, "raw", n = file.info(path)$size)
}

.bv_inst_2026 <- function(extra_q = character(0), relevant_q2 = NA_character_) {
  survey <- data.frame(
    type = c("select_one sn", "select_one sn", "integer", rep("select_one sn", length(extra_q))),
    name = c("q1", "q2", "q3", extra_q),
    label = c("Recurrió a la defensoría", "Recurrió a la secretaría", "Edad", extra_q),
    relevant = c(NA_character_, relevant_q2, rep(NA_character_, 1L + length(extra_q))),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = "sn", name = c("1", "2", "99"),
                        label = c("Sí", "No", "No responde"), stringsAsFactors = FALSE)
  list(survey = survey, choices = choices)
}

.bv_data_2026 <- function() {
  n <- 40L
  data.frame(
    `_uuid` = sprintf("u%02d", seq_len(n)),
    q1 = rep(c("1", "2", "2", "99", NA), length.out = n),
    q2 = rep(c("2", "1", "2", "99", NA), length.out = n),
    q3 = 18L + (seq_len(n) %% 10L),
    facultad = rep(c("Derecho", "Letras", "Ciencias"), length.out = n),
    P12_R = rep(c(1, 2, 3, 2), length.out = n),
    indice = round(seq_len(n) / 7, 3),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.bv_add_base <- function(sid, nombre, inst_sheets, data_bytes, data_name, ext) {
  xmeta <- save_upload(sid, "xlsform", paste0("inst_", nombre, ".xlsx"), .bv_xlsx_bytes(inst_sheets))
  dmeta <- save_upload(sid, if (identical(ext, "sav")) "sav" else "data", data_name, data_bytes)
  inst <- reporte_instrumento(path = xmeta$path)
  df <- normalize_data_for_xlsform(.read_data_from_path(dmeta$path, ext), inst)
  estudio_add_base(sid, nombre, xmeta$file_id, dmeta$file_id, ext,
                   reporte_data(df, instrumento = inst), inst,
                   n_filas = nrow(df), n_columnas = ncol(df))
}

.bv_sav_bytes <- function() {
  df <- data.frame(
    p1 = haven::labelled(c(1, 2, 1, 2, 99, 1), labels = c("Sí" = 1, "No" = 2, "No responde" = 99),
                         label = "¿Presenció hostigamiento?"),
    indice_vbg = haven::labelled(c(1, 2, 3, 1, 2, 3), labels = c("Bajo" = 1, "Medio" = 2, "Alto" = 3),
                                 label = "Índice de VBG"),
    stringsAsFactors = FALSE
  )
  path <- tempfile(fileext = ".sav")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  haven::write_sav(df, path)
  readBin(path, "raw", n = file.info(path)$size)
}

# Estudio con las dos bases y topología de bases separadas.
.bv_estudio <- function() {
  sid <- session_create()
  .bv_add_base(sid, "2026", .bv_inst_2026(),
               .bv_xlsx_bytes(list(data = .bv_data_2026())), "data_2026.xlsx", "xlsx")
  inst_2024 <- list(
    survey = data.frame(type = "select_one sn", name = "p1", label = "¿Presenció hostigamiento?",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sn", name = c("1", "2", "99"),
                         label = c("Sí", "No", "No responde"), stringsAsFactors = FALSE)
  )
  .bv_add_base(sid, "2024", inst_2024, .bv_sav_bytes(), "base_2024.sav", "sav")
  estudio_set_topology(sid, "separate")
  sid
}

# Llama un endpoint montado sin levantar servidor.
.bv_endpoint <- function(mount, verbo, ruta) {
  pr <- mount(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  Find(function(e) identical(e$verbs, verbo) && identical(e$path, ruta), eps)
}

.bv_req <- function(sid, body = NULL) {
  req <- list(HTTP_X_PULSO_SESSION = sid)
  if (!is.null(body)) req$bodyRaw <- charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null")))
  req
}

.bv_call <- function(mount, verbo, ruta, sid, body = NULL, ...) {
  ep <- .bv_endpoint(mount, verbo, ruta)
  if (is.null(ep)) stop(sprintf("No hay endpoint %s %s", verbo, ruta))
  ep$getFunc()(req = .bv_req(sid, body), res = plumber:::PlumberResponse$new(), ...)
}
