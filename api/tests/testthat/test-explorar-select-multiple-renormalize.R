library(testthat)

# Regresión del explorador de Validación con select_multiple tras abrir un .pulso.
#
# Bug (ACNUR_PDM): al abrir el proyecto, la distribución de una pregunta
# select_multiple (`obstacle`) en "Explorar respuestas" salía MAL: solo la
# opción `other` aparecía con conteo y el resto en 0.
#
# Causa raíz: `.pulso_rebuild_estudio_runtime_sources` reconstruye la base desde
# el archivo (normalize -> reporte_data -> sanitize). Cuando la data cruda ya
# viene en forma "madre" (tokens separados por espacio, SIN columnas dummy),
# `normalize_data_for_xlsform` no colapsa nada y NO deja el atributo
# `xlsform_normalized`. `reporte_data` luego expande el select_multiple a dummies
# `var.opcion`. Sin ese marcador, el paso post-load `.pulso_renormalize_after_load`
# cree que la base está sin normalizar y RE-EJECUTA `normalize_data_for_xlsform`
# sobre la salida ya expandida, colapsando los dummies de vuelta a la madre y
# dropeándolos (sobrevive solo `.other`). El fix marca `data_cache` como ya
# normalizado en el rebuild cuando el pipeline corrió con éxito.

.esm_write_xlsform <- function(path) {
  survey <- data.frame(
    type = c("text", "select_multiple lst_obs", "text"),
    name = c("resp_id", "obstacle", "obstacle_other"),
    label = c("ID", "Obstáculos", "Otro obstáculo"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = rep("lst_obs", 5),
    name = c("none", "distance", "cost", "security", "other"),
    label = c("Ninguno", "Distancia", "Costo", "Seguridad", "Otro"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  settings <- data.frame(
    form_title = "PDM ESM", form_id = "pdm_esm",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  .carga_write_xlsform_model(
    list(survey = survey, choices = choices, settings = settings), path
  )
}

# Data en forma "madre": `obstacle` con tokens separados por espacio, sin dummies.
.esm_write_data <- function(path) {
  obstacle <- c(
    rep("none", 6),
    rep("distance", 3),
    rep("distance cost", 2),
    "cost",
    "security",
    rep("other", 2),
    "distance other"
  )
  n <- length(obstacle)
  df <- data.frame(
    resp_id = sprintf("R%03d", seq_len(n)),
    obstacle = obstacle,
    obstacle_other = ifelse(grepl("other", obstacle), "texto libre", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  openxlsx::write.xlsx(df, path, overwrite = TRUE)
  df
}

test_that("select_multiple conserva sus dummies tras rebuild + renormalize al abrir el .pulso", {
  skip_if_not_installed("openxlsx")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  xls_path <- tempfile(fileext = ".xlsx")
  dat_path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(xls_path, dat_path)), add = TRUE)

  .esm_write_xlsform(xls_path)
  raw <- .esm_write_data(dat_path)

  inst <- reporte_instrumento(path = xls_path)

  # Registrar files + base como lo deja un .pulso recién abierto (rp_data_sources
  # se reconstruye desde el archivo, no viene persistido).
  xls_fid <- "xls-esm"
  dat_fid <- "dat-esm"
  session_set(sid, "files", list(
    `xls-esm` = list(file_id = xls_fid, kind = "xlsform", path = xls_path, ext = "xlsx"),
    `dat-esm` = list(file_id = dat_fid, kind = "data", path = dat_path, ext = "xlsx")
  ))
  estudio_add_base(
    sid,
    nombre = "pdm",
    xlsform_file_id = xls_fid,
    data_file_id = dat_fid,
    data_ext = "xlsx",
    rp_data = raw,
    rp_inst = inst,
    n_filas = nrow(raw),
    n_columnas = ncol(raw)
  )

  # Path exacto de apertura de proyecto.
  .pulso_rebuild_estudio_runtime_sources(sid)
  .pulso_renormalize_after_load(sid)

  df <- estudio_data_sources(sid)[["pdm"]]
  expect_true(is.data.frame(df))

  # Los dummies del select_multiple deben sobrevivir (no colapsar a solo `.other`).
  dummies <- grep("^obstacle[/.]", names(df), value = TRUE)
  expect_setequal(
    sub("^obstacle\\.", "", dummies),
    c("none", "distance", "cost", "security", "other")
  )

  # La base reconstruida debe quedar marcada como normalizada para que el paso
  # post-load no la vuelva a normalizar destructivamente.
  expect_false(is.null(attr(df, "xlsform_normalized")))

  # La tabla de frecuencia SM del explorador debe reportar TODAS las opciones.
  inst_base <- estudio_inst_sources(sid)[["pdm"]]
  tb <- .explorar_tab_frec_sm(df, "obstacle", inst_base)
  expect_true(is.data.frame(tb) && nrow(tb) >= 5)
  counts <- stats::setNames(tb$n, tb$code)
  expect_equal(unname(counts["none"]), 6L)
  expect_equal(unname(counts["distance"]), 6L) # 3 solas + 2 "distance cost" + 1 "distance other"
  expect_equal(unname(counts["cost"]), 3L)     # 1 sola + 2 "distance cost"
  expect_equal(unname(counts["security"]), 1L)
  expect_equal(unname(counts["other"]), 3L)    # 2 solas + 1 "distance other"
})
