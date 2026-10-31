# El Estado que campo declara en el Excel de asignación (C7): se lee al subir el archivo,
# se guarda con la asignación y la huella, y se publica de solo lectura para Monitoreo.

.mte_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mte_sesion <- function(env = parent.frame()) {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE, .env = env)
  sid <- .hre_session()
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP Lima")
  s <- session_get(sid)
  s$monitoreo_config$territorial$enumerator_roster <- list(code_format = "PXXX", assignments = list(
    list(codigo_pulso = "P844", nombre = "Encuestador Ejemplo Uno", dni = "40000001")))
  .session_env[[sid]] <- s
  sid
}

T1 <- "150101001001"; T2 <- "150101001002"

# Llena celdas de la hoja Asignación como lo haría campo: lista UMP → list(columna = valor).
.mte_llenar <- function(sid, celdas) {
  r <- collection_territorial_asignacion_excel(sid)
  path <- session_get(sid)$files[[r$file_id]]$path
  wb <- openxlsx::loadWorkbook(path)
  t <- openxlsx::read.xlsx(path, sheet = "Asignación", startRow = 4, check.names = FALSE, sep.names = " ")
  for (id in names(celdas)) {
    fila <- match(id, as.character(t[["Código de manzana"]]))
    for (col in names(celdas[[id]])) {
      openxlsx::writeData(wb, "Asignación", celdas[[id]][[col]], startCol = match(col, names(t)), startRow = 4 + fila)
    }
  }
  out <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, out)
  readBin(out, "raw", file.info(out)$size)
}

test_that("importar lee Estado y fechas (serial, Date o texto) y reporta lo que no reconoce", {
  sid <- .mte_sesion(); on.exit(session_delete(sid), add = TRUE)
  raw <- .mte_llenar(sid, list(
    `150101001001` = list(Encuestador = "P844", Estado = "en campo", `Fecha de salida` = as.Date("2026-11-03"), `Fecha de entrega` = "05/11/2026"),
    `150101001002` = list(Estado = "Terminada", `Fecha de salida` = "mañana")
  ))
  antes <- session_get(sid)
  r <- collection_territorial_asignacion_importar(sid, file_raw = raw)
  expect_identical(session_get(sid), antes)
  e1 <- Filter(function(e) identical(e$id_manzana, T1), r$estados)[[1]]
  expect_identical(e1$estado_declarado, "En campo")
  expect_identical(e1$fecha_salida, "2026-11-03")
  expect_identical(e1$fecha_entrega, "2026-11-05")
  motivos <- vapply(Filter(function(p) identical(p$id_manzana, T2), r$problemas), `[[`, "", "motivo")
  expect_true(any(grepl("Estado no es uno de la lista", motivos)))
  expect_true(any(grepl("fecha de salida no se reconoce", motivos)))
  expect_identical(r$resumen$estados_declarados, 1L)
})

test_that("aplicar guarda lo declarado; el GET lo publica con huella y el selector no lo borra", {
  sid <- .mte_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_territorial_asignacion_importar(sid, file_raw = .mte_llenar(sid, list(
    `150101001001` = list(Encuestador = "P844", Estado = "Finalizada", `Fecha de entrega` = 46331))))
  collection_territorial_asignacion_put(sid, asignacion = r$propuesta, estados = r$estados)
  g <- collection_territorial_estado_get(sid)
  expect_false(g$es_avance)
  expect_false(g$stale); expect_false(g$desactualizada)
  expect_true(nzchar(g$sample_fingerprint))
  u1 <- Filter(function(u) identical(u$id_manzana, T1), g$unidades)[[1]]
  expect_identical(u1$estado_declarado, "Finalizada")
  expect_identical(u1$codigo, "P844")
  expect_identical(u1$fecha_entrega, format(as.Date(46331, origin = "1899-12-30")))
  expect_length(g$unidades, length(.mta_unidades(.mcamp_territorial_envio(session_get(sid), "field"))))
  expect_false(grepl("40000001", jsonlite::toJSON(g, auto_unbox = TRUE)))
  # El Excel nace con «Pendiente» en cada fila: todas las UMP traen algo declarado.
  expect_identical(g$declaradas, length(g$unidades))
  # El selector de la app guarda sin `estados`: lo declarado se conserva.
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T2, codigo = "P844")))
  expect_identical(collection_territorial_estado_get(sid)$declaradas, g$declaradas)
  # Con la muestra cambiada, el GET lo dice para que Monitoreo no compare.
  s <- session_get(sid); s$hojas_ruta_runs$field$workspace_outputs$sample <- .hre_sample(viviendas = 7L); .session_env[[sid]] <- s
  expect_true(collection_territorial_estado_get(sid)$stale)
})

test_that("HTTP: GET del estado declarado", {
  sid <- .mte_sesion(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  g <- .hre_call(pr, sid, "GET", "/api/recopiladores/campaigns/territorial/asignacion/estado", query = "id=territorial.principal")
  expect_identical(g$status, 200L)
  expect_identical(g$body$declaradas, 0L)
  expect_true(length(g$body$unidades) > 0L)
})
