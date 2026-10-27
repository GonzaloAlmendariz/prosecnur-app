# Barrido de un solo bloque con la columna de origen titulada «Muestra»
# (monitoreo_sheets_origen.R), forma del ACNUR RMS 2026 al 2026-10-27:
#   Código proGres | Muestra | … | ¿Se reemplaza con el Backup? (LLAMEN AL BACKUP IGUAL)
# con valores «Muestra»/«Backup» por fila, en tramos que no son 1:1, y la marca
# de reemplazo con texto largo. También el mixto: una pestaña de un bloque y
# otra lado a lado. Fixture sintético (códigos FX-*, «Hogar NNN», sin
# teléfonos). Sin red: la API de Sheets se mockea.

ORG_COLS <- c("Código proGres", "Muestra", "Nombre Completo", "Tef1", "Tef2", "Tef3",
              "Estatus Legal", "Periodo de Llegada", "Responsable", "Status",
              "Teléfono de la encuesta", "Intentos", "Fecha", "Observaciones",
              "¿Se reemplaza con el Backup? (LLAMEN AL BACKUP IGUAL)")
ORG_MARCA <- "¿Se reemplaza con el Backup? (LLAMEN AL BACKUP IGUAL)"
ORG_PERIODOS <- c("Pre visa humanitaria", "Pandemia", "Post-pandemia", "Actualidad")
ORG_STATUS <- c("Efectivo", "No contesta", "Rechazo", "No barrido", "Efectivo", "Apagado")
ORG_MARCAS <- c("No, el caso está completo", "No, el caso sigue en gestión", "Sí",
                "No, el caso sigue en gestión", "No, el caso está completo", "Sí")

# Tramos como en la hoja real: muestra y luego su backup, sin emparejar 1:1
# (el último tramo trae más backups que muestra).
ORG_TRAMOS <- list(c(Muestra = 3L, Backup = 2L), c(Muestra = 2L, Backup = 5L))

org_fila <- function(i, origen) {
  status <- ORG_STATUS[[(i - 1L) %% length(ORG_STATUS) + 1L]]
  marca <- if (origen == "Muestra") ORG_MARCAS[[(i - 1L) %% length(ORG_MARCAS) + 1L]] else ""
  c(sprintf("FX-%04d", i), origen, sprintf("Hogar %03d", i), "", "", "",
    "Refugiado", ORG_PERIODOS[[(i - 1L) %% 4L + 1L]],
    sprintf("Encuestador %02d", (i - 1L) %% 2L + 1L), status, "",
    if (status == "No barrido") "0" else "1", if (status == "No barrido") "" else "27/10/2026",
    "", marca)
}

# Filas como data.frame de texto con el encabezado de la hoja.
org_tabla <- function(cabecera_origen = "Muestra") {
  origenes <- unlist(lapply(ORG_TRAMOS, function(t) rep(names(t), t)), use.names = FALSE)
  filas <- lapply(seq_along(origenes), function(i) org_fila(i, origenes[[i]]))
  out <- as.data.frame(do.call(rbind, filas), stringsAsFactors = FALSE)
  names(out) <- replace(ORG_COLS, 2L, cabecera_origen)
  out
}

# values de la API: la API recorta las celdas vacías finales de cada fila.
org_values <- function(tabla) {
  recortar <- function(x) {
    while (length(x) && !nzchar(x[[length(x)]])) x <- x[-length(x)]
    as.list(x)
  }
  c(list(as.list(names(tabla))),
    lapply(seq_len(nrow(tabla)), function(i) recortar(unname(unlist(tabla[i, ])))))
}

test_that("la columna «Muestra» se reconoce como origen por cabecera y valores, y se añade Origen", {
  tabla <- org_tabla()
  df <- monitoreo_sheets_bloques_dataframe(org_values(tabla), 1L)

  # Grano: un caso por fila, ninguno perdido ni duplicado, en su orden.
  expect_identical(nrow(df), 12L)
  expect_identical(df$`Código proGres`, tabla$`Código proGres`)
  expect_false(anyDuplicated(df$`Código proGres`) > 0L)
  # Origen junto a la columna original, que se conserva (linaje).
  expect_identical(names(df)[1:3], c("Código proGres", "Muestra", "Origen"))
  expect_identical(df$Origen, df$Muestra)
  expect_identical(as.integer(table(df$Origen)[c("Muestra", "Backup")]), c(5L, 7L))
  # No es una hoja de bloques: no hay Par de.
  expect_false("Par de" %in% names(df))
  expect_null(attr(df, "monitoreo_bloques"))

  meta <- attr(df, "monitoreo_origen")
  expect_identical(meta$columna, "Muestra")
  expect_identical(c(meta$titular, meta$reserva, meta$sin_origen, meta$no_reconocidos), c(5L, 7L, 0L, 0L))
})

