source("setup-load-all.R")

# ADR 0061 — La configuración de Analítica pertenece a su base, no al estudio.
#
# El defecto que estos casos fijan: `.analitica_scoped_base()` sólo devolvía la
# base activa en `independent_siblings`, así que un estudio `multibase` con
# bases SEPARADAS (instrumentos distintos) leía y escribía una `analitica_config`
# global compartida. Como `.analitica_apply_data_review()` aplica los overrides
# POR NOMBRE DE VARIABLE, una etiqueta escrita mirando la base A se aplicaba a la
# base B, donde ese mismo nombre designa otra pregunta.
#
# Medido en el estudio real de acreditación de Contabilidad PUCP: `p13_1` es
# «¿Conoce el servicio de salud?» (Sí/No) en docentes y la batería de
# satisfacción (escala de 4 puntos) en estudiantes. La etiqueta de docentes se
# mostraba sobre los datos de estudiantes.
#
# La contraparte importa tanto como el caso: con bases INTEGRADAS hay un solo
# instrumento, los nombres sí son comparables y la config compartida es correcta.
# Sin ese caso, el scoping se generaliza por descuido.

# --- Fixture -----------------------------------------------------------------
# Dos bases con el MISMO nombre de variable y distinta pregunta detrás, que es la
# condición exacta bajo la que el defecto se manifiesta.

.acs_write_instrument <- function(path, label, choices) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = "select_one lst_p13", name = "p13_1", label = label,
    stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = rep("lst_p13", length(choices)),
    name = as.character(seq_along(choices)),
    label = choices,
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.acs_register_base <- function(sid, nombre, label, choices, valores) {
  sdir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(sdir, recursive = TRUE, showWarnings = FALSE)
  inst_path <- .acs_write_instrument(
    file.path(sdir, paste0(nombre, "_inst.xlsx")), label, choices)
  datos <- data.frame(p13_1 = valores, stringsAsFactors = FALSE)
  data_path <- file.path(sdir, paste0(nombre, "_data.xlsx"))
  openxlsx::write.xlsx(datos, data_path, overwrite = TRUE)

  inst_meta <- save_upload(sid, "xlsform", basename(inst_path),
    readBin(inst_path, "raw", n = file.info(inst_path)$size))
  data_meta <- save_upload(sid, "data", basename(data_path),
    readBin(data_path, "raw", n = file.info(data_path)$size))

  inst <- reporte_instrumento(path = inst_meta$path)
  estudio_add_base(
    sid = sid, nombre = nombre,
    xlsform_file_id = inst_meta$file_id, data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(datos, instrumento = inst), rp_inst = inst,
    n_filas = nrow(datos), n_columnas = ncol(datos)
  )
  invisible(inst)
}

# docentes: p13_1 = ¿Conoce? (Sí/No) · estudiantes: p13_1 = satisfacción (4 pts)
.acs_setup <- function(topology = "separate") {
  sid <- session_create()
  .acs_register_base(sid, "docentes", "Servicio de salud",
                     c("Sí", "No"), c("1", "2"))
  .acs_register_base(sid, "estudiantes", "Servicio de salud",
                     c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho"),
                     c("3", "4"))
  estudio_set_topology(sid, topology)
  sid
}

.acs_set_label <- function(sid, base, etiqueta) {
  estudio_active_base_set(sid, base)
  cfg <- .analitica_config_get(sid)
  cfg$datos <- cfg$datos %||% list()
  cfg$datos$variable_labels <- list(p13_1 = etiqueta)
  .analitica_config_set(sid, cfg)
  invisible(NULL)
}

.acs_label_visible <- function(sid, base) {
  estudio_active_base_set(sid, base)
  s <- session_get(sid)
  cfg <- .analitica_get_config(sid)
  reviewed <- .analitica_apply_data_review(
    s$rp_data_sources[[base]], s$rp_inst_sources[[base]], cfg)
  lab <- attr(reviewed$data[["p13_1"]], "label", exact = TRUE)
  if (is.null(lab)) "" else as.character(lab)[1]
}

# --- Casos -------------------------------------------------------------------

test_that("bases separadas: una etiqueta editada en una base no alcanza a la otra", {
  skip_if_not_installed("openxlsx")
  sid <- .acs_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  .acs_set_label(sid, "docentes", "¿Conoce el Servicio de salud?")

  expect_equal(.acs_label_visible(sid, "docentes"), "¿Conoce el Servicio de salud?")

  # El corazón del ADR 0061. Antes del fix, estudiantes recibía la etiqueta de
  # docentes sobre una batería de satisfacción de 4 puntos.
  expect_equal(.acs_label_visible(sid, "estudiantes"), "Servicio de salud")
})

