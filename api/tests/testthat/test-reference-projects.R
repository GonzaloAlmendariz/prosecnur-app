test_that("el catalogo de proyectos de referencia cubre las cuatro familias", {
  catalog <- reference_project_catalog()
  # `acrconta_mazo` es el segundo de la familia acreditacion y no la duplica:
  # aquel cubre monitoreo multiactor con Sheets, este el plan de mazo aprobado.
  expect_equal(catalog$slug,
               c("acnur_pdm", "acnur_acg", "hsvg2026", "acrconta", "acrconta_mazo"))
  expect_equal(catalog$family,
               c("telefonico", "territorial", "muestral", "acreditacion", "acreditacion"))
  expect_true(all(catalog$canonical_order == seq_len(nrow(catalog))))
  # Cada fixture debe justificar su existencia: si no aporta algo que otro no
  # cubra, no vale el peso que ocupa en el repo.
  expect_true(all(nzchar(catalog$aporta)))
  expect_equal(length(unique(catalog$aporta)), nrow(catalog))
})

test_that("cada proyecto de referencia declara un origen resoluble", {
  for (slug in reference_project_catalog()$slug) {
    meta <- .reference_project_meta(slug)
    expect_true(nzchar(meta$origen), info = slug)
    # La ruta se resuelve contra el root configurable, nunca absoluta en código.
    expect_false(startsWith(meta$origen, "/"), info = slug)
    expect_match(meta$origen, "\\.pulso$", info = slug)
  }
})

test_that("PROSECNUR_REFERENCE_SOURCES manda sobre el root por defecto", {
  antes <- Sys.getenv("PROSECNUR_REFERENCE_SOURCES", NA_character_)
  on.exit({
    if (is.na(antes)) Sys.unsetenv("PROSECNUR_REFERENCE_SOURCES")
    else Sys.setenv(PROSECNUR_REFERENCE_SOURCES = antes)
  }, add = TRUE)

  Sys.setenv(PROSECNUR_REFERENCE_SOURCES = "/tmp/fuentes-prosecnur")
  expect_equal(reference_project_sources_root(), "/tmp/fuentes-prosecnur")
  expect_equal(
    reference_project_source_path("acnur_pdm"),
    "/tmp/fuentes-prosecnur/ACNUR PDM/ACNUR_PDM.pulso"
  )
})

test_that("el slug desconocido falla con mensaje util", {
  expect_error(.reference_project_meta("no_existe"), "no_existe")
})

test_that("reference_project_cobertura mide el state y no el manifest", {
  # Un state con monitoreo y hojas de ruta, sin bases ni analitica.
  s <- list(
    monitoreo_snapshot = list(data = data.frame(a = 1)),
    hojas_ruta_config = list(n_objetivo = 120),
    estudio = list(bases = list()),
    graficos_config = list(version = "graficos/4")
  )
  cob <- reference_project_cobertura(s)

  expect_true(cob[["monitoreo"]])
  expect_true(cob[["hojas_ruta"]])
  expect_true(cob[["graficos"]])
  expect_false(cob[["carga"]])
  expect_false(cob[["analitica"]])
  expect_false(cob[["codificacion"]])
  expect_setequal(names(cob), REFERENCE_PROJECT_MODULOS)
})

test_that("la cobertura de carga y validacion sale de las bases reales", {
  s <- list(
    estudio = list(bases = list(
      base_a = list(nombre = "base_a", validacion = list(plan_result = list(plan = 1))),
      base_b = list(nombre = "base_b")
    )),
    codif_por_base = list(base_a = list(), base_b = list())
  )
  cob <- reference_project_cobertura(s)
  expect_true(cob[["carga"]])
  expect_true(cob[["validacion"]])
  # codif_por_base con entradas VACIAS no cuenta como codificacion: el PDM real
  # tiene tres claves vacias y declararlo cubierto seria mentir sobre el fixture.
  expect_false(cob[["codificacion"]])

  s$codif_por_base$base_a <- list(familias_draft = list(x = 1))
  expect_true(reference_project_cobertura(s)[["codificacion"]])
})

test_that("cobertura funciona igual con un state que es environment", {
  env <- new.env(parent = emptyenv())
  assign("monitoreo_snapshot", list(data = data.frame(a = 1)), envir = env)
  assign("estudio", list(bases = list()), envir = env)
  cob <- reference_project_cobertura(env)
  expect_true(cob[["monitoreo"]])
  expect_false(cob[["carga"]])
})