test_that("sin columna de origen reconocible, o con Origen ya presente, la hoja se lee como siempre", {
  con_origen <- org_values(org_tabla("Origen"))
  un_rol <- org_tabla("Tipo")
  un_rol$Tipo <- "Muestra"
  sin_pista_un_rol <- org_values(un_rol)
  la_marca_sola <- org_values(org_tabla()[, -2L])
  for (v in list(con_origen, sin_pista_un_rol, la_marca_sola)) {
    expect_identical(monitoreo_sheets_bloques_dataframe(v, 1L), .monitoreo_values_to_dataframe(v, 1L))
  }
  # Sin pista en la cabecera pero con las dos listas: se reconoce por valores.
  df <- monitoreo_sheets_bloques_dataframe(org_values(org_tabla("Tipo")), 1L)
  expect_identical(names(df)[2:3], c("Tipo", "Origen"))
  expect_identical(attr(df, "monitoreo_origen")$columna, "Tipo")
})

test_that("un origen vacío o mal tecleado no se descarta: queda en la fila y se cuenta", {
  tabla <- org_tabla()
  tabla$Muestra[[4]] <- ""
  tabla$Muestra[[9]] <- " BACKUP "
  tabla$Muestra[[10]] <- "Bakup"
  df <- monitoreo_sheets_bloques_dataframe(org_values(tabla), 1L)

  expect_identical(nrow(df), 12L)
  expect_identical(df$Origen[[4]], "")
  expect_identical(df$Origen[[9]], "Backup")  # grafía de la mayoría
  expect_identical(df$Origen[[10]], "Bakup")
  meta <- attr(df, "monitoreo_origen")
  expect_identical(c(meta$titular, meta$reserva, meta$sin_origen, meta$no_reconocidos), c(5L, 5L, 1L, 1L))
  expect_identical(meta$valores_no_reconocidos, list("Bakup"))

  # El bloque «Origen de la muestra» los muestra: suman el total de la hoja.
  origen <- .monitoreo_telefonico_origen_df(df, list(
    sample_origin = list(column = "Origen", titular_values = list("Muestra"), reserva_values = list("Backup"))))
  filas <- origen[origen$Columna == "Origen", , drop = FALSE]
  roles <- stats::setNames(filas$Rol, filas$Valor)
  expect_identical(unname(roles[c("Muestra", "Backup", "Bakup", "Sin dato")]),
                   c("titular", "reserva", "sin_rol", "sin_rol"))
  expect_identical(sum(filas$Casos), 12L)
})

