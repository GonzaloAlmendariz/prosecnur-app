source("setup-load-all.R")

# ADR 0094 — el Word guarda decisiones, no defaults (contrato A6, rebanada R1; tests 1–9 y 11 de §3).
#
# «El recetario siempre manda; si algo va a cambiar en el recetario, cambia en los defaults por defecto de la app»
# (Gonzalo, 1a). Los cuatro proyectos de referencia con estado guardaban `barras_apiladas` entero —leyenda de 6 pt, sin
# Top Two Box—: fotos de defaults viejos (G1/G2) que un diff ingenuo habría consagrado como decisiones.

.wpd_def <- function() .WORD_PRESETS_DEFAULT_PULSO
.wpd_g <- function(id) Filter(function(g) identical(g$id, id), .WORD_MIGRACIONES_DEFAULTS)[[1]]$claves
.wpd_vacios <- function(x) {
  # ¿Queda algún contenedor vacío en el árbol? (nunca `list()`/`[]` en disco)
  if (!is.list(x)) return(FALSE)
  if (!length(x)) return(TRUE)
  any(vapply(x, .wpd_vacios, logical(1)))
}
.wpd_ordenar <- function(x) {
  # El orden de las claves no es semántico (JSON); la idempotencia se compara sobre el árbol ordenado.
  if (!is.list(x)) return(x)
  if (!is.null(names(x))) x <- x[order(names(x))]
  lapply(x, .wpd_ordenar)
}
.wpd_sesion <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))   # con un .pulso abierto, un cambio marca dirty
  session_set(sid, "project_dirty", FALSE)
  sid
}
.wpd_pulso_copia <- function(slug, env = parent.frame()) {
  pulso <- system.file("reference_projects", slug, paste0(slug, ".pulso"), package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", slug, paste0(slug, ".pulso"))
  testthat::skip_if_not(file.exists(pulso), paste("sin el proyecto de referencia", slug))
  copia <- withr::local_tempdir(.local_envir = env)
  file.copy(pulso, file.path(copia, "ref.pulso"))
  ld <- suppressMessages(load_pulso(file.path(copia, "ref.pulso")))
  withr::defer(session_delete(ld$session_id), envir = env)
  ld$session_id
}
.wpd_endpoint <- function(path, body, captura = new.env(), sid, verbo = "POST", extra = list()) {
  mocks <- c(list(
    session_header = function(req) sid,
    .require_rp_data = function(sid) list(),
    .graficos_processing_sources = function(sid) list(data_sources = list(), inst_sources = list()),
    job_save_rds = function(...) tempfile(),
    .graficos_icon_registry = function(...) list(),
    .graficos_active_base_name = function(sid) "",
    .graficos_export_filename = function(...) "x",
    job_submit = function(sid, kind, func, args, ..., on_complete = NULL) { captura$args <- args; "job-wpd" }
  ), extra)
  do.call(testthat::local_mocked_bindings, c(mocks, list(.package = "prosecnurapp")))
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, path) && verbo %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv())
  if (!is.null(body)) req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(req, res)
  attr(out, "status") <- res$status
  out
}
.wpd_plan <- function() list(slides = list(list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "T"))))

# --- (1) lo igual al default no se guarda ---------------------------------------------------------------------------
test_that("(1) guardar la config con el Word de fábrica no deja w_presets ni documento_word en el proyecto", {
  sid <- .wpd_sesion()
  .graficos_config_set(sid, list(plan = .wpd_plan(), w_presets = .wpd_def(),
                                 documento_word = list(portada = "A", apertura = "B", como_leer = "auto")))
  guardada <- session_get(sid)$graficos_config
  expect_false("w_presets" %in% names(guardada))
  expect_false("documento_word" %in% names(guardada))
  # El control: lo que sí difiere sobrevive, y sólo eso.
  w <- .wpd_def(); w$chart_presets$barras_apiladas$size_leyenda <- 9
  .graficos_config_set(sid, list(plan = .wpd_plan(), w_presets = w, documento_word = list(portada = "C", apertura = "B")))
  guardada <- session_get(sid)$graficos_config
  expect_identical(guardada$w_presets, list(chart_presets = list(barras_apiladas = list(size_leyenda = 9))))
  expect_identical(guardada$documento_word, list(portada = "C"))
  # Y al leer (limpio): un proyecto que trae el default completo se lee sin él.
  session_set(sid, "graficos_config", list(plan = .wpd_plan(), w_presets = .wpd_def()))
  expect_false("w_presets" %in% names(.graficos_config_get(sid)))
})

