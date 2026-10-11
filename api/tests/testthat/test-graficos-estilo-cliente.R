source("setup-load-all.R")

# A6 R3 — el estilo del cliente: logos propios y perfil de letra K13 (contrato docs/qa/contrato-word-estilo-f6-2026-10-11.md,
# ADR 0094; tests 13, 14, 15 y 16 de §3 y los de ámbito de la decisión 14 de Gonzalo: «Por base o por proyecto, depende del
# usuario»). El de ida y vuelta por `.pulso` (10) vive en test-pulso-estilo-cliente.R.

.ec_png_b64 <- paste0("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwACh",
                      "wGA60e6kgAAAABJRU5ErkJggg==")

.ec_sesion <- function(env = parent.frame(), bases = NULL, activa = NULL) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  if (length(bases)) {
    session_set(sid, "estudio", list(
      bases = stats::setNames(lapply(bases, function(b) list(nombre = b)), bases),
      active_base = activa %||% bases[[1]], processing_mode = "independent_siblings"))
  }
  sid
}
.ec_activar <- function(sid, base) {
  e <- session_get(sid)$estudio; e$active_base <- base; session_set(sid, "estudio", e)
}
.ec_plan <- function() list(slides = list(list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "T"))))
.ec_logo <- function(sid, nombre = "UNSA") .graficos_estilo_cliente_subir_logo(sid, list(nombre = nombre, data_base64 = .ec_png_b64))
.ec_estilo <- function(...) .graficos_config_get(...)$estilo_cliente

.ec_endpoint <- function(mount, path, body, sid, verbo = "POST", captura = new.env(), extra = list()) {
  mocks <- c(list(
    session_header = function(req) sid,
    .require_rp_data = function(sid) list(),
    .graficos_processing_sources = function(sid) list(data_sources = list(), inst_sources = list()),
    job_save_rds = function(...) tempfile(),
    .graficos_icon_registry = function(...) list(),
    .graficos_active_base_name = function(sid) "",
    .graficos_export_filename = function(...) "x",
    job_submit = function(sid, kind, func, args, ..., on_complete = NULL) { captura$args <- args; "job-ec" }
  ), extra)
  do.call(testthat::local_mocked_bindings, c(mocks, list(.package = "prosecnurapp")))
  pr <- mount(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, path) && verbo %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv())
  if (!is.null(body)) req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(req, res)
  attr(out, "status") <- res$status
  out
}
# Un endpoint envuelto en `wrap_endpoint` responde el error con su status (como lo vería el cliente).
.ec_fallo <- function(out) list(code = out$error$code, status = attr(out, "status"))

# --- forma, diff y validación ----------------------------------------------------------------------------------------
test_that("lo igual al recetario no se guarda; lo propio sí, y leer dos veces no cambia nada", {
  sid <- .ec_sesion()
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = .graficos_estilo_cliente_default()))
  expect_false("estilo_cliente" %in% names(session_get(sid)$graficos_config))
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(
    version = 1, letra = list(paso = "grande", roles = list(cifras = "grande", titulos = "estandar")))))
  guardado <- session_get(sid)$graficos_config$estilo_cliente
  # `cifras` = el paso que heredaría → no es decisión; `titulos` estándar con global grande, sí.
  expect_identical(guardado, list(version = 1L, letra = list(paso = "grande", roles = list(titulos = "estandar"))))
  leido <- .graficos_normalize_config(.graficos_config_get(sid), sid = sid)$estilo_cliente
  expect_identical(leido$letra$paso, "grande")
  expect_identical(leido$ambito, "proyecto")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = leido))
  expect_identical(session_get(sid)$graficos_config$estilo_cliente, guardado)
})

test_that("un autosave sin estilo_cliente lo conserva y `{}` vuelve al recetario", {
  sid <- .ec_sesion()
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(letra = list(paso = "muy_grande"))))
  .graficos_config_set(sid, list(plan = .ec_plan()))
  expect_identical(session_get(sid)$graficos_config$estilo_cliente$letra$paso, "muy_grande")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = setNames(list(), character(0))))
  expect_false("estilo_cliente" %in% names(session_get(sid)$graficos_config))
})

