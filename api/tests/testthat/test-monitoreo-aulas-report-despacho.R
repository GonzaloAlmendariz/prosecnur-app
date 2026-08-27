# =============================================================================
# El despacho del reporte a cliente reconoce a aulas sin capturar a los demás
# =============================================================================
#
# Aulas gana su propio PDF de avance (2026-08-27), junto a territorial y
# telefónico. Antes caía al `else` de acreditación, que NO es un genérico: su
# modelo y su renderizador hablan de `actors`, `daily_actor` y `channel_labels`.
#
# Una rama nueva en un despacho tiene DOS formas de fallar y las dos importan:
# que no reconozca lo suyo, y que se lleve lo ajeno. Esto fija las dos.

test_that("el modelo de aulas se elige por la familia y trae su report_kind", {
  plan <- list(list(
    classroom_id = "A1", operational_code = "CH 1", faculty = "FAC1",
    label = "Aula A1", sample_role = "titular", wave = "M1",
    eligible_n = 30, expected_valid = 15, operational_status = "aplicada"
  ))
  cfg <- list(
    monitoreo_profile = list(family = "aulas_universitarias", status = "active"),
    aulas_universitarias = list(
      enabled = TRUE, plan = plan,
      source_mapping = list(collector_var = "collectorID"),
      design_targets = list(
        schema = "monitoreo_aulas_design_targets_v1",
        facultades = list(list(
          facultad = "FAC1", faculty_key = .cm_criterios_fac_key("FAC1"),
          cuota = 20, cuota_sexo = list(F = 11, M = 9), tau = 0.5))
      )
    )
  )
  snap <- list(data = data.frame(collectorID = rep("A1", 8),
                                 sexo = rep(c("Femenino", "Masculino"), 4),
                                 stringsAsFactors = FALSE),
               synced_at = "2026-08-27T10:00:00Z")
  m <- .monitoreo_client_report_model_for_snapshot(snap, cfg)
  expect_identical(m$report_kind, "aulas_advance_pdf")
  expect_identical(m$family, "aulas_universitarias")
  # Y NO trae la forma de acreditación: si la trajera, el renderizador de
  # aquella lo dibujaría llamando «actores» a las facultades.
  expect_null(m$actors)
  expect_true(is.data.frame(m$facultades))
})

test_that("la rama de aulas NO se lleva un perfil de acreditación", {
  # La otra mitad del riesgo: una rama nueva que captura de más rompe dos
  # perfiles que funcionaban.
  data <- data.frame(
    actor = c("Docentes", "Docentes", "Estudiantes"),
    estado = c("completa", "completa", "completa"),
    stringsAsFactors = FALSE
  )
  cfg <- list(monitoreo_profile = list(family = "acreditacion", status = "active"))
  m <- tryCatch(
    .monitoreo_client_report_model_for_snapshot(list(data = data, synced_at = ""), cfg),
    error = function(e) NULL
  )
  # Sea cual sea su contenido, lo que NO puede es venir marcado como de aulas.
  if (!is.null(m)) expect_false(identical(m$report_kind, "aulas_advance_pdf"))
})

test_that("el renderizador de aulas se elige por report_kind y por familia", {
  # El runner ramifica por las dos, igual que territorial y telefónico: un
  # modelo viejo sin `report_kind` todavía se reconoce por su familia.
  fuente <- readLines("../../R/router_monitoreo.R", warn = FALSE)
  runner <- paste(fuente, collapse = "\n")
  expect_match(runner, 'identical\\(report_kind, "aulas_advance_pdf"\\)')
  expect_match(runner, 'identical\\(family, "aulas_universitarias"\\)')
  expect_match(runner, "monitoreo_aulas_advance_report_pdf\\(model, result_path")
  # Y el documento sale con su propio nombre, no con el genérico.
  expect_match(runner, '"avance_aulas_monitoreo"')
  expect_match(runner, '"monitoreo\\.aulas_advance_pdf"')
})
