# ADR 0133 §1 — los cuatro campos del registro llegan en la respuesta.
#
# El front lee `guardado_en`, `aviso_guardado`, `modulo` y `rotulo` del archivo
# principal: en la raíz de la respuesta (una base) o en `zip` (multibase). Un
# NULL tiene que salir como `null` y no como `{}`, que es lo que hace el
# serializador de la API con un NULL dentro de una lista.

.rs_json <- function(x) {
  as.character(jsonlite::toJSON(x, auto_unbox = TRUE, na = "null", null = "list"))
}

.rs_sesion <- function(bases = character(), con_proyecto = TRUE, envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  if (con_proyecto) {
    dir <- withr::local_tempdir(.local_envir = envir)
    pulso <- file.path(dir, "estudio.pulso")
    writeBin(as.raw(0), pulso)
    s <- session_get(sid)
    s$project_path <- pulso
    .session_env[[sid]] <- s
  }
  .planner_declarar(sid, "estudio", list(nombre = "Estudio", codigo = "HSVG2026"), 0L)
  for (b in bases) {
    estudio_add_base(sid, b, xlsform_file_id = paste0("x-", b), data_file_id = paste0("d-", b),
                     data_ext = "xlsx", rp_data = data.frame(a = 1), rp_inst = NULL)
  }
  sid
}

test_that("entregable_respuesta agrega los cuatro campos y un NULL sale como null", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  sid <- .rs_sesion(con_proyecto = FALSE)
  path <- file.path(session_get(sid)$dir, "downloads", "salida.xlsx")
  writeLines("x", path)
  meta <- .register_output_file(sid, "frecuencias", path)
  expect_null(meta$guardado_en)

  resp <- entregable_respuesta(list(ok = TRUE, file_id = meta$file_id), meta)
  expect_identical(resp$modulo, "Procesamiento")
  expect_identical(resp$rotulo, "Frecuencias")
  json <- .rs_json(resp)
  expect_match(json, '"guardado_en":null', fixed = TRUE)
  expect_match(json, '"aviso_guardado":null', fixed = TRUE)
  expect_false(grepl("{}", json, fixed = TRUE))
})

test_that("una base: la respuesta de run_report_multibase trae la copia en la raíz", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  sid <- .rs_sesion(bases = "docentes")
  r <- run_report_multibase(sid, "frecuencias", "xlsx", "frecuencias", "frecuencias_zip",
                            function(d, i, out) writeLines("una", out))
  expect_identical(r$n_bases, 1L)
  expect_identical(r$modulo, "Procesamiento")
  expect_identical(r$rotulo, "Frecuencias")
  expect_true(file.exists(r$guardado_en))
  expect_match(r$guardado_en, "Entregables[/\\\\]Procesamiento[/\\\\]HSVG2026_Frecuencias_")
  expect_true(is.na(r$aviso_guardado))
  expect_match(.rs_json(r), '"aviso_guardado":null', fixed = TRUE)
})

test_that("multibase: el zip trae su copia y su rótulo; cada base, la suya", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  sid <- .rs_sesion(bases = c("docentes", "estudiantes"))
  r_csv <- run_report_multibase(sid, "datos", "csv", "bases_csv", "bases_csv_zip",
                                function(d, i, out) writeLines("csv", out))
  r_xlsx <- run_report_multibase(sid, "datos", "xlsx", "bases_xlsx", "bases_xlsx_zip",
                                 function(d, i, out) writeLines("xlsx", out))
  expect_identical(r_csv$zip$rotulo, "Datos CSV por base")
  expect_identical(r_xlsx$zip$rotulo, "Datos Excel por base")
  # El ZIP se nombra por su kind: el de CSV y el de Excel ya no comparten nombre.
  expect_match(r_csv$zip$filename, "^HSVG2026_Datos_CSV_por_base_")
  expect_match(r_xlsx$zip$filename, "^HSVG2026_Datos_Excel_por_base_")
  expect_true(file.exists(r_csv$zip$guardado_en))
  expect_true(file.exists(r_xlsx$zip$guardado_en))
  expect_false(grepl("_2\\.zip$", r_xlsx$zip$guardado_en))
  # Cada base se registra y se sirve, pero no se copia: lo que se entrega es el ZIP.
  for (b in r_csv$bases) {
    expect_identical(b$rotulo, "Datos")
    expect_true(is.na(b$guardado_en))
    expect_true(is.na(b$aviso_guardado))
    expect_false(is.null(session_get(sid)$files[[b$file_id]]))
  }
  expect_match(.rs_json(r_csv$bases[[1]][setdiff(names(r_csv$bases[[1]]), "path")]),
               '"guardado_en":null', fixed = TRUE)
})