test_that("POST /config rechaza un estilo_cliente inválido con 400 E_BAD_ESTILO_CLIENTE; lo guardado inválido se descarta con aviso", {
  sid <- .ec_sesion()
  for (malo in list(list(ambito = "global"), list(letra = list(paso = "enorme")), list(letra = list(roles = list(colores = "grande"))),
                    list(logos = list(lomo = list(file_id = "x"))), list(logos = list(contraportada = list(file_id = "x", path = "/tmp/a.png"))))) {
    e <- .ec_fallo(.ec_endpoint(mount_graficos, "/api/graficos/config", list(config = list(plan = .ec_plan(), estilo_cliente = malo)), sid))
    expect_identical(e$code, "E_BAD_ESTILO_CLIENTE")
    expect_identical(as.integer(e$status), 400L)
  }
  # Un archivo que no es PNG no puede ser logo.
  txt <- tempfile(fileext = ".txt"); writeLines("x", txt)
  meta <- .register_output_file(sid, "otro", txt)
  e <- .ec_fallo(.ec_endpoint(mount_graficos, "/api/graficos/config",
                              list(config = list(plan = .ec_plan(), estilo_cliente = list(logos = list(contraportada = list(file_id = meta$file_id))))), sid))
  expect_identical(e$code, "E_BAD_LOGO")
  # Persistido a mano con un paso desconocido: el GET no se rompe; se descarta ese bloque con aviso.
  session_set(sid, "graficos_config", list(plan = .ec_plan(), estilo_cliente = list(letra = list(paso = "enorme"), foo = 1)))
  expect_warning(est <- .ec_estilo(sid), "estilo_cliente.letra")
  expect_null(est$letra)
  expect_identical(est$foo, 1)   # lo desconocido se conserva sin interpretar
})

# --- ámbito: lo elige el usuario --------------------------------------------------------------------------------------
test_that("el ámbito por defecto es proyecto sin hermanas y base en hermanas independientes; el usuario puede elegir el otro", {
  expect_identical(.ec_estilo(.ec_sesion())$ambito, "proyecto")
  sid <- .ec_sesion(bases = c("docentes", "estudiantes"), activa = "docentes")
  expect_identical(.ec_estilo(sid)$ambito, "base")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(ambito = "proyecto", letra = list(paso = "grande"))))
  s <- session_get(sid)
  expect_identical(s$graficos_config$estilo_cliente$ambito, "proyecto")         # el ámbito vive en el portador de proyecto
  expect_null(s$graficos_config_por_base$docentes$estilo_cliente)                 # y el estilo, una sola vez
  .ec_activar(sid, "estudiantes")
  expect_identical(.ec_estilo(sid)$letra$paso, "grande")                          # aplica a la otra base sin copiarse
  expect_identical(.ec_estilo(sid)$ambito, "proyecto")
})

test_that("con ámbito base cada base guarda el suyo y escribir en la activa no cae en la primera", {
  sid <- .ec_sesion(bases = c("docentes", "estudiantes"), activa = "estudiantes")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(letra = list(paso = "muy_grande"))))
  s <- session_get(sid)
  expect_identical(s$graficos_config_por_base$estudiantes$estilo_cliente$letra$paso, "muy_grande")
  expect_null(s$graficos_config_por_base$docentes)
  expect_null((s$graficos_config %||% list())$estilo_cliente)
  .ec_activar(sid, "docentes")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(letra = list(paso = "grande"))))
  expect_identical(.ec_estilo(sid)$letra$paso, "grande")
  .ec_activar(sid, "estudiantes")
  expect_identical(.ec_estilo(sid)$letra$paso, "muy_grande")                      # la hermana se preserva
})

test_that("cambiar de ámbito copia y no pierde: base → proyecto → base", {
  sid <- .ec_sesion(bases = c("docentes", "estudiantes"), activa = "docentes")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(letra = list(paso = "grande"))))
  .ec_activar(sid, "estudiantes")
  .graficos_config_set(sid, list(plan = .ec_plan()))                              # la hermana tiene config, sin estilo
  .ec_activar(sid, "docentes")
  # base → proyecto: lo que se ve (docentes, «grande») pasa a ser el del proyecto; la copia de docentes se conserva.
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = c(.ec_estilo(sid)[c("version", "letra")], list(ambito = "proyecto"))))
  s <- session_get(sid)
  expect_identical(s$graficos_config$estilo_cliente$letra$paso, "grande")
  expect_identical(s$graficos_config_por_base$docentes$estilo_cliente$letra$paso, "grande")
  .ec_activar(sid, "estudiantes")
  expect_identical(.ec_estilo(sid)$letra$paso, "grande")
  # En ámbito proyecto se edita el del proyecto: «muy grande» para todas.
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(ambito = "proyecto", letra = list(paso = "muy_grande"))))
  expect_identical(session_get(sid)$graficos_config_por_base$docentes$estilo_cliente$letra$paso, "grande")   # intacta
  # proyecto → base (desde estudiantes): la activa queda con lo que veía; docentes recupera su copia; nada se pierde.
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(ambito = "base", letra = list(paso = "muy_grande"))))
  s <- session_get(sid)
  expect_identical(s$graficos_config_por_base$estudiantes$estilo_cliente$letra$paso, "muy_grande")
  expect_identical(s$graficos_config_por_base$docentes$estilo_cliente$letra$paso, "grande")
  expect_identical(s$graficos_config$estilo_cliente$letra$paso, "muy_grande")    # el del proyecto queda para otra vuelta
  expect_null(s$graficos_config$estilo_cliente$ambito)                           # "base" es el default aquí
  expect_identical(.ec_estilo(sid)$ambito, "base")
})

