# Lo que se copia al Space público: lista permitida (ADR 0122 §9).
#
# Se arma un árbol como el de la app con lo que el Space necesita y con la
# basura que de verdad hay en un árbol de trabajo (capturas de QA, auditorías
# en CSV, .pulso, fixtures, historial de R, borradores sin versionar) y se
# comprueba que nada de la basura entra al stage del Space.

source("setup-load-all.R")

.dps_escribir <- function(root, rel, contenido = "x") {
  ruta <- file.path(root, rel)
  dir.create(dirname(ruta), recursive = TRUE, showWarnings = FALSE)
  writeLines(contenido, ruta)
  invisible(ruta)
}

# Lo que el Dockerfile necesita.
.DPS_NECESARIOS <- c(
  "Dockerfile", ".dockerignore",
  "api/DESCRIPTION", "api/NAMESPACE", "api/R/motor.R",
  "api/inst/catalogos/catalogo.json", "api/inst/ppt_assets/iconos/icono.png", "api/inst/estandar/logos/logo.png",
  "api/inst/fonts/fuente/COPYING",
  "launcher/launch_server.R",
  "frontend/package.json", "frontend/pnpm-lock.yaml", "frontend/index.html", "frontend/vite.config.ts",
  "frontend/tsconfig.json", "frontend/src/main.tsx", "frontend/src/app/theme.css", "frontend/public/pulso-pucp-logo.png"
)

# Lo que hay en un árbol de trabajo y no puede viajar.
.DPS_BASURA <- c(
  "frontend/tmp/visual-qa/telefonico-acnur/captura.png", "frontend/tmp/visual-qa/reporte.json",
  "frontend/output/warmup-check/shell.png",
  "api/outputs/ast_corpus_audit/discarded.csv",
  "api/inst/reference_projects/acnur/acnur.pulso", "api/inst/collection_fixtures/aulas/plan.json",
  "api/inst/audit_reference/proyecto.pulso", "api/inst/samples/base.xlsx",
  "api/R/.Rhistory", "api/R/notas.csv", "api/.Renviron", "frontend/.env",
  "frontend/src/features/x/x.test.ts", "frontend/src/features/x/__tests__/y.tsx",
  "frontend/src/captura.png.bak", "data/otro-proyecto.pulso", "tmp/qa.png", "outputs/informe.csv",
  "launcher/notas.txt", "api/inst/catalogos/base.csv"
)

.dps_arbol <- function(envir = parent.frame()) {
  root <- withr::local_tempdir(.local_envir = envir)
  for (rel in c(.DPS_NECESARIOS, .DPS_BASURA)) .dps_escribir(root, rel)
  root
}

test_that("sin git, al Space va sólo lo que la lista permite", {
  root <- .dps_arbol()
  testthat::local_mocked_bindings(.space_versionados = function(root) NULL)
  rutas <- .space_rutas_permitidas(root)
  expect_setequal(rutas, .DPS_NECESARIOS)
  for (b in .DPS_BASURA) expect_false(b %in% rutas, info = b)
})

test_that("en un repo git, además, sólo lo versionado: un borrador local no viaja", {
  testthat::skip_if(!nzchar(Sys.which("git")), "sin git")
  root <- .dps_arbol()
  .dps_escribir(root, "frontend/src/borrador-sin-versionar.tsx")
  git <- function(...) system2("git", c("-C", shQuote(root), ...), stdout = FALSE, stderr = FALSE)
  git("init", "-q")
  git("add", "--", shQuote(.DPS_NECESARIOS))
  git("add", "--", "frontend/tmp", "api/outputs")   # aun versionada, la basura no calza con la lista
  rutas <- .space_rutas_permitidas(root)
  expect_setequal(rutas, .DPS_NECESARIOS)
  expect_false("frontend/src/borrador-sin-versionar.tsx" %in% rutas)
})

test_that("armar el Space de punta a punta no copia nada de la basura", {
  root <- .dps_arbol()
  plantilla <- testthat::test_path("..", "..", "..", "deploy", "hf-space-README.md.template")
  testthat::skip_if_not(file.exists(plantilla), "sin deploy/hf-space-README.md.template")
  dir.create(file.path(root, "deploy"))
  file.copy(plantilla, file.path(root, "deploy", "hf-space-README.md.template"))
  testthat::local_mocked_bindings(.space_versionados = function(root) NULL)
  withr::local_envvar(PULSO_APP_ROOT = root)
  sid <- session_create()
  withr::defer(session_delete(sid))
  armado <- .dashboard_publish_prepare_space(sid, "usuario/space", "space")
  rel <- armado$rel
  for (b in .DPS_BASURA) expect_false(b %in% rel, info = b)
  expect_true(all(.DPS_NECESARIOS %in% rel))
  # Lo único fuera de la lista es lo que arma la propia publicación.
  expect_setequal(setdiff(rel, .DPS_NECESARIOS), c("README.md", "data/proyecto.pulso"))
  expect_false(any(grepl("[.](csv|xlsx|rds)$|(^|/)tmp/|outputs/", rel)))
})

# --- El runtime público sólo sirve un .pulso preparado -----------------------

test_that("el .pulso de una publicación lleva la marca y el del proyecto no", {
  sid <- session_create()
  withr::defer(session_delete(sid))
  expect_false(.publicacion_preparada(session_get(sid)))
  publicado <- .dashboard_publish_snapshot(sid, "publicado")$path
  ld <- suppressMessages(load_pulso(publicado))
  withr::defer(session_delete(ld$session_id))
  expect_true(.publicacion_preparada(session_get(ld$session_id)))
  # La publicación no marca la sesión de quien publica.
  expect_false(.publicacion_preparada(session_get(sid)))
})

test_that("launch_server.R se niega a servir un .pulso sin la marca", {
  fuente <- readLines(testthat::test_path("..", "..", "..", "launcher", "launch_server.R"), warn = FALSE)
  chequeo <- grep(".publicacion_preparada", fuente, fixed = TRUE)
  expect_length(chequeo, 1L)
  # El chequeo va ANTES de exponer la sesión al servidor.
  expect_lt(chequeo, grep("PULSO_BOOTSTRAP_SID = bs$session_id", fuente, fixed = TRUE)[[1]])
})

test_that("el script del deploy manual prepara el .pulso por la misma ruta", {
  testthat::skip_on_cran()
  script <- testthat::test_path("..", "..", "scripts", "publicacion_preparar.R")
  skip_if_not(file.exists(script))
  sid <- session_create()
  withr::defer(session_delete(sid))
  dir <- withr::local_tempdir()
  proyecto <- file.path(dir, "proyecto.pulso")
  build_pulso(sid, proyecto, project_name = "proyecto", allow_empty_overwrite = TRUE)
  salida <- file.path(dir, "data", "proyecto.pulso")
  status <- system2(file.path(R.home("bin"), "Rscript"), c(shQuote(normalizePath(script)), "--project", shQuote(proyecto), "--out", shQuote(salida)),
                    stdout = FALSE, stderr = FALSE)
  expect_equal(status, 0L)
  ld <- suppressMessages(load_pulso(salida))
  withr::defer(session_delete(ld$session_id))
  expect_true(.publicacion_preparada(session_get(ld$session_id)))
})
