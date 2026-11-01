# Publicar un dashboard sube SÓLO lo que el artefacto público lee (ADR 0122 §9).
#
# Lo que fija este archivo, con datos personales sembrados en cada clave que
# antes viajaba al Space público:
# - el .pulso publicado no contiene ninguno, ni en state.rds ni en files/;
# - el gate de datos personales (pulso_detectar_pii) los ve en la publicación
#   vieja (el .pulso entero) y no en la nueva;
# - el dashboard publicado responde IGUAL que antes: mismas respuestas en sus
#   endpoints públicos.

source("setup-load-all.R")

.dpp_pulso_ref <- function() {
  ruta <- system.file("reference_projects", "acnur_pdm", "acnur_pdm.pulso", package = "prosecnurapp")
  if (!nzchar(ruta)) ruta <- testthat::test_path("..", "..", "inst", "reference_projects", "acnur_pdm", "acnur_pdm.pulso")
  testthat::skip_if_not(file.exists(ruta), "sin el proyecto de referencia acnur_pdm")
  ruta
}

# Valores que no pueden salir: forma real de DNI, celular y correo.
.DPP_SEMBRADOS <- c("Nombre Sembrado Uno", "Aplicadora Sembrada Dos", "Persona Sembrada Tres",
                    "45678912", "987654321", "persona.sembrada@correo.pe")

.dpp_proyecto <- function(dir, envir = parent.frame()) {
  copia <- file.path(dir, "base.pulso")
  file.copy(.dpp_pulso_ref(), copia)
  Sys.chmod(copia, "644")
  ld <- suppressMessages(load_pulso(copia))
  sid <- ld$session_id
  withr::defer(session_delete(sid), envir = envir)
  # Una fuente de dashboard real, de los archivos del propio proyecto.
  invisible(.dashboard_import_source(sid, list(
    xlsform_file_id = "8f166bcd-01f1-4c73-a70c-6ccba88b1795",
    data_file_id = "2a1c6390-b530-428e-b1ce-eff82b32e48a")))

  # Datos personales en cada clave que antes viajaba entera.
  s <- session_get(sid)
  s$monitoreo_config$territorial$enumerator_roster <- list(code_format = "PXXX", assignments = list(
    list(codigo_pulso = "P900", nombre = "Nombre Sembrado Uno", dni = "45678912")))
  s$monitoreo_aulas_disponibilidad <- list(list(nombre = "Aplicadora Sembrada Dos", dias = list()))
  s$material_territorial_asignacion <- list(schema = "material_territorial_asignacion/v1",
                                            asignaciones = list(list(id_manzana = "M1", codigo = "P900", nota = "Persona Sembrada Tres")))
  s$codif_por_base <- list(base = list(grupos_recod = list(), respuestas = list("987654321", "persona.sembrada@correo.pe")))
  # Un archivo en files/ que el dashboard no lee: la lista del equipo en Excel.
  roster <- file.path(dir, "equipo.xlsx")
  openxlsx::write.xlsx(data.frame(nombre = "Nombre Sembrado Uno", dni = "45678912", celular = "987654321"), roster)
  s$files[["f-equipo"]] <- list(file_id = "f-equipo", kind = "enumerator_roster", original_name = "equipo.xlsx",
                                path = roster, size = file.size(roster), ext = "xlsx", uploaded_at = "2026-10-31T00:00:00Z")
  .session_env[[sid]] <- s
  .planner_declarar(sid, "estudio", list(nombre = "PDM de prueba"), 0L)
  .planner_declarar(sid, "equipo", list(personas = list(list(codigo = "P900", nombre = "Nombre Sembrado Uno"))), 1L)
  sid
}

.dpp_call <- function(pr, sid, method, path, body = "") {
  raw_body <- charToRaw(enc2utf8(body))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  req <- as.environment(list(REQUEST_METHOD = method, PATH_INFO = path, QUERY_STRING = "",
    CONTENT_TYPE = "application/json", HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
    rook.input = input))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = as.character(r$body))
}

# Lo que cambia entre dos sesiones sin cambiar el dashboard (ids, horas, rutas).
.dpp_limpia <- function(x) {
  gsub('"(session_id|sid|generated_at|loaded_at|project_file|path|saved_at|project_dir)":"[^"]*"', "", x)
}

