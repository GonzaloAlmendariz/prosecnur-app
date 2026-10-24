# Hojas de barrido con bloques lado a lado (monitoreo_sheets_bloques.R).
#
# Forma nueva del ACNUR RMS 2026: A–O la muestra (con «¿Se reemplaza con el
# Backup?»), P vacía, Q–AD el backup. Fixture sintético: códigos CGU-26-9xxxxxx
# y «Hogar NNN» inventados. Sin red: la API de Sheets se mockea.

COLS_BLOQUE <- c("Código proGres", "%s", "Nombre Completo", "Tef1", "Tef2", "Tef3",
                 "Estatus Legal", "Periodo de Llegada", "Responsable", "Status",
                 "Teléfono de la encuesta", "Intentos", "Fecha", "Observaciones")
PERIODOS_BLQ <- c("Pre visa humanitaria", "Pandemia", "Post-pandemia", "Actualidad")
STATUS_MUESTRA <- c("Efectivo", "Efectivo", "Encuesta parcial", "Rechazo", "No contesta",
                    "No barrido", "No barrido", "No barrido")

# Una fila de cada bloque (vector con el largo de su bloque).
blq_muestra <- function(i) {
  status <- STATUS_MUESTRA[[(i - 1L) %% length(STATUS_MUESTRA) + 1L]]
  c(sprintf("CGU-26-9%06d", i), "Muestra", sprintf("Hogar %03d", i),
    sprintf("+5199%07d", i), "", "", "Refugiado", PERIODOS_BLQ[[(i - 1L) %% 4L + 1L]],
    sprintf("Encuestador %02d", (i - 1L) %% 3L + 1L), status,
    "", if (status == "No barrido") "0" else "1",
    if (status == "No barrido") "" else "23/10/2026", "",
    if (status == "Efectivo") "No, el caso está completo" else if (i == 5L) "Sí" else "No, el caso sigue en gestión")
}

blq_backup <- function(i, casi_vacio = FALSE) {
  codigo <- sprintf("CGU-26-8%06d", i)
  if (casi_vacio) return(c(codigo, "Backup"))
  c(codigo, "Backup", sprintf("Hogar %03d", 500L + i), sprintf("+5198%07d", i), "", "",
    "Solicitante", PERIODOS_BLQ[[(i - 1L) %% 4L + 1L]],
    sprintf("Encuestador %02d", (i - 1L) %% 3L + 1L), if (i == 2L) "No contesta" else "No barrido",
    "", if (i == 2L) "1" else "0", if (i == 2L) "23/10/2026" else "", "")
}

# values de la API: lista de filas; la API recorta las celdas vacías finales.
recortar <- function(x) {
  while (length(x) && !nzchar(x[[length(x)]])) x <- x[-length(x)]
  as.list(x)
}

# n filas de muestra; backups: `sin_backup` filas sin bloque Q (vacío entero),
# `casi_vacios` con sólo llave y rótulo.
blq_values <- function(n = 8L, sin_backup = c(7L, 8L), casi_vacios = 6L) {
  header <- c(sprintf(COLS_BLOQUE, "Muestra"), "¿Se reemplaza con el Backup?", "",
              sprintf(COLS_BLOQUE, "Backup"))
  filas <- lapply(seq_len(n), function(i) {
    m <- blq_muestra(i)
    b <- if (i %in% sin_backup) character(0) else blq_backup(i, casi_vacio = i %in% casi_vacios)
    recortar(c(m, "", b))
  })
  c(list(as.list(header)), filas)
}

# La misma información en la forma anterior: una tabla con `Origen`.
blq_tabla_anterior <- function(n = 8L, sin_backup = c(7L, 8L), casi_vacios = 6L) {
  nm <- c("Código proGres", "Origen", COLS_BLOQUE[-(1:2)])
  fila <- function(v) { length(v) <- length(nm); v[is.na(v)] <- ""; stats::setNames(as.list(v), nm) }
  m <- lapply(seq_len(n), function(i) fila(blq_muestra(i)[1:14]))
  b <- lapply(setdiff(seq_len(n), sin_backup), function(i) fila(blq_backup(i, i %in% casi_vacios)))
  out <- do.call(rbind.data.frame, c(c(m, b), stringsAsFactors = FALSE))
  names(out) <- nm
  rownames(out) <- NULL
  out
}

test_that("detecta los dos bloques con su llave y sus rótulos", {
  v <- blq_values()
  filas <- .monitoreo_bloques_filas(v)
  det <- .monitoreo_sheets_bloques_detectar(filas[[1]], filas[-1])

  expect_false(is.null(det))
  expect_identical(det$llave, "Código proGres")
  expect_identical(det$rotulos, c("Muestra", "Backup"))
  expect_identical(det$bloques[[1]], 1:15)
  expect_identical(det$bloques[[2]], 17:30)
})