# --- (2) bloque vacío desaparece ------------------------------------------------------------------------------------
test_that("(2) un bloque sin decisiones desaparece entero: nunca list() ni [] en disco", {
  expect_identical(.graficos_w_presets_solo_decisiones(list(chart_options = list(), chart_presets = list(barras_apiladas = list(), multi_apiladas = list()))),
                   list())
  w <- .wpd_def(); w$chart_presets$multi_apiladas$size_ejes <- 12
  d <- .graficos_w_presets_solo_decisiones(w)
  expect_identical(d, list(chart_presets = list(multi_apiladas = list(size_ejes = 12))))
  expect_false(.wpd_vacios(d))
  sid <- .wpd_sesion()
  .graficos_config_set(sid, list(plan = .wpd_plan(), w_presets = list(chart_presets = list(barras_apiladas = list())),
                                 documento_word = list(contacto = list(correo = ""), meta_portada = list())))
  guardada <- session_get(sid)$graficos_config
  expect_false(any(c("w_presets", "documento_word") %in% names(guardada)))
})

# --- (3) un default nuevo alcanza a un proyecto viejo y sus decisiones aguantan -------------------------------------
test_that("(3) .build_w_presets repone el default vigente: lo nuevo llega y lo decidido se queda", {
  guardado <- list(chart_presets = list(barras_apiladas = list(size_ejes = 11)))
  nuevo <- .wpd_def()
  nuevo$chart_presets$barras_apiladas$size_leyenda <- 10       # llega una versión con otro default
  nuevo$chart_options$ocultar_etiqueta_si_titulo <- FALSE
  testthat::local_mocked_bindings(.graficos_w_presets_default = function() nuevo, .package = "prosecnurapp")
  b <- .build_w_presets(guardado)
  expect_s3_class(b, "word_presets")
  expect_equal(b$chart_presets$barras_apiladas$size_leyenda, 10)     # adopta el default nuevo
  expect_equal(b$chart_presets$barras_apiladas$size_ejes, 11)        # conserva su decisión
  expect_false(isTRUE(b$chart_options$ocultar_etiqueta_si_titulo))   # también fuera de chart_presets
  # Lo mismo por el normalizador de la config (GET y export).
  cfg <- .graficos_normalize_config(list(w_presets = guardado))
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$size_leyenda, 10)
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$size_ejes, 11)
})

# --- (4) fósiles G1/G2 ----------------------------------------------------------------------------------------------
test_that("(4) el bloque fósil de acrconta_mazo (G2) sale con Top Two Box y 8 pt al leer", {
  sid <- .wpd_pulso_copia("acrconta_mazo")
  crudo <- session_get(sid)$graficos_config$w_presets$chart_presets$barras_apiladas
  expect_equal(crudo$size_leyenda, 6)                       # la foto vieja sigue en el .pulso
  expect_length(crudo, 28L)
  cfg <- .graficos_normalize_config(.graficos_config_get(sid), sid = sid)
  b <- cfg$w_presets$chart_presets$barras_apiladas
  expect_equal(b$size_leyenda, 8); expect_equal(b$legend_key_cm, 0.18)
  expect_true(isTRUE(b$mostrar_barra_extra)); expect_identical(b$barra_extra_preset, "top2box")
  expect_equal(b$canvas_w_extra, 0.16)
  # Y lo que guardaría: nada (era todo foto del default).
  expect_false("w_presets" %in% names(.graficos_config_get(sid)))
  # El job de Word lo recibe igual.
  wb <- .build_w_presets(session_get(sid)$graficos_config$w_presets)$chart_presets$barras_apiladas
  expect_equal(wb$size_leyenda, 8); expect_identical(wb$barra_extra_preset, "top2box")
})

test_that("(4) G1 (25 claves, el espejo viejo del front) también migra", {
  g1 <- .wpd_g("G1")
  expect_length(g1, 25L)
  expect_identical(.graficos_w_presets_solo_decisiones(list(chart_presets = list(barras_apiladas = g1))), list())
})

test_that("(4) un valor aislado distinto del default se respeta como decisión", {
  # Un FALSE suelto sobre el default vigente: el analista apagó el Top Two Box.
  w <- .wpd_def(); w$chart_presets$barras_apiladas$mostrar_barra_extra <- FALSE
  expect_identical(.graficos_w_presets_solo_decisiones(w),
                   list(chart_presets = list(barras_apiladas = list(mostrar_barra_extra = FALSE))))
  # El bloque G1 con UNA clave distinta de la foto ya no es la foto: se conserva todo lo que difiere del default.
  casi <- .wpd_g("G1"); casi$size_ejes <- 8
  d <- .graficos_w_presets_solo_decisiones(list(chart_presets = list(barras_apiladas = casi)))$chart_presets$barras_apiladas
  expect_false(isTRUE(d$mostrar_barra_extra)); expect_identical(d$barra_extra_preset, "ninguno")
  expect_equal(d$size_leyenda, 6); expect_equal(d$size_ejes, 8)
  # Una leyenda de 6 pt sola tampoco es un fósil.
  expect_identical(.graficos_w_presets_solo_decisiones(list(chart_presets = list(barras_apiladas = list(size_leyenda = 6)))),
                   list(chart_presets = list(barras_apiladas = list(size_leyenda = 6))))
})