# Reporte telefónico con la configuración real del RMS: dimension_vars
# origen = "Origen" (sin reconfigurar) y la marca declarada con el nombre corto.
org_reporte <- function(barrido) {
  fuente <- monitoreo_normalize_sources(list(list(
    id = "rms_barrido", kind = "google_sheets", label = "RMS barrido", enabled = TRUE,
    role = "barrido", integration_mode = "connected_read", dimensions = list(),
    actor_var = "Periodo de Llegada",
    dimension_vars = list(periodo = "Periodo de Llegada", origen = "Origen"),
    sheet_binding = list(spreadsheet_id = "fx_rms", sheet_name = "Barrido", header_row = 1L)
  )))[[1]]
  datos <- .monitoreo_bind_rows(list(.monitoreo_add_source_columns(barrido, fuente)))
  datos <- monitoreo_apply_source_dimension_vars(datos, fuente)
  spec <- list(
    objetivo_total = 8L, date_var = "Fecha", control_vars = list(),
    goals = lapply(ORG_PERIODOS, function(p) list(filters = list(Actor = p), meta = 2L, meta_pct = 50)),
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

org_filas <- function(rep, id) {
  b <- Filter(function(x) identical(x$id, id), rep$bloques)
  if (!length(b)) return(NULL)
  vapply(b[[1]]$rows, function(r) paste(vapply(r, function(x) paste(as.character(x), collapse = ""), ""), collapse = "|"), "")
}

test_that("con la configuración del RMS, el backup es reserva y la marca larga se interpreta", {
  df <- monitoreo_sheets_bloques_dataframe(org_values(org_tabla()), 1L)
  rep <- org_reporte(df)

  # La dimensión declarada sobre «Origen» se deriva sin reconfigurar.
  expect_identical(as.integer(table(rep$datos$dim_origen)[c("Muestra", "Backup")]), c(5L, 7L))

  origen <- .monitoreo_telefonico_origen_df(rep$datos, rep$cfg$monitoreo_profile)
  roles <- stats::setNames(origen$Casos, paste(origen$Columna, origen$Valor, origen$Rol, sep = " · "))
  expect_identical(unname(roles[["Origen · Muestra · titular"]]), 5L)
  expect_identical(unname(roles[["Origen · Backup · reserva"]]), 7L)
  expect_false(any(origen$Columna == "Origen" & origen$Valor == "Backup" & origen$Rol == "titular"))
  # «Sí» reemplaza; «No, …» y el vacío del backup, no.
  marca <- origen[origen$Columna == ORG_MARCA, , drop = FALSE]
  rol_marca <- stats::setNames(marca$Rol, marca$Valor)
  expect_identical(unname(rol_marca[["Sí"]]), "reemplazo")
  expect_identical(unname(rol_marca[["No, el caso sigue en gestión"]]), "no_reemplazo")
  expect_identical(unname(rol_marca[["No, el caso está completo"]]), "no_reemplazo")
  expect_identical(unname(rol_marca[["Sin dato"]]), "no_reemplazo")
  expect_identical(marca$Casos[marca$Valor == "Sí"], 2L)
  expect_identical(marca$Casos[marca$Valor == "Sin dato"], 7L)  # los 7 backups
  expect_identical(sum(marca$Casos), 12L)
})

test_that("las cifras del reporte son las mismas que con la columna titulada «Origen»", {
  r_muestra <- org_reporte(monitoreo_sheets_bloques_dataframe(org_values(org_tabla()), 1L))
  r_origen <- org_reporte(monitoreo_sheets_bloques_dataframe(org_values(org_tabla("Origen")), 1L))
  for (id in c("resumen_telefonico", "cuotas_variable", "operacion_responsable")) {
    filas <- org_filas(r_muestra, id)
    expect_gt(length(filas), 0L)
    expect_identical(filas, org_filas(r_origen, id), info = id)
  }
  expect_true(any(grepl("^Total telefónico\\|12", org_filas(r_muestra, "resumen_telefonico"))))
})

# Pestaña lado a lado (forma de días atrás): muestra A–O, columna vacía,
# backup Q–AD, ambos con su `Código proGres`.
org_values_lado_a_lado <- function(n = 4L) {
  bloque <- function(rotulo) replace(ORG_COLS[-15], 2L, rotulo)
  header <- c(bloque("Muestra"), "¿Se reemplaza con el Backup?", "", bloque("Backup"))
  filas <- lapply(seq_len(n), function(i) {
    m <- org_fila(100L + i, "Muestra")
    m[[1]] <- sprintf("FY-%04d", i)
    b <- org_fila(200L + i, "Backup")[-15]
    b[[1]] <- sprintf("FZ-%04d", i)
    as.list(c(m, "", b))
  })
  c(list(as.list(header)), filas)
}

test_that("mixto entre pestañas: un bloque y lado a lado dan el mismo Origen sin perder ni duplicar casos", {
  hojas <- list(Barrido = org_values(org_tabla()), Anterior = org_values_lado_a_lado())
  local_mocked_bindings(.monitoreo_google_api = function(url, ...) {
    list(values = if (grepl("Anterior", url, fixed = TRUE)) hojas$Anterior else hojas$Barrido)
  })
  leer <- function(pestana) {
    src <- list(id = paste0("rms_", tolower(pestana)), kind = "google_sheets", label = pestana,
                sheet_binding = list(spreadsheet_id = "fx_rms", sheet_name = pestana, header_row = 1L))
    monitoreo_sheets_read_source(src)
  }
  un_bloque <- leer("Barrido")
  lado <- leer("Anterior")

  expect_identical(as.integer(table(un_bloque$Origen)[c("Muestra", "Backup")]), c(5L, 7L))
  expect_identical(as.integer(table(lado$Origen)[c("Muestra", "Backup")]), c(4L, 4L))
  expect_false(is.null(attr(lado, "monitoreo_bloques")))

  todo <- .monitoreo_bind_rows(list(un_bloque, lado))
  expect_identical(nrow(todo), 20L)
  expect_false(anyDuplicated(todo$`Código proGres`) > 0L)
  expect_identical(as.integer(table(todo$Origen)[c("Muestra", "Backup")]), c(9L, 11L))
  expect_true(all(nzchar(todo$Origen)))
})