test_that("apila N de muestra más M backups no vacíos, con Origen y Par de por fila", {
  df <- monitoreo_sheets_bloques_dataframe(blq_values(), 1L)

  muestra <- df[df$Origen == "Muestra", , drop = FALSE]
  backup <- df[df$Origen == "Backup", , drop = FALSE]
  expect_identical(nrow(muestra), 8L)
  expect_identical(nrow(backup), 6L)  # 8 filas, dos sin bloque backup
  expect_identical(nrow(df), 14L)
  expect_setequal(unique(df$Origen), c("Muestra", "Backup"))

  # Par de: la llave del otro bloque en la misma fila; vacío si no hay.
  expect_identical(muestra$`Par de`[1:6], sprintf("CGU-26-8%06d", 1:6))
  expect_identical(muestra$`Par de`[7:8], c("", ""))
  expect_identical(backup$`Par de`, sprintf("CGU-26-9%06d", 1:6))
  expect_identical(backup$`Código proGres`, sprintf("CGU-26-8%06d", 1:6))

  # Las columnas de rótulo se pliegan en Origen; no hay copias con sufijo.
  expect_false(any(c("Muestra", "Backup") %in% names(df)))
  expect_false(any(grepl("_1$", names(df))))
  expect_identical(names(df)[1:3], c("Código proGres", "Origen", "Nombre Completo"))
  expect_identical(utils::tail(names(df), 1L), "Par de")
})

test_that("la columna propia de la muestra queda vacía en las filas del backup", {
  df <- monitoreo_sheets_bloques_dataframe(blq_values(), 1L)
  col <- "¿Se reemplaza con el Backup?"

  expect_true(col %in% names(df))
  expect_true(all(df[[col]][df$Origen == "Backup"] == ""))
  expect_identical(sum(df[[col]] == "Sí"), 1L)
  # El backup casi vacío entra como caso con sus celdas vacías.
  casi <- df[df$`Código proGres` == "CGU-26-8000006", , drop = FALSE]
  expect_identical(nrow(casi), 1L)
  expect_identical(casi$Status, "")
  expect_identical(casi$Responsable, "")
})

test_that("una fila sin llave en un bloque se descarta y se cuenta", {
  v <- blq_values()
  v[[3]][[1]] <- ""  # fila 2: la muestra pierde su llave
  df <- monitoreo_sheets_bloques_dataframe(v, 1L)

  expect_identical(sum(df$Origen == "Muestra"), 7L)
  expect_identical(sum(df$Origen == "Backup"), 6L)
  # El backup de esa fila queda sin par.
  expect_identical(df$`Par de`[df$`Código proGres` == "CGU-26-8000002"], "")
  expect_identical(attr(df, "monitoreo_bloques")$descartadas$Muestra, 1L)
})

test_that("sin encabezado que distinga los bloques, el rótulo es «Bloque k»", {
  base <- c("Código", "Nombre", "Status", "Fecha")
  v <- list(as.list(c(base, "", base)),
            list("A1", "Uno", "Efectivo", "", "", "B1", "Dos", "No barrido"),
            list("A2", "Tres", "Rechazo"))
  df <- monitoreo_sheets_bloques_dataframe(v, 1L)

  expect_identical(df$Origen, c("Bloque 1", "Bloque 1", "Bloque 2"))
  expect_identical(names(df), c("Código", "Origen", "Nombre", "Status", "Fecha", "Par de"))
  expect_identical(df$`Par de`, c("B1", "", "A1"))
})

test_that("una hoja de un solo bloque se lee idéntica a hoy", {
  # Forma anterior del RMS (con Origen), PDM-like y con una columna repetida
  # por accidente: ninguna es de bloques.
  anterior <- blq_tabla_anterior()
  v_anterior <- c(list(as.list(names(anterior))),
                  lapply(seq_len(nrow(anterior)), function(i) recortar(unlist(anterior[i, ], use.names = FALSE))))
  v_dup <- list(list("Código", "Teléfono", "Status", "Teléfono", "Fecha"),
                list("X1", "999", "Efectivo", "988", "23/10/2026"),
                list("X2", "977", "No barrido"))
  # Intentos repetidos: el juego se repite pero la columna no identifica.
  v_intentos <- list(list("Código", "Nombre", "Fecha", "Status", "Obs", "Fecha", "Status", "Obs"),
                     list("X1", "Uno", "22/10/2026", "No contesta", "", "23/10/2026", "Efectivo", ""),
                     list("X2", "Dos", "22/10/2026", "No contesta", "", "22/10/2026", "Apagado", ""),
                     list("X3", "Tres", "22/10/2026", "Apagado"))
  for (v in list(v_anterior, v_dup, v_intentos, list(), list(list("A", "B")))) {
    expect_identical(monitoreo_sheets_bloques_dataframe(v, 1L), .monitoreo_values_to_dataframe(v, 1L))
  }
  expect_identical(monitoreo_sheets_bloques_dataframe(v_anterior, 1L), anterior)
  # header_row > 1 también se respeta.
  v2 <- c(list(list("Título del barrido")), blq_values())
  expect_identical(nrow(monitoreo_sheets_bloques_dataframe(v2, 2L)), 14L)
})

