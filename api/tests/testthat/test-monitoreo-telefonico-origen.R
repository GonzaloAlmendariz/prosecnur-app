# Contrato del bloque `origen_de_la_muestra` y de las claves de perfil
# `sample_origin` y `replacement_flag` (revamp Monitoreo › Telefónico).
# Fixture sintético: códigos ORI-0xx inventados; sin red, sin reloj y sin rutas.

origen_barrido <- function() {
  data.frame(
    CodPulso = sprintf("ORI-%03d", 1:8),
    Origen = c("Muestra", "Muestra", "Muestra", "Muestra", "Backup", "Backup", "Backup", ""),
    `¿Se reemplaza con el Backup?` = c("No", "No", "Sí", "", "", "", "", ""),
    Periodo = c("A", "B", "A", "B", "A", "B", "A", "B"),
    Status = c("Efectivo", "No contesta", "No barrido", "No barrido", "No barrido", "No barrido", "No barrido", "No barrido"),
    Responsable = c("Op-01", "Op-01", "", "", "", "", "", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

origen_escenario <- function(perfil_extra = list()) {
  fuentes <- monitoreo_normalize_sources(list(list(
    id = "ori_barrido", kind = "google_sheets", label = "ori_barrido", enabled = TRUE, role = "barrido",
    integration_mode = "connected_read", dimensions = list(),
    sheet_binding = list(spreadsheet_id = "fx_ori", sheet_name = "Hoja", header_row = 1L),
    last_sync_at = "2026-10-23T12:00:00Z"
  )))
  datos <- .monitoreo_add_source_columns(origen_barrido(), fuentes[[1]])
  perfil <- utils::modifyList(list(
    family = "telefonico", variant = "multi_actor", status = "active", route_selected = TRUE,
    platform_effective_filter = list(enabled = FALSE), platform_test_filter = list(enabled = FALSE),
    key_rules = list(universe_fields = list("CodPulso"), response_fields = list("CodPulso"),
                     use_name_fallback = FALSE, automatic_detection = TRUE)
  ), perfil_extra)
  cfg <- monitoreo_normalize_config(list(objetivo_total = 4L, date_var = "Fecha", monitoreo_profile = perfil), datos)
  list(datos = datos, cfg = cfg)
}

origen_bloque <- function(esc) {
  bloques <- .monitoreo_report_phone_blocks(esc$datos, esc$cfg$monitoreo_profile, esc$cfg)
  ids <- vapply(bloques, function(b) b$id, "")
  expect_true("origen_de_la_muestra" %in% ids)
  bloques[[match("origen_de_la_muestra", ids)]]
}

origen_filas <- function(bloque) {
  if (!length(bloque$rows)) return(data.frame())
  do.call(rbind, lapply(bloque$rows, function(r) data.frame(
    Columna = r$Columna, Valor = r$Valor, Rol = r$Rol, Casos = as.integer(r$Casos), stringsAsFactors = FALSE
  )))
}

test_that("el normalizador conserva las dos claves declaradas y las omite si no hay columna", {
  esc <- origen_escenario(list(
    sample_origin = list(column = "Origen", titular_values = list("Muestra", " "), reserva_values = list("Backup")),
    replacement_flag = list(column = "¿Se reemplaza con el Backup?", yes_values = list("Sí"))
  ))
  perfil <- esc$cfg$monitoreo_profile
  expect_identical(perfil$sample_origin$column, "Origen")
  expect_identical(unlist(perfil$sample_origin$titular_values), "Muestra")
  expect_identical(unlist(perfil$sample_origin$reserva_values), "Backup")
  expect_identical(unlist(perfil$replacement_flag$yes_values), "Sí")

  sin <- origen_escenario(list(sample_origin = list(column = "  ")))$cfg$monitoreo_profile
  expect_null(sin$sample_origin)
  expect_null(sin$replacement_flag)
})

test_that("sin declarar, el bloque muestra las columnas candidatas por nombre con sus conteos", {
  filas <- origen_filas(origen_bloque(origen_escenario()))
  expect_setequal(unique(filas$Columna), c("Origen", "¿Se reemplaza con el Backup?"))
  expect_true(all(filas$Rol == "sin_declarar"))
  origen <- filas[filas$Columna == "Origen", ]
  expect_identical(origen$Casos[match(c("Muestra", "Backup", "Sin dato"), origen$Valor)], c(4L, 3L, 1L))
  # Periodo no se llama como origen ni reemplazo; CodPulso tampoco.
  expect_false(any(filas$Columna %in% c("Periodo", "CodPulso")))
})

test_that("declaradas, cada valor lleva su rol y los conteos suman el total de la hoja", {
  esc <- origen_escenario(list(
    sample_origin = list(column = "Origen", titular_values = list("Muestra"), reserva_values = list("backup")),
    replacement_flag = list(column = "¿Se reemplaza con el Backup?", yes_values = list("si"))
  ))
  filas <- origen_filas(origen_bloque(esc))
  origen <- filas[filas$Columna == "Origen", ]
  expect_identical(origen$Rol[match(c("Muestra", "Backup", "Sin dato"), origen$Valor)], c("titular", "reserva", "sin_rol"))
  expect_identical(sum(origen$Casos), 8L)
  marca <- filas[filas$Columna == "¿Se reemplaza con el Backup?", ]
  expect_identical(marca$Rol[match(c("Sí", "No", "Sin dato"), marca$Valor)], c("reemplazo", "no_reemplazo", "no_reemplazo"))
  expect_identical(marca$Casos[match("Sí", marca$Valor)], 1L)
  expect_identical(sum(marca$Casos), 8L)
  # Ninguna columna aparece dos veces (declarada y candidata a la vez).
  expect_false(any(filas$Rol == "sin_declarar"))
})

test_that("una columna declarada que no existe en la hoja no inventa filas", {
  esc <- origen_escenario(list(sample_origin = list(column = "Tipo de lista", titular_values = list("A"))))
  filas <- origen_filas(origen_bloque(esc))
  expect_false("Tipo de lista" %in% filas$Columna)
})
