# Qué ve el modo público del Planner (ADR 0122 §9).
#
# Lo que fija: el Planner no se expone en el modo público y, de lo que guarda,
# sólo la identidad del estudio puede viajar en un artefacto publicado. El
# equipo (nombres de personas), los códigos, los insumos, la etapa y los
# perfiles nunca.

source("setup-load-all.R")

.pp_rutas <- c("GET /api/planner", "GET /api/planner/modos", "GET /api/planner/calendario",
               "GET /api/planner/codigos", "PUT /api/planner/equipo", "PUT /api/planner/estudio")

test_that("ninguna ruta del Planner pasa el filtro del modo público", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "1")
  for (r in .pp_rutas) {
    partes <- strsplit(r, " ", fixed = TRUE)[[1]]
    expect_false(public_request_allowed(partes[[1]], partes[[2]]), info = r)
  }
  expect_false(any(grepl("/api/planner", PUBLIC_MODE_WHITELIST, fixed = TRUE)))
})

test_that("el Planner sólo se monta fuera del modo público", {
  fuente <- readLines(testthat::test_path("..", "..", "R", "plumber_app.R"), warn = FALSE)
  # La rama pública va de `if (is_public_mode())` al primer `} else {`.
  inicio <- grep("if (is_public_mode())", fuente, fixed = TRUE)[[1]]
  fin <- inicio + grep("^\\s*\\} else \\{", fuente[inicio:length(fuente)])[[1]] - 1L
  expect_false(any(grepl("mount_planner", fuente[inicio:fin], fixed = TRUE)))
  expect_true(any(grepl("mount_planner(pr)", fuente[(fin + 1L):length(fuente)], fixed = TRUE)))
})

test_that("al publicar, del Planner sólo viaja la identidad", {
  sid <- session_create()
  withr::defer(session_delete(sid))
  .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba", codigo = "EP26", cliente = "Cliente"), 0L)
  .planner_sembrar_legado(sid, "equipo", list(personas = list(list(codigo = "P001", nombre = "Encuestador Ejemplo Uno"))))
  .planner_sembrar_legado(sid, "codigos", list(resultado = list(list(codigo = "8", rotulo = "Efectiva", grupo = "efectiva"))))
  .planner_declarar(sid, "etapa", list(valor = "campo"), 3L)
  original <- session_get(sid)$planner

  snap <- .dashboard_publish_snapshot(sid, "publicado")
  dir <- withr::local_tempdir()
  zip::unzip(snap$path, files = "state.rds", exdir = dir)
  publicado <- readRDS(file.path(dir, "state.rds"))$planner
  expect_equal(publicado$estudio$nombre, "Estudio de prueba")
  expect_setequal(setdiff(names(publicado), c("schema", "revision", "declarado_en")), "estudio")
  expect_false(any(grepl("Encuestador Ejemplo Uno", unlist(publicado), fixed = TRUE)))
  # Publicar no toca la sesión de quien publica.
  expect_identical(session_get(sid)$planner, original)
})

test_that("sin identidad declarada, al publicar no queda Planner", {
  s <- list(planner = list(schema = PLANNER_SCHEMA, revision = 1L, equipo = list(personas = list(list(codigo = "P1", nombre = "X")))))
  expect_null(.planner_para_publicar(s)$planner)
  expect_null(.planner_para_publicar(list(otra = 1))$planner)
})