test_that("proyecto → base da una copia del estilo del proyecto a la hermana que no tenía el suyo", {
  sid <- .ec_sesion(bases = c("docentes", "estudiantes"), activa = "docentes")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(ambito = "proyecto", letra = list(paso = "grande"))))
  .ec_activar(sid, "estudiantes")
  .graficos_config_set(sid, list(plan = .ec_plan()))
  expect_null(session_get(sid)$graficos_config_por_base$estudiantes$estilo_cliente)
  .ec_activar(sid, "docentes")
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(ambito = "base", letra = list(paso = "grande"))))
  expect_identical(session_get(sid)$graficos_config_por_base$estudiantes$estilo_cliente$letra$paso, "grande")
})

# --- GET /config ---------------------------------------------------------------------------------------------------------
test_that("GET /config entrega el estilo con su ámbito y `defaults.estilo_cliente` (5a)", {
  sid <- .ec_sesion()
  out <- .ec_endpoint(mount_graficos, "/api/graficos/config", NULL, sid, verbo = "GET")
  expect_identical(out$defaults$estilo_cliente$letra$paso, "estandar")
  expect_identical(out$defaults$estilo_cliente$ambito, "proyecto")
  expect_identical(out$config$estilo_cliente$ambito, "proyecto")
  json <- as.character(jsonlite::toJSON(out$defaults$estilo_cliente, auto_unbox = TRUE))
  expect_match(json, '"logos":{}', fixed = TRUE)                                  # objeto, no arreglo
})

# --- (13) worker con estilo_cliente = list(); el router lo pasa sólo si no está vacío ------------------------------------
test_that("(13) /word no pasa estilo_cliente sin estilo y sí con logo propio, ya resuelto a ruta", {
  expect_identical(formals(graficos_job_worker_word)$estilo_cliente, quote(list()))
  sid <- .ec_sesion()
  cap <- new.env()
  .ec_endpoint(mount_graficos, "/api/graficos/word", list(plan = .ec_plan()), sid, captura = cap)
  expect_false("estilo_cliente" %in% names(cap$args))
  logo <- .ec_logo(sid)
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(logos = list(portada_izquierda = list(file_id = logo$file_id, nombre = "UNSA")),
                                                                         letra = list(paso = "grande"))))
  .ec_endpoint(mount_graficos, "/api/graficos/word", list(plan = .ec_plan()), sid, captura = cap)
  est <- cap$args$estilo_cliente
  expect_identical(est$logos$portada_izquierda, normalizePath(session_get(sid)$files[[logo$file_id]]$path, winslash = "/"))
  expect_equal(est$letra$ppt[["cifra"]], 2)
  expect_null(est$logos$contraportada)                                            # sin propio, el del recetario
  # Un logo cuyo archivo se perdió degrada al del recetario, con aviso, sin abortar.
  unlink(session_get(sid)$files[[logo$file_id]]$path)
  .ec_endpoint(mount_graficos, "/api/graficos/word", list(plan = .ec_plan()), sid, captura = cap)
  expect_null(cap$args$estilo_cliente$logos)
  expect_match(cap$args$estilo_cliente$avisos, "«UNSA».*el Word usa el de PUCP")
})

test_that("el worker de Word aplica los logos y la letra K13 y los repone al salir", {
  cap <- new.env()
  testthat::local_mocked_bindings(
    .graficos_job_rebuild_slides = function(...) list(),
    reporte_word_plan = function(..., opciones_documento = list()) {
      cap$op <- opciones_documento; cap$cifra <- .std_pt("cifra"); cap$word <- .std_word("tipografia", "grafico_cifra")
      invisible(NULL)
    },
    .package = "prosecnurapp")
  est <- list(logos = list(contraportada = "/x/logo.png"), letra = .graficos_estilo_cliente_desplazos(list(paso = "muy_grande")),
              avisos = "Aviso de prueba del estilo.")
  msgs <- testthat::capture_messages(graficos_job_worker_word(
    rp_data_path = "no", rp_inst_path = "no", plan = list(slides = list()), presets = list(), w_presets = list(), paletas = list(),
    slide_registry = list(), graficador_registry = character(), icon_registry = list(), active_base = "", result_path = tempfile(),
    estilo_cliente = est))
  expect_identical(cap$op$logos$contraportada, "/x/logo.png")
  expect_equal(cap$cifra, .std_valor("ppt", "tipografia", "cifra") + 4)
  expect_equal(cap$word, .std_valor("word", "tipografia", "grafico_cifra") + 4)
  expect_true(any(grepl("[PULSO-AVISO] Aviso de prueba del estilo.", msgs, fixed = TRUE)))
  expect_null(getOption("prosecnur.letra_desplazo"))                              # repuesto
  expect_equal(.std_pt("cifra"), .std_valor("ppt", "tipografia", "cifra"))
})