# --- (5) idempotencia y GET de un .pulso viejo sin dirty ------------------------------------------------------------
test_that("(5) strip(merge(default, strip(x))) == strip(x)", {
  casi <- .wpd_g("G1"); casi$size_ejes <- 8
  casos <- list(
    .wpd_def(),
    list(chart_presets = list(barras_apiladas = .wpd_g("G2"))),
    list(chart_presets = list(barras_apiladas = casi)),
    list(chart_options = list(ocultar_etiqueta_si_titulo = FALSE), title_style = list(size = 14),
         chart_presets = list(barras_agrupadas = list(x = 1), multi_apiladas = list(size_ejes = 9)))
  )
  for (x in casos) {
    s1 <- .graficos_w_presets_solo_decisiones(x)
    expect_identical(.wpd_ordenar(.graficos_w_presets_solo_decisiones(.graficos_w_presets_con_defaults(s1))), .wpd_ordenar(s1))
  }
})

test_that("(5) el GET de un proyecto con el fósil no lo escribe de vuelta ni marca el proyecto como modificado", {
  skip_if_not_installed("plumber")
  sid <- .wpd_sesion()
  session_set(sid, "graficos_config", list(plan = .wpd_plan(), w_presets = list(chart_presets = list(barras_apiladas = .wpd_g("G2"))),
                                           documento_word = list(portada = "A", apertura = "C")))
  session_set(sid, "project_dirty", FALSE)
  r <- suppressWarnings(.wpd_endpoint("/api/graficos/config", NULL, sid = sid, verbo = "GET"))
  expect_equal(r$config$w_presets$chart_presets$barras_apiladas$size_leyenda, 8)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  guardada <- session_get(sid)$graficos_config
  expect_equal(guardada$w_presets$chart_presets$barras_apiladas$size_leyenda, 6)   # en disco, intacto hasta guardar
  expect_identical(guardada$documento_word$apertura, "C")
})

test_that("(5) en acrconta_mazo, la limpieza del Word al leer no toca la sesión", {
  sid <- .wpd_pulso_copia("acrconta_mazo")
  antes <- session_get(sid)
  expect_false(isTRUE(antes$project_dirty))
  invisible(.graficos_normalize_config(.graficos_config_get(sid), sid = sid))
  despues <- session_get(sid)
  expect_false(isTRUE(despues$project_dirty))
  expect_identical(despues$graficos_config$w_presets, antes$graficos_config$w_presets)
})

# --- (6) claves desconocidas y sublistas de estilo ------------------------------------------------------------------
test_that("(6) .build_w_presets mezcla title_style sobre su formal y filtra lo desconocido con aviso, sin abortar", {
  expect_warning(b <- .build_w_presets(list(title_style = list(size = 14), foo = 1)), "foo")
  expect_equal(b$title_style$size, 14)
  expect_identical(b$title_style$font, "Arial")
  expect_identical(b$title_style$color, "#39588B")
  expect_true(isTRUE(b$title_style$bold))
  # Lo desconocido sigue en disco: puede ser de una versión posterior.
  expect_identical(.graficos_w_presets_solo_decisiones(list(foo = 1)), list(foo = 1))
})

# --- (7) documento_word persistido inválido / body inválido ---------------------------------------------------------
test_that("(7) portada «D» guardada se descarta con aviso; en el body es un 400", {
  expect_warning(o <- .graficos_documento_word_mezclar(list(portada = "D", apertura = "A")), "portada")
  expect_identical(o, list(apertura = "A"))
  sid <- .wpd_sesion()
  session_set(sid, "graficos_config", list(plan = .wpd_plan(), documento_word = list(portada = "D", apertura = "A")))
  expect_warning(cfg <- .graficos_config_get(sid), "portada")
  expect_identical(cfg$documento_word, list(apertura = "A"))
  e <- tryCatch(.graficos_documento_word_mezclar(list(apertura = "A"), list(portada = "D")), error = function(e) e)
  expect_s3_class(e, "api_error")
  expect_identical(e$code, "E_BAD_DOCUMENTO_WORD")
  expect_identical(e$status, 400)
})

