source("setup-load-all.R")

# D5 (Gonzalo, 2026-10-14: «Llevarlos también al PPT ahora») — el estilo del cliente llega al PowerPoint como al Word:
# los logos propios reemplazan a los de la plantilla estándar en la portada y la contraportada nativas
# (lamina_logos_cliente.R) y el paso de letra desplaza los tokens `ppt.tipografia` de cada rol, con la portada leyendo
# tokens (`portada_*`) y las cifras con piso de 8 pt. El entregable es el mismo: mismo registro de artefacto.

.ecp_png_b64 <- paste0("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwACh",
                       "wGA60e6kgAAAABJRU5ErkJggg==")
.ecp_png <- function() { p <- tempfile(fileext = ".png"); writeBin(jsonlite::base64_dec(.ecp_png_b64), p); p }
.ecp_sesion <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  sid
}
.ecp_logo <- function(sid, nombre = "UNSA") .graficos_estilo_cliente_subir_logo(sid, list(nombre = nombre, data_base64 = .ecp_png_b64))
.ecp_df <- function() data.frame(p = rep(c("a", "b"), 10))
.ecp_inst <- function() list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
                             choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
.ecp_plan <- function() list(slides = list(
  list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "Estudio de opinión", subtitulo = "Informe consolidado",
                                                           fecha = "Octubre de 2026", subtexto = "Por encargo de la Facultad")),
  list(id = "s2", tipo = "p_slide_cierre", payload = list())))

.ecp_endpoint <- function(mount, path, body, sid, captura = new.env(), extra = list()) {
  mocks <- c(list(
    session_header = function(req) sid,
    .require_rp_data = function(sid) list(),
    .graficos_processing_sources = function(sid) list(data_sources = list(principal = .ecp_df()), inst_sources = list(principal = .ecp_inst())),
    job_save_rds = function(sid, name, obj) { p <- tempfile(fileext = ".rds"); saveRDS(obj, p); captura$rds[[name]] <- obj; p },
    .graficos_icon_registry = function(...) list(),
    .graficos_active_base_name = function(sid) "",
    .graficos_export_filename = function(...) "x",
    job_submit = function(sid, kind, func, args, ..., on_complete = NULL) {
      captura$func <- func; captura$args <- args; captura$on_complete <- on_complete; "job-ecp"
    }
  ), extra)
  do.call(testthat::local_mocked_bindings, c(mocks, list(.package = "prosecnurapp")))
  pr <- mount(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, path) && "POST" %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv())
  if (!is.null(body)) req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  ep$getFunc()(req, res)
}