test_that("bases integradas: la configuración sigue siendo compartida", {
  skip_if_not_installed("openxlsx")
  sid <- .acs_setup("integrated")
  on.exit(session_delete(sid), add = TRUE)

  .acs_set_label(sid, "docentes", "Etiqueta compartida")

  # Contraparte deliberada: con un solo instrumento los nombres SÍ son
  # comparables y compartir es lo correcto. Si este caso se pone rojo, el
  # scoping se generalizó de más.
  expect_equal(.acs_label_visible(sid, "docentes"), "Etiqueta compartida")
  expect_equal(.acs_label_visible(sid, "estudiantes"), "Etiqueta compartida")
})

test_that("bases separadas: una base sin config propia arranca en default y no hereda la global", {
  skip_if_not_installed("openxlsx")
  sid <- .acs_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  # Simula el estado heredado de un .pulso guardado antes del ADR 0061: la
  # config vive en el slot global del proyecto y ninguna base la reclama.
  session_set(sid, "analitica_config", list(
    datos = list(variable_labels = list(p13_1 = "Etiqueta global heredada"))
  ))
  session_set(sid, "analitica_config_por_base", list())

  expect_equal(.acs_label_visible(sid, "docentes"), "Servicio de salud")
  expect_equal(.acs_label_visible(sid, "estudiantes"), "Servicio de salud")

  # La config global se conserva: la migración no destruye el trabajo, sólo
  # deja de aplicarlo.
  expect_equal(
    session_get(sid)$analitica_config$datos$variable_labels$p13_1,
    "Etiqueta global heredada"
  )
})

test_that("Gráficos aplica la etiqueta curada de cada base, no la de otra", {
  skip_if_not_installed("openxlsx")
  sid <- .acs_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  .acs_set_label(sid, "docentes", "¿Conoce el Servicio de salud?")

  s <- session_get(sid)
  src <- .graficos_apply_data_review_labels_sources(sid, list(
    data_sources = s$rp_data_sources,
    inst_sources = s$rp_inst_sources
  ))

  etiqueta <- function(base) {
    lab <- attr(src$data_sources[[base]][["p13_1"]], "label", exact = TRUE)
    if (is.null(lab)) "" else as.character(lab)[1]
  }

  # El PPT no pasa por .analitica_apply_data_review: sin este pase mostraba el
  # texto del XLSForm mientras Analítica mostraba el editado.
  expect_equal(etiqueta("docentes"), "¿Conoce el Servicio de salud?")
  # Y sin el scoping del ADR 0061, lo mostraría también sobre estudiantes.
  expect_equal(etiqueta("estudiantes"), "Servicio de salud")
})

test_that("label_original conserva el texto del instrumento cuando hay override", {
  skip_if_not_installed("openxlsx")
  sid <- .acs_setup("separate")
  on.exit(session_delete(sid), add = TRUE)

  .acs_set_label(sid, "docentes", "¿Conoce el Servicio de salud?")

  estudio_active_base_set(sid, "docentes")
  s <- session_get(sid)
  payload <- .analitica_data_review_payload(
    s$rp_data_sources$docentes, s$rp_inst_sources$docentes,
    .analitica_get_config(sid))
  fila <- Filter(function(v) identical(v$name, "p13_1"), payload)[[1]]

  expect_equal(fila$label_actual, "¿Conoce el Servicio de salud?")
  # Antes del ADR 0061 los dos campos traían el texto editado, así que la
  # pantalla no podía decir de qué se separa el analista.
  expect_equal(fila$label_original, "Servicio de salud")
})

test_that("scoped_base declara la base activa en topologías de bases separadas", {
  skip_if_not_installed("openxlsx")
  for (topology in c("separate", "independent")) {
    sid <- .acs_setup(topology)
    estudio_active_base_set(sid, "estudiantes")
    expect_equal(.analitica_scoped_base(sid), "estudiantes",
                 info = sprintf("topología %s", topology))
    session_delete(sid)
  }

  for (topology in c("single", "integrated")) {
    sid <- .acs_setup(topology)
    estudio_active_base_set(sid, "estudiantes")
    expect_equal(.analitica_scoped_base(sid), "",
                 info = sprintf("topología %s", topology))
    session_delete(sid)
  }
})