test_that("(7) contrato HTTP: /word con portada «D» en el body responde 400 E_BAD_DOCUMENTO_WORD", {
  skip_if_not_installed("plumber")
  sid <- .wpd_sesion()
  captura <- new.env()
  r <- .wpd_endpoint("/api/graficos/word", list(plan = .wpd_plan(), opciones_documento = list(portada = "D")), captura, sid = sid)
  expect_identical(attr(r, "status"), 400)
  expect_identical(r$error$code, "E_BAD_DOCUMENTO_WORD")
  expect_null(captura$args)   # no llegó a encolar el job
})

# --- (8) lo guardado y el body llegan juntos al worker --------------------------------------------------------------
test_that("(8) guardado {portada: C} + body {apertura: A} llegan juntos al worker de Word", {
  skip_if_not_installed("plumber")
  sid <- .wpd_sesion()
  .graficos_config_set(sid, list(plan = .wpd_plan(), documento_word = list(portada = "C"),
                                 w_presets = list(chart_presets = list(barras_apiladas = list(size_ejes = 11)))))
  captura <- new.env()
  .wpd_endpoint("/api/graficos/word", list(plan = .wpd_plan(), opciones_documento = list(apertura = "A")), captura, sid = sid)
  expect_identical(captura$args$opciones_documento$portada, "C")
  expect_identical(captura$args$opciones_documento$apertura, "A")
  # El w_presets guardado también viaja (precedencia: default -> diff guardado -> body).
  expect_equal(.build_w_presets(captura$args$w_presets)$chart_presets$barras_apiladas$size_ejes, 11)
  # Una clave del body manda sobre la guardada.
  captura2 <- new.env()
  .wpd_endpoint("/api/graficos/word", list(plan = .wpd_plan(), opciones_documento = list(portada = "B")), captura2, sid = sid)
  expect_identical(captura2$args$opciones_documento$portada, "B")
})

# --- (9) documento_word: {} borra, sin clave conserva ---------------------------------------------------------------
test_that("(9) POST /config: documento_word {} borra lo guardado; sin la clave, se conserva", {
  skip_if_not_installed("plumber")
  sid <- .wpd_sesion()
  .wpd_endpoint("/api/graficos/config", list(plan = .wpd_plan(), documento_word = list(portada = "C")), sid = sid)
  expect_identical(session_get(sid)$graficos_config$documento_word, list(portada = "C"))
  .wpd_endpoint("/api/graficos/config", list(plan = .wpd_plan()), sid = sid)                    # autosave sin la clave
  expect_identical(session_get(sid)$graficos_config$documento_word, list(portada = "C"))
  .wpd_endpoint("/api/graficos/config", list(plan = .wpd_plan(), documento_word = structure(list(), names = character(0))), sid = sid)
  expect_false("documento_word" %in% names(session_get(sid)$graficos_config))                   # «volver al recetario»
})

# --- (11) el borrador del consolidado también guarda sólo decisiones ------------------------------------------------
test_that("(11) graficos_consolidado_draft_set limpia w_presets y documento_word como config_set", {
  sid <- .wpd_sesion()
  w <- .wpd_def(); w$chart_presets$barras_apiladas$size_leyenda <- 9
  graficos_consolidado_draft_set(sid, config = list(plan = .wpd_plan(), w_presets = w,
                                                    documento_word = list(portada = "A")), expected_revision = 0L)
  cfg <- session_get(sid)$graficos_consolidado_draft$config
  expect_identical(cfg$w_presets, list(chart_presets = list(barras_apiladas = list(size_leyenda = 9))))
  expect_false("documento_word" %in% names(cfg))
})

# --- multibase: la base activa guarda su diff y la hermana no se toca -----------------------------------------------
test_that("multibase independiente: el diff se aplica a la base activa y no cae en la primera ni toca la hermana", {
  sid <- .wpd_sesion()
  hermana <- list(plan = .wpd_plan(), w_presets = list(chart_presets = list(barras_apiladas = .wpd_g("G2"))))
  session_set(sid, "graficos_config_por_base", list(docentes = hermana, egresados = list(plan = .wpd_plan())))
  global_antes <- session_get(sid)[["graficos_config"]]   # [[ ]]: `$` haría match parcial con graficos_config_por_base
  testthat::local_mocked_bindings(.graficos_scoped_base = function(sid) "egresados", .package = "prosecnurapp")
  w <- .wpd_def(); w$chart_presets$barras_apiladas$size_ejes <- 11
  .graficos_config_set(sid, list(plan = .wpd_plan(), w_presets = w))
  por_base <- session_get(sid)$graficos_config_por_base
  expect_identical(por_base$egresados$w_presets, list(chart_presets = list(barras_apiladas = list(size_ejes = 11))))
  expect_identical(por_base$docentes, hermana)   # la hermana (y su fósil, hasta que se guarde) intacta
  expect_identical(session_get(sid)[["graficos_config"]], global_antes)  # no cayó en la config global
})