.ecp_slides <- function(pptx) {
  d <- tempfile(); utils::unzip(pptx, exdir = d)
  n <- length(list.files(file.path(d, "ppt", "slides"), pattern = "^slide[0-9]+\\.xml$"))
  list(dir = d, xml = lapply(seq_len(n), function(k) xml2::read_xml(file.path(d, "ppt", "slides", sprintf("slide%d.xml", k)))))
}
.ecp_nombres <- function(x) xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
.ecp_sz <- function(x, nombre) {
  as.numeric(xml2::xml_attr(xml2::xml_find_first(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]//a:rPr", nombre)), "sz")) / 100
}
# Hash del PNG que referencia la imagen `nombre` de la lámina k (por su relación r:embed).
.ecp_media_sha <- function(sl, k, nombre) {
  pic <- xml2::xml_find_first(sl$xml[[k]], sprintf("//p:pic[p:nvPicPr/p:cNvPr[@name='%s']]", nombre))
  if (inherits(pic, "xml_missing")) return(NA_character_)
  rid <- xml2::xml_attr(xml2::xml_find_first(pic, ".//a:blip"), "embed")
  rels <- xml2::read_xml(file.path(sl$dir, "ppt", "slides", "_rels", sprintf("slide%d.xml.rels", k)))
  rel <- xml2::xml_find_first(rels, sprintf("//*[local-name()='Relationship'][@Id='%s']", rid))
  digest::digest(file = normalizePath(file.path(sl$dir, "ppt", "slides", xml2::xml_attr(rel, "Target"))), algo = "sha256")
}
.ecp_mazo <- function(plan) {
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .ecp_df(), instrumento = .ecp_inst(), plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  out
}

# --- router -----------------------------------------------------------------------------------------------------------
test_that("/ppt pasa el estilo del cliente sólo si hay, ya resuelto a rutas, con el aviso del PowerPoint", {
  skip_if_not_installed("plumber")
  expect_identical(formals(graficos_job_worker_ppt)$estilo_cliente, quote(list()))
  sid <- .ecp_sesion(); cap <- new.env()
  .ecp_endpoint(mount_graficos, "/api/graficos/ppt", list(plan = .ecp_plan()), sid, captura = cap)
  expect_false("estilo_cliente" %in% names(cap$args))                              # un worker instalado viejo sigue andando
  logo <- .ecp_logo(sid)
  .graficos_config_set(sid, list(plan = .ecp_plan(), estilo_cliente = list(
    logos = list(portada_izquierda = list(file_id = logo$file_id, nombre = "UNSA")), letra = list(paso = "grande"))))
  .ecp_endpoint(mount_graficos, "/api/graficos/ppt", list(plan = .ecp_plan()), sid, captura = cap)
  est <- cap$args$estilo_cliente
  expect_identical(est$logos$portada_izquierda, normalizePath(session_get(sid)$files[[logo$file_id]]$path, winslash = "/"))
  expect_equal(est$letra$ppt[["portada_titulo"]], 2)
  unlink(session_get(sid)$files[[logo$file_id]]$path)
  .ecp_endpoint(mount_graficos, "/api/graficos/ppt", list(plan = .ecp_plan()), sid, captura = cap)
  expect_null(cap$args$estilo_cliente$logos)
  expect_match(cap$args$estilo_cliente$avisos, "«UNSA».*el PowerPoint usa el de la plantilla")
})

test_that("/ppt/all lleva a cada base SU estilo del cliente (el del ámbito de esa base)", {
  skip_if_not_installed("plumber")
  sid <- .ecp_sesion(); cap <- new.env()
  logo <- .ecp_logo(sid)
  cfg_de <- function(sid, base, s = NULL) {
    cfg <- list(plan = .ecp_plan(), presets = list(), paletas = list())
    if (identical(base, "docentes")) cfg$estilo_cliente <- list(logos = list(contraportada = list(file_id = logo$file_id, nombre = "UNSA")))
    cfg
  }
  .ecp_endpoint(mount_graficos, "/api/graficos/ppt-all", list(), sid, captura = cap, extra = list(
    .graficos_sesion_con_migracion = function(sid) list(),
    estudio_is_independent_siblings = function(sid) TRUE,
    estudio_data_sources = function(sid) list(docentes = .ecp_df(), estudiantes = .ecp_df()),
    estudio_inst_sources = function(sid) list(docentes = .ecp_inst(), estudiantes = .ecp_inst()),
    .graficos_effective_config_for_base = cfg_de,
    .export_filename = function(...) "x.pptx"))
  pb <- cap$rds$graficos_ppt_all_per_base
  expect_identical(pb$docentes$estilo_cliente$logos$contraportada, normalizePath(session_get(sid)$files[[logo$file_id]]$path, winslash = "/"))
  expect_null(pb$estudiantes$estilo_cliente)
})

# --- worker -----------------------------------------------------------------------------------------------------------
test_that("el worker del PPT aplica la letra (+2 en el rol con paso «grande») y los logos durante el render y los repone", {
  cap <- new.env()
  testthat::local_mocked_bindings(
    .graficos_job_rebuild_slides = function(...) list(),
    reporte_ppt_plan = function(...) {
      cap$titulo <- .std_pt("titulo"); cap$portada <- .std_pt("portada_titulo"); cap$cifra <- .std_pt("cifra")
      cap$base <- .std_pt("base"); cap$logos <- getOption("prosecnur.logos_cliente"); invisible(NULL)
    },
    .graficos_laminas_entregadas = function(...) 0L,
    graficos_avisos_ponderacion_mazo = function(...) character(0),
    .package = "prosecnurapp")
  est <- list(logos = list(portada_derecha = "/x/logo.png"),
              letra = .graficos_estilo_cliente_desplazos(list(paso = "estandar", roles = list(titulos = "grande"))),
              avisos = "Aviso de prueba del estilo.")
  rds <- tempfile(fileext = ".rds"); saveRDS(data.frame(), rds)
  llamar <- function(estilo, template = NULL) testthat::capture_messages(graficos_job_worker_ppt(
    rp_data_path = rds, rp_inst_path = "no", plan = list(slides = list()), presets = list(), paletas = list(),
    slide_registry = list(), graficador_registry = character(), icon_registry = list(), active_base = "",
    template_pptx = template, template_id = NULL, auto_otros_slides = FALSE, result_path = tempfile(), estilo_cliente = estilo))
  msgs <- llamar(est)
  expect_equal(cap$titulo, .std_valor("ppt", "tipografia", "titulo") + 2)
  expect_equal(cap$portada, .std_valor("ppt", "tipografia", "portada_titulo") + 2)
  expect_equal(cap$cifra, .std_valor("ppt", "tipografia", "cifra"))                # otro rol, sin paso
  expect_equal(cap$base, .std_valor("ppt", "tipografia", "base"))
  expect_identical(cap$logos$portada_derecha, "/x/logo.png")
  expect_true(any(grepl("[PULSO-AVISO] Aviso de prueba del estilo.", msgs, fixed = TRUE)))
  expect_null(getOption("prosecnur.letra_desplazo")); expect_null(getOption("prosecnur.logos_cliente"))   # repuestas
  # Plantilla de cliente: su portada es suya; los logos no se inyectan y se avisa la causa.
  msgs <- llamar(est, template = file.path(tempdir(), "plantilla_acnur.pptx"))
  expect_null(cap$logos)
  expect_true(any(grepl("La plantilla «plantilla_acnur» trae su propia portada: los logos propios no se ponen en ella.", msgs, fixed = TRUE)))
  expect_equal(cap$portada, .std_valor("ppt", "tipografia", "portada_titulo") + 2)  # la letra sí aplica al resto del mazo
})

test_that("las cifras del PPT no bajan de 8 pt tras el desplazamiento; los demás roles no tienen ese piso", {
  withr::local_options(prosecnur.letra_desplazo = list(ppt = c(cifra = -10, cifra_destacada = -40, cifra_fuera = 2, titulo = -20)))
  expect_equal(.std_pt("cifra"), .std_valor("ppt", "tipografia", "cifra_minimo"))
  expect_equal(.std_pt("cifra"), 8)
  expect_equal(.std_pt("cifra_destacada"), 8)
  expect_equal(.std_pt("cifra_fuera"), .std_valor("ppt", "tipografia", "cifra_fuera") + 2)
  expect_equal(.std_pt("titulo"), .std_valor("ppt", "tipografia", "titulo") - 20)
  expect_false("cifra_minimo" %in% unlist(lapply(.ESTILO_CLIENTE_ROLES, `[[`, "ppt")))   # un piso no se desplaza
  expect_true(all(grepl("^portada_", setdiff(.ESTILO_CLIENTE_ROLES$titulos$ppt, c("titulo", "antetitulo")))))
})

# --- render real: portada y contraportada ---------------------------------------------------------------------------
test_that("sin estilo la portada nativa queda idéntica: los tokens dan los mismos pt de siempre en las tres variantes", {
  skip_if_not_installed("officer")
  pp <- function(v) p_slide_portada("Estudio de opinión", "Informe consolidado", fecha = "Octubre de 2026", subtexto = "Por encargo", meta = list(variante = v))
  sl <- .ecp_slides(.ecp_mazo(list(a = pp("centrada"), b = pp("izquierda"), c = pp("banda"))))
  esperado <- list(c(13, 30, 18, 18), c(13, 30, 16, 14), c(13, 30, 15, 13))
  for (k in 1:3) {
    got <- vapply(c("portada:rotulo", "portada:titulo", "portada:encargo", "portada:fecha"), function(n) .ecp_sz(sl$xml[[k]], n), 0)
    expect_equal(unname(got), esperado[[k]], info = k)
    expect_false(any(grepl("^logo_cliente", .ecp_nombres(sl$xml[[k]]))), info = k)
  }
})

test_that("con estilo la portada lleva el logo propio en su lugar (tapando el de la plantilla) y la letra +2; el cierre, el suyo", {
  skip_if_not_installed("officer")
  logo <- .ecp_png()
  withr::local_options(prosecnur.logos_cliente = list(portada_izquierda = logo, contraportada = logo),
                       prosecnur.letra_desplazo = .graficos_estilo_cliente_desplazos(list(paso = "grande"))[c("ppt", "word")])
  .lam_logos_cliente_reiniciar()
  out <- .ecp_mazo(list(a = p_slide_portada("Estudio de opinión", "Informe consolidado", fecha = "Octubre de 2026", subtexto = "Por encargo"),
                        b = p_slide_cierre()))
  sl <- .ecp_slides(out)
  portada <- sl$xml[[1]]; cierre <- sl$xml[[length(sl$xml)]]
  sha_logo <- digest::digest(file = logo, algo = "sha256")
  expect_identical(.ecp_media_sha(sl, 1, "logo_cliente:portada_izquierda"), sha_logo)
  expect_true("logo_cliente:tapa:portada_izquierda" %in% .ecp_nombres(portada))
  expect_false(any(c("logo_cliente:portada_derecha", "logo_cliente:tapa:portada_derecha") %in% .ecp_nombres(portada)))   # sin propio, el de la plantilla
  expect_identical(.ecp_media_sha(sl, length(sl$xml), "logo_cliente:contraportada"), sha_logo)
  expect_true("logo_cliente:tapa:contraportada" %in% .ecp_nombres(cierre))
  # Contain: un PNG cuadrado en la caja de 2.88 x 1.26 in queda de 1.26 x 1.26, centrado.
  caja <- .LAM_LOGOS_CLIENTE_CAJAS$portada_izquierda
  xf <- xml2::xml_find_first(portada, "//p:pic[p:nvPicPr/p:cNvPr[@name='logo_cliente:portada_izquierda']]/p:spPr/a:xfrm")
  ext <- as.numeric(xml2::xml_attr(xml2::xml_find_first(xf, "a:ext"), c("cx"))) / 914400
  off <- as.numeric(xml2::xml_attr(xml2::xml_find_first(xf, "a:off"), "x")) / 914400
  expect_equal(ext, caja[4], tolerance = 0.01)
  expect_equal(off, caja[1] + (caja[3] - caja[4]) / 2, tolerance = 0.01)
  # La letra: el título de la portada a 30 + 2 y el rótulo a 13 + 2.
  expect_equal(.ecp_sz(portada, "portada:titulo"), 32)
  expect_equal(.ecp_sz(portada, "portada:rotulo"), 15)
  expect_setequal(.lam_logos_cliente_puestos(), c("portada_izquierda", "contraportada"))
})

test_that("las cajas de los logos son las de la plantilla estándar (si la plantilla cambia, hay que volver a medir)", {
  plantilla <- system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")
  skip_if(!nzchar(plantilla))
  d <- tempfile(); utils::unzip(plantilla, exdir = d)
  pick <- function(f, a) as.numeric(xml2::xml_attr(f, a))
  layout_pics <- function(layout) {
    x <- xml2::read_xml(file.path(d, "ppt", "slideLayouts", layout))
    lapply(xml2::xml_find_all(x, "//p:pic/p:spPr/a:xfrm"), function(f) round(c(
      pick(xml2::xml_find_first(f, "a:off"), "x"), pick(xml2::xml_find_first(f, "a:off"), "y"),
      pick(xml2::xml_find_first(f, "a:ext"), "cx"), pick(xml2::xml_find_first(f, "a:ext"), "cy")) / 914400, 3))
  }
  portada <- layout_pics("slideLayout1.xml"); contra <- layout_pics("slideLayout14.xml")
  r <- function(v) round(v, 3)
  expect_true(list(r(.LAM_LOGOS_CLIENTE_CAJAS$portada_izquierda)) %in% portada)
  expect_true(list(r(.LAM_LOGOS_CLIENTE_CAJAS$portada_derecha)) %in% portada)
  expect_true(list(r(.LAM_LOGOS_CLIENTE_CAJAS$contraportada)) %in% contra)
})

# --- de punta a punta: router → worker → registro del artefacto ------------------------------------------------------
test_that("el PPT con estilo del cliente se registra igual que sin él (mismo kind, MIME y file_id) y lleva el logo propio", {
  skip_if_not_installed("plumber"); skip_if_not_installed("officer")
  sid <- .ecp_sesion()
  logo <- .ecp_logo(sid)
  correr <- function(con_estilo) {
    cap <- new.env()
    .graficos_config_set(sid, c(list(plan = .ecp_plan()), if (con_estilo) list(estilo_cliente = list(
      logos = list(portada_derecha = list(file_id = logo$file_id, nombre = "UNSA")), letra = list(paso = "grande")))))
    .ecp_endpoint(mount_graficos, "/api/graficos/ppt", list(plan = .ecp_plan()), sid, captura = cap)
    out <- tempfile(fileext = ".pptx")
    res <- suppressWarnings(suppressMessages(do.call(cap$func, c(cap$args, list(result_path = out)))))
    testthat::local_mocked_bindings(.graficos_avisos_job = function(...) character(0), .package = "prosecnurapp")
    meta <- cap$on_complete(list(sid = sid, id = "job-ecp", result_path = out, result_data = res))
    list(out = out, meta = meta, args = cap$args)
  }
  sin <- correr(FALSE); con <- correr(TRUE)
  expect_true("estilo_cliente" %in% names(con$args)); expect_false("estilo_cliente" %in% names(sin$args))
  for (r in list(sin, con)) {
    expect_true(isTRUE(r$meta$ok)); expect_true(nzchar(r$meta$file_id %||% ""))
    reg <- session_get(sid)$files[[r$meta$file_id]]
    expect_identical(reg$kind, sin_kind <- session_get(sid)$files[[sin$meta$file_id]]$kind)
    expect_identical(reg$mime %||% "", session_get(sid)$files[[sin$meta$file_id]]$mime %||% "")
    expect_identical(tools::file_ext(r$meta$filename), "pptx")
  }
  expect_identical(sort(names(con$meta)), sort(names(sin$meta)))                    # el registro del job no cambia
  expect_identical(session_get(sid)$files[[con$meta$file_id]]$kind, "reporte_ppt")
  sl <- .ecp_slides(con$out)
  expect_identical(.ecp_media_sha(sl, 1, "logo_cliente:portada_derecha"), logo$sha256)
  expect_equal(.ecp_sz(sl$xml[[1]], "portada:titulo"), 32)
  expect_true(is.na(.ecp_media_sha(.ecp_slides(sin$out), 1, "logo_cliente:portada_derecha")))
  expect_equal(.ecp_sz(.ecp_slides(sin$out)$xml[[1]], "portada:titulo"), 30)
  expect_null(getOption("prosecnur.logos_cliente"))
})
