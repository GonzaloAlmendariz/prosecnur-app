# Entradas de bitácora: revisiones, cupo, archivado y export (ADR 0047).
#
# La promesa que fija este archivo: la bitácora es un REGISTRO. Editar conserva
# lo anterior, archivar no destruye, y el archivo exportado dice exactamente lo
# que la vista muestra.

.bitent_sid <- function() {
  sid <- session_create()
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  sid
}

# Reemplazo campo a campo y NO `modifyList`: éste recursa dentro de las listas
# anidadas y, como `tags` es una lista SIN nombres, no puede sustituirla — el
# parche quedaba ignorado en silencio.
.bitent_entrada <- function(patch = list()) {
  base <- list(
    id = "e1", module_id = "monitoreo", tone = "riesgo",
    title = "Cuota de Ate en rojo", body = "Faltan 40 encuestas.",
    occurred_at = "2026-03-10T09:00:00Z", created_at = "2026-03-10T09:00:00Z",
    updated_at = "", tags = list("campo"), revisions = list(), archived_at = "", links = list()
  )
  for (campo in names(patch)) base[[campo]] <- patch[[campo]]
  base
}

# --- Revisiones --------------------------------------------------------------

test_that("editar una entrada conserva lo que decía antes", {
  previa <- .bitent_entrada()
  siguiente <- .bitent_entrada(list(body = "Faltan 12 encuestas."))

  out <- .bit_entrada_revisar(previa, siguiente)
  expect_equal(length(out$revisions), 1L)
  expect_equal(out$revisions[[1]]$body, "Faltan 40 encuestas.")
  expect_equal(out$body, "Faltan 12 encuestas.")
})

test_that("reguardar sin cambios no infla el historial", {
  previa <- .bitent_entrada()
  out <- .bit_entrada_revisar(previa, .bitent_entrada())
  expect_equal(length(out$revisions %||% list()), 0L)
})

test_that("cambiar el tono o el módulo también cuenta como revisión", {
  previa <- .bitent_entrada()
  expect_equal(length(.bit_entrada_revisar(previa, .bitent_entrada(list(tone = "bloqueo")))$revisions), 1L)
  expect_equal(length(.bit_entrada_revisar(previa, .bitent_entrada(list(module_id = "carga")))$revisions), 1L)
})

test_that("el historial se acumula y se acota", {
  entrada <- .bitent_entrada()
  for (i in 1:15) {
    siguiente <- entrada; siguiente$body <- paste("v", i)
    entrada <- .bit_entrada_revisar(entrada, siguiente)
  }
  expect_equal(length(entrada$revisions), BITACORA_MAX_REVISIONES)
  # La más reciente primero.
  expect_equal(entrada$revisions[[1]]$body, "v 14")
})

# --- Cupo --------------------------------------------------------------------

test_that("las archivadas no expulsan entradas vivas", {
  # El defecto que este test impide: con un cupo único de 200, archivar 200
  # entradas viejas dejaría fuera a las activas.
  vivas <- lapply(1:10, function(i) .bitent_entrada(list(
    id = paste0("viva", i), occurred_at = sprintf("2026-03-%02dT09:00:00Z", i)
  )))
  archivadas <- lapply(1:300, function(i) .bitent_entrada(list(
    id = paste0("arch", i), archived_at = "2026-04-01T00:00:00Z",
    occurred_at = sprintf("2026-01-%02dT09:00:00Z", (i %% 28L) + 1L)
  )))

  out <- .bit_entradas_cap(c(vivas, archivadas))
  ids <- vapply(out, function(e) e$id, character(1))

  expect_true(all(vapply(vivas, function(e) e$id, character(1)) %in% ids))
  expect_equal(sum(grepl("^arch", ids)), BITACORA_MAX_ENTRADAS_ARCHIVADAS)
})