test_that("las semillas sinteticas apuntan a slugs de referencia que existen", {
  # `audit_projects.R` declara de qué estudio real derivó cada semilla. Ese
  # puntero tiene que resolver, si no la trazabilidad entre el sintético y el
  # real es decorativa.
  slugs_referencia <- reference_project_catalog()$slug
  procedencia <- .audit_project_catalog_list()

  declarados <- Filter(Negate(is.null), lapply(procedencia, function(x) x$reduced_from))
  expect_gt(length(declarados), 0L)

  for (slug_sintetico in names(declarados)) {
    expect_true(
      declarados[[slug_sintetico]] %in% slugs_referencia,
      info = sprintf("la semilla '%s' deriva de '%s', que no esta en el catalogo de referencia",
                     slug_sintetico, declarados[[slug_sintetico]])
    )
  }
})

test_that("verify reporta el fixture ausente sin reventar", {
  # Se apunta la resolucion de ruta a un directorio vacio. No sirve manipular
  # PULSO_API_DIR: `reference_project_install_dir()` consulta primero
  # `system.file()`, que gana cuando el paquete esta cargado.
  vacio <- tempfile("sin-fixtures-"); dir.create(vacio, recursive = TRUE)
  testthat::local_mocked_bindings(
    reference_project_path = function(slug) file.path(vacio, slug, paste0(slug, ".pulso"))
  )
  res <- reference_project_verify("acnur_pdm")
  expect_false(res$ok)
  expect_match(paste(res$problemas, collapse = " "), "ausente")
})

test_that("build exige una sal estable", {
  antes <- Sys.getenv("PROSECNUR_ANON_SALT", NA_character_)
  on.exit({
    if (is.na(antes)) Sys.unsetenv("PROSECNUR_ANON_SALT")
    else Sys.setenv(PROSECNUR_ANON_SALT = antes)
  }, add = TRUE)
  Sys.unsetenv("PROSECNUR_ANON_SALT")

  origen <- tempfile(fileext = ".pulso")
  file.create(origen)
  expect_error(
    reference_project_build("acnur_pdm", origen = origen),
    "PROSECNUR_ANON_SALT"
  )
})

test_that("build produce fixture read-only, manifest y cobertura verificable", {
  sal_antes <- Sys.getenv("PROSECNUR_ANON_SALT", NA_character_)
  on.exit({
    if (is.na(sal_antes)) Sys.unsetenv("PROSECNUR_ANON_SALT")
    else Sys.setenv(PROSECNUR_ANON_SALT = sal_antes)
  }, add = TRUE)
  Sys.setenv(PROSECNUR_ANON_SALT = "sal-de-test")

  # .pulso de origen mínimo pero con PII y con dos módulos poblados.
  stage <- tempfile("orig-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  saveRDS(list(
    monitoreo_snapshot = list(data = data.frame(
      `Apellidos y nombres` = c("Rojas Vargas, Maria", "Quispe Huaman, Jose"),
      email = c("mrojas@pucp.edu.pe", "jquispe@pucp.edu.pe"),
      check.names = FALSE, stringsAsFactors = FALSE
    )),
    hojas_ruta_config = list(n_objetivo = 120),
    estudio = list(bases = list())
  ), file.path(stage, "state.rds"))
  writeLines(
    jsonlite::toJSON(list(format_version = 1, project_name = "o"), auto_unbox = TRUE),
    file.path(stage, "manifest.json")
  )
  origen <- tempfile(fileext = ".pulso")
  zip::zip(zipfile = origen, files = list.files(stage), root = stage)

  out_dir <- tempfile("ref-out-"); dir.create(out_dir, recursive = TRUE)
  on.exit(unlink(out_dir, recursive = TRUE, force = TRUE), add = TRUE)

  res <- reference_project_build("acnur_pdm", origen = origen, out_dir = out_dir)
  expect_true(res$ok)
  expect_true(file.exists(res$project_path))
  expect_match(res$project_sha256, "^[0-9a-f]{64}$")

  # Read-only: un fixture que se reescribe por accidente deja de ser punto de
  # comparación.
  modo <- as.character(file.info(res$project_path)$mode)
  expect_true(grepl("444$", modo), info = modo)

  manifest <- jsonlite::fromJSON(res$manifest_path, simplifyVector = FALSE)
  expect_equal(manifest$schema, REFERENCE_PROJECT_MANIFEST_SCHEMA)
  expect_equal(manifest$slug, "acnur_pdm")
  expect_true(isTRUE(manifest$anonimizado))
  expect_true("monitoreo" %in% unlist(manifest$modulos_cubiertos))
  expect_true("hojas_ruta" %in% unlist(manifest$modulos_cubiertos))
  expect_false("analitica" %in% unlist(manifest$modulos_cubiertos))

  # El fixture resultante no tiene PII.
  expect_equal(nrow(pulso_detectar_pii(res$project_path)), 0L)
  expect_true(res$cobertura[["monitoreo"]])
})