test_that("multibase: en disco sólo queda el ZIP en Entregables/Procesamiento", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  sid <- .rs_sesion(bases = c("docentes", "estudiantes"))
  r <- run_report_multibase(sid, "frecuencias", "xlsx", "frecuencias", "frecuencias_zip",
                            function(d, i, out) writeLines("x", out))
  expect_false(is.na(r$zip$guardado_en))
  expect_true(all(vapply(r$bases, function(b) is.na(b$guardado_en), logical(1))))
  carpeta <- file.path(dirname(session_get(sid)$project_path), "Entregables")
  en_disco <- list.files(carpeta, recursive = TRUE)
  expect_identical(en_disco, file.path("Procesamiento", basename(r$zip$guardado_en)))
  expect_match(en_disco, "\\.zip$")
})

test_that("una base: el archivo de esa base sí se copia", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  sid <- .rs_sesion(bases = "docentes")
  r <- run_report_multibase(sid, "frecuencias", "xlsx", "frecuencias", "frecuencias_zip",
                            function(d, i, out) writeLines("x", out))
  expect_null(r$zip)
  expect_true(file.exists(r$bases[[1]]$guardado_en))
  expect_identical(r$guardado_en, r$bases[[1]]$guardado_en)
})

test_that("informe consolidado: la respuesta trae guardado_en y en disco hay una sola copia", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  sid <- .rs_sesion()
  ppt <- file.path(session_get(sid)$dir, "downloads",
                   paste0(uuid::UUIDgenerate(), "__HSVG2026_Informe_consolidado_07_11_26.pptx"))
  writeLines("mazo", ppt)
  r <- .graficos_consolidado_register_artifacts(sid, ppt, list(n_slides = 3L))
  expect_identical(r$rotulo, "Informe consolidado")
  expect_identical(r$modulo, "Procesamiento")
  expect_false(is.na(r$guardado_en))
  expect_true(file.exists(r$guardado_en))
  expect_true(is.na(r$aviso_guardado))
  # El manifiesto se registra pero no se copia: en Entregables queda sólo el PPT.
  carpeta <- file.path(dirname(session_get(sid)$project_path), "Entregables")
  expect_identical(list.files(carpeta, recursive = TRUE),
                   file.path("Procesamiento", basename(r$guardado_en)))
  expect_match(.rs_json(r), '"aviso_guardado":null', fixed = TRUE)
})

test_that("sólo se copia lo que el usuario pidió descargar (regla del lead)", {
  cat <- entregables_catalogo()
  guardar <- function(k) cat$guardar[cat$kind == k]
  for (k in c("monitoreo_ocurrencias_xlsform", "monitoreo_processing_handoff_data",
              "monitoreo_processing_handoff_xlsform")) {
    expect_identical(guardar(k), FALSE, info = k)
  }
  # Fase 5, oleada 3: la UI ya ofrece los tres archivos del cierre de limpieza.
  for (k in c("validacion_limpieza_base_limpia", "validacion_limpieza_html", "validacion_limpieza_excel")) {
    expect_identical(guardar(k), TRUE, info = k)
  }
  expect_identical(guardar("monitoreo_processing_handoff_zip"), TRUE)
  expect_identical(guardar("graficos_ppt_consolidado"), TRUE)
})
