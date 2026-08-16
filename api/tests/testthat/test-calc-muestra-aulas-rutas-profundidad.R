# La hoja operativa exporta la cadena entera, no sus primeros seis eslabones.
#
# Medido sobre la seleccion del proyecto de referencia: 30 titulares y 330
# reservas encadenadas, exactamente 11 por titular. La hoja «Rutas operativas
# aulas» exportaba 6 porque `.cm_aulas_operational_routes_sheet` tenia
# `max_depth = 6L` y su unico llamador nunca se lo pasaba. Es la hoja que viaja
# a campo: el equipo recibia una ruta mas corta que la planificada.

seleccion_con_reservas <- function(n_titulares, reservas_por_titular) {
  titulares <- do.call(rbind, lapply(seq_len(n_titulares), function(i) {
    data.frame(
      classroom_id = paste0("CH-", i), selection_slot_id = paste0("slot-", i),
      replacement_for = "", sample_role = "titular", wave = "M1",
      course_name = paste0("Titular ", i), faculty = "Ciencias",
      stratum = "Ciencias", program = "Fisica", operational_code = paste0("CH ", i),
      stringsAsFactors = FALSE
    )
  }))
  reservas <- do.call(rbind, lapply(seq_len(n_titulares), function(i) {
    do.call(rbind, lapply(seq_len(reservas_por_titular), function(j) {
      data.frame(
        classroom_id = paste0("R-", i, "-", j), selection_slot_id = paste0("slot-", i),
        replacement_for = paste0("CH-", i), sample_role = "chain_reserve",
        wave = paste0("M", j + 1L), course_name = paste0("Reemplazo ", i, ".", j),
        faculty = "Ciencias", stratum = "Ciencias", program = "Fisica",
        operational_code = paste0("R ", i, ".", j), stringsAsFactors = FALSE
      )
    }))
  }))
  list(selection = rbind(titulares, reservas))
}

test_that("la hoja operativa lleva los once reemplazos que el motor encadeno", {
  hoja <- .cm_aulas_operational_routes_sheet(seleccion_con_reservas(3L, 11L))
  expect_gt(nrow(hoja), 0L)
  columnas_reemplazo <- grep("^m[0-9]+_operational_code$", names(hoja), value = TRUE)
  # El defecto: con el tope en 6 la hoja solo traia seis bloques de reemplazo.
  expect_equal(length(columnas_reemplazo), 11L)
})

test_that("una cadena mas corta no infla la hoja", {
  # Control: la profundidad sigue al dato, no a una constante nueva.
  hoja <- .cm_aulas_operational_routes_sheet(seleccion_con_reservas(3L, 3L))
  columnas_reemplazo <- grep("^m[0-9]+_operational_code$", names(hoja), value = TRUE)
  expect_equal(length(columnas_reemplazo), 3L)
})

test_that("una profundidad pedida explicitamente sigue mandando", {
  hoja <- .cm_aulas_operational_routes_sheet(seleccion_con_reservas(3L, 11L), max_depth = 4L)
  columnas_reemplazo <- grep("^m[0-9]+_operational_code$", names(hoja), value = TRUE)
  expect_equal(length(columnas_reemplazo), 4L)
})

test_that("el conteo de reservas por titular usa el titular mejor servido", {
  sel <- seleccion_con_reservas(2L, 5L)
  reservas <- sel$selection[sel$selection$sample_role == "chain_reserve", , drop = FALSE]
  expect_equal(.cm_aulas_reservas_por_titular(reservas), 5L)
})

test_that("sin reservas con que contar cae en seis, no en cero", {
  expect_equal(.cm_aulas_reservas_por_titular(NULL), 6L)
  expect_equal(.cm_aulas_reservas_por_titular(data.frame(stringsAsFactors = FALSE)), 6L)
  # Una columna presente pero vacia no agrupa nada.
  vacia <- data.frame(replacement_for = c("", ""), stringsAsFactors = FALSE)
  expect_equal(.cm_aulas_reservas_por_titular(vacia), 6L)
})

test_that("el techo absoluto de doce olas se respeta", {
  hoja <- .cm_aulas_operational_routes_sheet(seleccion_con_reservas(2L, 20L))
  columnas_reemplazo <- grep("^m[0-9]+_operational_code$", names(hoja), value = TRUE)
  expect_equal(length(columnas_reemplazo), 12L)
})
