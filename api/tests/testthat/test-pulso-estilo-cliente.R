source("setup-load-all.R")

# A6 R3 — (10) de §3 del contrato docs/qa/contrato-word-estilo-f6-2026-10-11.md: los logos del cliente viajan en el
# `.pulso` por `file_id` (ADR 0094 §5) y un logo sin su PNG se poda al abrir, con aviso, en vez de prometer un recurso que
# no existe. Mutante que mata: logos fuera de `.pulso_collect_input_fids`.

.pec_png_b64 <- paste0("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwACh",
                       "wGA60e6kgAAAABJRU5ErkJggg==")
.pec_plan <- function() list(slides = list(list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "T"))))
.pec_avisos <- function(expr) {
  msgs <- character(0)
  withCallingHandlers(force(expr), message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  msgs[grepl("[PULSO-AVISO]", msgs, fixed = TRUE)]
}
.pec_proyecto <- function(env = parent.frame(), bases = NULL) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  if (length(bases)) {
    session_set(sid, "estudio", list(bases = stats::setNames(lapply(bases, function(b) list(nombre = b)), bases),
                                     active_base = bases[[1]], processing_mode = "independent_siblings"))
  }
  logo <- .graficos_estilo_cliente_subir_logo(sid, list(nombre = "UNSA", data_base64 = .pec_png_b64))
  .graficos_config_set(sid, list(plan = .pec_plan(), estilo_cliente = list(
    ambito = if (length(bases)) "proyecto" else NULL,
    logos = list(contraportada = list(file_id = logo$file_id, nombre = "UNSA")), letra = list(paso = "grande"))))
  list(sid = sid, logo = logo)
}
.pec_abrir <- function(path, env = parent.frame()) {
  ld <- suppressMessages(load_pulso(path))
  withr::defer(session_delete(ld$session_id), envir = env)
  ld$session_id
}

test_that("(10) ida y vuelta .pulso: el logo viaja en files/ y en la sesión nueva resuelve a un PNG idéntico", {
  p <- .pec_proyecto()
  expect_true(p$logo$file_id %in% .pulso_collect_input_fids(session_get(p$sid)))
  destino <- tempfile(fileext = ".pulso")
  build_pulso(p$sid, destino, project_name = "Estilo")
  entradas <- zip::zip_list(destino)$filename
  expect_true(any(startsWith(entradas, paste0("files/", p$logo$file_id, "__"))))
  sid2 <- .pec_abrir(destino)
  s2 <- session_get(sid2)
  expect_false(isTRUE(s2$project_dirty))
  est <- .graficos_config_get(sid2)$estilo_cliente
  expect_identical(est$logos$contraportada$file_id, p$logo$file_id)
  expect_null(est$logos$contraportada$path)                                       # nunca rutas en el estilo
  expect_identical(est$letra$paso, "grande")
  ruta <- .graficos_estilo_cliente_resolver(sid2, .graficos_normalize_config(.graficos_config_get(sid2), sid = sid2))$logos$contraportada
  expect_true(startsWith(ruta, normalizePath(s2$dir, winslash = "/")))           # en el tempdir de la sesión NUEVA
  expect_identical(digest::digest(file = ruta, algo = "sha256"), p$logo$sha256)
  expect_false(isTRUE(session_get(sid2)$project_dirty))                          # leer no marca el proyecto
})

test_that("(10) ida y vuelta multibase con ámbito proyecto: el estilo vive una vez y su logo viaja", {
  p <- .pec_proyecto(bases = c("docentes", "estudiantes"))
  s <- session_get(p$sid)
  expect_identical(s$graficos_config$estilo_cliente$ambito, "proyecto")
  destino <- tempfile(fileext = ".pulso")
  build_pulso(p$sid, destino)
  sid2 <- .pec_abrir(destino)
  for (b in c("docentes", "estudiantes")) {
    e <- session_get(sid2)$estudio; e$active_base <- b; session_set(sid2, "estudio", e)
    expect_identical(.graficos_config_get(sid2)$estilo_cliente$logos$contraportada$file_id, p$logo$file_id)
  }
})