test_that("el cupo de vivas recorta las más antiguas", {
  vivas <- lapply(1:(BITACORA_MAX_ENTRADAS_VIVAS + 5L), function(i) .bitent_entrada(list(
    id = paste0("v", i), occurred_at = sprintf("2026-03-10T%02d:00:00Z", i %% 24L)
  )))
  out <- .bit_entradas_cap(vivas)
  expect_equal(length(out), BITACORA_MAX_ENTRADAS_VIVAS)
})

# --- Archivar y purgar -------------------------------------------------------

test_that("archivar marca sin destruir y se puede revertir", {
  entradas <- list(.bitent_entrada())
  archivadas <- .bit_entrada_archivar(entradas, "e1")
  expect_equal(length(archivadas), 1L)
  expect_true(nzchar(archivadas[[1]]$archived_at))

  restauradas <- .bit_entrada_archivar(archivadas, "e1", archivar = FALSE)
  expect_equal(restauradas[[1]]$archived_at, "")
})

test_that("purgar borra de verdad", {
  entradas <- list(.bitent_entrada(), .bitent_entrada(list(id = "e2")))
  out <- .bit_entrada_purgar(entradas, "e1")
  expect_equal(length(out), 1L)
  expect_equal(out[[1]]$id, "e2")
})

test_that("operar sobre una entrada inexistente da un error accionable", {
  err <- tryCatch(.bit_entrada_archivar(list(), "fantasma"), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BITACORA_ENTRADA_NO_EXISTE")
  expect_equal(err$status, 404)
})

# --- Filtros -----------------------------------------------------------------

test_that("por defecto las archivadas no aparecen", {
  entradas <- list(.bitent_entrada(), .bitent_entrada(list(id = "e2", archived_at = "2026-04-01T00:00:00Z")))
  expect_equal(length(.bit_entradas_filtrar(entradas, list())), 1L)
  expect_equal(length(.bit_entradas_filtrar(entradas, list(mostrar_archivadas = TRUE))), 2L)
})

test_that("filtra por tono, módulo y etiqueta", {
  entradas <- list(
    .bitent_entrada(list(id = "a", tone = "riesgo", module_id = "monitoreo", tags = list("campo"))),
    .bitent_entrada(list(id = "b", tone = "avance", module_id = "carga", tags = list("datos")))
  )
  expect_equal(length(.bit_entradas_filtrar(entradas, list(tonos = list("riesgo")))), 1L)
  expect_equal(length(.bit_entradas_filtrar(entradas, list(modulos = list("carga")))), 1L)
  expect_equal(length(.bit_entradas_filtrar(entradas, list(etiquetas = list("campo")))), 1L)
})

test_that("la búsqueda ignora mayúsculas y acentos", {
  # Buscar "validacion" tiene que encontrar "Validación": si no, el usuario
  # concluye que la entrada no existe.
  entradas <- list(.bitent_entrada(list(title = "Revisión de Validación", body = "")))
  expect_equal(length(.bit_entradas_filtrar(entradas, list(texto = "validacion"))), 1L)
  expect_equal(length(.bit_entradas_filtrar(entradas, list(texto = "VALIDACIÓN"))), 1L)
  expect_equal(length(.bit_entradas_filtrar(entradas, list(texto = "codificacion"))), 0L)
})

test_that("la búsqueda mira el cuerpo, no solo el título", {
  entradas <- list(.bitent_entrada(list(title = "Nota", body = "Se cayó el enlace de Kobo")))
  expect_equal(length(.bit_entradas_filtrar(entradas, list(texto = "kobo"))), 1L)
})

test_that("el rango de fechas acota por día", {
  entradas <- list(
    .bitent_entrada(list(id = "a", occurred_at = "2026-03-05T09:00:00Z")),
    .bitent_entrada(list(id = "b", occurred_at = "2026-03-15T09:00:00Z"))
  )
  expect_equal(length(.bit_entradas_filtrar(entradas, list(desde = "2026-03-10"))), 1L)
  expect_equal(length(.bit_entradas_filtrar(entradas, list(hasta = "2026-03-10"))), 1L)
  expect_equal(length(.bit_entradas_filtrar(entradas, list(desde = "2026-03-01", hasta = "2026-03-31"))), 2L)
})

# --- Export ------------------------------------------------------------------

test_that("el markdown agrupa por día y conserva el contenido", {
  entradas <- list(
    .bitent_entrada(list(id = "a", title = "Cuota en rojo", occurred_at = "2026-03-10T09:00:00Z")),
    .bitent_entrada(list(id = "b", title = "Se destrabó", occurred_at = "2026-03-11T09:00:00Z"))
  )
  md <- .bit_entradas_markdown(entradas)
  expect_match(md, "## 2026-03-11")
  expect_match(md, "## 2026-03-10")
  expect_match(md, "### Se destrabó")
  expect_match(md, "Faltan 40 encuestas")
  # Más reciente primero, igual que la vista.
  expect_lt(regexpr("2026-03-11", md, fixed = TRUE), regexpr("2026-03-10", md, fixed = TRUE))
})

test_that("el export dice cuántas veces se editó cada entrada", {
  entrada <- .bit_entrada_revisar(.bitent_entrada(), .bitent_entrada(list(body = "otra cosa")))
  md <- .bit_entradas_markdown(list(entrada))
  expect_match(md, "Editada 1 vez")
})

test_that("exportar un filtro vacío lo dice en vez de entregar un archivo mudo", {
  md <- .bit_entradas_markdown(list())
  expect_match(md, "Sin entradas en el rango")
})

test_that("el export contiene exactamente lo filtrado", {
  # Criterio de aceptación del spec: filtrar, exportar, y que el archivo tenga
  # lo filtrado y nada más.
  entradas <- list(
    .bitent_entrada(list(id = "a", title = "Riesgo de cuota", tone = "riesgo")),
    .bitent_entrada(list(id = "b", title = "Avance del campo", tone = "avance"))
  )
  filtradas <- .bit_entradas_filtrar(entradas, list(tonos = list("riesgo")))
  md <- .bit_entradas_markdown(filtradas)
  expect_match(md, "Riesgo de cuota", fixed = TRUE)
  expect_false(grepl("Avance del campo", md, fixed = TRUE))
})

# --- Integración con el router ----------------------------------------------

test_that("editar por el endpoint deja historial y conserva el archivado", {
  sid <- .bitent_sid(); on.exit(session_delete(sid), add = TRUE)

  .diseno_bitacora_upsert(sid, list(id = "e1", title = "Original", body = "Cuerpo 1", tone = "nota"))
  entradas <- .diseno_bitacora_entries(session_get(sid))
  expect_equal(length(entradas[[1]]$revisions), 0L)

  .diseno_bitacora_upsert(sid, list(id = "e1", title = "Original", body = "Cuerpo 2", tone = "nota"))
  entradas <- .diseno_bitacora_entries(session_get(sid))
  expect_equal(length(entradas[[1]]$revisions), 1L)
  expect_equal(entradas[[1]]$revisions[[1]]$body, "Cuerpo 1")
  expect_equal(entradas[[1]]$body, "Cuerpo 2")
})

test_that("editar una entrada archivada no la desarchiva sola", {
  sid <- .bitent_sid(); on.exit(session_delete(sid), add = TRUE)
  .diseno_bitacora_upsert(sid, list(id = "e1", title = "T", body = "B"))
  .diseno_bitacora_save(sid, .bit_entrada_archivar(.diseno_bitacora_entries(session_get(sid)), "e1"))

  .diseno_bitacora_upsert(sid, list(id = "e1", title = "T", body = "B2"))
  entradas <- .diseno_bitacora_entries(session_get(sid))
  expect_true(nzchar(entradas[[1]]$archived_at))
})