test_that("K13: el paso global desplaza toda la jerarquía, el rol afinado manda y el Word no baja del piso", {
  d <- .graficos_estilo_cliente_desplazos(list(paso = "grande", roles = list(base = "estandar", cifras = "muy_grande")))
  expect_equal(d$ppt[["titulo"]], 2); expect_equal(d$ppt[["cifra"]], 4); expect_false("base" %in% names(d$ppt))
  expect_equal(d$word[["grafico_cifra"]], 4); expect_false("base" %in% names(d$word))
  withr::local_options(prosecnur.letra_desplazo = list(ppt = c(titulo = 2), word = c(grafico_leyenda = -5)))
  expect_equal(.std_pt("titulo"), .std_valor("ppt", "tipografia", "titulo") + 2)
  expect_equal(.std_word("tipografia", "grafico_leyenda"), .std_valor("word", "tipografia", "grafico_minimo"))
  expect_identical(.std_word("tipografia", "fuente"), "Arial")
})

test_that("el Word del recetario pone el logo propio en la portada y la contraportada (contrato estructural del docx)", {
  skip_if_not_installed("officer"); skip_if_not_installed("flextable")
  logo <- tempfile(fileext = ".png"); writeBin(jsonlite::base64_dec(.ec_png_b64), logo)
  sha <- function(f) digest::digest(file = f, algo = "sha256")
  media <- function(docx) {
    d <- tempfile(); utils::unzip(docx, exdir = d)
    vapply(list.files(file.path(d, "word", "media"), full.names = TRUE), sha, "")
  }
  rm <- list(list(kind = "title_doc", title = "Informe de prueba"))
  propio <- tempfile(fileext = ".docx"); recetario <- tempfile(fileext = ".docx")
  suppressMessages(.word_documento(rm, propio, opciones = list(logos = list(portada_derecha = logo, contraportada = logo))))
  suppressMessages(.word_documento(rm, recetario))
  expect_true(sha(logo) %in% media(propio))
  expect_false(sha(logo) %in% media(recetario))
  expect_true(sha(.word_logo("pucp")) %in% media(propio))                          # el lugar sin propio sigue al recetario
  expect_false(sha(.word_logo("pulso")) %in% media(propio))
})

# --- (14) huella de miniaturas ---------------------------------------------------------------------------------------------
test_that("(14) la huella de una lámina cambia con la letra y con el logo, y no cambia sin estilo", {
  ctx <- list(slide = list(id = "s1"), scope = "active_base", base = "", bases = character(), huella_fuentes = list(),
              huella_estandar = list(), version_paquete = "x")
  h0 <- .mini_hash_lamina(ctx)
  expect_identical(as.character(.mini_hash_lamina(c(ctx, list(estilo_cliente = list())))), as.character(h0))
  h_letra <- .mini_hash_lamina(c(ctx, list(estilo_cliente = list(letra = .graficos_estilo_cliente_desplazos(list(paso = "grande"))))))
  expect_false(identical(as.character(h_letra), as.character(h0)))
  a <- tempfile(fileext = ".png"); writeBin(jsonlite::base64_dec(.ec_png_b64), a)
  b <- tempfile(fileext = ".png"); writeBin(c(jsonlite::base64_dec(.ec_png_b64), as.raw(0)), b)
  h_a <- .mini_hash_lamina(c(ctx, list(estilo_cliente = list(logos = list(contraportada = a)))))
  h_b <- .mini_hash_lamina(c(ctx, list(estilo_cliente = list(logos = list(contraportada = b)))))
  expect_false(identical(as.character(h_a), as.character(h_b)))
  expect_false(identical(attr(h_a, "grupos")[["d"]], attr(h0, "grupos")[["d"]]))
  expect_identical(attr(h_a, "grupos")[["a"]], attr(h0, "grupos")[["a"]])
})