test_that("(10) un logo cuyo PNG no viajó se poda al abrir, con aviso que lo nombra, y el Word vuelve al del recetario", {
  p <- .pec_proyecto()
  unlink(session_get(p$sid)$files[[p$logo$file_id]]$path)                        # se perdió entre la subida y el guardado
  destino <- tempfile(fileext = ".pulso")
  guardado <- build_pulso(p$sid, destino)
  expect_true(any(grepl("logo «UNSA» (contraportada)", unlist(guardado$refs_perdidas), fixed = TRUE)))
  avisos <- character(0); ld <- NULL
  avisos <- .pec_avisos(ld <- load_pulso(destino))
  withr::defer(session_delete(ld$session_id))
  expect_true(any(grepl("«UNSA» (contraportada)", avisos, fixed = TRUE)))
  expect_false(any(grepl(p$logo$file_id, avisos, fixed = TRUE)))                 # sin ids en el aviso
  est <- .graficos_config_get(ld$session_id)$estilo_cliente
  expect_null(est$logos)
  expect_identical(est$letra$paso, "grande")                                      # el resto del estilo sobrevive
  expect_length(.graficos_estilo_cliente_resolver(ld$session_id, .graficos_config_get(ld$session_id))$logos, 0L)
})

test_that("la poda alcanza los cuatro portadores y deja vivo el logo que sí está", {
  ok <- tempfile(fileext = ".png"); writeBin(jsonlite::base64_dec(.pec_png_b64), ok)
  logos <- function(fid) list(estilo_cliente = list(logos = list(contraportada = list(file_id = fid, nombre = "X"))))
  s <- list(files = list(vivo = list(path = ok)),
            graficos_config = logos("muerto"), graficos_config_por_base = list(a = logos("vivo"), b = logos("muerto")),
            graficos_consolidado_draft = list(config = logos("muerto")), graficos_consolidado = list(config = logos("muerto")))
  avisos <- .pec_avisos(s2 <- .graficos_estilo_cliente_podar_huerfanos(s))
  expect_length(avisos, 1L)
  expect_null(s2$graficos_config$estilo_cliente$logos)
  expect_identical(s2$graficos_config_por_base$a$estilo_cliente$logos$contraportada$file_id, "vivo")
  expect_null(s2$graficos_config_por_base$b$estilo_cliente$logos)
  expect_null(s2$graficos_consolidado_draft$config$estilo_cliente$logos)
  expect_null(s2$graficos_consolidado$config$estilo_cliente$logos)
  expect_identical(sort(.graficos_estilo_cliente_fids(s)), c("muerto", "vivo"))
})

test_that("el borrador del consolidado guarda el estilo como diff, sin ámbito y con los logos sólo por file_id", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  png <- tempfile(fileext = ".png"); writeBin(jsonlite::base64_dec(.pec_png_b64), png)
  meta <- .register_output_file(sid, "graficos_logo", png)
  out <- graficos_consolidado_draft_set(sid, list(plan = .pec_plan(), estilo_cliente = list(
    version = 1, ambito = "proyecto", letra = list(paso = "estandar"),
    logos = list(contraportada = list(path = meta$path), portada_izquierda = list(file_id = meta$file_id)))), 0L)
  est <- session_get(sid)$graficos_consolidado_draft$config$estilo_cliente
  # La ruta heredada de la contraportada se traduce al file_id que la registra; `ambito` y el paso estándar no se guardan.
  expect_identical(est, list(version = 1L, logos = list(contraportada = list(file_id = meta$file_id),
                                                        portada_izquierda = list(file_id = meta$file_id))))
  expect_identical(.graficos_estilo_cliente_portable(list(logos = list(contraportada = list(path = meta$path))),
                                                     session_get(sid)$files)$logos$contraportada,
                   list(file_id = meta$file_id))
})