test_that("el lector de fuentes Sheets apila sin red", {
  v <- blq_values()
  local_mocked_bindings(.monitoreo_google_api = function(url, ...) list(values = v))
  src <- list(id = "rms_barrido", kind = "google_sheets", label = "RMS barrido",
              sheet_binding = list(spreadsheet_id = "fx_rms", sheet_name = "Barrido", header_row = 1L))
  df <- monitoreo_sheets_read_source(src)

  expect_identical(nrow(df), 14L)
  expect_identical(as.integer(table(df$Origen)[c("Muestra", "Backup")]), c(8L, 6L))
  expect_identical(attr(df, "sheet_binding")$sheet_name, "Barrido")
})

# Cifras del reporte telefónico: la forma nueva apilada debe dar lo mismo que
# la forma anterior con `Origen`, con la configuración real del RMS
# (dimension_vars origen/periodo y actor_var «Periodo de Llegada»).
blq_reporte <- function(barrido) {
  fuente <- monitoreo_normalize_sources(list(list(
    id = "rms_barrido", kind = "google_sheets", label = "RMS barrido", enabled = TRUE,
    role = "barrido", integration_mode = "connected_read", dimensions = list(),
    actor_var = "Periodo de Llegada",
    dimension_vars = list(periodo = "Periodo de Llegada", origen = "Origen"),
    sheet_binding = list(spreadsheet_id = "fx_rms", sheet_name = "Barrido", header_row = 1L)
  )))[[1]]
  datos <- .monitoreo_bind_rows(list(.monitoreo_add_source_columns(barrido, fuente)))
  spec <- list(
    objetivo_total = 8L, date_var = "Fecha", control_vars = list(),
    goals = lapply(PERIODOS_BLQ, function(p) list(filters = list(Actor = p), meta = 2L, meta_pct = 50)),
    operational_model = list(
      cases = list(enabled = TRUE, case_id_var = "Código proGres", person_label_var = "Nombre Completo",
                   status_var = "Status", contact_vars = list("Tef1", "Tef2", "Tef3"), roster_source = "none")),
    monitoreo_profile = list(family = "telefonico", variant = "multi_actor", status = "active",
                             route_selected = TRUE,
                             sample_origin = list(column = "Origen", titular_values = list("Muestra"),
                                                  reserva_values = list("Backup")),
                             replacement_flag = list(column = "¿Se reemplaza con el Backup?",
                                                     yes_values = list("Sí")))
  )
  cfg <- monitoreo_normalize_config(spec, datos)
  list(datos = datos, cfg = cfg,
       bloques = .monitoreo_report_phone_blocks(datos, cfg$monitoreo_profile, cfg))
}

blq_filas <- function(rep, id) {
  b <- Filter(function(x) identical(x$id, id), rep$bloques)
  if (!length(b)) return(NULL)
  vapply(b[[1]]$rows, function(r) paste(vapply(r, function(x) paste(as.character(x), collapse = ""), ""), collapse = "|"), "")
}

test_that("las cifras del reporte telefónico coinciden con la forma anterior", {
  nueva <- monitoreo_sheets_bloques_dataframe(blq_values(), 1L)
  anterior <- blq_tabla_anterior()
  r_nueva <- blq_reporte(nueva)
  r_anterior <- blq_reporte(anterior)

  # dim_origen y dim_actor salen de las columnas declaradas.
  expect_identical(as.integer(table(r_nueva$datos$dim_origen)[c("Muestra", "Backup")]), c(8L, 6L))
  # El backup casi vacío no trae periodo: entra con actor vacío, no se pierde.
  expect_setequal(unique(r_nueva$datos$dim_actor), c(PERIODOS_BLQ, ""))

  for (id in c("resumen_telefonico", "cuotas_variable", "operacion_responsable")) {
    filas <- blq_filas(r_nueva, id)
    expect_gt(length(filas), 0L)
    expect_identical(filas, blq_filas(r_anterior, id), info = id)
  }
  resumen <- blq_filas(r_nueva, "resumen_telefonico")
  expect_true(any(grepl("^Total telefónico\\|14", resumen)))

  # Origen y marca de reemplazo declarados leen la columna generada.
  origen <- .monitoreo_telefonico_origen_df(r_nueva$datos, r_nueva$cfg$monitoreo_profile)
  roles <- stats::setNames(origen$Casos, paste(origen$Columna, origen$Valor, origen$Rol))
  expect_identical(unname(roles[["Origen Muestra titular"]]), 8L)
  expect_identical(unname(roles[["Origen Backup reserva"]]), 6L)
  expect_identical(unname(roles[["¿Se reemplaza con el Backup? Sí reemplazo"]]), 1L)
  # El backup, sin la columna, cae en «Sin dato» y los conteos suman el total.
  expect_identical(sum(origen$Casos[origen$Columna == "¿Se reemplaza con el Backup?"]), 14L)
})