test_that("el .pulso publicado no trae ningún dato personal sembrado y sólo los archivos del dashboard", {
  dir <- withr::local_tempdir()
  sid <- .dpp_proyecto(dir)
  publicado <- .dashboard_publish_snapshot(sid, "publicado")$path

  stage <- withr::local_tempdir()
  zip::unzip(publicado, exdir = stage)
  estado <- readRDS(file.path(stage, "state.rds"))
  texto <- paste(capture.output(str(estado, list.len = 10000L, nchar.max = 10000L, vec.len = 10000L)), collapse = "\n")
  for (v in .DPP_SEMBRADOS) expect_false(grepl(v, texto, fixed = TRUE), info = v)
  expect_null(estado$monitoreo_config)
  expect_null(estado$monitoreo_aulas_disponibilidad)
  expect_null(estado$material_territorial_asignacion)
  expect_null(estado$planner$equipo)
  expect_equal(estado$planner$estudio$nombre, "PDM de prueba")
  expect_equal(names(estado$codif_por_base$base), "grupos_recod")

  archivos <- list.files(file.path(stage, "files"))
  expect_setequal(sub("__.*$", "", archivos), c("8f166bcd-01f1-4c73-a70c-6ccba88b1795", "2a1c6390-b530-428e-b1ce-eff82b32e48a"))
})

test_that("el gate de datos personales ve lo sembrado en la publicación vieja y nada en la nueva", {
  dir <- withr::local_tempdir()
  sid <- .dpp_proyecto(dir)
  viejo <- file.path(dir, "viejo.pulso")   # lo que antes subía: el .pulso entero
  build_pulso(sid, viejo, project_name = "viejo", allow_empty_overwrite = TRUE)
  nuevo <- .dashboard_publish_snapshot(sid, "nuevo")$path
  expect_gt(nrow(pulso_detectar_pii(viejo)), 0L)
  expect_equal(nrow(pulso_detectar_pii(nuevo)), 0L)
})

test_that("el dashboard publicado responde igual que con el .pulso entero", {
  testthat::skip_if_not_installed("plumber")
  dir <- withr::local_tempdir()
  sid <- .dpp_proyecto(dir)
  viejo <- file.path(dir, "viejo.pulso")
  build_pulso(sid, viejo, project_name = "viejo", allow_empty_overwrite = TRUE)
  nuevo <- .dashboard_publish_snapshot(sid, "nuevo")$path
  sid_viejo <- suppressMessages(load_pulso(viejo))$session_id
  sid_nuevo <- suppressMessages(load_pulso(nuevo))$session_id
  withr::defer({ session_delete(sid_viejo); session_delete(sid_nuevo) })

  pr <- mount_dashboard(mount_sistema(plumber::pr() |> plumber::pr_set_serializer(.api_serializer())))
  llamadas <- list(
    c("GET", "/api/dashboard/manifest", ""), c("GET", "/api/dashboard/secciones", ""),
    c("GET", "/api/dashboard/config", ""), c("GET", "/api/dashboard/all-vars", ""),
    c("GET", "/api/dashboard/recod-vars", ""), c("GET", "/api/dashboard/curacion", ""),
    c("GET", "/api/dashboard/base-datos", ""), c("GET", "/api/public/artifact", ""),
    c("POST", "/api/dashboard/resumen/kpis", "{}"),
    c("POST", "/api/dashboard/resumen/seccion", '{"seccion":"Detalles de la entrevista"}'),
    c("POST", "/api/dashboard/categorias-var", '{"var":"Consent"}'),
    c("POST", "/api/dashboard/base-datos/data", '{"page":1,"page_size":20}')
  )
  for (l in llamadas) {
    a <- .dpp_call(pr, sid_viejo, l[[1]], l[[2]], l[[3]])
    b <- .dpp_call(pr, sid_nuevo, l[[1]], l[[2]], l[[3]])
    expect_equal(a$status, 200L, info = l[[2]])
    expect_identical(.dpp_limpia(b$body), .dpp_limpia(a$body), info = l[[2]])
  }
  # La fuente es la misma; lo único que cambia es que ya no ofrece como
  # candidatos los otros archivos de la sesión, que no viajan.
  fuente <- function(sid) jsonlite::fromJSON(.dpp_call(pr, sid, "GET", "/api/dashboard/source")$body)$payload$source
  expect_identical(fuente(sid_nuevo)[c("xlsform_file_id", "data_file_id", "n_filas", "n_columnas")],
                   fuente(sid_viejo)[c("xlsform_file_id", "data_file_id", "n_filas", "n_columnas")])
})

test_that("publicar no toca la sesión de quien publica", {
  dir <- withr::local_tempdir()
  sid <- .dpp_proyecto(dir)
  antes <- session_get(sid)
  .dashboard_publish_snapshot(sid, "publicado")
  despues <- session_get(sid)
  expect_identical(despues$monitoreo_config, antes$monitoreo_config)
  expect_identical(despues$planner, antes$planner)
  expect_identical(names(despues$files), names(antes$files))
})