# --- (15) el paquete compartible embebe los logos ----------------------------------------------------------------------
test_that("(15) compartir el plan embebe los logos del cliente y al importarlo se remapean a archivos de la sesión destino", {
  skip_if_not_installed("zip")
  sid <- .ec_sesion()
  logo <- .ec_logo(sid)
  .graficos_config_set(sid, list(plan = .ec_plan(), estilo_cliente = list(logos = list(contraportada = list(file_id = logo$file_id, nombre = "UNSA")))))
  testthat::local_mocked_bindings(.graficos_share_source_vars = function(sid) list(), .package = "prosecnurapp")
  meta <- .graficos_share_write_package(sid, .graficos_config_get(sid))
  d <- tempfile(); utils::unzip(meta$path, exdir = d)
  manifest <- jsonlite::fromJSON(file.path(d, "manifest.json"), simplifyVector = FALSE)
  asset <- Filter(function(a) identical(a$kind, "graficos_logo"), manifest$assets)
  expect_length(asset, 1L)
  expect_identical(digest::digest(file = file.path(d, asset[[1]]$path), algo = "sha256"), logo$sha256)
  cfg <- jsonlite::fromJSON(file.path(d, "config.json"), simplifyVector = FALSE)$config
  expect_identical(cfg$estilo_cliente$logos$contraportada$file_id, logo$file_id)
  expect_null(cfg$estilo_cliente$logos$contraportada$path)
  destino <- .ec_sesion()
  meta_dest <- .register_output_file(destino, "graficos_share", meta$path)
  mat <- .graficos_share_materialize_assets(destino, meta_dest)
  nuevo <- mat$remap[[logo$file_id]]
  expect_true(is.character(nuevo) && nzchar(nuevo) && !identical(nuevo, logo$file_id))
  expect_true(file.exists(session_get(destino)$files[[nuevo]]$path))
  remapeada <- .graficos_share_apply_asset_remap(mat$config, mat$remap)
  expect_identical(remapeada$estilo_cliente$logos$contraportada$file_id, nuevo)
})

# --- (16) subida de logos: sólo PNG, registrada; 403 en modo público ----------------------------------------------------
test_that("(16) POST /api/graficos/estilo/logos registra un PNG, rechaza lo que no es PNG y en modo público responde 403", {
  skip_if_not_installed("plumber")
  sid <- .ec_sesion()
  out <- .ec_endpoint(mount_graficos_estilo, "/api/graficos/estilo/logos", list(nombre = "Logo UNSA", data_base64 = .ec_png_b64, lugar = "contraportada"), sid)
  meta <- session_get(sid)$files[[out$file_id]]
  expect_identical(meta$kind, "graficos_logo")
  expect_identical(meta$original_name, "logo_logo_unsa.png")
  expect_true(file.exists(meta$path))
  expect_identical(out$sha256, digest::digest(file = meta$path, algo = "sha256"))
  expect_identical(c(out$ancho_px, out$alto_px), c(1, 1))
  for (body in list(list(nombre = "x", data_base64 = jsonlite::base64_enc(charToRaw("GIF89a no es png"))),
                    list(nombre = "x", data_base64 = .ec_png_b64, lugar = "lomo"), list(data_base64 = .ec_png_b64))) {
    e <- .ec_fallo(.ec_endpoint(mount_graficos_estilo, "/api/graficos/estilo/logos", body, sid))
    expect_identical(e$code, "E_BAD_LOGO")
    expect_identical(as.integer(e$status), 400L)
  }
  # El mount está registrado en la app y la ruta NO está en la whitelist pública: con PULSO_PUBLIC_MODE, 403.
  expect_true(any(grepl("mount_graficos_estilo", deparse(body(build_plumber_app)), fixed = TRUE)))
  withr::local_envvar(PULSO_PUBLIC_MODE = "1")
  pr <- apply_public_mode_filter(mount_graficos_estilo(plumber::pr()))
  cuerpo <- charToRaw(as.character(jsonlite::toJSON(list(nombre = "x", data_base64 = .ec_png_b64), auto_unbox = TRUE)))
  entrada <- list(read = function(...) cuerpo, rewind = function() invisible(0), read_lines = function(...) rawToChar(cuerpo))
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/graficos/estilo/logos", QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada))
  r <- pr$call(req)
  expect_identical(as.integer(r$status), 403L)
  expect_match(as.character(r$body), "E_FORBIDDEN_PUBLIC", fixed = TRUE)
  n_logos <- sum(vapply(session_get(sid)$files, function(m) identical(m$kind, "graficos_logo"), TRUE))
  expect_identical(n_logos, 1L)                                                    # nada se registró en modo público
})
